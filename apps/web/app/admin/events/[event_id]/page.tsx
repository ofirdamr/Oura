"use client";

// Photographer-facing single-Event management screen.
// Sprint 1 upgrade: supports drag-and-drop loose JPEGs *and* Lightroom .zip
// archives (extracted client-side via JSZip — the raw zip never hits the server).
// Uploads run through ResilientUploadManager (4 parallel connections, 3 retries,
// exponential backoff).  A "Sync High-Res Originals" Stage 2 button surfaces
// below the photo grid for photos where is_original_uploaded = false.
//
// Reads (event header + photo list) go straight through the Supabase browser
// client per CLAUDE.md's read-path convention (RLS scopes to owning photographer).
// Writes (upload, delete) go through the Worker — never expose R2 credentials
// to the browser, and a direct Supabase delete can't remove the R2 object.

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { API_BASE_URL, deletePhoto, uploadEventPhoto } from "@/lib/api";
import { extractZipLocally, ResilientUploadManager } from "@/lib/upload";
import type { UploadItemState } from "@/lib/upload";

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

export default function EventManagementPage() {
  const params = useParams<{ event_id: string }>();
  const eventId = params.event_id;

  const [eventRow, setEventRow] = useState<EventRow | null>(null);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Upload queue state — driven by ResilientUploadManager callbacks
  const [uploadItems, setUploadItems] = useState<UploadItemState[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState<string | null>(null);
  const [uploadBannerError, setUploadBannerError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // Stage 2 sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    return () => {
      cancelled = true;
    };
  }, [eventId, loadPhotos]);

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !eventId) return;

    setUploadBannerError(null);

    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setUploadBannerError("יש להתחבר מחדש כדי להעלות תמונות.");
      return;
    }

    const accessToken = session.access_token;
    const allFiles: File[] = [];

    // Separate ZIP files from direct images
    const zipFiles: File[] = [];
    const imageFiles: File[] = [];

    for (const f of Array.from(fileList)) {
      if (f.name.toLowerCase().endsWith(".zip") || f.type === "application/zip") {
        zipFiles.push(f);
      } else {
        imageFiles.push(f);
      }
    }

    // Extract ZIPs client-side
    if (zipFiles.length > 0) {
      setExtracting(true);
      try {
        for (const zip of zipFiles) {
          const extracted = await extractZipLocally(zip, (progress) => {
            setExtractProgress(
              `מחלץ מ-${zip.name}: ${progress.extracted}/${progress.total}`,
            );
          });
          allFiles.push(...extracted);
        }
      } catch {
        setUploadBannerError("שגיאה בחילוץ הקובץ. ודאו שהקובץ הוא ZIP תקין.");
        setExtracting(false);
        setExtractProgress(null);
        return;
      }
      setExtracting(false);
      setExtractProgress(null);
    }

    allFiles.push(...imageFiles);

    if (allFiles.length === 0) {
      setUploadBannerError("לא נמצאו תמונות להעלאה.");
      return;
    }

    const mgr = new ResilientUploadManager({
      concurrency: 4,
      maxRetries: 3,
      baseDelayMs: 1_000,
      uploadFn: async (file, signal) => {
        const result = await uploadEventPhoto(eventId, file, accessToken, signal);
        if (!result.ok) {
          return { ok: false, errorMessage: result.error ?? "ההעלאה נכשלה" };
        }
        // Append to photo grid optimistically
        const { id, storage_key } = result.data;
        setPhotos((prev) => [
          {
            id,
            storage_key,
            status: "ready",
            created_at: new Date().toISOString(),
            is_original_uploaded: false,
          },
          ...prev,
        ]);
        return { ok: true };
      },
      onItemStateChange: (item) => {
        setUploadItems((prev) => {
          const idx = prev.findIndex((i) => i.id === item.id);
          if (idx === -1) return [...prev, item];
          const next = [...prev];
          next[idx] = item;
          return next;
        });
      },
    });

    mgr.enqueue(allFiles);
    await mgr.drain();
  }

  async function handleDeletePhoto(photo: PhotoRow) {
    if (!eventId) return;
    if (!window.confirm("למחוק את התמונה? לא ניתן לשחזר לאחר המחיקה.")) return;

    setDeletingIds((prev) => new Set(prev).add(photo.id));

    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(photo.id);
        return next;
      });
      setUploadBannerError("יש להתחבר מחדש כדי למחוק תמונות.");
      return;
    }

    const result = await deletePhoto(eventId, photo.id, session.access_token);
    setDeletingIds((prev) => {
      const next = new Set(prev);
      next.delete(photo.id);
      return next;
    });

    if (!result.ok) {
      setUploadBannerError("מחיקת התמונה נכשלה. נסו שוב.");
      return;
    }

    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  }

  async function handleStage2Sync() {
    if (!eventId) return;

    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setSyncMessage("יש להתחבר מחדש.");
      return;
    }

    // Let the photographer pick the original-resolution files from disk.
    // We match by filename against photos where is_original_uploaded = false.
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,.zip";
    input.multiple = true;

    input.onchange = async () => {
      const fileList = input.files;
      if (!fileList || fileList.length === 0) return;

      setIsSyncing(true);
      setSyncMessage("מעלה קבצי מקור...");

      const accessToken = session.access_token;
      const pendingPhotos = photos.filter((p) => !p.is_original_uploaded);

      // Build a lookup: filename → photo row
      const pendingByName = new Map<string, PhotoRow>(pendingPhotos.map((p) => [extractBasename(p.storage_key), p]));

      const allFiles: File[] = [];

      for (const f of Array.from(fileList)) {
        if (f.name.toLowerCase().endsWith(".zip") || f.type === "application/zip") {
          try {
            const extracted = await extractZipLocally(f, (progress) => {
              setSyncMessage(`מחלץ ${progress.extracted}/${progress.total}...`);
            });
            allFiles.push(...extracted);
          } catch {
            // Skip bad zips, continue with rest
          }
        } else {
          allFiles.push(f);
        }
      }

      // Match files to pending photos by name
      const matchedFiles = allFiles.filter((f) => pendingByName.has(f.name));

      if (matchedFiles.length === 0) {
        setSyncMessage("לא נמצאו קבצים תואמים לתמונות שממתינות לסנכרון.");
        setIsSyncing(false);
        return;
      }

      let synced = 0;

      const mgr = new ResilientUploadManager({
        concurrency: 3,
        maxRetries: 3,
        baseDelayMs: 1_000,
        uploadFn: async (file: File, signal: AbortSignal) => {
          const photo = pendingByName.get(file.name);
          if (!photo) return { ok: false, errorMessage: "לא נמצא רשומה תואמת" };

          const res = await fetch(
            `${API_BASE_URL}/events/${encodeURIComponent(eventId)}/photos/${photo.id}/original`,
            {
              method: "PUT",
              headers: { Authorization: `Bearer ${accessToken}` },
              body: file,
              signal,
            },
          );

          if (!res.ok) return { ok: false, errorMessage: `http_${res.status}` };

          synced++;
          setSyncMessage(`סנכרן ${synced}/${matchedFiles.length} קבצים...`);

          // Update local state
          setPhotos((prev) =>
            prev.map((p) =>
              p.id === photo.id ? { ...p, is_original_uploaded: true } : p,
            ),
          );
          return { ok: true };
        },
        onItemStateChange: () => {},
      });

      mgr.enqueue(matchedFiles);
      await mgr.drain();

      setSyncMessage(`סנכרון הושלם — ${synced} מתוך ${matchedFiles.length} קבצים הועלו.`);
      setIsSyncing(false);
    };

    input.click();
  }

  // Drag-and-drop handlers
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

  const pendingCount = photos.filter((p) => !p.is_original_uploaded).length;
  const activeUploads = uploadItems.filter((i) => i.status === "uploading" || i.status === "queued");
  const recentUploads = uploadItems.filter((i) => i.status === "done" || i.status === "failed");

  if (!eventId) return null;

  if (notFound) {
    return (
      <AdminShell active="אירועים פעילים">
        <div className="mx-auto max-w-md py-20 text-center">
          <p className="mb-4 text-on-surface-variant">
            האירוע המבוקש לא נמצא, או שאין לך הרשאה לצפות בו.
          </p>
          <Link
            href="/admin/events"
            className="font-bold text-primary underline underline-offset-4"
          >
            חזרה לרשימת האירועים
          </Link>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell active="אירועים פעילים">
      {/* Header */}
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

      {/* Banners */}
      {loadError && (
        <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-center text-sm text-error">
          {loadError}
        </p>
      )}
      {uploadBannerError && (
        <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-center text-sm text-error">
          {uploadBannerError}
        </p>
      )}

      {/* Upload dropzone */}
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
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-outline-variant/50 hover:border-primary/50"
          }`}
        >
          {extracting ? (
            <>
              <span className="material-symbols-outlined animate-spin text-3xl text-primary">
                progress_activity
              </span>
              <p className="text-sm font-medium text-on-surface">מייעל ומעלה נכסים בצורה בטוחה...</p>
              {extractProgress && (
                <p className="text-xs text-on-surface-variant">{extractProgress}</p>
              )}
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-3xl text-on-surface-variant/50">
                add_photo_alternate
              </span>
              <p className="text-sm font-medium text-on-surface">
                גררו תמונות או קובץ ZIP לכאן, או לחצו לבחירה
              </p>
              <p className="text-xs text-on-surface-variant">
                JPG, PNG, HEIC — או ארכיון Lightroom ZIP
              </p>
            </>
          )}
        </div>

        {/* Active uploads progress */}
        {(activeUploads.length > 0 || recentUploads.length > 0) && (
          <ul className="mt-4 space-y-2">
            {[...activeUploads, ...recentUploads.slice(0, 5)].map((u) => (
              <li
                key={u.id}
                className="flex flex-row-reverse items-center justify-between gap-3 rounded-xl bg-surface-container-high px-4 py-2.5 text-start"
              >
                <span className="truncate text-sm text-on-surface" dir="ltr">
                  {u.file.name}
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold">
                  {(u.status === "uploading" || u.status === "queued") && (
                    <span className="material-symbols-outlined animate-spin text-base text-on-surface-variant">
                      progress_activity
                    </span>
                  )}
                  {u.status === "done" && (
                    <span className="material-symbols-outlined text-base text-success">
                      check_circle
                    </span>
                  )}
                  {u.status === "failed" && (
                    <span
                      className="material-symbols-outlined text-base text-error"
                      title={u.errorMessage}
                    >
                      error
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Stage 2 Sync High-Res Originals */}
      {pendingCount > 0 && (
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="text-start">
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-on-surface">
                <span className="material-symbols-outlined text-base text-warning">
                  cloud_sync
                </span>
                סנכרון קבצי מקור ({pendingCount} תמונות ממתינות)
              </h2>
              <p className="mt-1 text-xs text-on-surface-variant">
                התמונות הועלו בפורמט מותאם לאירוע. לחצו להעלאת הקבצים המקוריים מהאולפן.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleStage2Sync()}
              disabled={isSyncing}
              className="shrink-0 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary transition-all hover:opacity-90 disabled:opacity-60"
            >
              {isSyncing ? "מסנכרן..." : "סנכרון High-Res"}
            </button>
          </div>
          {syncMessage && (
            <p className="mt-3 text-xs text-on-surface-variant">{syncMessage}</p>
          )}
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
                {/* Pending sync badge */}
                {!photo.is_original_uploaded && (
                  <div className="absolute start-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md">
                    מקור חסר
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

function extractBasename(storageKey: string): string {
  return storageKey.split("/").pop() ?? storageKey;
}
