"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getStatistics, type StatisticsResponse } from "@/lib/api";

function fmtNum(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return n.toLocaleString("he-IL");
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export default function StatisticsPage() {
  const [data, setData] = useState<StatisticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { setLoading(false); return; }
      const res = await getStatistics(token);
      if (res.ok) setData(res.data);
      setLoading(false);
    })();
  }, []);

  const kpis = [
    {
      icon: "event_available",
      label: 'סה"כ אירועים',
      value: data ? fmtNum(data.events_total) : "—",
      trend: null,
    },
    {
      icon: "auto_awesome",
      label: "תמונות שעובדו ב-AI",
      value: data ? fmtNum(data.photos_ai_done) : "—",
      trend: null,
    },
    {
      icon: "face",
      label: "זיהויי פנים",
      value: data ? fmtNum(data.face_embeddings) : "—",
      trend: null,
    },
    {
      icon: "group",
      label: "סה״כ אורחים",
      value: data ? fmtNum(data.guests_total) : "—",
      trend: null,
    },
  ];

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
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-outline-variant/30 bg-surface-container p-6 flex flex-col justify-between hover:border-primary/40 transition-colors"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">
                {kpi.icon}
              </span>
              <span className="text-xs font-bold text-on-surface-variant">
                {loading ? (
                  <span className="material-symbols-outlined animate-spin text-sm">
                    progress_activity
                  </span>
                ) : "—"}
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
                {loading ? (
                  <span className="text-2xl text-on-surface-variant">...</span>
                ) : kpi.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* AI Efficiency */}
      <div className="rounded-xl border border-outline-variant/30 bg-surface-container p-6 mb-8">
        <h2 className="text-lg font-bold text-on-surface mb-6">יעילות AI</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="sm:col-span-2">
            <div className="flex justify-between text-sm font-bold mb-2">
              <span>זיהוי פנים</span>
              <span className="text-primary" style={{ unicodeBidi: "isolate" }}>
                {data && data.photos_ai_done > 0
                  ? Math.min(
                      100,
                      Math.round((data.face_embeddings / Math.max(data.photos_ai_done, 1)) * 10),
                    ) + "%"
                  : "—"}
              </span>
            </div>
            <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width:
                    data && data.photos_ai_done > 0
                      ? `${Math.min(100, Math.round((data.face_embeddings / Math.max(data.photos_ai_done, 1)) * 10))}%`
                      : "0%",
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-4 bg-surface-container-high rounded-lg border border-outline-variant/30">
              <p className="text-primary font-bold text-2xl" style={{ unicodeBidi: "isolate" }}>
                {loading ? "..." : data ? fmtNum(data.face_embeddings) : "—"}
              </p>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase mt-1">
                פנים שזוהו
              </p>
            </div>
            <div className="text-center p-4 bg-surface-container-high rounded-lg border border-outline-variant/30">
              <p className="text-primary font-bold text-2xl" style={{ unicodeBidi: "isolate" }}>
                {loading ? "..." : data ? fmtNum(data.photos_ai_done) : "—"}
              </p>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase mt-1">
                תמונות עובדו
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
        {loading ? (
          <div className="flex justify-center items-center p-12 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin me-2">progress_activity</span>
            טוען נתונים...
          </div>
        ) : !data || data.top_events.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant text-sm">
            אין אירועים עדיין
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start">
              <thead className="bg-surface-container-high text-on-surface-variant text-[10px] font-bold uppercase tracking-wider border-b border-outline-variant/30">
                <tr>
                  <th className="px-5 py-3 text-start">שם אירוע</th>
                  <th className="px-5 py-3 text-start">תאריך</th>
                  <th className="px-5 py-3 text-start">אורחים</th>
                  <th className="px-5 py-3 text-start">תמונות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {data.top_events.map((ev) => (
                  <tr
                    key={ev.id}
                    className="hover:bg-surface-container-high/50 transition-colors"
                  >
                    <td className="px-5 py-4 text-sm font-medium text-on-surface">
                      {ev.name}
                    </td>
                    <td
                      className="px-5 py-4 text-sm text-on-surface-variant"
                      style={{ unicodeBidi: "isolate" }}
                    >
                      {fmtDate(ev.date)}
                    </td>
                    <td
                      className="px-5 py-4 text-sm text-on-surface"
                      style={{ unicodeBidi: "isolate" }}
                    >
                      {fmtNum(ev.guests)}
                    </td>
                    <td
                      className="px-5 py-4 text-sm text-primary font-bold"
                      style={{ unicodeBidi: "isolate" }}
                    >
                      {fmtNum(ev.photos)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
