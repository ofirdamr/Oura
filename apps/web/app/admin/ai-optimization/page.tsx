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
// pipeline is doing, not a manual control surface. The desktop screen.png also
// renders a literal debug filename ("_Final_Production_AI_Optimization_Desktop")
// as an on-page heading - a leftover artifact, not real copy, not ported.

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";

const QUEUE_ITEMS = [
  { status: "done" as const },
  { status: "done" as const },
  { status: "done" as const },
  { status: "scanning" as const, progress: 74 },
];

const ACCURACY_METRICS = [
  { label: "דיוק זיהוי פנים", value: "99.98%", barPct: 100, tone: "success" as const },
  { label: "שחזור פרטים בחושך", value: "94.2%", barPct: 94, tone: "primary" as const },
  { label: "יעילות קודק פלטינום", value: "1:24", barPct: 20, tone: "neutral" as const },
];

const ERROR_LOG = [
  {
    time: "לפני 12 דקות",
    tag: "CRITICAL",
    tone: "error" as const,
    text: "כפילות זיהוי במצלמה 3. נדרשת בדיקת מפעיל ידנית.",
  },
  {
    time: "לפני 45 דקות",
    tag: "SYSTEM UPDATE",
    tone: "neutral" as const,
    text: "מודל זיהוי פנים עודכן לגרסה 4.2.1 לשיפור ביצועי פרופיל.",
  },
];

export default function AiOptimizationPage() {
  const [comparePct, setComparePct] = useState(50);

  return (
    <AdminShell active="הגדרות">
      <div className="flex flex-row-reverse items-start justify-between gap-4">
        <div className="text-end">
          <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            פעיל אוטומטית
          </span>
          <h1 className="text-3xl font-bold text-on-surface">
            עיבוד תמונה אוטומטי
          </h1>
          <p className="mt-1 max-w-xl text-sm text-on-surface-variant">
            מערכת עיבוד תמונה מבוססת AI בזמן אמת עבור סטודיו Photo Santos. כל
            התמונות עוברות אופטימיזציה אוטומטית עם העלאתן, ללא צורך בפעולה
            ידנית.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-5">
            <div className="mb-3 flex flex-row-reverse items-center justify-between">
              <h2 className="text-sm font-bold text-on-surface">
                תור עיבוד חי
              </h2>
              <span className="text-xs text-on-surface-variant">
                ממתינים לעיבוד: 42 תמונות
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {QUEUE_ITEMS.map((item, i) => (
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
                  ) : (
                    <div className="absolute inset-x-0 bottom-0 bg-black/70 px-1.5 py-1 text-center">
                      <span
                        className="text-[10px] font-bold text-primary"
                        style={{ unicodeBidi: "isolate" }}
                      >
                        {item.progress}%
                      </span>
                      <div className="mt-0.5 h-0.5 w-full overflow-hidden rounded-full bg-white/20">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
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
                <span className="absolute start-3 top-3 rounded-full bg-primary/90 px-3 py-1 text-xs font-bold text-on-primary">
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
                <span className="absolute end-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white">
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
            <h2 className="mb-3 flex items-center gap-1.5 text-end text-sm font-bold text-on-surface">
              <span className="material-symbols-outlined text-base">insights</span>
              מדדי דיוק
            </h2>
            <div className="space-y-4">
              {ACCURACY_METRICS.map((metric) => (
                <div key={metric.label}>
                  <div className="mb-1 flex flex-row-reverse items-baseline justify-between">
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
            <div className="mt-4 flex flex-row-reverse items-center gap-3 rounded-xl bg-success/5 p-3">
              <span className="material-symbols-outlined text-success">
                verified
              </span>
              <div className="text-end">
                <p className="text-sm font-bold text-success">
                  אימות VIP מאושר
                </p>
                <p className="text-xs text-on-surface-variant">
                  38 אנשי מפתח זוהו אוטומטית
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-end text-sm font-bold text-on-surface">
              <span className="material-symbols-outlined text-base">warning</span>
              סיכום התראות מערכת
            </h2>
            <div className="space-y-3">
              {ERROR_LOG.map((entry, i) => (
                <div
                  key={i}
                  className={`rounded-xl border-s-4 p-3 text-end ${
                    entry.tone === "error"
                      ? "border-error bg-error/5"
                      : "border-outline-variant bg-surface-container-high"
                  }`}
                >
                  <div className="flex flex-row-reverse items-center justify-between">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide ${
                        entry.tone === "error" ? "text-error" : "text-on-surface-variant"
                      }`}
                    >
                      {entry.tag}
                    </span>
                    <span className="text-[10px] text-on-surface-variant">
                      {entry.time}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-on-surface">{entry.text}</p>
                </div>
              ))}
            </div>
            <button className="mt-3 w-full text-center text-xs font-medium text-primary underline underline-offset-4">
              צפייה בכל הדיווחים
            </button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
