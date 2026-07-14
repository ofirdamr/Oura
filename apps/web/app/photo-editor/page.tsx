"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StudioLogo } from "@/components/brand/StudioLogo";
import {
  API_BASE_URL,
  getGallery,
  type EventBranding,
  type GuestPhoto,
} from "@/lib/api";
import { loadGuestSession } from "@/lib/guestSession";
import {
  adjustmentsFilter,
  compositeBrandedPhoto,
  downloadFileName,
  NEUTRAL_ADJUSTMENTS,
  type CompositeBranding,
  type FrameStyle,
  type PhotoAdjustments,
} from "@/lib/watermark";
import { savePhotos, sharePhotos } from "@/lib/photoActions";

const STUDIO_NAME = "Photo Santos";

type SliderKey = "brightness" | "contrast" | "saturation" | "exposure";

const SLIDERS: { key: SliderKey; label: string }[] = [
  { key: "brightness", label: "בהירות" },
  { key: "contrast", label: "ניגודיות" },
  { key: "saturation", label: "רוויה" },
  { key: "exposure", label: "חשיפה" },
];

const NEUTRAL_VALUES: Record<SliderKey, number> = {
  brightness: NEUTRAL_ADJUSTMENTS.brightness,
  contrast: NEUTRAL_ADJUSTMENTS.contrast,
  saturation: NEUTRAL_ADJUSTMENTS.saturation,
  exposure: NEUTRAL_ADJUSTMENTS.exposure,
};

const ENHANCED_VALUES: Record<SliderKey, number> = {
  brightness: 18,
  contrast: 24,
  saturation: 20,
  exposure: 12,
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      photo: GuestPhoto;
      branding: EventBranding;
      eventName: string | null;
    };

export default function PhotoEditorPage() {
  const router = useRouter();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [values, setValues] = useState<Record<SliderKey, number>>(NEUTRAL_VALUES);
  const [autoOptimizeOn, setAutoOptimizeOn] = useState(false);
  const [showFrame, setShowFrame] = useState(true);
  const [cropMode, setCropMode] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "share">(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const session = loadGuestSession();
      if (!session) {
        router.replace("/gallery-entry");
        return;
      }
      const photoId = new URLSearchParams(window.location.search).get("photo");
      const result = await getGallery(session.token);
      if (cancelled) return;
      if (!result.ok) {
        setLoad({ status: "error", message: "לא הצלחנו לטעון את התמונה. נסו שוב." });
        return;
      }
      const personal = result.data.personal_gallery.consent_required
        ? []
        : result.data.personal_gallery.photos;
      const all = [...personal, ...result.data.photos];
      const photo = all.find((p) => p.id === photoId) ?? all[0];
      if (!photo) {
        setLoad({ status: "error", message: "התמונה לא נמצאה." });
        return;
      }
      setLoad({
        status: "ready",
        photo,
        branding: result.data.event?.branding ?? {
          event_title: null,
          share_caption: null,
          logo_key: null,
          frame: "crystal",
          primary_color: "#FF8A75",
          auto_watermark: true,
        },
        eventName: result.data.event?.name ?? null,
      });
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const compositeBranding: CompositeBranding | null = useMemo(() => {
    if (load.status !== "ready") return null;
    const b = load.branding;
    return {
      studioName: STUDIO_NAME,
      eventTitle: b.event_title || load.eventName || null,
      logoUrl: b.logo_key ? `${API_BASE_URL}/media/${b.logo_key}` : null,
      frameStyle: showFrame ? ((b.frame as FrameStyle) ?? "crystal") : "none",
      primaryColor: b.primary_color ?? "#FF8A75",
    };
  }, [load, showFrame]);

  const adjustments: PhotoAdjustments = { ...values, rotation };
  const filter = adjustmentsFilter(values);

  function handleSliderChange(key: SliderKey, raw: string) {
    setValues((prev) => ({ ...prev, [key]: Number(raw) }));
    setAutoOptimizeOn(false);
  }

  function toggleAutoOptimize() {
    if (autoOptimizeOn) {
      setValues(NEUTRAL_VALUES);
      setAutoOptimizeOn(false);
    } else {
      setValues(ENHANCED_VALUES);
      setAutoOptimizeOn(true);
    }
  }

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }

  const runExport = useCallback(
    async (mode: "save" | "share") => {
      if (busy || load.status !== "ready" || !compositeBranding) return;
      setBusy(mode);
      try {
        const blob = await compositeBrandedPhoto(load.photo.url, compositeBranding, adjustments);
        const item = { blob, filename: downloadFileName(load.photo.id, STUDIO_NAME) };
        if (mode === "save") {
          const res = await savePhotos([item]);
          if (res === "downloaded") flash("השינויים נשמרו");
          else if (res === "failed") flash("השמירה נכשלה. נסו שוב.");
        } else {
          const title = compositeBranding.eventTitle;
          const caption = title
            ? `חוגגים ב${title}! 📸 הצילומים באדיבות ${STUDIO_NAME}`
            : `📸 הצילומים באדיבות ${STUDIO_NAME}`;
          const res = await sharePhotos([item], caption);
          if (res === "downloaded") flash("השיתוף לא נתמך במכשיר, התמונה נשמרה");
          else if (res === "failed") flash("השיתוף נכשל. נסו שוב.");
        }
      } catch {
        flash(mode === "save" ? "השמירה נכשלה. נסו שוב." : "השיתוף נכשל. נסו שוב.");
      } finally {
        setBusy(null);
      }
    },
    [busy, load, compositeBranding, adjustments],
  );

  return (
    <>
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .slider-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 16px; width: 16px;
          border-radius: 50%;
          background: #ffb4a6;
          cursor: pointer;
          margin-top: -6px;
        }
        .slider-thumb::-webkit-slider-runnable-track {
          width: 100%; height: 4px;
          background: rgba(255,255,255,0.2);
          border-radius: 2px;
        }
      `}</style>

      <div className="min-h-screen overflow-x-hidden" style={{ background: "#0e0e0e", color: "#e5e2e1" }}>

        {/* Header */}
        <header
          className="fixed top-0 z-50 w-full border-b"
          style={{
            height: 64,
            background: "rgba(14,14,14,0.92)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderColor: "rgba(255,255,255,0.05)",
          }}
        >
          {/* flex without row-reverse — dir=rtl in layout already handles RTL direction */}
          <div className="flex h-full w-full items-center justify-between px-6 md:px-20">
            {/* In RTL: this is visual RIGHT (start side) = back button */}
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="חזרה"
              className="flex h-10 w-10 items-center justify-center rounded-full transition-opacity hover:opacity-70"
              style={{ color: "#e5e2e1" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 26 }}>
                arrow_forward
              </span>
            </button>

            <h1 className="text-base font-bold" style={{ color: "#e5e2e1" }}>
              עריכת תמונה
            </h1>

            {/* In RTL: visual LEFT (end side) = studio logo */}
            <div className="flex items-center">
              <StudioLogo size={32} />
            </div>
          </div>
        </header>

        {/* Body: photo column + sidebar (desktop side-by-side, mobile stacked) */}
        <div className="flex min-h-screen pt-16 md:flex-row-reverse">

          {/* ── Editor sidebar ──
              - Desktop (md+): permanent right-hand panel (logical start = physical right in RTL)
              - Mobile: slide-over from physical right side
              Uses dir="ltr" + physical right:0 positioning to avoid RTL translation ambiguity */}

          {/* Mobile backdrop */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-[110] md:hidden"
              style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <aside
            dir="ltr"
            className={[
              // Mobile: fixed overlay sliding from the right
              "fixed top-0 bottom-0 right-0 z-[120] w-80 flex flex-col gap-8",
              "transition-transform duration-500",
              sidebarOpen ? "translate-x-0" : "translate-x-full",
              // Desktop: permanent side panel, no overlay
              "md:relative md:top-auto md:bottom-auto md:right-auto md:translate-x-0 md:flex",
            ].join(" ")}
            style={{
              background: "rgba(10,10,10,0.98)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              borderLeft: "1px solid rgba(255,255,255,0.08)",
              padding: "96px 28px 28px",
              boxShadow: "-10px 0 30px rgba(0,0,0,0.5)",
            }}
          >
            {/* Sidebar header (dir=ltr, so we flip text direction for the Hebrew labels) */}
            <div className="flex items-center justify-between" dir="rtl">
              <h3 className="text-xl font-bold" style={{ color: "#fff" }}>כלי עריכה</h3>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded-full p-1 transition-colors hover:bg-white/10 md:hidden"
                aria-label="סגירה"
              >
                <span className="material-symbols-outlined" style={{ color: "rgba(255,255,255,0.6)", fontSize: 22 }}>
                  close
                </span>
              </button>
            </div>

            {/* Sliders */}
            <div className="space-y-7" dir="rtl">
              {SLIDERS.map((slider, idx) => (
                <div
                  key={slider.key}
                  className="space-y-2"
                  style={{
                    opacity: 0,
                    animation: `fadeSlideUp 0.4s ease-out ${0.08 + idx * 0.09}s forwards`,
                  }}
                >
                  <div className="flex items-center justify-between text-sm font-medium"
                    style={{ color: "rgba(255,255,255,0.9)" }}>
                    <span>{slider.label}</span>
                    <span className="font-bold" style={{ color: "#ffb4a6", direction: "ltr" }}>
                      {values[slider.key]}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    value={values[slider.key]}
                    onChange={(e) => handleSliderChange(slider.key, e.target.value)}
                    disabled={load.status !== "ready"}
                    className="slider-thumb w-full cursor-pointer appearance-none bg-transparent disabled:opacity-50"
                    dir="ltr"
                  />
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="mt-auto space-y-3" dir="rtl">
              <button
                type="button"
                onClick={toggleAutoOptimize}
                disabled={load.status !== "ready"}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{
                  background: autoOptimizeOn ? "#ffb4a6" : "#ffffff",
                  color: autoOptimizeOn ? "#601308" : "#111",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>magic_button</span>
                שיפור אוטומטי
              </button>

              <button
                type="button"
                onClick={() => { setCropMode((v) => !v); setSidebarOpen(false); }}
                disabled={load.status !== "ready"}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border py-4 font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{
                  borderColor: cropMode ? "rgba(255,180,166,0.5)" : "rgba(255,255,255,0.1)",
                  color: cropMode ? "#ffb4a6" : "#fff",
                  background: cropMode ? "rgba(255,180,166,0.08)" : "transparent",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>crop</span>
                חיתוך וסיבוב
              </button>

              <button
                type="button"
                onClick={() => setShowFrame((v) => !v)}
                disabled={load.status !== "ready"}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border py-4 font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{
                  borderColor: showFrame ? "rgba(255,180,166,0.5)" : "rgba(255,255,255,0.1)",
                  color: showFrame ? "#ffb4a6" : "#fff",
                  background: showFrame ? "rgba(255,180,166,0.08)" : "transparent",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>frame_person</span>
                מסגרת {STUDIO_NAME}
              </button>

              <button
                type="button"
                onClick={() => { setSidebarOpen(false); runExport("save"); }}
                disabled={busy !== null || load.status !== "ready"}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{
                  background: "#ffb4a6",
                  color: "#601308",
                  boxShadow: "0 6px 20px rgba(255,180,166,0.25)",
                }}
              >
                <span
                  className={`material-symbols-outlined ${busy === "save" ? "animate-spin" : ""}`}
                  style={{ fontSize: 20 }}
                >
                  {busy === "save" ? "progress_activity" : "download"}
                </span>
                שמירת שינויים
              </button>
            </div>
          </aside>

          {/* ── Photo column ── */}
          <div className="flex flex-1 flex-col items-center px-5 py-8 md:px-12 md:py-10">

            {/* Festive frame + photo */}
            <div
              className="relative w-full max-w-lg overflow-hidden"
              style={{
                padding: 8,
                background: "rgba(255,255,255,0.03)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 12px 40px 0 rgba(0,0,0,0.6)",
                borderRadius: 4,
              }}
            >
              <div
                className="relative overflow-hidden"
                style={{ filter: load.status === "ready" ? filter : undefined, transition: "filter 0.2s" }}
              >
                {load.status === "ready" ? (
                  <div style={{ transform: `rotate(${rotation}deg)`, transition: "transform 0.3s" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={load.photo.url}
                      alt=""
                      className="block w-full object-contain"
                      style={{ maxHeight: "66vh" }}
                      crossOrigin="anonymous"
                    />
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-center"
                    style={{ height: 420, background: "rgba(32,31,31,1)" }}
                  >
                    {load.status === "loading" ? (
                      <span className="material-symbols-outlined animate-spin" style={{ fontSize: 40, color: "#ffb4a6" }}>
                        progress_activity
                      </span>
                    ) : (
                      <p className="px-6 text-center text-sm" style={{ color: "#dcc0bb" }}>
                        {load.message}
                      </p>
                    )}
                  </div>
                )}

                {/* Crop grid overlay */}
                {cropMode && load.status === "ready" && (
                  <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} style={{ border: "1px solid rgba(255,255,255,0.25)" }} />
                    ))}
                  </div>
                )}

                {/* Branding overlay: studio logo + name, NO Oura credit */}
                {showFrame && load.status === "ready" && (
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between"
                    style={{
                      padding: "36px 28px 20px",
                      background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.35) 60%, transparent 100%)",
                      // Physical flex direction since branding is always left-anchored
                      flexDirection: "row",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <StudioLogo size={52} />
                      <p
                        className="font-bold uppercase"
                        style={{ color: "#fff", fontSize: 18, letterSpacing: "0.2em", textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}
                      >
                        PHOTO SANTOS
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Crop rotate controls */}
            {cropMode && (
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setRotation((r) => r - 90)}
                  className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all active:scale-95"
                  style={{ borderColor: "rgba(255,255,255,0.1)", color: "#e5e2e1", background: "rgba(255,255,255,0.05)" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>rotate_left</span>
                  סיבוב שמאלה
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => r + 90)}
                  className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all active:scale-95"
                  style={{ borderColor: "rgba(255,255,255,0.1)", color: "#e5e2e1", background: "rgba(255,255,255,0.05)" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>rotate_right</span>
                  סיבוב ימינה
                </button>
              </div>
            )}

            {/* Bottom action row: Edit button (mobile-only), Share, Save */}
            <div className="mt-6 flex w-full max-w-lg items-center justify-between gap-3">
              {/* Open editor sidebar — mobile only (on desktop the sidebar is always visible) */}
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                disabled={load.status !== "ready"}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-4 font-bold transition-all active:scale-[0.98] disabled:opacity-50 md:hidden"
                style={{ background: "#ffb4a6", color: "#601308", boxShadow: "0 4px 16px rgba(255,180,166,0.2)" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>tune</span>
                עריכה מתקדמת
              </button>

              {/* Share */}
              <button
                type="button"
                onClick={() => runExport("share")}
                disabled={busy !== null || load.status !== "ready"}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-95 disabled:opacity-50"
                style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.1)", color: "#e5e2e1" }}
                aria-label="שיתוף"
              >
                <span
                  className={`material-symbols-outlined ${busy === "share" ? "animate-spin" : ""}`}
                  style={{ fontSize: 22 }}
                >
                  {busy === "share" ? "progress_activity" : "ios_share"}
                </span>
              </button>

              {/* Save */}
              <button
                type="button"
                onClick={() => runExport("save")}
                disabled={busy !== null || load.status !== "ready"}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-95 disabled:opacity-50"
                style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.1)", color: "#e5e2e1" }}
                aria-label="הורדה"
              >
                <span
                  className={`material-symbols-outlined ${busy === "save" ? "animate-spin" : ""}`}
                  style={{ fontSize: 22 }}
                >
                  {busy === "save" ? "progress_activity" : "download"}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className="pointer-events-none fixed inset-x-0 bottom-10 z-[200] mx-auto w-fit rounded-full px-5 py-2 text-sm"
            style={{ background: "rgba(255,255,255,0.15)", color: "#fff", backdropFilter: "blur(12px)" }}
          >
            {toast}
          </div>
        )}
      </div>
    </>
  );
}
