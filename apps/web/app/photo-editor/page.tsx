"use client";

// Photo Editor: a guest adjusts one selected photo, then saves/shares the
// finished, branded result. Reached from the gallery's full-screen viewer
// ("עריכה") with ?photo=<id>; it re-reads the guest's gallery (via the stored
// opaque token) so a direct link / refresh still works, finds that photo, and
// lets the guest tune brightness/contrast/saturation/exposure, auto-optimize,
// rotate, and toggle the photographer frame.
//
// The adjustments drive a live CSS-filter preview on the REAL photo, and the
// exact same filter math (lib/watermark.adjustmentsFilter) is baked into the
// exported JPEG by compositeBrandedPhoto, so what the guest sees == what they
// save. No processing backend and no persistence: the guest flow is ephemeral
// and login-free, so "save" produces a real branded image on the device via
// the phone's share sheet (lib/photoActions), not a server-side edit record.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OuraLogo } from "@/components/brand/OuraLogo";
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
  | { status: "ready"; photo: GuestPhoto; branding: EventBranding; eventName: string | null };

export default function PhotoEditorPage() {
  const router = useRouter();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [values, setValues] = useState<Record<SliderKey, number>>(NEUTRAL_VALUES);
  const [autoOptimizeOn, setAutoOptimizeOn] = useState(false);
  const [showFrame, setShowFrame] = useState(true);
  const [cropMode, setCropMode] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [busy, setBusy] = useState<null | "save" | "share">(null);
  const [toast, setToast] = useState<string | null>(null);

  // Read ?photo=<id>, load the guest's gallery, and resolve the target photo.
  // window.location (not useSearchParams) avoids a Suspense boundary on this
  // client-only guest route.
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
      // Frame toggle: an "off" frame exports with no photographer border.
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
          if (res === "downloaded") flash("התמונה נשמרה");
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
    <div className="min-h-screen pb-40">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg flex-row-reverse items-center justify-between px-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="material-symbols-outlined text-on-surface transition-opacity hover:opacity-70"
            aria-label="חזרה"
          >
            arrow_forward
          </button>
          <h1 className="text-lg font-bold text-on-surface">עריכת תמונה</h1>
          <OuraLogo size={24} />
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-6 px-4 py-6">
        {/* Preview */}
        <div className="relative aspect-[3/4] overflow-hidden rounded-3xl border border-white/5 bg-surface-container shadow-xl">
          {load.status === "ready" ? (
            <div className="h-full w-full transition-[filter] duration-200" style={{ filter }}>
              <div
                className="flex h-full w-full items-center justify-center transition-transform duration-300"
                style={{ transform: `rotate(${rotation}deg)` }}
              >
                {/* Real photo, taint-safe fetch handled at export; preview is a
                    plain <img> so the CSS filter/rotation match the export. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={load.photo.url}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                  crossOrigin="anonymous"
                />
              </div>
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              {load.status === "loading" ? (
                <span className="material-symbols-outlined animate-spin text-4xl text-primary">
                  progress_activity
                </span>
              ) : (
                <p className="px-6 text-center text-sm text-on-surface-variant">{load.message}</p>
              )}
            </div>
          )}

          {cropMode && load.status === "ready" && (
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="border border-white/25" />
              ))}
            </div>
          )}

          {showFrame && load.status === "ready" && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-row-reverse items-end justify-between bg-gradient-to-t from-black/90 via-black/30 to-transparent p-4">
              <div className="flex flex-row-reverse items-center gap-2.5 text-start">
                <StudioLogo size={44} />
                <p className="font-display text-2xl font-bold uppercase tracking-[0.2em] text-white [text-shadow:0_2px_6px_rgba(0,0,0,0.8)]">
                  PHOTO SANTOS
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Auto-optimize */}
        <button
          type="button"
          onClick={toggleAutoOptimize}
          disabled={load.status !== "ready"}
          className={`flex w-full items-center justify-between rounded-2xl border p-4 transition-all active:scale-[0.98] disabled:opacity-50 ${
            autoOptimizeOn
              ? "border-primary/40 bg-primary/10"
              : "border-white/5 bg-surface-container"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`rounded-xl p-2.5 ${autoOptimizeOn ? "bg-primary" : "bg-surface-container-high"}`}
            >
              <span
                className={`material-symbols-outlined ${autoOptimizeOn ? "text-on-primary" : "text-on-surface-variant"}`}
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                magic_button
              </span>
            </div>
            <div className="text-start">
              <h3 className="text-sm font-bold text-on-surface">
                שיפור אוטומטי
              </h3>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                אופטימיזציה חכמה של אור וצבע בלחיצה אחת
              </p>
            </div>
          </div>
          <span
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              autoOptimizeOn ? "bg-primary" : "bg-surface-container-highest"
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-md transition-all ${
                autoOptimizeOn ? "start-6" : "start-1"
              }`}
            />
          </span>
        </button>

        {/* Sliders */}
        <div className="space-y-5 rounded-2xl border border-white/5 bg-surface-container/60 p-5">
          <h2 className="text-sm font-bold text-on-surface-variant">
            כוונון ידני
          </h2>
          {SLIDERS.map((slider) => (
            <div key={slider.key} className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium text-on-surface">
                <span>{slider.label}</span>
                <span
                  className="font-bold text-primary"
                  style={{ unicodeBidi: "isolate", direction: "ltr" }}
                >
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
                className="w-full accent-primary disabled:opacity-50"
              />
            </div>
          ))}
        </div>

        {/* Crop/rotate + frame toggles */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setCropMode((v) => !v)}
            disabled={load.status !== "ready"}
            className={`flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all active:scale-[0.98] disabled:opacity-50 ${
              cropMode
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-white/5 bg-surface-container text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined">crop</span>
            <span className="text-sm font-bold">חיתוך וסיבוב</span>
          </button>
          <button
            type="button"
            onClick={() => setShowFrame((v) => !v)}
            disabled={load.status !== "ready"}
            className={`flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all active:scale-[0.98] disabled:opacity-50 ${
              showFrame
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-white/5 bg-surface-container text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined">frame_person</span>
            <span className="text-sm font-bold">מסגרת Photo Santos</span>
          </button>
        </div>

        {cropMode && (
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setRotation((r) => r - 90)}
              className="flex items-center gap-2 rounded-xl border border-white/5 bg-surface-container px-4 py-3 text-on-surface transition-all active:scale-95"
            >
              <span className="material-symbols-outlined">rotate_left</span>
              <span className="text-sm font-medium">סיבוב שמאלה</span>
            </button>
            <button
              type="button"
              onClick={() => setRotation((r) => r + 90)}
              className="flex items-center gap-2 rounded-xl border border-white/5 bg-surface-container px-4 py-3 text-on-surface transition-all active:scale-95"
            >
              <span className="material-symbols-outlined">rotate_right</span>
              <span className="text-sm font-medium">סיבוב ימינה</span>
            </button>
          </div>
        )}
      </main>

      {/* Sticky action bar — a real branded export: Save lands in the phone's
          Photos, Share opens the sheet with a caption. */}
      <div className="glass-panel fixed inset-x-0 bottom-0 z-50 border-t border-white/10 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <button
            type="button"
            onClick={() => runExport("share")}
            disabled={busy !== null || load.status !== "ready"}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-outline-variant/40 py-4 font-bold text-on-surface transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <span className={`material-symbols-outlined ${busy === "share" ? "animate-spin" : ""}`}>
              {busy === "share" ? "progress_activity" : "ios_share"}
            </span>
            שיתוף
          </button>
          <button
            type="button"
            onClick={() => runExport("save")}
            disabled={busy !== null || load.status !== "ready"}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-on-primary shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <span className={`material-symbols-outlined ${busy === "save" ? "animate-spin" : ""}`}>
              {busy === "save" ? "progress_activity" : "download"}
            </span>
            שמירת התמונה
          </button>
        </div>
      </div>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[60] mx-auto w-fit rounded-full bg-white/15 px-4 py-2 text-sm text-white backdrop-blur-md">
          {toast}
        </div>
      )}
    </div>
  );
}
