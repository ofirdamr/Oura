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
  exposure: (NEUTRAL_ADJUSTMENTS as Record<string, number>).exposure ?? 0,
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
      photos: GuestPhoto[];
      branding: EventBranding;
      eventName: string | null;
    };

export default function PhotoEditorPage() {
  const router = useRouter();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
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
      if (!session) { router.replace("/gallery-entry"); return; }
      const photoId = new URLSearchParams(window.location.search).get("photo");
      const result = await getGallery(session.token);
      if (cancelled) return;
      if (!result.ok) {
        setLoad({ status: "error", message: "לא הצלחנו לטעון את התמונות. נסו שוב." });
        return;
      }
      const personal = result.data.personal_gallery.consent_required
        ? []
        : result.data.personal_gallery.photos;
      const all = [...personal, ...result.data.photos];
      setLoad({
        status: "ready",
        photos: all,
        branding: result.data.event?.branding ?? {
          event_title: null, share_caption: null, logo_key: null,
          frame: "crystal", primary_color: "#FF8A75", auto_watermark: true,
        },
        eventName: result.data.event?.name ?? null,
      });
      if (photoId) {
        const idx = all.findIndex((p) => p.id === photoId);
        if (idx >= 0) {
          setLightboxIndex(idx);
          document.body.style.overflow = "hidden";
        }
      }
    }
    run();
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (lightboxIndex === null) return;
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") navLightbox(-1);
      else if (e.key === "ArrowRight") navLightbox(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const photos = load.status === "ready" ? load.photos : [];
  const currentPhoto = lightboxIndex !== null ? photos[lightboxIndex] ?? null : null;

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

  const filter = adjustmentsFilter(values);
  const adjustments: PhotoAdjustments = { ...values, rotation };

  function openLightbox(index: number) {
    setLightboxIndex(index);
    setSidebarOpen(false);
    setValues(NEUTRAL_VALUES);
    setAutoOptimizeOn(false);
    setCropMode(false);
    setRotation(0);
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    setLightboxIndex(null);
    setSidebarOpen(false);
    document.body.style.overflow = "";
  }

  function navLightbox(dir: 1 | -1) {
    if (!photos.length || lightboxIndex === null) return;
    const next = (lightboxIndex + dir + photos.length) % photos.length;
    setLightboxIndex(next);
    setValues(NEUTRAL_VALUES);
    setAutoOptimizeOn(false);
    setCropMode(false);
    setRotation(0);
  }

  function handleSliderChange(key: SliderKey, raw: string) {
    setValues((prev) => ({ ...prev, [key]: Number(raw) }));
    setAutoOptimizeOn(false);
  }

  function toggleAutoOptimize() {
    if (autoOptimizeOn) { setValues(NEUTRAL_VALUES); setAutoOptimizeOn(false); }
    else { setValues(ENHANCED_VALUES); setAutoOptimizeOn(true); }
  }

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }

  const runExport = useCallback(async (mode: "save" | "share") => {
    if (busy || load.status !== "ready" || !currentPhoto || !compositeBranding) return;
    setBusy(mode);
    try {
      const blob = await compositeBrandedPhoto(currentPhoto.url, compositeBranding, adjustments);
      const item = { blob, filename: downloadFileName(currentPhoto.id, STUDIO_NAME) };
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
    } finally { setBusy(null); }
  }, [busy, load, currentPhoto, compositeBranding, adjustments]);

  const eventBadge =
    load.status === "ready"
      ? (load.eventName ?? "אירוע") + " • " + new Date().toLocaleDateString("he-IL")
      : "...";

  return (
    <>
      <style>{`
        .pe-festive-frame {
          position: relative; padding: 8px;
          background: rgba(255,255,255,0.03);
          backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 12px 40px 0 rgba(0,0,0,0.6);
          transition: all 0.4s cubic-bezier(0.4,0,0.2,1); overflow: hidden;
        }
        .pe-photo-container:hover .pe-festive-frame {
          transform: translateY(-6px);
          border-color: rgba(255,255,255,0.3);
          background: rgba(255,255,255,0.08);
        }
        .pe-watermark { text-shadow: 0 2px 8px rgba(0,0,0,0.8); letter-spacing: 1.5px; }
        .pe-glass {
          background: rgba(15,14,13,0.85);
          backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
        }
        .pe-slider::-webkit-slider-thumb {
          -webkit-appearance: none; height: 16px; width: 16px;
          border-radius: 50%; background: #ffb4a5; cursor: pointer; margin-top: -6px;
        }
        .pe-slider::-webkit-slider-runnable-track {
          width: 100%; height: 4px;
          background: rgba(255,255,255,0.2); border-radius: 2px;
        }
        .pe-tool-item { opacity: 0; transform: translateY(10px); transition: all 0.4s ease-out; }
        .pe-sidebar-open .pe-tool-item { opacity: 1; transform: translateY(0); }
        .pe-tool-item:nth-child(1) { transition-delay: 0.1s; }
        .pe-tool-item:nth-child(2) { transition-delay: 0.2s; }
        .pe-tool-item:nth-child(3) { transition-delay: 0.3s; }
        .pe-tool-item:nth-child(4) { transition-delay: 0.4s; }
      `}</style>

      <div style={{ background: "#0f0e0d", color: "#f5f0ec", minHeight: "100vh" }}>

        {/* ── Header ── */}
        <header
          className="fixed top-0 w-full z-50 flex justify-between items-center px-4 md:px-8"
          style={{
            height: 64,
            background: "rgba(21,19,17,0.9)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderBottom: "1px solid rgba(86,66,62,0.5)",
          }}
        >
          {/* RTL start (physical right): logo + nav */}
          <div className="flex items-center gap-4">
            <div className="flex items-center h-10">
              <StudioLogo size={36} />
              <span className="ms-3 text-2xl font-bold" style={{ color: "#ffb4a5" }}>Oura</span>
            </div>
            <nav className="hidden md:flex gap-8 ms-10">
              <a className="border-b-2 font-medium pb-1" href="#" style={{ color: "#ffb4a5", borderColor: "#ffb4a5" }}>גלריה</a>
              <a className="font-medium transition-colors" href="#" style={{ color: "#ddc0ba" }}>אירועים</a>
              <a className="font-medium transition-colors" href="#" style={{ color: "#ddc0ba" }}>הגדרות</a>
            </nav>
          </div>

          {/* RTL end (physical left): upload + notifications + avatar */}
          <div className="flex items-center gap-6">
            <button
              className="rounded-full px-7 py-2.5 font-semibold transition-all hover:scale-105 active:opacity-80"
              style={{ background: "#ffb4a5", color: "#5e170a" }}
            >
              העלאת תמונות
            </button>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined cursor-pointer" style={{ color: "#ddc0ba", fontSize: 24 }}>
                notifications
              </span>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden"
                style={{ background: "#5d4037", border: "2px solid rgba(86,66,62,0.8)" }}
              >
                <span className="material-symbols-outlined" style={{ color: "#ffdbd0", fontSize: 20 }}>person</span>
              </div>
            </div>
          </div>
        </header>

        {/* ── Main ── */}
        <main className="pt-28 pb-32 px-4 md:px-8 min-h-screen relative">

          {/* Hero */}
          <section className="mb-16 text-center md:text-start">
            <div
              className="inline-block px-5 py-1.5 rounded-full font-medium mb-6"
              style={{ border: "1px solid #e9c349", color: "#e9c349", fontSize: 14, background: "rgba(233,195,73,0.1)" }}
            >
              {eventBadge}
            </div>
            <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight" style={{ color: "#f5f0ec" }}>
              רגעים של אושר בלתי נשכח
            </h2>
            <p className="text-lg leading-relaxed max-w-2xl md:me-0 me-auto" style={{ color: "#ddc0ba" }}>
              גלריית האורחים הרשמית. מוזמנים לדפדף, לערוך ולשתף את הרגעים המרגשים ביותר.
            </p>
          </section>

          {/* Bento photo grid */}
          <section
            className="grid grid-cols-2 md:grid-cols-4"
            style={{ gap: 16, gridAutoRows: "240px" }}
          >
            {load.status === "loading" && (
              <div className="col-span-2 md:col-span-4 flex items-center justify-center" style={{ height: 480 }}>
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 40, color: "#ffb4a5" }}>
                  progress_activity
                </span>
              </div>
            )}
            {load.status === "error" && (
              <div className="col-span-2 md:col-span-4 flex items-center justify-center" style={{ height: 480 }}>
                <p style={{ color: "#ddc0ba" }}>{load.message}</p>
              </div>
            )}
            {photos.map((photo, idx) => {
              const isFeatured = idx === 0;
              const isTall = idx === 5;
              return (
                <div
                  key={photo.id}
                  className={[
                    "pe-photo-container group cursor-pointer",
                    isFeatured ? "col-span-2 row-span-2" : "col-span-1",
                    isTall ? "md:row-span-2" : "",
                  ].join(" ")}
                  onClick={() => openLightbox(idx)}
                >
                  <div className="pe-festive-frame h-full">
                    <div className="relative overflow-hidden w-full h-full rounded-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt=""
                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                      />
                      <div
                        className="absolute inset-0 flex flex-col justify-between p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.1) 50%, transparent)" }}
                      >
                        {isFeatured && (
                          <div className="flex justify-between items-start">
                            <div className="flex gap-3">
                              <button
                                className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
                                style={{ background: "rgba(15,14,13,0.85)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>share</span>
                              </button>
                              <span className="material-symbols-outlined cursor-pointer" style={{ color: "rgba(255,255,255,0.8)", fontSize: 24 }}>favorite</span>
                            </div>
                            <div
                              className="w-14 h-14 rounded-xl flex items-center justify-center"
                              style={{ background: "rgba(15,14,13,0.85)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.2)" }}
                            >
                              <span className="material-symbols-outlined" style={{ color: "#e9c349", fontSize: 36, fontVariationSettings: "'FILL' 1" }}>camera</span>
                            </div>
                          </div>
                        )}
                        <div className="text-start mt-auto">
                          <p className="pe-watermark font-bold text-2xl uppercase tracking-widest" style={{ color: "#fff" }}>
                            {STUDIO_NAME.toUpperCase()}
                          </p>
                          <p className="mt-1" style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>
                            Cinematography &amp; Fine Art
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>

          {/* Load More FAB */}
          {photos.length > 0 && (
            <button
              className="hidden md:flex fixed z-40 items-center gap-3 font-bold rounded-full transition-all hover:scale-105 hover:opacity-90 active:scale-95 group"
              style={{
                bottom: 96,
                left: "50%",
                transform: "translateX(-50%)",
                background: "#e9c349",
                color: "#241a00",
                padding: "16px 40px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              }}
            >
              <span
                className="material-symbols-outlined group-hover:rotate-180 transition-transform duration-500"
                style={{ fontSize: 22 }}
              >
                expand_more
              </span>
              צפה בתמונות נוספות
            </button>
          )}
        </main>

        {/* ── Mobile Bottom Nav ── */}
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-50 flex justify-around items-center py-3 px-4"
          style={{
            background: "rgba(21,19,17,0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderTop: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {([
            { icon: "home", label: "ראשי", active: false, fill: true },
            { icon: "grid_view", label: "גלריה", active: false, fill: false },
            { icon: "auto_fix_high", label: "עריכה", active: true, fill: false },
            { icon: "person", label: "פרופיל", active: false, fill: false },
          ] as const).map((item) => (
            <a
              key={item.label}
              className="flex flex-col items-center"
              href="#"
              style={{ color: item.active ? "#ffb4a5" : "#ddc0ba" }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: item.fill ? "'FILL' 1" : "'FILL' 0" }}
              >
                {item.icon}
              </span>
              <span style={{ fontSize: 10, marginTop: 4, fontWeight: 500 }}>{item.label}</span>
            </a>
          ))}
        </nav>

        {/* ── Lightbox ── */}
        {lightboxIndex !== null && (
          <div
            className="pe-glass fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12"
            onClick={(e) => { if (e.target === e.currentTarget) closeLightbox(); }}
          >
            {/* Close */}
            <button
              className="absolute top-8 left-8 z-[110] rounded-full p-3 transition-all hover:bg-white/20"
              style={{ color: "rgba(255,255,255,0.8)", background: "rgba(255,255,255,0.1)" }}
              onClick={closeLightbox}
              aria-label="סגירה"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 28 }}>close</span>
            </button>

            {/* Photo content + nav arrows */}
            <div className="relative w-full max-w-6xl h-full flex items-center justify-center">
              {/* Prev */}
              <button
                className="absolute z-[110] transition-all hover:text-white"
                style={{ left: 16, color: "rgba(255,255,255,0.4)", transform: "scale(1.5)" }}
                onClick={() => navLightbox(-1)}
                aria-label="הקודם"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 48 }}>chevron_left</span>
              </button>
              {/* Next */}
              <button
                className="absolute z-[110] transition-all hover:text-white"
                style={{ right: 16, color: "rgba(255,255,255,0.4)", transform: "scale(1.5)" }}
                onClick={() => navLightbox(1)}
                aria-label="הבא"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 48 }}>chevron_right</span>
              </button>

              {/* Photo in festive frame */}
              <div
                className="pe-festive-frame inline-block relative"
                style={{ maxHeight: "85vh", boxShadow: "0 0 100px rgba(0,0,0,0.8)", borderColor: "rgba(255,255,255,0.2)" }}
              >
                <div className="relative h-full overflow-hidden rounded-sm">
                  {currentPhoto && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={currentPhoto.url}
                        alt=""
                        style={{
                          maxHeight: "75vh",
                          width: "auto",
                          objectFit: "contain",
                          display: "block",
                          filter,
                          transform: `rotate(${rotation}deg)`,
                          transition: "filter 0.2s, transform 0.3s",
                        }}
                        crossOrigin="anonymous"
                      />

                      {/* Crop grid */}
                      {cropMode && (
                        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                          {Array.from({ length: 9 }).map((_, i) => (
                            <div key={i} style={{ border: "1px solid rgba(255,255,255,0.25)" }} />
                          ))}
                        </div>
                      )}

                      {/* Bottom overlay: branding (start) + actions (end) */}
                      <div
                        className="absolute bottom-0 inset-x-0 flex justify-between items-end"
                        style={{
                          padding: "40px 40px 40px",
                          background: "linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.4) 50%, transparent)",
                        }}
                      >
                        {/* Studio branding – RTL start = physical right */}
                        <div className="text-start" style={{ color: "#fff" }}>
                          <p className="pe-watermark font-extrabold uppercase" style={{ fontSize: 28, letterSpacing: "0.2em", marginBottom: 8 }}>
                            {STUDIO_NAME.toUpperCase()}
                          </p>
                          {/* Desktop: Oura credit line */}
                          <div className="hidden md:flex items-center gap-3" style={{ color: "rgba(255,255,255,0.6)" }}>
                            <div style={{ filter: "grayscale(1) brightness(2)", opacity: 0.7 }}>
                              <StudioLogo size={24} />
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 300 }}>מופעל על ידי Oura - צלם האירוע הרשמי</span>
                          </div>
                          {/* Mobile: copyright line */}
                          <div className="md:hidden flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>copyright</span>
                            <span style={{ fontSize: 10 }}>כל הזכויות שמורות למותג</span>
                          </div>
                        </div>

                        {/* Action buttons – RTL end = physical left */}
                        <div className="flex gap-3 md:gap-5">
                          {/* Edit: desktop shows icon+text, mobile icon only */}
                          <button
                            className="flex items-center gap-2 md:gap-3 rounded-2xl font-bold transition-all hover:opacity-80 active:scale-95"
                            style={{
                              background: "#ffb4a5",
                              color: "#5e170a",
                              padding: "12px 16px",
                              boxShadow: "0 4px 12px rgba(255,180,165,0.3)",
                            }}
                            onClick={() => setSidebarOpen(true)}
                          >
                            <span className="material-symbols-outlined md:hidden" style={{ fontSize: 20 }}>tune</span>
                            <span className="material-symbols-outlined hidden md:block" style={{ fontSize: 20 }}>edit</span>
                            <span className="hidden md:block" style={{ fontSize: 14 }}>עריכה מקצועית</span>
                          </button>
                          {/* Download */}
                          <button
                            className="rounded-2xl p-3 md:p-4 transition-all hover:opacity-80 active:scale-95 group"
                            style={{
                              background: "rgba(255,255,255,0.05)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              color: "#fff",
                            }}
                            onClick={() => runExport("save")}
                            disabled={busy !== null}
                            aria-label="הורדה"
                          >
                            <span
                              className={`material-symbols-outlined ${busy === "save" ? "animate-spin" : "group-hover:scale-110"} transition-transform`}
                              style={{ fontSize: 22 }}
                            >
                              {busy === "save" ? "progress_activity" : "download"}
                            </span>
                          </button>
                          {/* Share – desktop only per desktop design */}
                          <button
                            className="hidden md:flex rounded-2xl p-4 transition-all hover:opacity-80 active:scale-95 group"
                            style={{
                              background: "rgba(255,255,255,0.05)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              color: "#fff",
                            }}
                            onClick={() => runExport("share")}
                            disabled={busy !== null}
                            aria-label="שיתוף"
                          >
                            <span
                              className={`material-symbols-outlined ${busy === "share" ? "animate-spin" : "group-hover:scale-110"} transition-transform`}
                              style={{ fontSize: 22 }}
                            >
                              {busy === "share" ? "progress_activity" : "share"}
                            </span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Edit sidebar
                Mobile: slides from physical right (right-0, translate-x-full when hidden)
                Desktop: slides from physical left (left-0, -translate-x-full when hidden) */}
            <div
              className={[
                "absolute top-0 bottom-0 z-[120] w-80 flex flex-col gap-8 p-8",
                "right-0 md:right-auto md:left-0",
                sidebarOpen
                  ? "translate-x-0 pe-sidebar-open"
                  : "translate-x-full md:-translate-x-full",
                "transition-transform duration-500",
              ].join(" ")}
              style={{
                background: "rgba(21,19,17,0.98)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                borderLeft: "1px solid rgba(255,255,255,0.05)",
                boxShadow: "-10px 0 30px rgba(0,0,0,0.5)",
              }}
            >
              {/* Sidebar header */}
              <div className="flex items-center justify-between">
                <h3 className="font-bold" style={{ color: "#fff", fontSize: 20 }}>כלי עריכה</h3>
                <button
                  className="rounded-lg p-2 transition-colors hover:bg-white/10"
                  onClick={() => setSidebarOpen(false)}
                  style={{ color: "rgba(255,255,255,0.4)" }}
                  aria-label="סגירה"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 22 }}>close</span>
                </button>
              </div>

              {/* Sliders */}
              <div className="space-y-8">
                {SLIDERS.map((slider) => (
                  <div key={slider.key} className="space-y-4 pe-tool-item">
                    <div className="flex justify-between text-sm font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>
                      <span>{slider.label}</span>
                      <span className="font-bold" style={{ color: "#ffb4a5", direction: "ltr" }}>
                        {values[slider.key]}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      value={values[slider.key]}
                      onChange={(e) => handleSliderChange(slider.key, e.target.value)}
                      className="pe-slider w-full appearance-none bg-transparent cursor-pointer"
                      dir="ltr"
                    />
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="mt-auto space-y-4">
                <button
                  type="button"
                  onClick={toggleAutoOptimize}
                  className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all hover:opacity-90 active:scale-95"
                  style={{ background: autoOptimizeOn ? "#ffb4a5" : "#fff", color: autoOptimizeOn ? "#5e170a" : "#111" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 22 }}>magic_button</span>
                  {autoOptimizeOn ? "ביטול שיפור" : "שיפור אוטומטי"}
                </button>

                <button
                  type="button"
                  onClick={() => { setCropMode((v) => !v); setSidebarOpen(false); }}
                  className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all hover:opacity-80 active:scale-95"
                  style={{
                    border: `1px solid ${cropMode ? "rgba(255,180,165,0.5)" : "rgba(255,255,255,0.1)"}`,
                    color: cropMode ? "#ffb4a5" : "rgba(255,255,255,0.8)",
                    background: cropMode ? "rgba(255,180,165,0.08)" : "transparent",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 22 }}>crop</span>
                  חיתוך וסיבוב
                </button>

                <button
                  type="button"
                  onClick={() => setShowFrame((v) => !v)}
                  className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all hover:opacity-80 active:scale-95"
                  style={{
                    border: `1px solid ${showFrame ? "rgba(255,180,165,0.5)" : "rgba(255,255,255,0.1)"}`,
                    color: showFrame ? "#ffb4a5" : "rgba(255,255,255,0.8)",
                    background: showFrame ? "rgba(255,180,165,0.08)" : "transparent",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 22 }}>frame_person</span>
                  הוספת מסגרת {STUDIO_NAME}
                </button>

                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => { setSidebarOpen(false); runExport("save"); }}
                  className="mt-4 w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                  style={{ background: "#ffb4a5", color: "#5e170a", boxShadow: "0 6px 20px rgba(255,180,165,0.25)" }}
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
            </div>

            {/* Crop rotation controls */}
            {cropMode && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-[115]">
                <button
                  type="button"
                  onClick={() => setRotation((r) => r - 90)}
                  className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all active:scale-95"
                  style={{ borderColor: "rgba(255,255,255,0.1)", color: "#f5f0ec", background: "rgba(255,255,255,0.05)" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>rotate_left</span>
                  סיבוב שמאלה
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => r + 90)}
                  className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all active:scale-95"
                  style={{ borderColor: "rgba(255,255,255,0.1)", color: "#f5f0ec", background: "rgba(255,255,255,0.05)" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>rotate_right</span>
                  סיבוב ימינה
                </button>
              </div>
            )}
          </div>
        )}

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
