"use client";

// Photographer-facing single-Event management screen: this is where photos
// actually get into an event. Closes the gap between event-creation
// (create-event -> branding -> qr-management) and the guest gallery, which
// until now had no ingest path from the browser at all - the only working
// route was a direct POST to the Worker (apps/api's
// `POST /events/:event_id/photos`, already deployed, multipart/form-data with
// a single `file` field, Authorization: Bearer <supabase access token>,
// requireEventOwner-gated).
//
// Visual pattern is deliberately reused wholesale from the branding
// dropzone (founder-approved shortcut for this screen - no fresh Stitch
// design), and the photo-grid rendering pattern is reused from
// app/gallery/page.tsx (next/image against the Worker's GET /media/:key R2
// route, same next.config.ts remotePatterns host).
//
// Reads (event header + photo list) go straight through the Supabase browser
// client per CLAUDE.md's read-path convention already used in
// branding/qr-management (RLS already scopes both to the owning
// photographer). Writes that touch R2 (upload, delete) go through the Worker
// instead - never expose R2 credentials to the browser, and a direct
// Supabase-only delete couldn't remove the R2 object anyway.

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { API_BASE_URL, deletePhoto, uploadEventPhoto } from "@/lib/api";

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
};

type UploadStatus = "uploading" | "done" | "failed";

type UploadItem = {
  key: string;
  name: string;
  status: UploadStatus;
  errorMessage?: string;
};

export default function EventManagementPage() {
  const params = useParams<{ event_id: string }>();
  const eventId = params.event_id;

  const [eventRow, setEventRow] = useState<EventRow | null>(null);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [uploadBannerError, setUploadBannerError] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPhotos = useCallback(async (id: string) => {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("photos")
      .select("id, storage_key, status, created_at")
      .eq("event_id", id)
      .order("created_at", { ascending: false });

    if (error || !data) {
      return null;
    }
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
    const files = Array.from(fileList);

    setUploadBannerError(null);

    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setUploadBannerError("יש להתחבר מחדש כדי להעלות תמונות.");
      return;
    }

    // Sequential uploads: simplest correct option for MVP scale, and it keeps
    // the per-file status list trivially consistent (no interleaved
    // read-modify-write races on `uploads` state from parallel completions).
    for (const file of files) {
      const key = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`;
      setUploads((prev) => [...prev, { key, name: file.name, status: "uploading" }]);

      const result = await uploadEventPhoto(eventId, file, session.access_token);

      if (!result.ok) {
        setUploads((prev) =>
          prev.map((u) =>
            u.key === key ? { ...u, status: "failed", errorMessage: "ההעלאה נכשלה" } : u,
          ),
        );
        continue;
      }

      setUploads((prev) => prev.map((u) => (u.key === key ? { ...u, status: "done" } : u)));

      // Optimistically append rather than re-fetching the whole list on every
      // file - cheaper, and the upload response already has everything a grid
      // tile needs (id, storage_key). Falls back to a full re-fetch below only
      // if this optimistic row shape ever needs the freshest `status`.
      setPhotos((prev) => [
        { id: result.data.id, storage_key: result.data.storage_key, status: "ready", created_at: new Date().toISOString() },
        ...prev,
      ]);
    }
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

  if (!eventId) {
    return null;
  }

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
      {uploadBannerError && (
        <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-center text-sm text-error">
          {uploadBannerError}
        </p>
      )}

      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-5">
        <h2 className="mb-3 flex items-center gap-1.5 text-start text-sm font-bold text-on-surface">
          <span className="material-symbols-outlined text-base">add_photo_alternate</span>
          העלאת תמונות
        </h2>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFilesSelected(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-outline-variant/50 p-8 text-center transition-colors hover:border-primary/50"
        >
          <span className="material-symbols-outlined text-3xl text-on-surface-variant/50">
            add_photo_alternate
          </span>
          <p className="text-sm font-medium text-on-surface">לחצו להעלאת תמונות</p>
          <p className="text-xs text-on-surface-variant">ניתן לבחור מספר תמונות בו-זמנית</p>
        </button>

        {uploads.length > 0 && (
          <ul className="mt-4 space-y-2">
            {uploads.map((u) => (
              <li
                key={u.key}
                className="flex flex-row-reverse items-center justify-between gap-3 rounded-xl bg-surface-container-high px-4 py-2.5 text-start"
              >
                <span className="truncate text-sm text-on-surface" dir="ltr">
                  {u.name}
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold">
                  {u.status === "uploading" && (
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
