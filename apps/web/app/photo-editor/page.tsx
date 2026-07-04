"use client";

// Photo Editor: a guest adjusts one selected photo before sharing/downloading.
// Source design (oura_final_production_photo_editor_mobile/_desktop) actually
// exports a full event-gallery page whose real "editor" content lives inside a
// hidden lightbox side panel (triggered by a "עריכה מתקדמת"/"עריכה מקצועית"
// button in code.html, never visible in the static screen.png) - per
// CLAUDE.md's match-screen.png-not-folder-name guardrail, but also per this
// task's explicit brief, what's actually being ported here is that editor
// panel's controls (brightness/contrast/saturation/exposure sliders,
// auto-optimize, crop & rotate, branded frame/watermark), promoted to their
// own full screen rather than a gallery-embedded drawer. Sliders/toggles are
// wired to real local state driving a CSS filter + transform on the
// placeholder tile - no real image processing backend exists yet.

import { useState } from "react";
import { OuraLogo } from "@/components/brand/OuraLogo";
import { StudioLogo } from "@/components/brand/StudioLogo";

type SliderKey = "brightness" | "contrast" | "saturation" | "exposure";

const SLIDERS: { key: SliderKey; label: string }[] = [
  { key: "brightness", label: "בהירות" },
  { key: "contrast", label: "ניגודיות" },
  { key: "saturation", label: "רוויה" },
  { key: "exposure", label: "חשיפה" },
];

const NEUTRAL_VALUES: Record<SliderKey, number> = {
  brightness: 0,
  contrast: 12,
  saturation: 5,
  exposure: 0,
};

const ENHANCED_VALUES: Record<SliderKey, number> = {
  brightness: 18,
  contrast: 24,
  saturation: 20,
  exposure: 12,
};

export default function PhotoEditorPage() {
  const [values, setValues] = useState<Record<SliderKey, number>>(NEUTRAL_VALUES);
  const [autoOptimizeOn, setAutoOptimizeOn] = useState(false);
  const [showFrame, setShowFrame] = useState(true);
  const [cropMode, setCropMode] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [savedAt, setSavedAt] = useState<number | null>(null);

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

  function handleSave() {
    // TODO(no backend yet): a real photo editor would persist crop/filter
    // state (and re-render the branded export) via the processing pipeline.
    // Purely a local confirmation affordance for this mock.
    setSavedAt(Date.now());
    window.setTimeout(() => setSavedAt(null), 2500);
  }

  const brightnessFactor = clamp(
    1 + (values.brightness / 100) * 0.5 + (values.exposure / 100) * 0.3,
    0.4,
    1.8,
  );
  const contrastFactor = clamp(1 + values.contrast / 100, 0.4, 1.8);
  const saturateFactor = clamp(1 + values.saturation / 100, 0, 2);

  const filter = `brightness(${brightnessFactor}) contrast(${contrastFactor}) saturate(${saturateFactor})`;

  return (
    <div className="min-h-screen pb-32">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg flex-row-reverse items-center justify-between px-4">
          <button
            type="button"
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
          <div
            className="h-full w-full transition-[filter] duration-200"
            style={{ filter }}
          >
            <div
              className="flex h-full w-full items-center justify-center transition-transform duration-300"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              <span className="material-symbols-outlined text-7xl text-on-surface-variant/30">
                image
              </span>
            </div>
          </div>

          {cropMode && (
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="border border-white/25" />
              ))}
            </div>
          )}

          {showFrame && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-row-reverse items-end justify-between bg-gradient-to-t from-black/90 via-black/30 to-transparent p-4">
              <div className="flex flex-row-reverse items-center gap-2 text-end">
                <StudioLogo size={28} />
                <div>
                  <p className="font-display text-base font-bold uppercase tracking-[0.2em] text-white [text-shadow:0_2px_6px_rgba(0,0,0,0.8)]">
                    PHOTO SANTOS
                  </p>
                  <div className="mt-1 flex flex-row-reverse items-center gap-1.5 text-white/60">
                    <OuraLogo size={12} />
                    <span className="text-[10px] font-medium">
                      מופעל על ידי Oura — הצלם הרשמי של האירוע
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Auto-optimize */}
        <button
          type="button"
          onClick={toggleAutoOptimize}
          className={`flex w-full items-center justify-between rounded-2xl border p-4 transition-all active:scale-[0.98] ${
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
                className="w-full accent-primary"
              />
            </div>
          ))}
        </div>

        {/* Crop/rotate + frame toggles */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setCropMode((v) => !v)}
            className={`flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all active:scale-[0.98] ${
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
            className={`flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all active:scale-[0.98] ${
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

      {/* Sticky save bar */}
      <div className="glass-panel fixed inset-x-0 bottom-0 z-50 border-t border-white/10 p-4">
        <div className="mx-auto max-w-lg space-y-2">
          {savedAt && (
            <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-success">
              <span className="material-symbols-outlined text-base">
                check_circle
              </span>
              השינויים נשמרו
            </p>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-on-primary shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
          >
            שמירת שינויים
          </button>
        </div>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
