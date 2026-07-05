"use client";

// Real photographer-facing event list, ported from
// design/screens/oura_final_production_event_list_desktop_1 (the cleanest of the
// three desktop variants - _2 and _3 are near-identical re-exports with only
// cosmetic token/copy tweaks, per this project's established Stitch-export
// pattern). The design's "location" and "כניסות" (guest visits) columns were
// dropped: `events` has no location column (see create-event/page.tsx) and we
// have no guest-visit tracking yet - showing either would mean fabricating
// numbers, which CLAUDE.md forbids. The "storage used" summary tile IS kept,
// unlike the design's other unimplemented tile ("צפיות השבוע" / weekly views,
// dropped for the same reason), because it's a real aggregate of photos.bytes.

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type EventStatus = "draft" | "live" | "archived";

type EventRow = {
  id: string;
  name: string;
  code: string | null;
  status: EventStatus;
  gallery_theme: string;
  created_at: string;
};

type PhotoStats = { count: number; bytes: number };

const STATUS_LABEL: Record<EventStatus, string> = {
  live: "פעיל",
  draft: "טיוטה",
  archived: "בארכיון",
};

const STATUS_BADGE_CLASSES: Record<EventStatus, string> = {
  live: "border-success/20 bg-success/10 text-success",
  draft:
    "border-outline-variant/30 bg-surface-container-highest text-on-surface-variant",
  archived:
    "border-outline-variant/20 bg-surface-container-highest text-on-surface-variant/60",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const decimals = unitIndex === 0 || value >= 10 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

export default function EventsListPage() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [photoStats, setPhotoStats] = useState<Record<string, PhotoStats>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createSupabaseBrowserClient();

      const [eventsResult, photosResult] = await Promise.all([
        supabase
          .from("events")
          .select("id, name, code, status, gallery_theme, created_at")
          .order("created_at", { ascending: false }),
        // No event_id filter needed - RLS (migration 0001) already scopes
        // `photos` reads to events owned by the logged-in photographer.
        supabase.from("photos").select("event_id, bytes"),
      ]);

      if (cancelled) return;

      if (eventsResult.error || !eventsResult.data) {
        setError("לא הצלחנו לטעון את רשימת האירועים. נסו לרענן את הדף.");
        setEvents([]);
        return;
      }

      const stats: Record<string, PhotoStats> = {};
      if (!photosResult.error && photosResult.data) {
        for (const row of photosResult.data as {
          event_id: string;
          bytes: number | null;
        }[]) {
          const entry = stats[row.event_id] ?? { count: 0, bytes: 0 };
          entry.count += 1;
          entry.bytes += row.bytes ?? 0;
          stats[row.event_id] = entry;
        }
      }

      setPhotoStats(stats);
      setEvents(eventsResult.data as EventRow[]);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = events === null;
  const rows = events ?? [];
  const totalEvents = rows.length;
  const liveEvents = rows.filter((event) => event.status === "live").length;
  const totalPhotos = Object.values(photoStats).reduce(
    (sum, stat) => sum + stat.count,
    0,
  );
  const totalBytes = Object.values(photoStats).reduce(
    (sum, stat) => sum + stat.bytes,
    0,
  );

  return (
    <AdminShell active="אירועים">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-on-surface">האירועים שלי</h1>
        <Link
          href="/admin/create-event"
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:brightness-110 active:scale-95"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          אירוע חדש
        </Link>
      </div>

      {error && (
        <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-center text-sm text-error">
          {error}
        </p>
      )}

      {!loading && totalEvents > 0 && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-row-reverse items-center justify-between rounded-2xl border border-primary/10 bg-surface-container p-5">
            <div className="text-start">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant/60">
                סה&quot;כ אירועים
              </p>
              <h3 className="text-2xl font-bold text-on-surface">
                {totalEvents}
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <span className="material-symbols-outlined">event</span>
            </div>
          </div>
          <div className="flex flex-row-reverse items-center justify-between rounded-2xl border border-primary/10 bg-surface-container p-5">
            <div className="text-start">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant/60">
                פעילים כעת
              </p>
              <h3 className="text-2xl font-bold text-success">{liveEvents}</h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10 text-success">
              <span className="material-symbols-outlined">sensors</span>
            </div>
          </div>
          <div className="flex flex-row-reverse items-center justify-between rounded-2xl border border-primary/10 bg-surface-container p-5">
            <div className="text-start">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant/60">
                תמונות (אחסון)
              </p>
              <h3 className="text-2xl font-bold text-on-surface">
                {totalPhotos.toLocaleString("he-IL")}
                <span className="ms-2 text-sm font-medium text-on-surface-variant/60">
                  {formatBytes(totalBytes)}
                </span>
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <span className="material-symbols-outlined">cloud</span>
            </div>
          </div>
        </section>
      )}

      {loading && (
        <div className="flex items-center justify-center rounded-3xl border border-primary/10 bg-surface-container py-24">
          <span className="material-symbols-outlined animate-spin text-3xl text-primary">
            sync
          </span>
        </div>
      )}

      {!loading && totalEvents === 0 && !error && (
        <div className="flex flex-col items-center rounded-3xl border border-primary/10 bg-surface-container px-6 py-24 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <span className="material-symbols-outlined text-3xl text-primary">
              celebration
            </span>
          </div>
          <h2 className="text-lg font-bold text-on-surface">
            עדיין אין לך אירועים
          </h2>
          <p className="mt-1 max-w-sm text-sm text-on-surface-variant">
            צרו את האירוע הראשון שלכם כדי להתחיל להעלות תמונות ולשתף גלריה עם
            האורחים.
          </p>
          <Link
            href="/admin/create-event"
            className="mt-6 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:brightness-110"
          >
            צור אירוע חדש
          </Link>
        </div>
      )}

      {!loading && totalEvents > 0 && (
        <section className="overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface-container shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-start">
              <thead>
                <tr className="border-b border-outline-variant/20 bg-surface-container-high/60">
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                    שם האירוע
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                    נוצר בתאריך
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                    תמונות
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                    סטטוס
                  </th>
                  <th className="px-6 py-4 text-center text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {rows.map((event) => {
                  const stats = photoStats[event.id];
                  return (
                    <tr
                      key={event.id}
                      className="transition-colors hover:bg-surface-container-highest/40"
                    >
                      <td className="px-6 py-4">
                        <div className="text-start">
                          <p className="font-bold text-on-surface">
                            {event.name}
                          </p>
                          {event.code && (
                            <p
                              className="font-mono text-xs text-on-surface-variant/60"
                              dir="ltr"
                            >
                              {event.code}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-on-surface-variant">
                        {formatDate(event.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-on-surface">
                        {(stats?.count ?? 0).toLocaleString("he-IL")}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold ${STATUS_BADGE_CLASSES[event.status]}`}
                        >
                          {event.status === "live" && (
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                          )}
                          {STATUS_LABEL[event.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/admin/branding?event_id=${event.id}`}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-container-high text-on-surface-variant transition-all hover:border-primary/30 hover:text-primary"
                            title="עריכת מיתוג"
                            aria-label="עריכת מיתוג"
                          >
                            <span className="material-symbols-outlined text-lg">
                              edit
                            </span>
                          </Link>
                          <Link
                            href={`/admin/qr-management?event_id=${event.id}`}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-container-high text-on-surface-variant transition-all hover:border-primary/30 hover:text-primary"
                            title="קוד QR"
                            aria-label="קוד QR"
                          >
                            <span className="material-symbols-outlined text-lg">
                              qr_code
                            </span>
                          </Link>
                          <Link
                            href={`/admin/events/${event.id}`}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-container-high text-on-surface-variant transition-all hover:border-primary/30 hover:text-primary"
                            title="ניהול תמונות"
                            aria-label="ניהול תמונות"
                          >
                            <span className="material-symbols-outlined text-lg">
                              photo_library
                            </span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AdminShell>
  );
}
