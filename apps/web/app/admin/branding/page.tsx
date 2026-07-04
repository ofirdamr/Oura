"use client";

// Photographer-facing Branding Settings, ported from
// oura_final_production_branding_settings_desktop_2 (picked over the other
// numbered variants per the established "pick the cleanest one" pattern -
// desktop_1's screen.png is actually a mismatched Gallery Entry screen, same
// class of folder/content bug already logged for gallery_entry_desktop).
// UI only for this pass: frame/color/watermark selections are local state,
// not yet persisted to events.branding in Supabase.

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { StudioLogo } from "@/components/brand/StudioLogo";

const FRAME_STYLES = [
  { key: "black", label: "שחור פסנתר", swatchClass: "bg-black" },
  { key: "crystal", label: "לבן קריסטל", swatchClass: "bg-white" },
  { key: "none", label: "ללא מסגרת", swatchClass: "border-2 border-dashed border-outline-variant bg-transparent" },
  { key: "silver", label: "כסף קלאסי", swatchClass: "bg-gradient-to-br from-gray-300 to-gray-400" },
] as const;

const BACKGROUND_THUMBS = ["globe", "ring", "gradient", "waves"] as const;

export default function BrandingSettingsPage() {
  const [frame, setFrame] = useState<(typeof FRAME_STYLES)[number]["key"]>("crystal");
  const [accentColor, setAccentColor] = useState("#FF8A75");
  const [autoWatermark, setAutoWatermark] = useState(true);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [activeBg, setActiveBg] = useState(3);

  const frameFrameClass =
    frame === "none"
      ? "border-0"
      : frame === "black"
        ? "border-[10px] border-black"
        : frame === "silver"
          ? "border-[10px] border-gray-300"
          : "border-[10px] border-white";

  return (
    <AdminShell active="הגדרות">
      <div className="flex flex-row-reverse items-start justify-between gap-4">
        <div className="text-end">
          <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            <span className="material-symbols-outlined text-sm">workspace_premium</span>
            מהדורת פלטינום
          </span>
          <h1 className="text-3xl font-bold text-on-surface">
            מיתוג ולוגו: Photo Santos
          </h1>
          <p className="mt-1 max-w-xl text-sm text-on-surface-variant">
            נהל את הזהות הוויזואלית של הסטודיו שלך. הגדרות אלו יחולו באופן
            אוטומטי על כל הגלריות והאירועים שתיצור במערכת Oura.
          </p>
        </div>
        <div className="flex shrink-0 flex-row-reverse gap-3">
          <button className="rounded-xl bg-primary px-6 py-3 font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:brightness-110 active:scale-95">
            שמור שינויים
          </button>
          <button className="rounded-xl border border-outline-variant px-6 py-3 font-bold text-on-surface transition-all hover:bg-surface-container-highest">
            ביטול
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* Live preview */}
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-5">
          <div className="mb-4 flex flex-row-reverse items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-on-surface">
              <span className="material-symbols-outlined text-base">visibility</span>
              תצוגה מקדימה חיה
            </h2>
            <div className="flex gap-1 rounded-lg bg-surface-container-high p-1">
              <button
                onClick={() => setDevice("desktop")}
                className={`rounded-md p-1.5 ${device === "desktop" ? "bg-primary text-on-primary" : "text-on-surface-variant"}`}
                aria-label="תצוגת מחשב"
              >
                <span className="material-symbols-outlined text-lg">computer</span>
              </button>
              <button
                onClick={() => setDevice("mobile")}
                className={`rounded-md p-1.5 ${device === "mobile" ? "bg-primary text-on-primary" : "text-on-surface-variant"}`}
                aria-label="תצוגת נייד"
              >
                <span className="material-symbols-outlined text-lg">smartphone</span>
              </button>
            </div>
          </div>

          <div className="flex min-h-80 items-center justify-center rounded-xl border border-outline-variant/20 bg-surface-container-low p-8">
            <div
              className={`relative overflow-hidden rounded-sm bg-black shadow-2xl ${frameFrameClass} ${device === "mobile" ? "aspect-[9/16] w-40" : "aspect-square w-64"}`}
            >
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-container-high to-black">
                <span className="material-symbols-outlined text-5xl text-on-surface-variant/20">
                  image
                </span>
              </div>
              <div className="absolute start-3 top-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
                <StudioLogo size={16} />
                Photo Santos © 2024
              </div>
              {autoWatermark && (
                <div
                  className="absolute bottom-3 end-3 flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-black"
                  style={{ backgroundColor: accentColor }}
                >
                  <StudioLogo size={14} />
                  Photo Santos
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex justify-center gap-2">
            {BACKGROUND_THUMBS.map((thumb, i) => (
              <button
                key={thumb}
                onClick={() => setActiveBg(i)}
                className={`flex h-14 w-14 items-center justify-center rounded-lg border-2 bg-surface-container-high text-xs font-bold text-on-surface-variant transition-all ${
                  activeBg === i ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <button className="mx-auto mt-4 flex items-center gap-1.5 rounded-full border border-outline-variant px-4 py-2 text-xs font-medium text-on-surface-variant transition-colors hover:text-primary">
            הגדל תצוגה
            <span className="material-symbols-outlined text-sm">zoom_in</span>
          </button>
        </div>

        {/* Settings */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-end text-sm font-bold text-on-surface">
              <span className="material-symbols-outlined text-base">add_photo_alternate</span>
              העלאת לוגו הסטודיו
            </h2>
            <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-outline-variant/50 p-8 text-center">
              <span className="material-symbols-outlined text-3xl text-on-surface-variant/50">
                add_photo_alternate
              </span>
              <p className="text-sm font-medium text-on-surface">גרור לוגו לכאן</p>
              <p className="text-xs text-on-surface-variant">
                PNG, SVG (רקע שקוף מומלץ)
              </p>
            </div>
            <div className="mt-3 flex flex-row-reverse items-center justify-between rounded-xl bg-surface-container-high px-4 py-3">
              <div className="flex flex-row-reverse items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black/40 p-1">
                  <StudioLogo size={32} />
                </div>
                <div className="text-end">
                  <p className="text-sm font-bold text-on-surface">
                    PhotoSantos_Platinum.png
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    24KB • גרסה אחרונה
                  </p>
                </div>
              </div>
              <button className="text-error" aria-label="מחק לוגו">
                <span className="material-symbols-outlined">delete</span>
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-end text-sm font-bold text-on-surface">
              <span className="material-symbols-outlined text-base">grid_view</span>
              סגנון מסגרת פרימיום
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {FRAME_STYLES.map((style) => (
                <button
                  key={style.key}
                  onClick={() => setFrame(style.key)}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all ${
                    frame === style.key ? "border-primary" : "border-outline-variant/30"
                  }`}
                >
                  <div className={`h-12 w-full rounded-md ${style.swatchClass}`} />
                  <span className="text-xs font-bold text-on-surface">
                    {style.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-end text-sm font-bold text-on-surface">
              <span className="material-symbols-outlined text-base">palette</span>
              צבעי המותג
            </h2>
            <div className="flex flex-row-reverse items-center justify-between">
              <div className="text-end">
                <p className="text-sm font-bold text-on-surface">צבע דגש ראשי</p>
                <p className="text-xs text-on-surface-variant">
                  צבע הלחצנים והאלמנטים בגלריה
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-on-surface-variant">
                  {accentColor.toUpperCase()}
                </span>
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded-full border border-outline-variant bg-transparent p-0"
                  aria-label="בחר צבע דגש"
                />
              </div>
            </div>
            <hr className="my-4 border-outline-variant/20" />
            <div className="flex flex-row-reverse items-center justify-between">
              <div className="text-end">
                <p className="text-sm font-bold text-on-surface">
                  סימן מים אוטומטי
                </p>
                <p className="text-xs text-on-surface-variant">
                  הוספת לוגו Photo Santos על תמונות
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAutoWatermark((v) => !v)}
                className={`relative h-7 w-12 rounded-full transition-colors ${
                  autoWatermark ? "bg-primary" : "bg-surface-container-highest"
                }`}
                aria-pressed={autoWatermark}
                aria-label="סימן מים אוטומטי"
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                    autoWatermark ? "end-1" : "start-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
