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

const STATUS_FILTERS: { key: EventStatus | "all"; label: string }[] = [
  { key: "all", label: "הכל" },
  { key: "live", label: "פעיל" },
  { key: "draft", label: "טיוטה" },
  { key: "archived", label: "בארכיון" },
];

function exportEventsCsv(rows: EventRow[], photoStats: Record<string, PhotoStats>) {
  const header = ["שם האירוע", "קוד", "נוצר בתאריך", "סטטוס", "תמונות"];
  const lines = rows.map((event) =>
    [
      event.name,
      event.code ?? "",
      formatDate(event.created_at),
      STATUS_LABEL[event.status],
      String(photoStats[event.id]?.count ?? 0),
    ]
      .map((field) => `"${field.replace(/"/g, '""')}"`)
      .join(","),
  );
  const csv = ["﻿" + header.join(","), ...lines].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "אירועים.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function EventsListPage() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [photoStats, setPhotoStats] = useState<Record<string, PhotoStats>>({});
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EventStatus | "all">("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [view, setView] = useState<"list" | "grid">("list");

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

  const filteredRows = rows.filter((event) => {
    if (statusFilter !== "all" && event.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchesName = event.name.toLowerCase().includes(q);
      const matchesCode = event.code?.toLowerCase().includes(q) ?? false;
      if (!matchesName && !matchesCode) return false;
    }
    return true;
  });

  return (
    <AdminShell active="אירועים פעילים">
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

      <div className="relative">
        <span className="material-symbols-outlined pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50">
          search
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש לפי שם או קוד..."
          className="h-12 w-full rounded-xl border border-outline-variant/30 bg-surface-container px-4 pe-11 text-sm text-on-surface outline-none transition-all placeholder:text-on-surface-variant/40 focus:border-primary/50"
        />
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-surface-container-high p-1">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-label="תצוגת רשת"
              aria-pressed={view === "grid"}
              className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${view === "grid" ? "bg-primary text-on-primary" : "text-on-surface-variant"}`}
            >
              <span className="material-symbols-outlined text-lg">grid_view</span>
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-label="תצוגת רשימה"
              aria-pressed={view === "list"}
              className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${view === "list" ? "bg-primary text-on-primary" : "text-on-surface-variant"}`}
            >
              <span className="material-symbols-outlined text-lg">view_list</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setFilterOpen((v) => !v)}
                className="flex items-center gap-2 rounded-xl border border-outline-variant/30 px-4 py-2.5 text-sm font-medium text-on-surface transition-colors hover:border-primary/30"
              >
                <span className="material-symbols-outlined text-lg">filter_list</span>
                סינון
              </button>
              {filterOpen && (
                <div className="absolute top-full z-20 mt-2 w-40 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-high shadow-2xl" style={{ insetInlineEnd: 0 }}>
                  {STATUS_FILTERS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => {
                        setStatusFilter(f.key);
                        setFilterOpen(false);
                      }}
                      className={`block w-full px-4 py-2.5 text-start text-sm transition-colors hover:bg-surface-container-highest ${
                        statusFilter === f.key ? "font-bold text-primary" : "text-on-surface"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => exportEventsCsv(filteredRows, photoStats)}
              className="flex items-center gap-2 rounded-xl border border-outline-variant/30 px-4 py-2.5 text-sm font-medium text-on-surface transition-colors hover:border-primary/30"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              ייצוא נתונים
            </button>
          </div>
        </div>
      )}

      {!loading && totalEvents > 0 && filteredRows.length === 0 && (
        <p className="rounded-lg border border-outline-variant/30 bg-surface-container px-4 py-6 text-center text-sm text-on-surface-variant">
          לא נמצאו אירועים התואמים את החיפוש/הסינון.
        </p>
      )}

      {!loading && filteredRows.length > 0 && view === "grid" && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRows.map((event) => {
            const stats = photoStats[event.id];
            return (
              <div
                key={event.id}
                className="rounded-2xl border border-outline-variant/30 bg-surface-container p-5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold ${STATUS_BADGE_CLASSES[event.status]}`}
                  >
                    {event.status === "live" && (
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                    )}
                    {STATUS_LABEL[event.status]}
                  </span>
                  <span className="text-xs text-on-surface-variant/60">
                    {formatDate(event.created_at)}
                  </span>
                </div>
                <p className="font-bold text-on-surface">{event.name}</p>
                {event.code && (
                  <p className="font-mono text-xs text-on-surface-variant/60" dir="ltr">
                    {event.code}
                  </p>
                )}
                <p className="mt-2 text-sm text-on-surface-variant">
                  {(stats?.count ?? 0).toLocaleString("he-IL")} תמונות
                </p>
                <div className="mt-4 flex items-center justify-center gap-2 border-t border-outline-variant/20 pt-4">
                  <Link
                    href={`/admin/branding?event_id=${event.id}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-container-high text-on-surface-variant transition-all hover:border-primary/30 hover:text-primary"
                    title="עריכת מיתוג"
                    aria-label="עריכת מיתוג"
                  >
                    <span className="material-symbols-outlined text-lg">edit</span>
                  </Link>
                  <Link
                    href={`/admin/qr-management?event_id=${event.id}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-container-high text-on-surface-variant transition-all hover:border-primary/30 hover:text-primary"
                    title="קוד QR"
                    aria-label="קוד QR"
                  >
                    <span className="material-symbols-outlined text-lg">qr_code</span>
                  </Link>
                  <Link
                    href={`/admin/events/${event.id}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-container-high text-on-surface-variant transition-all hover:border-primary/30 hover:text-primary"
                    title="ניהול תמונות"
                    aria-label="ניהול תמונות"
                  >
                    <span className="material-symbols-outlined text-lg">photo_library</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {!loading && filteredRows.length > 0 && view === "list" && (
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
                {filteredRows.map((event) => {
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
