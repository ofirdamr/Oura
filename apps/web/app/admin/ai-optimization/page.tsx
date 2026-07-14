"use client";

// Photographer-facing AI Optimization, ported from
// oura_final_production_ai_optimization_desktop_1/2 and _mobile.
//
// Scope note (deliberate, not an oversight): the source design is an elaborate
// "Platinum Core" control panel with manual model selection (Oura Vision
// Platinum v4.2 dropdown), a manual retouch-strength slider, and quality-tier
// radio buttons (Platinum Master / Standard Enhanced / Social Media Fast-Path).
// PRD.md's MVP feature list scopes this screen as "AI Optimization (auto-only)"
// - manual model/tier controls imply a non-automatic mode that's explicitly out
// of scope for MVP, so they were intentionally left out rather than ported.
// What's kept: the live auto-processing queue, accuracy metrics, and the
// before/after quality comparison, which all describe what the automatic
// pipeline is doing, not a manual control surface.

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getProcessingStatus, type ProcessingStatusResponse } from "@/lib/api";

type QueueItem = { status: "processing" | "done" | "pending" | "failed"; label: string };

function toQueueItems(recent: ProcessingStatusResponse["recent"]): QueueItem[] {
  const items = recent.slice(0, 8).map((p) => ({
    status: (["done", "processing", "pending", "failed"].includes(p.status)
      ? p.status
      : "pending") as QueueItem["status"],
    label: p.event_name,
  }));
  // Pad to at least 4 slots so the grid always looks populated
  while (items.length < 4) items.push({ status: "pending", label: "" });
  return items;
}

export default function AiOptimizationPage() {
  const [comparePct, setComparePct] = useState(50);
  const [data, setData] = useState<ProcessingStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    const res = await getProcessingStatus(session.access_token);
    if (res.ok) setData(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 10_000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const stats = data?.stats ?? { total: 0, done: 0, processing: 0, pending: 0, failed: 0 };
  const queueItems = data ? toQueueItems(data.recent) : Array(4).fill({ status: "pending", label: "" }) as QueueItem[];
  const processedPct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  const pendingCount = stats.pending + stats.processing;
  const faceEmbeddings = data?.face_embeddings ?? 0;

  const realMetrics = [
    {
      label: "תמונות עובדו",
      value: stats.total > 0 ? `${processedPct}%` : "—",
      barPct: processedPct,
      tone: processedPct >= 90 ? "success" : processedPct >= 50 ? "primary" : "neutral",
    },
    {
      label: "זיהויי פנים שנשמרו",
      value: faceEmbeddings > 0 ? faceEmbeddings.toLocaleString("he-IL") : "—",
      barPct: Math.min(100, Math.round((faceEmbeddings / Math.max(stats.done, 1)) * 10)),
      tone: "primary",
    },
    {
      label: "ממתינות לעיבוד",
      value: pendingCount > 0 ? String(pendingCount) : "0",
      barPct: stats.total > 0 ? Math.round((pendingCount / stats.total) * 100) : 0,
      tone: pendingCount > 0 ? "neutral" : "success",
    },
  ] as const;

  return (
    <AdminShell active="אופטימיזציית AI">
      <div className="flex items-start justify-between gap-4">
        <div className="text-start">
          <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            פעיל אוטומטית
          </span>
          <h1 className="text-3xl font-bold text-on-surface">
            עיבוד תמונה אוטומטי
          </h1>
          <p className="mt-1 max-w-xl text-sm text-on-surface-variant">
            מערכת זיהוי פנים וייעול תמונות מבוססת AI בזמן אמת. כל
            התמונות עוברות עיבוד אוטומטי עם העלאתן, ללא צורך בפעולה
            ידנית.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-on-surface">
                תור עיבוד חי
              </h2>
              <span className="text-xs text-on-surface-variant">
                {loading
                  ? "טוען..."
                  : pendingCount > 0
                    ? `ממתינות לעיבוד: ${pendingCount} תמונות`
                    : "כל התמונות עובדו"}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {queueItems.map((item, i) => (
                <div
                  key={i}
                  className="relative aspect-[3/4] overflow-hidden rounded-lg bg-surface-container-high"
                >
                  <div className="flex h-full w-full items-center justify-center">
                    <span className="material-symbols-outlined text-2xl text-on-surface-variant/30">
                      image
                    </span>
                  </div>
                  {item.status === "done" ? (
                    <div className="absolute end-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-success">
                      <span
                        className="material-symbols-outlined text-xs text-on-primary"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check
                      </span>
                    </div>
                  ) : item.status === "failed" ? (
                    <div className="absolute end-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-error">
                      <span
                        className="material-symbols-outlined text-xs text-white"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        close
                      </span>
                    </div>
                  ) : item.status === "processing" ? (
                    <div className="absolute inset-x-0 bottom-0 bg-black/70 px-1.5 py-1 text-center">
                      <span
                        className="text-[10px] font-bold text-primary"
                        style={{ unicodeBidi: "isolate" }}
                      >
                        מעבד...
                      </span>
                      <div className="mt-0.5 h-0.5 w-full overflow-hidden rounded-full bg-white/20">
                        <div className="h-full animate-pulse bg-primary" style={{ width: "60%" }} />
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-5">
            <h2 className="mb-1 text-sm font-bold text-on-surface">
              בדיקת איכות (לפני/אחרי)
            </h2>
            <p className="mb-3 text-xs text-on-surface-variant">
              הזז את הסליידר לצפייה בשיפור
            </p>
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-surface-container-highest">
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-container-high to-black">
                <span className="material-symbols-outlined text-5xl text-on-surface-variant/20">
                  image
                </span>
                <span className="absolute end-3 top-3 rounded-full bg-primary/90 px-3 py-1 text-xs font-bold text-on-primary">
                  OPTIMIZED
                </span>
              </div>
              <div
                className="absolute inset-y-0 start-0 flex items-center justify-center overflow-hidden bg-gradient-to-br from-surface-container-highest to-black/60"
                style={{ width: `${comparePct}%` }}
              >
                <span className="material-symbols-outlined text-5xl text-on-surface-variant/10">
                  image
                </span>
                <span className="absolute start-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white">
                  ORIGINAL
                </span>
              </div>
              <div
                className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-lg"
                style={{ insetInlineStart: `${comparePct}%` }}
              />
              <input
                type="range"
                min={0}
                max={100}
                value={comparePct}
                onChange={(e) => setComparePct(Number(e.target.value))}
                aria-label="השוואת לפני ואחרי"
                className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-start text-sm font-bold text-on-surface">
              <span className="material-symbols-outlined text-base">insights</span>
              מדדי עיבוד בזמן אמת
            </h2>
            <div className="space-y-4">
              {realMetrics.map((metric) => (
                <div key={metric.label}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-xs text-on-surface-variant">
                      {metric.label}
                    </span>
                    <span
                      className={`text-lg font-bold ${
                        metric.tone === "success"
                          ? "text-success"
                          : metric.tone === "primary"
                            ? "text-primary"
                            : "text-on-surface"
                      }`}
                      style={{ unicodeBidi: "isolate" }}
                    >
                      {metric.value}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
                    <div
                      className={`h-full rounded-full ${
                        metric.tone === "success"
                          ? "bg-success"
                          : metric.tone === "primary"
                            ? "bg-primary"
                            : "bg-on-surface-variant"
                      }`}
                      style={{ width: `${metric.barPct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {stats.done > 0 && (
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-success/5 p-3">
                <span className="material-symbols-outlined text-success">
                  verified
                </span>
                <div className="text-start">
                  <p className="text-sm font-bold text-success">
                    עיבוד פעיל
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {stats.done} תמונות עובדו, {faceEmbeddings} פנים זוהו
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-start text-sm font-bold text-on-surface">
              <span className="material-symbols-outlined text-base">summarize</span>
              סיכום מצב
            </h2>
            <div className="space-y-3">
              {stats.failed > 0 ? (
                <div className="rounded-xl border-s-4 border-error bg-error/5 p-3 text-start">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-error">
                      נכשל
                    </span>
                    <span className="text-[10px] text-on-surface-variant">
                      {stats.failed} תמונות
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-on-surface">
                    חלק מהתמונות לא עובדו. ניתן להפעיל מחדש את העיבוד מדף ניהול האירוע.
                  </p>
                </div>
              ) : null}
              <div className="rounded-xl border-s-4 border-outline-variant bg-surface-container-high p-3 text-start">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                    סטטוס מערכת
                  </span>
                  <span className="text-[10px] text-on-surface-variant">
                    {loading ? "מתחבר..." : "פעיל"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-on-surface">
                  מנוע זיהוי הפנים פעיל. תמונות חדשות יעובדו אוטומטית עם העלאתן.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
