"use client";

import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";

const STATS = [
  { label: 'סה"כ תמונות שהועלו', value: "14,208", sub: "+12% החודש", tone: "primary-fixed-dim" },
  { label: "צפיות בגלריות", value: "8.5k", icon: "trending_up", tone: "tertiary-fixed-dim" },
  { label: "אירועים פעילים", value: "24", sub: "/ 50", tone: "primary-fixed" },
  { label: "תמונות שסוננו", value: "42", icon: "filter_alt", tone: "error" },
];

const REPORTS = [
  { reporter: "מיכל כהן", status: "חדש" },
  { reporter: "אלון לוי", status: "חדש" },
  { reporter: "שירה ברק", status: "חדש" },
];

export default function ReportsPage() {
  return (
    <AdminShell active="ניתוח נתונים">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="text-start">
          <h1 className="text-3xl font-bold text-on-surface font-sans">
            דוחות הפקה וביקורת
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant font-sans">
            סקירת תמונות שדווחו, סטטיסטיקות העלאה וסינון AI
          </p>
        </div>
        <button className="rounded-xl bg-primary px-6 py-2 text-sm font-bold text-on-primary transition-opacity hover:opacity-90 active:opacity-80">
          ייצוא דוח
        </button>
      </div>

      {/* Stats bento grid */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-8">
        <div className="col-span-2 rounded-3xl border border-white/5 bg-surface-container-high p-6 shadow-2xl">
          <span className="text-xs text-on-surface-variant font-sans">
            {STATS[0].label}
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-primary-fixed-dim font-sans">
              {STATS[0].value}
            </span>
            <span className="text-sm font-medium text-tertiary font-sans">
              {STATS[0].sub}
            </span>
          </div>
        </div>
        <div className="rounded-3xl border border-white/5 bg-surface-container-high p-6 shadow-2xl">
          <span className="text-xs text-on-surface-variant font-sans">
            {STATS[1].label}
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-tertiary-fixed-dim font-sans">
              {STATS[1].value}
            </span>
            <span className="material-symbols-outlined text-sm text-tertiary-fixed">
              trending_up
            </span>
          </div>
        </div>
        <div className="rounded-3xl border border-white/5 bg-surface-container-high p-6 shadow-2xl">
          <span className="text-xs text-on-surface-variant font-sans">
            {STATS[2].label}
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-primary-fixed font-sans">
              {STATS[2].value}
            </span>
            <span className="text-sm text-on-surface-variant font-sans">
              {STATS[2].sub}
            </span>
          </div>
        </div>
      </section>

      {/* AI filter summary */}
      <section className="mb-8 rounded-3xl border border-white/5 bg-surface-container-high p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-tertiary-fixed-dim">
            <span className="material-symbols-outlined">filter_alt</span>
            <h3 className="text-lg font-bold text-on-surface font-sans">
              סינון AI אוטומטי
            </h3>
          </div>
          <span className="rounded-full bg-error/20 px-3 py-1 text-xs font-medium text-error">
            42 תמונות הוסתרו
          </span>
        </div>
        <p className="mb-6 text-sm text-on-surface-variant text-start font-sans">
          ה-AI זיהה תמונות מטושטשות, עיניים עצומות או כפילויות באיכות נמוכה.
        </p>
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/5 bg-surface-container-highest p-4">
            <div className="mb-1 text-xs text-on-surface-variant font-sans">
              מטושטשות
            </div>
            <div className="text-xl font-bold text-on-surface font-sans">28</div>
          </div>
          <div className="rounded-xl border border-white/5 bg-surface-container-highest p-4">
            <div className="mb-1 text-xs text-on-surface-variant font-sans">
              עיניים עצומות
            </div>
            <div className="text-xl font-bold text-on-surface font-sans">14</div>
          </div>
        </div>
        <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-tertiary py-3 text-sm font-bold text-on-tertiary transition-all hover:brightness-110">
          <span className="material-symbols-outlined">visibility</span>
          סקירת תמונות שסוננו
        </button>
      </section>

      {/* Reports section */}
      <section className="rounded-3xl border border-white/5 bg-surface-container-high p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <span className="material-symbols-outlined">report_problem</span>
            <h3 className="text-lg font-bold text-on-surface font-sans">
              דוחות הפקה וביקורת
            </h3>
          </div>
          <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-medium text-primary">
            3 דיווחים חדשים
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {REPORTS.map((r, i) => (
            <div
              key={i}
              className="flex items-start gap-4 rounded-2xl border border-white/5 bg-surface-container-highest p-3"
            >
              {/* Placeholder image */}
              <div className="h-20 w-20 flex-shrink-0 rounded-lg bg-surface-container flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-on-surface-variant/30">
                  image
                </span>
              </div>
              <div className="flex flex-1 flex-col justify-between gap-3">
                <div className="text-start">
                  <div className="text-xs text-on-surface-variant font-sans">
                    דווח על ידי:
                  </div>
                  <div className="font-medium text-on-surface font-sans">
                    {r.reporter}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 rounded-lg bg-primary py-1.5 text-xs font-medium text-on-primary transition-all hover:brightness-110">
                    אשר הסרה
                  </button>
                  <button className="flex-1 rounded-lg border border-white/20 py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:bg-white/5">
                    דחה
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Link
          href="/admin/events"
          className="mt-4 block text-center text-xs font-medium text-primary underline underline-offset-4"
        >
          צפייה בכל הדיווחים
        </Link>
      </section>
    </AdminShell>
  );
}
