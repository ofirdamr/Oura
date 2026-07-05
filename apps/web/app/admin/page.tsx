"use client";

// De-mocked photographer dashboard. Previously showed a hardcoded
// RECENT_EVENTS array (fake names like "חתונה, משפחת לוי") to every logged-in
// photographer regardless of whose account it was, plus fabricated stat
// tiles and a fake "AI processing active" panel with invented progress bars
// and photo counts. All of that is replaced with real Supabase data scoped
// to the current photographer (RLS already enforces this - see
// supabase/migrations/0001_init.sql). The "ביקורי אורחים השבוע" (weekly guest
// visits) tile and the AI-processing / "נסה עכשיו" tip panel are removed
// entirely rather than replaced with fake or "coming soon" placeholders,
// since we have no guest-visit tracking or live AI-processing telemetry yet.

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
  live: "באוויר",
  draft: "טיוטה",
  archived: "בארכיון",
};

const STATUS_TEXT_CLASSES: Record<EventStatus, string> = {
  live: "text-success",
  draft: "text-on-surface-variant/60",
  archived: "text-on-surface-variant/40",
};

const STATUS_DOT_CLASSES: Record<EventStatus, string> = {
  live: "bg-success",
  draft: "",
  archived: "",
};

const RECENT_EVENTS_LIMIT = 5;

// gallery_theme is a real column (migration 0001) - using it to pick an icon
// is a real derived property, not a fabricated per-event category.
function themeIcon(theme: string): string {
  return theme === "minimal" ? "photo_camera" : "celebration";
}

export default function AdminDashboardPage() {
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
        // No event_id filter needed - RLS already scopes `photos` reads to
        // events owned by the logged-in photographer.
        supabase.from("photos").select("event_id, bytes"),
      ]);

      if (cancelled) return;

      if (eventsResult.error || !eventsResult.data) {
        setError("לא הצלחנו לטעון את האירועים. נסו לרענן את הדף.");
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
  const allEvents = events ?? [];
  const recentEvents = allEvents.slice(0, RECENT_EVENTS_LIMIT);
  const totalPhotos = Object.values(photoStats).reduce(
    (sum, stat) => sum + stat.count,
    0,
  );
  const liveEvents = allEvents.filter(
    (event) => event.status === "live",
  ).length;

  return (
    <AdminShell active="לוח בקרה">
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col rounded-3xl border border-primary/10 bg-surface-container p-6 shadow-[0_0_20px_rgba(255,138,117,0.08)]">
          <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
            סה&quot;כ תמונות באחסון
          </span>
          <div className="mt-2 flex items-end gap-3">
            <span className="text-4xl font-bold text-primary">
              {loading ? "…" : totalPhotos.toLocaleString("he-IL")}
            </span>
          </div>
        </div>
        <div className="flex flex-col rounded-3xl border border-primary/10 bg-surface-container p-6">
          <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
            אירועים פעילים
          </span>
          <div className="mt-2 flex items-end gap-3">
            <span className="text-4xl font-bold text-on-surface">
              {loading ? "…" : liveEvents}
            </span>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-row-reverse items-center justify-between">
          <h2 className="text-xl font-bold">אירועים אחרונים</h2>
          <Link
            href="/admin/events"
            className="text-sm font-bold text-primary hover:underline"
          >
            צפה בכל האירועים
          </Link>
        </div>

        {error && (
          <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-center text-sm text-error">
            {error}
          </p>
        )}

        {loading && (
          <div className="flex items-center justify-center rounded-2xl border border-primary/10 bg-surface-container py-16">
            <span className="material-symbols-outlined animate-spin text-2xl text-primary">
              sync
            </span>
          </div>
        )}

        {!loading && recentEvents.length === 0 && !error && (
          <div className="flex flex-col items-center rounded-2xl border border-primary/10 bg-surface-container px-6 py-16 text-center">
            <p className="text-on-surface-variant">עדיין אין לך אירועים.</p>
            <Link
              href="/admin/create-event"
              className="mt-4 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:brightness-110"
            >
              צור אירוע חדש
            </Link>
          </div>
        )}

        {!loading && recentEvents.length > 0 && (
          <div className="space-y-3">
            {recentEvents.map((event) => {
              const stats = photoStats[event.id];
              return (
                <Link
                  key={event.id}
                  href={`/admin/events/${event.id}`}
                  className="flex flex-row-reverse items-center justify-between rounded-2xl border border-primary/10 bg-surface-container p-4 transition-colors hover:bg-surface-container-high"
                >
                  <div className="flex flex-row-reverse items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-highest">
                      <span className="material-symbols-outlined text-on-surface-variant/40">
                        {themeIcon(event.gallery_theme)}
                      </span>
                    </div>
                    <div className="text-start">
                      <h4 className="font-bold text-on-surface">
                        {event.name}
                      </h4>
                      <p className="mt-0.5 text-xs text-on-surface-variant/60">
                        {new Date(event.created_at).toLocaleDateString(
                          "he-IL",
                        )}
                        {" · "}
                        {(stats?.count ?? 0).toLocaleString("he-IL")} תמונות
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold uppercase text-on-surface-variant/60">
                      סטטוס
                    </span>
                    <span
                      className={`flex items-center gap-1 text-xs font-bold ${STATUS_TEXT_CLASSES[event.status]}`}
                    >
                      {STATUS_DOT_CLASSES[event.status] && (
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASSES[event.status]}`}
                        />
                      )}
                      {STATUS_LABEL[event.status]}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
