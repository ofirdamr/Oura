"use client";

import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";

const KPI_CARDS = [
  {
    icon: "event_available",
    label: "סה\"כ אירועים",
    value: "142",
    trend: "+12%",
    trendUp: true,
  },
  {
    icon: "auto_awesome",
    label: "תמונות שעובדו ב-AI",
    value: "45,203",
    trend: "+8%",
    trendUp: true,
  },
  {
    icon: "visibility",
    label: "צפיות אורחים",
    value: "12.5k",
    trend: "+24%",
    trendUp: true,
  },
  {
    icon: "download",
    label: "הורדות תמונות",
    value: "3,892",
    trend: "0%",
    trendUp: null,
  },
];

const BAR_DATA = [
  { day: "א'", viewPct: 40, dlPct: 20 },
  { day: "ב'", viewPct: 60, dlPct: 45 },
  { day: "ג'", viewPct: 55, dlPct: 30 },
  { day: "ד'", viewPct: 85, dlPct: 65 },
  { day: "ה'", viewPct: 70, dlPct: 50 },
  { day: "ו'", viewPct: 30, dlPct: 15 },
  { day: "ש'", viewPct: 20, dlPct: 10 },
];

const TOP_EVENTS = [
  { name: "חתונה של גל ורון", date: "12.06.2025", guests: 240, photos: 1842, downloads: 620 },
  { name: "בר מצווה של עידו", date: "05.06.2025", guests: 180, photos: 1200, downloads: 410 },
  { name: "השקת מוצר טסלה", date: "28.05.2025", guests: 320, photos: 980, downloads: 290 },
];

export default function StatisticsPage() {
  return (
    <AdminShell active="ניתוח נתונים">
      {/* Page Header */}
      <div className="mb-8 text-start">
        <h1 className="text-3xl font-bold text-on-surface mb-1">
          Oura Analytics Dashboard
        </h1>
        <p className="text-on-surface-variant text-sm">
          סקירה מקיפה של פעילות הגלריות והמעורבות של האורחים שלך.
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {KPI_CARDS.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-outline-variant/30 bg-surface-container p-6 flex flex-col justify-between hover:border-primary/40 transition-colors"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">
                {kpi.icon}
              </span>
              <span
                className={`text-xs font-bold flex items-center gap-1 ${
                  kpi.trendUp === true
                    ? "text-green-400"
                    : "text-on-surface-variant"
                }`}
                style={{ unicodeBidi: "isolate" }}
              >
                {kpi.trend}
                <span className="material-symbols-outlined text-xs">
                  {kpi.trendUp === true
                    ? "trending_up"
                    : "horizontal_rule"}
                </span>
              </span>
            </div>
            <div>
              <p className="text-on-surface-variant text-sm font-medium mb-1">
                {kpi.label}
              </p>
              <p
                className="text-4xl font-bold text-on-surface"
                style={{ unicodeBidi: "isolate" }}
              >
                {kpi.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Chart + AI Efficiency */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Bar Chart */}
        <div className="lg:col-span-2 rounded-xl border border-outline-variant/30 bg-surface-container p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-on-surface">מעורבות אורחים</h2>
            <select className="bg-surface-container-high border border-outline-variant/30 text-xs font-bold rounded-lg px-3 py-1.5 text-on-surface focus:ring-1 focus:ring-primary focus:outline-none">
              <option>30 ימים אחרונים</option>
              <option>90 ימים אחרונים</option>
              <option>שנה אחרונה</option>
            </select>
          </div>
          <div className="h-56 flex items-end justify-between gap-3 border-b border-outline-variant/30 pb-2">
            {BAR_DATA.map((bar) => (
              <div
                key={bar.day}
                className="flex flex-col items-center gap-1 flex-1 h-full justify-end"
              >
                <div className="w-full flex flex-col items-center gap-0.5 h-full justify-end">
                  <div
                    className="w-full bg-primary/20 rounded-t transition-all"
                    style={{ height: `${bar.viewPct}%` }}
                  />
                  <div
                    className="w-full bg-primary rounded-t transition-all"
                    style={{ height: `${bar.dlPct}%` }}
                  />
                </div>
                <span className="text-[11px] font-bold text-on-surface-variant mt-1">
                  {bar.day}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-6 justify-center text-xs font-bold">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-primary/30 rounded-full" />
              <span>צפיות</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-primary rounded-full" />
              <span>הורדות</span>
            </div>
          </div>
        </div>

        {/* AI Efficiency */}
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container p-6 flex flex-col">
          <h2 className="text-lg font-bold text-on-surface mb-6">יעילות AI</h2>
          <div className="space-y-5 flex-1">
            <div>
              <div className="flex justify-between text-sm font-bold mb-2">
                <span>זיהוי פנים</span>
                <span className="text-primary" style={{ unicodeBidi: "isolate" }}>
                  98.2%
                </span>
              </div>
              <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: "98.2%" }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-4 bg-surface-container-high rounded-lg border border-outline-variant/30">
                <p className="text-primary font-bold text-2xl" style={{ unicodeBidi: "isolate" }}>
                  12.4k
                </p>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase mt-1">
                  פנים שזוהו
                </p>
              </div>
              <div className="text-center p-4 bg-surface-container-high rounded-lg border border-outline-variant/30">
                <p className="text-primary font-bold text-2xl" style={{ unicodeBidi: "isolate" }}>
                  842
                </p>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase mt-1">
                  שעות שנחסכו
                </p>
              </div>
            </div>
            <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 flex items-start gap-3">
              <span className="material-symbols-outlined text-primary shrink-0">bolt</span>
              <p className="text-xs text-on-surface-variant leading-relaxed text-start">
                מנוע ה-AI הצליח להקטין את גודל הקבצים ב-35% ללא פגיעה באיכות.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Events Table */}
      <div className="rounded-xl border border-outline-variant/30 bg-surface-container overflow-hidden">
        <div className="p-5 border-b border-outline-variant/30 flex justify-between items-center">
          <h2 className="text-base font-bold text-on-surface">אירועים מובילים</h2>
          <Link
            href="/admin/events"
            className="text-primary text-xs font-bold hover:underline underline-offset-4"
          >
            הצג הכל
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-start">
            <thead className="bg-surface-container-high text-on-surface-variant text-[10px] font-bold uppercase tracking-wider border-b border-outline-variant/30">
              <tr>
                <th className="px-5 py-3 text-start">שם אירוע</th>
                <th className="px-5 py-3 text-start">תאריך</th>
                <th className="px-5 py-3 text-start">אורחים</th>
                <th className="px-5 py-3 text-start">תמונות</th>
                <th className="px-5 py-3 text-start">הורדות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {TOP_EVENTS.map((ev) => (
                <tr
                  key={ev.name}
                  className="hover:bg-surface-container-high/50 transition-colors"
                >
                  <td className="px-5 py-4 text-sm font-medium text-on-surface">
                    {ev.name}
                  </td>
                  <td
                    className="px-5 py-4 text-sm text-on-surface-variant"
                    style={{ unicodeBidi: "isolate" }}
                  >
                    {ev.date}
                  </td>
                  <td
                    className="px-5 py-4 text-sm text-on-surface"
                    style={{ unicodeBidi: "isolate" }}
                  >
                    {ev.guests}
                  </td>
                  <td
                    className="px-5 py-4 text-sm text-on-surface"
                    style={{ unicodeBidi: "isolate" }}
                  >
                    {ev.photos.toLocaleString()}
                  </td>
                  <td
                    className="px-5 py-4 text-sm text-primary font-bold"
                    style={{ unicodeBidi: "isolate" }}
                  >
                    {ev.downloads}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
