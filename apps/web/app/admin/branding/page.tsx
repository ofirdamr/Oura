"use client";

// Photographer-facing Branding Settings, ported from
// oura_final_production_branding_settings_desktop_2 (picked over the other
// numbered variants per the established "pick the cleanest one" pattern -
// desktop_1's screen.png is actually a mismatched Gallery Entry screen, same
// class of folder/content bug already logged for gallery_entry_desktop).
// Frame/color/watermark selections are persisted to the `branding` jsonb
// column on the `events` row identified by the `?event_id=` query param
// (threaded through from create-event -> branding -> qr-management, since
// branding lives per-event in this schema, not on a separate studio-profile
// table).

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { StudioLogo } from "@/components/brand/StudioLogo";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { API_BASE_URL } from "@/lib/api";

// Order matches the design's 2x2 grid reading right-to-left per row (row 1:
// crystal right/black left; row 2: silver right/none left) — a plain
// `grid-cols-2` places DOM order 1..4 into row1-col1(right)/row1-col2(left)/
// row2-col1(right)/row2-col2(left) under RTL, so this array order IS the
// visual order, not just a data list.
const FRAME_STYLES = [
  { key: "crystal", label: "לבן קריסטל", swatchClass: "bg-white" },
  { key: "black", label: "שחור פסנתר", swatchClass: "bg-black" },
  { key: "silver", label: "כסף קלאסי", swatchClass: "bg-gradient-to-br from-gray-300 to-gray-400" },
  { key: "none", label: "ללא מסגרת", swatchClass: "border-2 border-dashed border-outline-variant bg-transparent" },
] as const;

type FrameKey = (typeof FRAME_STYLES)[number]["key"];

const FRAME_KEYS = FRAME_STYLES.map((f) => f.key) as readonly string[];

// Lets the photographer preview their frame/logo/watermark against a few
// different photo moods (a bright outdoor shot, a dark reception shot, etc.)
// since a frame that looks great on one photo can look wrong on another.
// Real gradient/icon swap in the live preview below, not just a selected
// state with no visible effect.
const BACKGROUND_THUMBS = [
  { key: "globe", icon: "public", gradient: "from-indigo-950 via-indigo-900 to-black" },
  { key: "ring", icon: "album", gradient: "from-cyan-950 via-cyan-900 to-black" },
  { key: "gradient", icon: "gradient", gradient: "from-fuchsia-950 via-fuchsia-900 to-black" },
  { key: "waves", icon: "waves", gradient: "from-teal-950 via-teal-900 to-black" },
] as const;

type SaveState = "idle" | "saving" | "saved" | "error";

export default function BrandingSettingsPage() {
  return (
    <Suspense fallback={null}>
      <BrandingSettingsPageInner />
    </Suspense>
  );
}

function BrandingSettingsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("event_id");

  const [frame, setFrame] = useState<FrameKey>("crystal");
  const [accentColor, setAccentColor] = useState("#FF8A75");
  const [autoWatermark, setAutoWatermark] = useState(true);
  // Title composited onto shared/downloaded guest photos (e.g. "החתונה של…").
  const [eventTitle, setEventTitle] = useState("");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [activeBg, setActiveBg] = useState(3);

  const [eventName, setEventName] = useState<string | null>(null);
  // Full branding object as last read from the row - preserved and merged on
  // save so we never clobber keys another part of the system (e.g. the
  // logo-upload endpoint) may have already written, like `logo_key`.
  const [existingBranding, setExistingBranding] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(!!eventId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [showEnlarged, setShowEnlarged] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!eventId) {
      return;
    }

    let cancelled = false;

    async function load(id: string) {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("events")
        .select("name, branding, gallery_theme")
        .eq("id", id)
        .single();

      if (cancelled) return;

      if (error || !data) {
        setLoadError("לא הצלחנו לטעון את פרטי האירוע. נסו לרענן את הדף.");
        setLoading(false);
        return;
      }

      setEventName(typeof data.name === "string" ? data.name : null);

      const branding = (data.branding ?? {}) as Record<string, unknown>;
      setExistingBranding(branding);

      if (typeof branding.frame === "string" && FRAME_KEYS.includes(branding.frame)) {
        setFrame(branding.frame as FrameKey);
      }
      if (typeof branding.primary_color === "string") {
        setAccentColor(branding.primary_color);
      }
      if (typeof branding.auto_watermark === "boolean") {
        setAutoWatermark(branding.auto_watermark);
      }
      if (typeof branding.event_title === "string") {
        setEventTitle(branding.event_title);
      }
      if (typeof branding.logo_key === "string" && branding.logo_key) {
        setLogoUrl(`${API_BASE_URL}/media/${branding.logo_key}`);
      }

      setLoading(false);
    }

    void load(eventId);
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  async function handleLogoFileSelected(file: File | undefined) {
    if (!file || !eventId) return;
    setLogoError(null);
    setLogoUploading(true);

    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setLogoUploading(false);
      setLogoError("יש להתחבר מחדש כדי להעלות לוגו.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE_URL}/events/${eventId}/branding/logo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const body = (await res.json().catch(() => null)) as { logo_key?: string; url?: string } | null;

      if (!res.ok || !body?.logo_key) {
        setLogoError("העלאת הלוגו נכשלה. נסו שוב.");
        setLogoUploading(false);
        return;
      }

      setExistingBranding((prev) => ({ ...prev, logo_key: body.logo_key }));
      setLogoUrl(body.url ?? `${API_BASE_URL}/media/${body.logo_key}`);
    } catch {
      setLogoError("העלאת הלוגו נכשלה. בדקו את החיבור ונסו שוב.");
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleSave() {
    if (!eventId || saveState === "saving") return;

    setSaveState("saving");
    const supabase = createSupabaseBrowserClient();
    const nextBranding = {
      ...existingBranding,
      frame,
      primary_color: accentColor,
      auto_watermark: autoWatermark,
      event_title: eventTitle.trim(),
    };

    const { error } = await supabase
      .from("events")
      .update({ branding: nextBranding })
      .eq("id", eventId);

    if (error) {
      setSaveState("error");
      return;
    }

    setExistingBranding(nextBranding);
    setSaveState("saved");
    router.push(`/admin/qr-management?event_id=${eventId}`);
  }

  const frameFrameClass =
    frame === "none"
      ? "border-0"
      : frame === "black"
        ? "border-[10px] border-black"
        : frame === "silver"
          ? "border-[10px] border-gray-300"
          : "border-[10px] border-white";

  if (!eventId) {
    return (
      <AdminShell active="הגדרות">
        <div className="mx-auto max-w-md py-20 text-center">
          <p className="mb-4 text-on-surface-variant">
            לא נבחר אירוע לעריכת מיתוג. יש ליצור אירוע חדש כדי להמשיך.
          </p>
          <Link
            href="/admin/create-event"
            className="font-bold text-primary underline underline-offset-4"
          >
            צור אירוע חדש
          </Link>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell active="הגדרות">
      <div className="flex items-start justify-between gap-4">
        <div className="text-start">
          <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            <span className="material-symbols-outlined text-sm">workspace_premium</span>
            מהדורת פלטינום
          </span>
          <h1 className="text-3xl font-bold text-on-surface">
            מיתוג ולוגו: {eventName ?? "טוען..."}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-on-surface-variant">
            נהל את הזהות הוויזואלית של הסטודיו שלך. הגדרות אלו יחולו באופן
            אוטומטי על כל הגלריות והאירועים שתיצור במערכת Oura.
          </p>
        </div>
        {/* Desktop only (matches oura_final_production_branding_settings_desktop_2):
            Save/Cancel sit beside the title. On mobile the actual design
            (branding_settings_mobile_2) moves these to a full-width stacked
            pair at the very end of the page instead - see below. */}
        <div className="hidden shrink-0 flex-col items-end gap-2 lg:flex">
          <div className="flex flex-row-reverse gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || saveState === "saving"}
              className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:brightness-110 active:scale-95 disabled:opacity-60"
            >
              {saveState === "saving" && (
                <span className="material-symbols-outlined animate-spin text-lg">
                  sync
                </span>
              )}
              {saveState === "saving"
                ? "שומר..."
                : saveState === "saved"
                  ? "נשמר!"
                  : "שמור שינויים"}
            </button>
            <Link
              href="/admin"
              className="rounded-xl border border-outline-variant px-6 py-3 font-bold text-on-surface transition-all hover:bg-surface-container-highest"
            >
              ביטול
            </Link>
          </div>
          {saveState === "error" && (
            <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
              שמירת המיתוג נכשלה. נסו שוב.
            </p>
          )}
        </div>
      </div>

      {loadError && (
        <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-center text-sm text-error">
          {loadError}
        </p>
      )}

      {/* Design (branding_settings_desktop_2) puts the live preview on the
          left and the settings cards on the right. A plain DOM-order grid
          under dir="rtl" auto-places the first child into the rightmost
          track, which put the preview (written first for readability) on
          the wrong side - measured live at left:787/right:1340 (right half)
          before this fix. Both panels are pinned with `order` to match the
          design instead of relying on source order. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Live preview */}
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-5 lg:order-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-on-surface">
              <span className="material-symbols-outlined text-base">visibility</span>
              תצוגה מקדימה חיה
            </h2>
            <div className="flex gap-1 rounded-lg bg-surface-container-high p-1">
              <button
                onClick={() => setDevice("mobile")}
                className={`rounded-md p-1.5 ${device === "mobile" ? "bg-primary text-on-primary" : "text-on-surface-variant"}`}
                aria-label="תצוגת נייד"
              >
                <span className="material-symbols-outlined text-lg">smartphone</span>
              </button>
              <button
                onClick={() => setDevice("desktop")}
                className={`rounded-md p-1.5 ${device === "desktop" ? "bg-primary text-on-primary" : "text-on-surface-variant"}`}
                aria-label="תצוגת מחשב"
              >
                <span className="material-symbols-outlined text-lg">computer</span>
              </button>
            </div>
          </div>

          <div className="flex min-h-80 items-center justify-center rounded-xl border border-outline-variant/20 bg-surface-container-low p-8">
            <div
              className={`relative overflow-hidden rounded-sm bg-black shadow-2xl ${frameFrameClass} ${device === "mobile" ? "aspect-[9/16] w-40" : "aspect-square w-64"}`}
            >
              <div
                className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${BACKGROUND_THUMBS[activeBg].gradient}`}
              >
                <span className="material-symbols-outlined text-5xl text-on-surface-variant/30">
                  {BACKGROUND_THUMBS[activeBg].icon}
                </span>
              </div>
              <div className="absolute start-3 top-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded logo, next/image would need this exact host allow-listed
                  <img src={logoUrl} alt="לוגו הסטודיו" className="h-4 w-4 object-contain" />
                ) : (
                  <StudioLogo size={16} />
                )}
                Photo Santos © 2024
              </div>
              {autoWatermark && (
                <div
                  className="absolute bottom-3 start-3 flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-black"
                  style={{ backgroundColor: accentColor }}
                >
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded logo, next/image would need this exact host allow-listed
                    <img src={logoUrl} alt="לוגו הסטודיו" className="h-3.5 w-3.5 object-contain" />
                  ) : (
                    <StudioLogo size={14} />
                  )}
                  Photo Santos
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex justify-center gap-2">
            {BACKGROUND_THUMBS.map((thumb, i) => (
              <button
                key={thumb.key}
                type="button"
                onClick={() => setActiveBg(i)}
                aria-label={`תצוגה מקדימה על רקע ${thumb.key}`}
                aria-pressed={activeBg === i}
                className={`flex h-14 w-14 items-center justify-center rounded-lg border-2 bg-gradient-to-br text-on-surface-variant transition-all ${thumb.gradient} ${
                  activeBg === i ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                <span className="material-symbols-outlined text-lg">{thumb.icon}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowEnlarged(true)}
            className="mx-auto mt-4 flex items-center gap-1.5 rounded-full border border-outline-variant px-4 py-2 text-xs font-medium text-on-surface-variant transition-colors hover:text-primary"
          >
            הגדל תצוגה
            <span className="material-symbols-outlined text-sm">zoom_in</span>
          </button>
        </div>

        {showEnlarged && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-6 backdrop-blur-md"
            onClick={() => setShowEnlarged(false)}
          >
            <button
              type="button"
              onClick={() => setShowEnlarged(false)}
              aria-label="סגור"
              className="absolute end-6 top-6 rounded-full bg-surface-container-high p-2 text-on-surface transition-colors hover:text-primary"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <div
              className={`relative overflow-hidden rounded-sm bg-black shadow-2xl ${frameFrameClass} ${
                device === "mobile" ? "aspect-[9/16] w-72" : "aspect-square w-[28rem] max-w-[85vw]"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${BACKGROUND_THUMBS[activeBg].gradient}`}
              >
                <span className="material-symbols-outlined text-7xl text-on-surface-variant/30">
                  {BACKGROUND_THUMBS[activeBg].icon}
                </span>
              </div>
              <div className="absolute start-3 top-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded logo, next/image would need this exact host allow-listed
                  <img src={logoUrl} alt="לוגו הסטודיו" className="h-4 w-4 object-contain" />
                ) : (
                  <StudioLogo size={16} />
                )}
                Photo Santos © 2024
              </div>
              {autoWatermark && (
                <div
                  className="absolute bottom-3 start-3 flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-black"
                  style={{ backgroundColor: accentColor }}
                >
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded logo, next/image would need this exact host allow-listed
                    <img src={logoUrl} alt="לוגו הסטודיו" className="h-3.5 w-3.5 object-contain" />
                  ) : (
                    <StudioLogo size={14} />
                  )}
                  Photo Santos
                </div>
              )}
            </div>
          </div>
        )}

        {/* Settings */}
        <div className="space-y-6 lg:order-1">
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-start text-sm font-bold text-on-surface">
              <span className="material-symbols-outlined text-base">add_photo_alternate</span>
              העלאת לוגו הסטודיו
            </h2>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void handleLogoFileSelected(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                void handleLogoFileSelected(e.dataTransfer.files?.[0]);
              }}
              disabled={logoUploading}
              className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors disabled:opacity-60 ${
                dragOver ? "border-primary bg-primary/5" : "border-outline-variant/50 hover:border-primary/50"
              }`}
            >
              <span className="material-symbols-outlined text-3xl text-on-surface-variant/50">
                {logoUploading ? "progress_activity" : "add_photo_alternate"}
              </span>
              <p className="text-sm font-medium text-on-surface">
                {logoUploading ? "מעלה לוגו..." : "גררו לוגו לכאן או לחצו לבחירה"}
              </p>
              <p className="text-xs text-on-surface-variant">
                PNG, SVG (רקע שקוף מומלץ)
              </p>
            </button>
            {logoError && (
              <p className="mt-2 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-center text-sm text-error">
                {logoError}
              </p>
            )}
            {logoUrl && (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-container-high px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-black/40 p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded logo, next/image would need this exact host allow-listed */}
                    <img src={logoUrl} alt="לוגו הסטודיו" className="h-full w-full object-contain" />
                  </div>
                  <p className="text-sm font-bold text-on-surface">הלוגו הנוכחי</p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-start text-sm font-bold text-on-surface">
              <span className="material-symbols-outlined text-base">title</span>
              כותרת לשיתוף
            </h2>
            <input
              type="text"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              placeholder="לדוגמה: החתונה של דניאל ומיכל"
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-start text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none"
            />
            <p className="mt-2 text-start text-xs text-on-surface-variant">
              הכותרת מוטבעת יחד עם המסגרת והלוגו על כל תמונה שאורח מוריד או משתף.
            </p>
          </div>

          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-start text-sm font-bold text-on-surface">
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
            <h2 className="mb-3 flex items-center gap-1.5 text-start text-sm font-bold text-on-surface">
              <span className="material-symbols-outlined text-base">palette</span>
              צבעי המותג
            </h2>
            <div className="flex items-center justify-between">
              <div className="text-start">
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
            <div className="flex items-center justify-between">
              <div className="text-start">
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

      {/* Mobile only (matches branding_settings_mobile_2): full-width stacked
          Save/Cancel at the end of the page, not beside the title. */}
      <div className="flex flex-col gap-3 lg:hidden">
        <button
          type="button"
          onClick={handleSave}
          disabled={loading || saveState === "saving"}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:brightness-110 active:scale-95 disabled:opacity-60"
        >
          {saveState === "saving" && (
            <span className="material-symbols-outlined animate-spin text-lg">
              sync
            </span>
          )}
          {saveState === "saving"
            ? "שומר..."
            : saveState === "saved"
              ? "נשמר!"
              : "שמירת שינויים"}
        </button>
        <Link
          href="/admin"
          className="w-full rounded-xl border border-outline-variant px-6 py-3 text-center font-bold text-on-surface transition-all hover:bg-surface-container-highest"
        >
          ביטול
        </Link>
        {saveState === "error" && (
          <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-center text-sm text-error">
            שמירת המיתוג נכשלה. נסו שוב.
          </p>
        )}
      </div>
    </AdminShell>
  );
}
