"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { API_BASE_URL, deletePhoto, uploadEventPhoto, uploadPhotoOriginal } from "@/lib/api";

// Lazy imports to avoid SSR issues — both are browser-only
const getJSZip = () => import("jszip").then((m) => m.default);
type ImageCompressorFn = (file: File, opts: typeof COMPRESS_OPTIONS) => Promise<File>;
const getCompressor = (): Promise<ImageCompressorFn> =>
  import("browser-image-compression").then((m) => m.default as unknown as ImageCompressorFn);

const UPLOAD_CONCURRENCY = 5;
const COMPRESS_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 4000,
  useWebWorker: true,
  preserveExif: true,
};

type EventRow = {
  name: string;
  code: string;
  branding: Record<string, unknown> | null;
};

type PhotoRow = {
  id: string;
  storage_key: string;
  status: string;
  created_at: string;
  is_original_uploaded: boolean;
};

type BatchState =
  | { phase: "idle" }
  | { phase: "processing"; label: string; done: number; total: number }
  | { phase: "done"; uploaded: number; failed: number }
  | { phase: "error"; message: string };

async function extractImagesFromZip(zipFile: File): Promise<File[]> {
  const JSZip = await getJSZip();
  const zip = await JSZip.loadAsync(zipFile);
  const files: File[] = [];

  // Process entries sequentially to avoid OOM on massive archives
  for (const [relativePath, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (!/\.(jpe?g|png|webp|heic)$/i.test(relativePath)) continue;

    const blob = await entry.async("blob");
    const name = relativePath.split("/").pop() ?? relativePath;
    const mimeType = /\.png$/i.test(name) ? "image/png" : "image/jpeg";
    const typedBlob = blob as Blob & { type: string };
    files.push(new File([blob], name, { type: typedBlob.type || mimeType }));
  }

  return files;
}

async function compressImage(file: File): Promise<File> {
  try {
    const compress = await getCompressor();
    return await compress(file, COMPRESS_OPTIONS);
  } catch {
    return file;
  }
}

async function uploadWithRetry(
  eventId: string,
  file: File,
  accessToken: string,
): Promise<{ ok: boolean; id?: string; storage_key?: string }> {
  let delay = 2000;
  for (let attempt = 0; attempt <= 3; attempt++) {
    const result = await uploadEventPhoto(eventId, file, accessToken);
    if (result.ok) {
      return { ok: true, id: result.data.id, storage_key: result.data.storage_key };
    }
    if (attempt === 3) break;
    await new Promise((r) => setTimeout(r, delay));
    delay *= 2;
  }
  return { ok: false };
}

// Run tasks with bounded concurrency
async function runPool<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;

  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}

export default function EventManagementPage() {
  const params = useParams<{ event_id: string }>();
  const eventId = params.event_id;

  const [eventRow, setEventRow] = useState<EventRow | null>(null);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [batch, setBatch] = useState<BatchState>({ phase: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const originalFileInputRef = useRef<HTMLInputElement>(null);

  const loadPhotos = useCallback(async (id: string) => {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("photos")
      .select("id, storage_key, status, created_at, is_original_uploaded")
      .eq("event_id", id)
      .order("created_at", { ascending: false });

    if (error || !data) return null;
    return data as PhotoRow[];
  }, []);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;

    async function load(id: string) {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("events")
        .select("name, code, branding")
        .eq("id", id)
        .single();

      if (cancelled) return;

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setEventRow(data as EventRow);

      const photoRows = await loadPhotos(id);
      if (cancelled) return;

      if (photoRows === null) {
        setLoadError("לא הצלחנו לטעון את תמונות האירוע. נסו לרענן את הדף.");
      } else {
        setPhotos(photoRows);
      }
      setLoading(false);
    }

    void load(eventId);
    return () => { cancelled = true; };
  }, [eventId, loadPhotos]);

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !eventId) return;
    if (batch.phase === "processing") return; // guard double-submit

    const supabase = createSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      setBatch({ phase: "error", message: "יש להתחבר מחדש כדי להעלות תמונות." });
      return;
    }

    // --- Step 1: collect raw files (expand ZIPs) ---
    const rawFiles = Array.from(fileList);
    const imageFiles: File[] = [];

    setBatch({ phase: "processing", label: "מחלץ תמונות...", done: 0, total: rawFiles.length });

    let extractDone = 0;
    for (const f of rawFiles) {
      if (/\.zip$/i.test(f.name)) {
        const extracted = await extractImagesFromZip(f);
        imageFiles.push(...extracted);
      } else if (/\.(jpe?g|png|webp|heic)$/i.test(f.name) || f.type.startsWith("image/")) {
        imageFiles.push(f);
      }
      extractDone++;
      setBatch({ phase: "processing", label: "מחלץ תמונות...", done: extractDone, total: rawFiles.length });
    }

    if (imageFiles.length === 0) {
      setBatch({ phase: "error", message: "לא נמצאו תמונות להעלאה. ניתן להעלות JPEG, PNG או קבצי ZIP." });
      return;
    }

    // --- Step 2: compress + upload in parallel pool ---
    let uploadedCount = 0;
    let failedCount = 0;
    const total = imageFiles.length;
    setBatch({ phase: "processing", label: "מייעל ומעלה נכסים בצורה בטוחה...", done: 0, total });

    const tasks = imageFiles.map((file) => async () => {
      const compressed = await compressImage(file);
      const result = await uploadWithRetry(eventId, compressed, session.access_token);

      if (result.ok && result.id && result.storage_key) {
        uploadedCount++;
        setPhotos((prev) => [
          { id: result.id!, storage_key: result.storage_key!, status: "ready", created_at: new Date().toISOString(), is_original_uploaded: false },
          ...prev,
        ]);
      } else {
        failedCount++;
      }

      setBatch({
        phase: "processing",
        label: "מייעל ומעלה נכסים בצורה בטוחה...",
        done: uploadedCount + failedCount,
        total,
      });
    });

    await runPool(tasks, UPLOAD_CONCURRENCY);

    setBatch({ phase: "done", uploaded: uploadedCount, failed: failedCount });
  }

  async function handleDeletePhoto(photo: PhotoRow) {
    if (!eventId) return;
    if (!window.confirm("למחוק את התמונה? לא ניתן לשחזר לאחר המחיקה.")) return;

    setDeletingIds((prev) => new Set(prev).add(photo.id));

    const supabase = createSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(photo.id);
        return next;
      });
      setBatch({ phase: "error", message: "יש להתחבר מחדש כדי למחוק תמונות." });
      return;
    }

    const result = await deletePhoto(eventId, photo.id, session.access_token);

    setDeletingIds((prev) => {
      const next = new Set(prev);
      next.delete(photo.id);
      return next;
    });

    if (!result.ok) {
      setBatch({ phase: "error", message: "מחיקת התמונה נכשלה. נסו שוב." });
      return;
    }

    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  }

  async function handleSyncOriginal(photo: PhotoRow) {
    if (!eventId) return;

    setSyncingIds((prev) => new Set(prev).add(photo.id));

    const supabase = createSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(photo.id);
        return next;
      });
      setBatch({ phase: "error", message: "יש להתחבר מחדש כדי לסנכרן תמונות." });
      return;
    }

    // Prompt for original file
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      if (!input.files || input.files.length === 0) {
        setSyncingIds((prev) => {
          const next = new Set(prev);
          next.delete(photo.id);
          return next;
        });
        return;
      }

      const file = input.files[0];
      const result = await uploadPhotoOriginal(eventId, photo.id, file, session.access_token);

      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(photo.id);
        return next;
      });

      if (!result.ok) {
        setBatch({ phase: "error", message: `סנכרון התמונה ${photo.id.slice(0, 8)} נכשל.` });
        return;
      }

      setPhotos((prev) =>
        prev.map((p) => (p.id === photo.id ? { ...p, is_original_uploaded: true } : p)),
      );
    };
    input.click();
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    void handleFilesSelected(e.dataTransfer.files);
  }

  if (!eventId) return null;

  if (notFound) {
    return (
      <AdminShell active="אירועים פעילים">
        <div className="mx-auto max-w-md py-20 text-center">
          <p className="mb-4 text-on-surface-variant">
            האירוע המבוקש לא נמצא, או שאין לך הרשאה לצפות בו.
          </p>
          <Link href="/admin/events" className="font-bold text-primary underline underline-offset-4">
            חזרה לרשימת האירועים
          </Link>
        </div>
      </AdminShell>
    );
  }

  const isUploading = batch.phase === "processing";
  const progressPct =
    batch.phase === "processing" && batch.total > 0
      ? Math.round((batch.done / batch.total) * 100)
      : 0;

  return (
    <AdminShell active="אירועים פעילים">
      <div className="flex items-start justify-between gap-4">
        <div className="text-start">
          <h1 className="text-3xl font-bold text-on-surface">
            {loading ? "טוען..." : (eventRow?.name ?? "האירוע")}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-on-surface-variant">
            ניהול תמונות האירוע: העלאה, צפייה ומחיקה.
          </p>
        </div>
        <div className="flex shrink-0 flex-row-reverse gap-3">
          <Link
            href={`/admin/branding?event_id=${eventId}`}
            className="rounded-xl border border-outline-variant px-5 py-2.5 text-sm font-bold text-on-surface transition-all hover:bg-surface-container-highest"
          >
            מיתוג ולוגו
          </Link>
          <Link
            href={`/admin/qr-management?event_id=${eventId}`}
            className="rounded-xl border border-outline-variant px-5 py-2.5 text-sm font-bold text-on-surface transition-all hover:bg-surface-container-highest"
          >
            קוד QR וגישה
          </Link>
        </div>
      </div>

      {loadError && (
        <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-center text-sm text-error">
          {loadError}
        </p>
      )}

      {/* Upload zone */}
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-5">
        <h2 className="mb-3 flex items-center gap-1.5 text-start text-sm font-bold text-on-surface">
          <span className="material-symbols-outlined text-base">add_photo_alternate</span>
          העלאת תמונות
        </h2>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.zip"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFilesSelected(e.target.files);
            e.target.value = "";
          }}
        />

        {/* Drop zone — hidden while uploading */}
        {batch.phase !== "processing" && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            disabled={isUploading}
            className={[
              "flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-outline-variant/50 hover:border-primary/50",
            ].join(" ")}
          >
            <span className="material-symbols-outlined text-3xl text-on-surface-variant/50">
              {isDragging ? "file_download" : "add_photo_alternate"}
            </span>
            <p className="text-sm font-medium text-on-surface">
              {isDragging ? "שחרר להעלאה" : "גרור תמונות לכאן או לחץ להעלאה"}
            </p>
            <p className="text-xs text-on-surface-variant">
              JPEG, PNG — ניתן גם לגרור קובץ ZIP עם כל התמונות
            </p>
          </button>
        )}

        {/* Progress UI */}
        {batch.phase === "processing" && (
          <div className="space-y-3 rounded-xl bg-surface-container-high px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-on-surface">{batch.label}</span>
              <span className="text-xs tabular-nums text-on-surface-variant">
                {batch.done}/{batch.total}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Done banner */}
        {batch.phase === "done" && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-success/10 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-success">check_circle</span>
              <span className="text-sm font-medium text-on-surface">
                {batch.uploaded} תמונות הועלו בהצלחה
                {batch.failed > 0 && (
                  <span className="ms-2 text-error">({batch.failed} נכשלו)</span>
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setBatch({ phase: "idle" });
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-bold text-on-surface-variant hover:bg-surface-container-highest"
            >
              העלאה נוספת
            </button>
          </div>
        )}

        {/* Error banner */}
        {batch.phase === "error" && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-error/30 bg-error/10 px-5 py-3">
            <span className="text-sm text-error">{batch.message}</span>
            <button
              type="button"
              onClick={() => setBatch({ phase: "idle" })}
              className="rounded-lg px-3 py-1.5 text-xs font-bold text-error/80 hover:bg-error/10"
            >
              סגור
            </button>
          </div>
        )}
      </div>

      {/* Stage 2: Sync originals section */}
      {photos.some((p) => !p.is_original_uploaded) && (
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-5">
          <h2 className="mb-3 flex items-center gap-1.5 text-start text-sm font-bold text-on-surface">
            <span className="material-symbols-outlined text-base">cloud_upload</span>
            סנכרון תמונות ברזולוציה גבוהה (שלב 2)
          </h2>
          <p className="mb-4 text-xs text-on-surface-variant">
            התמונות להלן הועלו ברזולוציה אופטימלית לאירוע (שלב 1). כעת, חזרה לסטודיו, באפשרותך להעלות את הקבצים המקוריים בברזולוציה גבוהה להדפסה ותיבוע.
          </p>

          <div className="space-y-2">
            {photos
              .filter((p) => !p.is_original_uploaded)
              .map((photo) => (
                <div
                  key={photo.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-high px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-on-surface truncate">
                      ID: {photo.id.slice(0, 8)}...
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {new Date(photo.created_at).toLocaleString("he-IL")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSyncOriginal(photo)}
                    disabled={syncingIds.has(photo.id)}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary transition-all hover:bg-primary-container disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {syncingIds.has(photo.id) ? "progress_activity" : "upload"}
                    </span>
                    {syncingIds.has(photo.id) ? " עלייה..." : " העלה מקור"}
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Photo grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-on-surface-variant">
          תמונות האירוע ({photos.length})
        </h2>
        {photos.length === 0 ? (
          <p className="rounded-xl border border-outline-variant/20 bg-surface-container/60 p-6 text-center text-sm text-on-surface-variant">
            {loading ? "טוען תמונות..." : "טרם הועלו תמונות לאירוע הזה."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative aspect-square overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container shadow-md"
              >
                <Image
                  src={`${API_BASE_URL}/media/${photo.storage_key}`}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                  className="object-cover"
                />
                {/* Original sync indicator badge */}
                {!photo.is_original_uploaded && (
                  <div className="absolute start-2 top-2 rounded-full bg-warning/80 px-2 py-1 backdrop-blur-sm">
                    <span className="text-xs font-bold text-on-warning">שלב 1</span>
                  </div>
                )}
                {photo.is_original_uploaded && (
                  <div className="absolute start-2 top-2 rounded-full bg-success/80 px-2 py-1 backdrop-blur-sm">
                    <span className="text-xs font-bold text-on-success">סונכרן ✓</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleDeletePhoto(photo)}
                  disabled={deletingIds.has(photo.id)}
                  aria-label="מחיקת תמונה"
                  className="absolute end-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-md transition-all hover:bg-error disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-base">
                    {deletingIds.has(photo.id) ? "progress_activity" : "delete"}
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
