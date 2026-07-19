"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  | { status: "no-photo" }
  | {
      status: "ready";
      photo: GuestPhoto;
      branding: EventBranding;
      eventName: string | null;
    };

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between py-1"
      aria-pressed={on}
    >
      <span className="text-sm font-medium" style={{ color: "rgba(245,240,236,0.85)" }}>
        {label}
      </span>
      {/* toggle track */}
      <div
        className="relative h-7 w-12 rounded-full transition-colors duration-200"
        style={{ background: on ? "#ffb4a5" : "rgba(255,255,255,0.12)" }}
      >
        {/* toggle thumb */}
        <div
          className="absolute top-1 h-5 w-5 rounded-full shadow-md transition-transform duration-200"
          style={{
            background: on ? "#5e170a" : "rgba(255,255,255,0.6)",
            transform: on ? "translateX(1.4rem)" : "translateX(0.15rem)",
          }}
        />
      </div>
    </button>
  );
}

export default function PhotoEditorPage() {
  const router = useRouter();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [values, setValues] = useState<Record<SliderKey, number>>(NEUTRAL_VALUES);
  const [autoOptimizeOn, setAutoOptimizeOn] = useState(false);
  const [showFrame, setShowFrame] = useState(true);
  const [busy, setBusy] = useState<null | "save" | "share">(null);
  const [toast, setToast] = useState<string | null>(null);
  const [guestToken, setGuestToken] = useState<string | null>(null);

  type EditState = { values: Record<SliderKey, number>; autoOptimizeOn: boolean };
  function loadEditState(token: string, photoId: string): EditState | null {
    try {
      const raw = localStorage.getItem(`oura_edit_${token}_${photoId}`);
      return raw ? (JSON.parse(raw) as EditState) : null;
    } catch { return null; }
  }
  function saveEditState(token: string, photoId: string, state: EditState) {
    try { localStorage.setItem(`oura_edit_${token}_${photoId}`, JSON.stringify(state)); } catch {}
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const session = loadGuestSession();
      if (!session) { router.replace("/gallery-entry"); return; }
      setGuestToken(session.token);
      const photoId = new URLSearchParams(window.location.search).get("photo");
      if (!photoId) { setLoad({ status: "no-photo" }); return; }

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
      const photo = all.find((p) => p.id === photoId) ?? null;
      if (!photo) { setLoad({ status: "no-photo" }); return; }

      const saved = loadEditState(session.token, photo.id);
      if (saved) { setValues(saved.values); setAutoOptimizeOn(saved.autoOptimizeOn); }

      setLoad({
        status: "ready",
        photo,
        branding: result.data.event?.branding ?? {
          event_title: null, share_caption: null, logo_key: null,
          frame: "crystal", primary_color: "#FF8A75", auto_watermark: true,
        },
        eventName: result.data.event?.name ?? null,
      });
    }
    run();
    return () => { cancelled = true; };
  }, [router]);

  const currentPhoto = load.status === "ready" ? load.photo : null;

  useEffect(() => {
    if (!guestToken || !currentPhoto) return;
    saveEditState(guestToken, currentPhoto.id, { values, autoOptimizeOn });
  }, [values, autoOptimizeOn, currentPhoto, guestToken]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const adjustments: PhotoAdjustments = { ...values, rotation: 0 };

  function handleSliderChange(key: SliderKey, raw: string) {
    setValues((prev) => ({ ...prev, [key]: Number(raw) }));
    setAutoOptimizeOn(false);
  }

  function handleAutoOptimize(on: boolean) {
    if (on) { setValues(ENHANCED_VALUES); setAutoOptimizeOn(true); }
    else { setValues(NEUTRAL_VALUES); setAutoOptimizeOn(false); }
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

  // ── Render states ──────────────────────────────────────────────────────────

  if (load.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#0f0e0d" }}>
        <span className="material-symbols-outlined animate-spin text-3xl" style={{ color: "#ffb4a5" }}>
          progress_activity
        </span>
      </div>
    );
  }

  if (load.status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center" style={{ background: "#0f0e0d" }}>
        <p className="text-sm" style={{ color: "#cf6679" }}>{load.message}</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl px-6 py-3 font-medium"
          style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#f5f0ec" }}
        >
          חזרה
        </button>
      </div>
    );
  }

  if (load.status === "no-photo") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center" style={{ background: "#0f0e0d" }}>
        <p className="text-sm" style={{ color: "#ddc0ba" }}>לא נמצאה תמונה לעריכה.</p>
        <button
          type="button"
          onClick={() => router.replace("/gallery")}
          className="rounded-xl px-6 py-3 font-bold"
          style={{ background: "#ffb4a5", color: "#5e170a" }}
        >
          חזרה לגלריה
        </button>
      </div>
    );
  }

  const photo = load.photo;

  // ── Sliders + controls shared between mobile and desktop ───────────────────

  const sliderControls = (
    <div className="space-y-6">
      {SLIDERS.map((slider) => (
        <div key={slider.key} className="space-y-3">
          <div className="flex items-center justify-between text-sm font-medium">
            <span style={{ color: "rgba(245,240,236,0.85)" }}>{slider.label}</span>
            <span className="font-bold" style={{ color: "#ffb4a5", direction: "ltr", minWidth: 28, textAlign: "end" }}>
              {values[slider.key]}
            </span>
          </div>
          <input
            type="range"
            min={-100}
            max={100}
            value={values[slider.key]}
            onChange={(e) => handleSliderChange(slider.key, e.target.value)}
            dir="ltr"
            className="w-full cursor-pointer appearance-none"
            style={{ accentColor: "#ffb4a5", height: 4 }}
          />
        </div>
      ))}
    </div>
  );

  const toggleControls = (
    <div className="space-y-4">
      <Toggle
        on={autoOptimizeOn}
        onChange={handleAutoOptimize}
        label="אופטימיזציה אוטומטית"
      />
      <Toggle
        on={showFrame}
        onChange={setShowFrame}
        label="הוספת מסגרת"
      />
    </div>
  );

  // ── Photo preview element ──────────────────────────────────────────────────

  const photoPreview = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.url}
      alt=""
      className="w-full object-contain"
      style={{
        filter,
        transition: "filter 0.18s ease-out",
        maxHeight: "60vh",
        display: "block",
      }}
      crossOrigin="anonymous"
    />
  );

  // ── Full page render ───────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 18px; width: 18px;
          border-radius: 50%;
          background: #ffb4a5;
          cursor: pointer;
          margin-top: -7px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        }
        input[type=range]::-webkit-slider-runnable-track {
          width: 100%; height: 4px;
          background: rgba(255,255,255,0.18);
          border-radius: 2px;
        }
        input[type=range]::-moz-range-thumb {
          height: 18px; width: 18px;
          border-radius: 50%;
          background: #ffb4a5;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        }
        input[type=range]::-moz-range-track {
          height: 4px;
          background: rgba(255,255,255,0.18);
          border-radius: 2px;
        }
      `}</style>

      <div style={{ background: "#0f0e0d", color: "#f5f0ec", minHeight: "100vh" }}>

        {/* ── Header ── */}
        <header
          className="sticky top-0 z-50 flex items-center justify-between px-4"
          style={{
            height: 56,
            background: "rgba(15,14,13,0.92)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/10"
            aria-label="חזרה"
            style={{ color: "#f5f0ec" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>arrow_forward</span>
          </button>
          <h1 className="text-base font-bold" style={{ color: "#f5f0ec" }}>עריכת תמונה</h1>
          {/* spacer to center the title */}
          <div className="h-9 w-9" />
        </header>

        {/* ── Mobile: scroll layout (hidden on md+) ── */}
        <div className="md:hidden pb-28">
          {/* Photo preview */}
          <div
            className="w-full flex items-center justify-center overflow-hidden"
            style={{
              background: "#0a0908",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            {photoPreview}
          </div>

          {/* Controls */}
          <div className="space-y-8 px-5 pt-7">
            {/* Sliders */}
            <section>
              <h2 className="mb-5 text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
                כוונון
              </h2>
              {sliderControls}
            </section>

            {/* Separator */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

            {/* Toggles */}
            <section>
              <h2 className="mb-5 text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
                אפקטים
              </h2>
              {toggleControls}
            </section>
          </div>
        </div>

        {/* ── Desktop: two-panel layout (hidden on mobile) ── */}
        <div className="hidden md:flex" style={{ minHeight: "calc(100vh - 56px)" }}>
          {/* Left: photo canvas */}
          <div
            className="flex flex-1 items-center justify-center"
            style={{
              background: "#0a0908",
              borderInlineEnd: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="w-full max-w-2xl px-8 py-10">
              {photoPreview}
            </div>
          </div>

          {/* Right: sidebar */}
          <aside
            className="flex w-80 shrink-0 flex-col gap-8 overflow-y-auto px-7 py-8"
            style={{
              background: "rgba(21,19,17,0.98)",
              borderInlineStart: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div>
              <h2 className="mb-6 text-lg font-bold" style={{ color: "#f5f0ec" }}>כלי עריכה</h2>
              {sliderControls}
            </div>

            <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

            {toggleControls}

            <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

            {/* Desktop action buttons */}
            <div className="mt-auto space-y-3">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => runExport("save")}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                style={{ background: "#ffb4a5", color: "#5e170a", boxShadow: "0 4px 16px rgba(255,180,165,0.2)" }}
              >
                <span
                  className={`material-symbols-outlined ${busy === "save" ? "animate-spin" : ""}`}
                  style={{ fontSize: 20 }}
                >
                  {busy === "save" ? "progress_activity" : "download"}
                </span>
                שמור
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => runExport("share")}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-bold transition-all hover:opacity-80 active:scale-[0.98] disabled:opacity-50"
                style={{ border: "1px solid rgba(255,255,255,0.12)", color: "#f5f0ec" }}
              >
                <span
                  className={`material-symbols-outlined ${busy === "share" ? "animate-spin" : ""}`}
                  style={{ fontSize: 20 }}
                >
                  {busy === "share" ? "progress_activity" : "ios_share"}
                </span>
                שתף
              </button>
            </div>
          </aside>
        </div>

        {/* ── Mobile fixed bottom bar ── */}
        <div
          className="md:hidden fixed inset-x-0 bottom-0 z-50 flex items-center gap-3 px-5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3"
          style={{
            background: "rgba(15,14,13,0.96)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderTop: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {/* שתף — secondary */}
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => runExport("share")}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3.5 font-bold transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ border: "1px solid rgba(255,255,255,0.12)", color: "#f5f0ec" }}
          >
            <span
              className={`material-symbols-outlined ${busy === "share" ? "animate-spin" : ""}`}
              style={{ fontSize: 20 }}
            >
              {busy === "share" ? "progress_activity" : "ios_share"}
            </span>
            שתף
          </button>

          {/* שמור — primary */}
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => runExport("save")}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3.5 font-bold transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ background: "#ffb4a5", color: "#5e170a", boxShadow: "0 4px 16px rgba(255,180,165,0.2)" }}
          >
            <span
              className={`material-symbols-outlined ${busy === "save" ? "animate-spin" : ""}`}
              style={{ fontSize: 20 }}
            >
              {busy === "save" ? "progress_activity" : "download"}
            </span>
            שמור
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className="pointer-events-none fixed inset-x-0 bottom-24 z-[200] mx-auto w-fit rounded-full px-5 py-2 text-sm font-medium"
            style={{ background: "rgba(255,255,255,0.15)", color: "#fff", backdropFilter: "blur(12px)" }}
          >
            {toast}
          </div>
        )}
      </div>
    </>
  );
}
