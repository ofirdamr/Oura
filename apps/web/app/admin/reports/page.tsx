"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AdminShell } from "@/components/admin/AdminShell";
import { API_BASE_URL } from "@/lib/api";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const REASON_LABEL: Record<string, string> = {
  closed_eyes: "עיניים עצומות",
  duplicate: "כפילות",
  low_quality: "איכות נמוכה",
  blurry: "מטושטשת",
};

type AiStats = {
  total: number;
  approved: number;
  rejected: number;
  by_reason: Record<string, number>;
  by_category: Record<string, number>;
  rejected_photos: Array<{ id: string; url: string; rejection_reason: string | null }>;
};

export default function ReportsPage() {
  const [stats, setStats] = useState<AiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandRejected, setExpandRejected] = useState(false);
  const [restoring, setRestoring] = useState<Set<string>>(new Set());

  async function restorePhoto(photoId: string) {
    setRestoring((prev) => new Set(prev).add(photoId));
    const sb = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { setRestoring((prev) => { const s = new Set(prev); s.delete(photoId); return s; }); return; }
    const res = await fetch(`${API_BASE_URL}/admin/photos/${photoId}/restore`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      setStats((prev) => {
        if (!prev) return prev;
        const updatedRejected = prev.rejected_photos.filter((p) => p.id !== photoId);
        const removedPhoto = prev.rejected_photos.find((p) => p.id === photoId);
        const newByReason = { ...prev.by_reason };
        if (removedPhoto?.rejection_reason) {
          newByReason[removedPhoto.rejection_reason] = Math.max(0, (newByReason[removedPhoto.rejection_reason] ?? 1) - 1);
        }
        return {
          ...prev,
          rejected: prev.rejected - 1,
          approved: prev.approved + 1,
          by_reason: newByReason,
          rejected_photos: updatedRejected,
        };
      });
    }
    setRestoring((prev) => { const s = new Set(prev); s.delete(photoId); return s; });
  }

  useEffect(() => {
    async function load() {
      const sb = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }

      const res = await fetch(`${API_BASE_URL}/admin/ai-pipeline-stats`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setStats(await res.json());
      setLoading(false);
    }
    load();
  }, []);

  const rejectedCount = stats?.rejected ?? 0;
  const closedEyes = stats?.by_reason?.closed_eyes ?? 0;
  const duplicates = stats?.by_reason?.duplicate ?? 0;
  const blurry = (stats?.by_reason?.blurry ?? 0) + (stats?.by_reason?.low_quality ?? 0);

  return (
    <AdminShell active="ניתוח נתונים">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="text-start">
          <h1 className="font-sans text-3xl font-bold text-on-surface">
            דוחות הפקה וביקורת
          </h1>
          <p className="mt-1 font-sans text-sm text-on-surface-variant">
            סקירת תמונות שדווחו, סטטיסטיקות העלאה וסינון AI
          </p>
        </div>
      </div>

      {/* Stats bento grid — real data */}
      {!loading && stats && (
        <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <div className="col-span-2 rounded-3xl border border-white/5 bg-surface-container-high p-6 shadow-2xl lg:col-span-1">
            <span className="font-sans text-xs text-on-surface-variant">סה״כ תמונות עובדו</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-sans text-3xl font-bold text-primary" dir="ltr">{stats.total.toLocaleString()}</span>
            </div>
          </div>
          <div className="rounded-3xl border border-white/5 bg-surface-container-high p-6 shadow-2xl">
            <span className="font-sans text-xs text-on-surface-variant">אושרו לגלריה</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-sans text-3xl font-bold text-tertiary" dir="ltr">{stats.approved.toLocaleString()}</span>
              <span className="material-symbols-outlined text-sm text-tertiary">check_circle</span>
            </div>
          </div>
          <div className="rounded-3xl border border-white/5 bg-surface-container-high p-6 shadow-2xl">
            <span className="font-sans text-xs text-on-surface-variant">סוננו ע״י AI</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-sans text-3xl font-bold text-error" dir="ltr">{stats.rejected.toLocaleString()}</span>
              <span className="material-symbols-outlined text-sm text-error">filter_alt</span>
            </div>
          </div>
        </section>
      )}

      {/* AI filter section — wired to real data */}
      <section className="mb-8 rounded-3xl border border-white/5 bg-surface-container-high p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
              filter_alt
            </span>
            <h3 className="font-sans text-lg font-bold text-on-surface">סינון AI אוטומטי</h3>
          </div>
          {!loading && (
            <span className="rounded-full bg-error/20 px-3 py-1 font-sans text-xs font-medium text-error" dir="ltr">
              {rejectedCount} תמונות הוסתרו
            </span>
          )}
        </div>
        <p className="mb-6 font-sans text-sm text-on-surface-variant">
          ה-AI זיהה תמונות מטושטשות, עיניים עצומות או כפילויות באיכות נמוכה.
        </p>

        {loading ? (
          <div className="flex justify-center py-6">
            <span className="material-symbols-outlined animate-spin text-2xl text-primary">progress_activity</span>
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/5 bg-surface-container p-4">
                <div className="mb-1 font-sans text-xs text-on-surface-variant">עיניים עצומות</div>
                <div className="font-sans text-xl font-bold text-on-surface" dir="ltr">{closedEyes}</div>
              </div>
              <div className="rounded-xl border border-white/5 bg-surface-container p-4">
                <div className="mb-1 font-sans text-xs text-on-surface-variant">כפילויות</div>
                <div className="font-sans text-xl font-bold text-on-surface" dir="ltr">{duplicates}</div>
              </div>
              <div className="rounded-xl border border-white/5 bg-surface-container p-4">
                <div className="mb-1 font-sans text-xs text-on-surface-variant">מטושטשות</div>
                <div className="font-sans text-xl font-bold text-on-surface" dir="ltr">{blurry}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setExpandRejected((v) => !v)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-container py-3 font-sans text-sm font-bold text-on-surface transition-all hover:brightness-110 border border-white/10"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                {expandRejected ? "visibility_off" : "visibility"}
              </span>
              {expandRejected ? "הסתרת תמונות שסוננו" : "סקירת תמונות שסוננו"}
            </button>

            {expandRejected && stats && stats.rejected_photos.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {stats.rejected_photos.map((p) => (
                  <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl bg-surface-container">
                    <Image
                      src={p.url}
                      alt=""
                      fill
                      sizes="120px"
                      className="object-cover opacity-60"
                    />
                    <div className="absolute bottom-0 start-0 end-0 bg-black/70 px-1.5 py-1">
                      <span className="font-sans text-[10px] text-on-surface-variant">
                        {p.rejection_reason ? (REASON_LABEL[p.rejection_reason] ?? p.rejection_reason) : "סונן"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => restorePhoto(p.id)}
                      disabled={restoring.has(p.id)}
                      className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-wait"
                      title="הצג תמונה זו לאורחים"
                    >
                      {restoring.has(p.id) ? (
                        <span className="material-symbols-outlined animate-spin text-2xl text-white">progress_activity</span>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-2xl text-white" style={{ fontVariationSettings: "'FILL' 1" }}>visibility</span>
                          <span className="font-sans text-[11px] font-bold text-white">הצג לאורחים</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {expandRejected && stats && stats.rejected_photos.length === 0 && (
              <p className="mt-4 rounded-xl border border-white/5 bg-surface-container p-4 text-center font-sans text-sm text-on-surface-variant">
                אין תמונות שסוננו עדיין.
              </p>
            )}
          </>
        )}
      </section>

      {/* Category distribution */}
      {!loading && stats && Object.keys(stats.by_category).length > 0 && (
        <section className="rounded-3xl border border-white/5 bg-surface-container-high p-6 shadow-2xl">
          <div className="mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
              category
            </span>
            <h3 className="font-sans text-lg font-bold text-on-surface">התפלגות קטגוריות</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { key: "ceremony", label: "חופה" },
              { key: "reception", label: "קבלת פנים" },
              { key: "dancing", label: "ריקודים" },
              { key: "party", label: "מסיבה" },
            ].map(({ key, label }) => {
              const count = stats.by_category[key] ?? 0;
              const pct = stats.approved > 0 ? Math.round((count / stats.approved) * 100) : 0;
              return (
                <div key={key} className="rounded-xl border border-white/5 bg-surface-container p-4">
                  <div className="mb-1 font-sans text-xs text-on-surface-variant">{label}</div>
                  <div className="font-sans text-2xl font-bold text-primary" dir="ltr">{count}</div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-surface-container-highest">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 font-sans text-[11px] text-on-surface-variant" dir="ltr">{pct}%</div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </AdminShell>
  );
}
