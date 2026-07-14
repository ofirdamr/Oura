"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type EventStatus = "draft" | "live" | "archived";
type EmbedStatus = "pending" | "processing" | "done" | "failed";

type EventRow = {
  id: string;
  name: string;
  code: string | null;
  status: EventStatus;
  gallery_theme: string;
  created_at: string;
};

type PhotoRow = {
  event_id: string;
  bytes: number | null;
  embed_status: EmbedStatus | null;
};

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

function themeIcon(theme: string): string {
  return theme === "minimal" ? "photo_camera" : "celebration";
}

export default function AdminDashboardPage() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [weeklyGuests, setWeeklyGuests] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const weekAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    async function load() {
      const supabase = createSupabaseBrowserClient();

      const [eventsResult, photosResult, guestsResult] = await Promise.all([
        supabase
          .from("events")
          .select("id, name, code, status, gallery_theme, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("photos").select("event_id, bytes, embed_status"),
        supabase
          .from("guests")
          .select("*", { count: "exact", head: true })
          .gte("created_at", weekAgo),
      ]);

      if (cancelled) return;

      if (eventsResult.error || !eventsResult.data) {
        setError("לא הצלחנו לטעון את האירועים. נסו לרענן את הדף.");
        setEvents([]);
        return;
      }

      setEvents(eventsResult.data as EventRow[]);
      setPhotos(
        !photosResult.error && photosResult.data
          ? (photosResult.data as PhotoRow[])
          : [],
      );
      setWeeklyGuests(
        !guestsResult.error ? (guestsResult.count ?? 0) : 0,
      );
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = events === null;
  const allEvents = events ?? [];
  const recentEvents = allEvents.slice(0, RECENT_EVENTS_LIMIT);

  const totalPhotos = photos.length;
  const processedPhotos = photos.filter(
    (p) => p.embed_status === "done",
  ).length;
  const pendingPhotos = photos.filter(
    (p) => p.embed_status === "pending" || p.embed_status === "processing",
  ).length;
  const processPct =
    totalPhotos > 0 ? Math.round((processedPhotos / totalPhotos) * 100) : 0;

  const liveEvents = allEvents.filter((e) => e.status === "live").length;

  return (
    <AdminShell active="לוח בקרה">
      {/* 3 stat cards — design: dashboard_desktop_1/2/3 */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Card 1: weekly guest visits (physical left in RTL grid) */}
        <div className="flex flex-col rounded-3xl border border-primary/10 bg-surface-container p-6 shadow-[0_0_20px_rgba(255,138,117,0.08)]">
          <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
            ביקורי אורחים השבוע
          </span>
          <div className="mt-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-xl text-success">
              trending_up
            </span>
            <span className="text-4xl font-bold text-primary">
              {loading ? "…" : weeklyGuests.toLocaleString("he-IL")}
            </span>
          </div>
        </div>

        {/* Card 2: active events */}
        <div className="flex flex-col rounded-3xl border border-primary/10 bg-surface-container p-6">
          <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
            אירועים פעילים
          </span>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-4xl font-bold text-on-surface">
              {loading ? "…" : liveEvents}
            </span>
            {!loading && (
              <span className="mb-1 text-sm text-on-surface-variant/60">
                / {allEvents.length} סה&quot;כ
              </span>
            )}
          </div>
        </div>

        {/* Card 3: total photos (physical right in RTL grid) */}
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
      </section>

      {/* Bottom section: AI widget (physical left) + events list (physical right).
          Explicit grid-column placement so physical position is writing-mode-independent. */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* AI widget + tip card — physical left col (column 1 of 3) */}
        <aside className="space-y-4 lg:[grid-column:1/2] lg:[grid-row:1]">
          {/* AI processing widget — only shown when photos exist */}
          {!loading && totalPhotos > 0 && (
            <div className="rounded-3xl border border-primary/10 bg-surface-container p-5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  psychology
                </span>
                <h3 className="font-bold text-on-surface">עיבוד AI פעיל</h3>
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-on-surface-variant/60">
                      דיוק פנים
                    </span>
                    <span className="font-bold text-primary">{processPct}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${processPct}%` }}
                    />
                  </div>
                </div>
              </div>
              {pendingPhotos > 0 && (
                <p className="mt-3 text-xs text-on-surface-variant/50">
                  המערכת מעבדת כרגע{" "}
                  {pendingPhotos.toLocaleString("he-IL")} תמונות ברקע
                </p>
              )}
              {pendingPhotos === 0 && processedPhotos === totalPhotos && (
                <p className="mt-3 text-xs text-success">
                  כל התמונות עובדו בהצלחה
                </p>
              )}
              <Link
                href="/admin/ai-optimization"
                className="mt-4 block text-center text-xs font-bold text-primary hover:underline"
              >
                לפאנל AI המלא
              </Link>
            </div>
          )}

          {/* Tip card */}
          <div className="rounded-3xl border border-primary/10 bg-surface-container p-5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">
                tips_and_updates
              </span>
              <h3 className="font-bold text-on-surface">טיפ מקצועי</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
              שדרג את הגלריה שלך עם תכונת ה-&quot;Highlights&quot; החדשה.
              האלגוריתם ה-AI שלנו יבחר עבורך את 20 התמונות הטובות מהאירוע
              באופן אוטומטי.
            </p>
            <Link
              href="/admin/ai-optimization"
              className="mt-4 block w-full rounded-xl bg-primary/10 py-2.5 text-center text-sm font-bold text-primary transition-colors hover:bg-primary/20"
            >
              נסה עכשיו
            </Link>
          </div>
        </aside>

        {/* Events list — physical right cols (columns 2–3 of 3) */}
        <div className="space-y-4 lg:[grid-column:2/4] lg:[grid-row:1]">
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
                const photoCount = photos.filter(
                  (p) => p.event_id === event.id,
                ).length;
                return (
                  <Link
                    key={event.id}
                    href={`/admin/events/${event.id}`}
                    className="flex items-center justify-between rounded-2xl border border-primary/10 bg-surface-container p-4 transition-colors hover:bg-surface-container-high"
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
                          {photoCount.toLocaleString("he-IL")} תמונות
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
        </div>
      </section>
    </AdminShell>
  );
}
