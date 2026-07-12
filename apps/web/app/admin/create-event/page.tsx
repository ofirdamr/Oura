"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type SubmitState = "idle" | "submitting" | "success";

const inputClasses =
  "h-12 w-full rounded-lg border border-outline-variant bg-surface-container-high ps-4 pe-11 text-start font-medium text-on-surface placeholder:font-normal placeholder:text-on-surface-variant/50 transition-all focus:border-2 focus:border-primary focus:outline-none";

const iconClasses =
  "material-symbols-outlined pointer-events-none absolute end-3 top-3 text-on-surface-variant/60";

// Mobile bottom-sheet field styling (matches the founder's mobile Stitch
// export: full-width pill inputs, leading icon at the start/right edge).
const mobileInput =
  "w-full rounded-xl border border-outline-variant bg-surface-high py-4 text-start text-base text-on-surface placeholder:text-on-surface-variant/60 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary";
const mobileIcon =
  "material-symbols-outlined pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-primary";

// Postgres unique_violation - see `code` column's partial-unique constraint
// added in migration 0002 (supabase/migrations).
const UNIQUE_VIOLATION = "23505";

// Transliterating Hebrew to Latin well is out of scope here (per CLAUDE.md
// guardrail against over-engineering this) - we only keep Latin/digit
// characters already present in the name and fall back to a short random
// code (matching the UI's own "WED-2024"-style placeholder) when the name
// has none, e.g. for Hebrew-only event names.
function slugifyEventName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "") // strip combining accents left by NFKD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function randomSuffix(length: number, alphabet: string): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

const LOWER_ALPHANUMERIC = "abcdefghijklmnopqrstuvwxyz0123456789";
const UPPER_ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateEventCode(name: string): string {
  const slug = slugifyEventName(name);
  if (slug) {
    return `${slug}-${randomSuffix(4, LOWER_ALPHANUMERIC)}`;
  }
  return `EVT-${randomSuffix(4, UPPER_ALPHANUMERIC)}`;
}

export default function CreateEventPage() {
  const router = useRouter();
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitState !== "idle") return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("event_name") ?? "").trim();
    const date = String(formData.get("event_date") ?? "").trim();
    // Location isn't a column on `events` yet (see migration 0001) - captured
    // visually only for now, matching the current schema.

    if (!name) {
      setError("אנא הזינו שם אירוע");
      return;
    }

    setError(null);
    setSubmitState("submitting");

    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSubmitState("idle");
      setError("לא ניתן לזהות את המשתמש המחובר. נסו להתחבר מחדש.");
      return;
    }

    const startsAt = date ? new Date(date).toISOString() : null;

    let insertedId: string | null = null;
    let lastErrorCode: string | undefined;

    for (let attempt = 0; attempt < 2 && !insertedId; attempt++) {
      const code = generateEventCode(name);
      const { data, error: insertError } = await supabase
        .from("events")
        .insert({
          photographer_id: user.id,
          name,
          starts_at: startsAt,
          status: "live",
          gallery_theme: "festive",
          code,
          branding: {},
        })
        .select()
        .single();

      if (!insertError && data) {
        insertedId = data.id as string;
        break;
      }

      lastErrorCode = insertError?.code;
      // Only retry once on a code collision - any other error should surface
      // immediately rather than silently retrying.
      if (insertError?.code !== UNIQUE_VIOLATION) {
        break;
      }
    }

    if (!insertedId) {
      setSubmitState("idle");
      setError(
        lastErrorCode === UNIQUE_VIOLATION
          ? "לא הצלחנו להפיק קוד אירוע ייחודי. נסו שוב."
          : "משהו השתבש ביצירת האירוע. בדקו את החיבור ונסו שוב.",
      );
      return;
    }

    setSubmitState("success");
    router.push(`/admin/branding?event_id=${insertedId}`);
  }

  return (
    <AdminShell active="אירועים פעילים">
      <div className="hidden justify-center md:flex">
        <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-outline-variant bg-surface-container shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-high px-6 py-5 md:px-8 md:py-6">
            <Link
              href="/admin"
              className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
              aria-label="סגור"
            >
              <span className="material-symbols-outlined">close</span>
            </Link>
            <div className="flex flex-col items-end">
              <h1 className="text-2xl font-bold text-primary md:text-3xl">
                אירוע חדש
              </h1>
              <p className="text-sm text-on-surface-variant">
                הזן פרטים ליצירת גלריה חכמה עבור Photo Santos
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-8 p-6 md:p-8">
            {/* Event name */}
            <div className="space-y-1.5">
              <label
                htmlFor="event_name"
                className="block text-start text-sm font-bold text-on-surface-variant"
              >
                שם האירוע
              </label>
              <div className="relative">
                <input
                  id="event_name"
                  name="event_name"
                  type="text"
                  required
                  placeholder="למשל: חתונת יוסי ודנה"
                  className={inputClasses}
                />
                <span className={iconClasses}>celebration</span>
              </div>
            </div>

            {/* Date + location */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="event_date"
                  className="block text-start text-sm font-bold text-on-surface-variant"
                >
                  תאריך האירוע
                </label>
                <div className="relative">
                  <input
                    id="event_date"
                    name="event_date"
                    type="date"
                    required
                    className={inputClasses}
                  />
                  <span className={iconClasses}>calendar_today</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="event_location"
                  className="block text-start text-sm font-bold text-on-surface-variant"
                >
                  מיקום
                </label>
                <div className="relative">
                  <input
                    id="event_location"
                    name="event_location"
                    type="text"
                    placeholder="שם האולם או העיר"
                    className={inputClasses}
                  />
                  <span className={iconClasses}>location_on</span>
                </div>
              </div>
            </div>

            {/* Aesthetic divider */}
            <div className="relative flex justify-center border-t border-dashed border-outline-variant">
              <span className="-mt-3 bg-surface-container px-4 text-xs font-medium text-on-surface-variant/70">
                אפשרויות נוספות
              </span>
            </div>

            {/* Auto-barcode preview card */}
            <div className="flex flex-row-reverse items-center gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-highest p-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-white">
                <span className="material-symbols-outlined text-3xl text-black/70">
                  qr_code_2
                </span>
              </div>
              <div className="flex-1 text-start">
                <div className="text-sm font-bold text-primary">
                  הפקת ברקוד אוטומטית
                </div>
                <div className="text-xs text-on-surface-variant">
                  לאחר היצירה יופק דף נחיתה וברקוד לסריקה עבור האורחים.
                </div>
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-center text-sm text-error">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-4 pt-2 md:flex-row-reverse">
              <button
                type="submit"
                disabled={submitState !== "idle"}
                className={`flex h-14 flex-1 items-center justify-center gap-2 rounded-xl text-lg font-bold shadow-lg transition-all active:scale-[0.98] disabled:active:scale-100 ${
                  submitState === "success"
                    ? "bg-success text-on-primary"
                    : "bg-primary text-on-primary hover:brightness-110"
                }`}
              >
                {submitState === "idle" && (
                  <>
                    <span>הפקה גלריה וברקוד</span>
                    <span className="material-symbols-outlined">
                      qr_code_2
                    </span>
                  </>
                )}
                {submitState === "submitting" && (
                  <>
                    <span className="material-symbols-outlined animate-spin">
                      sync
                    </span>
                    <span>מעבד נתונים...</span>
                  </>
                )}
                {submitState === "success" && (
                  <>
                    <span className="material-symbols-outlined">
                      check_circle
                    </span>
                    <span>הושלם בהצלחה</span>
                  </>
                )}
              </button>
              <Link
                href="/admin"
                className="flex h-14 items-center justify-center rounded-xl border border-outline-variant px-8 font-bold text-on-surface transition-all hover:bg-surface-container-highest active:scale-[0.98]"
              >
                ביטול
              </Link>
            </div>
          </form>
        </div>
      </div>

      {/* Mobile bottom-sheet (founder's mobile Stitch export). Own <form> so
          only the visible layout's fields submit; barcode toggle intentionally
          omitted - a code+QR is always generated (founder decision 2026-07-12). */}
      <div className="-m-6 md:hidden">
        <div className="flex min-h-[calc(100dvh-4rem)] flex-col rounded-t-[32px] bg-surface-container-low px-6 pb-10 pt-4">
          <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-surface-container-highest" />

          <div className="mb-8 flex items-start justify-between">
            <Link
              href="/admin"
              aria-label="סגור"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-on-surface transition-transform active:scale-95"
            >
              <span className="material-symbols-outlined">close</span>
            </Link>
            <div className="flex flex-col items-end gap-1 text-end">
              <h1 className="text-2xl font-bold text-on-surface">אירוע חדש</h1>
              <p className="text-sm text-on-surface-variant/80">
                הזן פרטים ליצירת גלריה חכמה
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-6">
            {/* Event name */}
            <div className="space-y-2">
              <label
                htmlFor="event_name_m"
                className="block text-start text-xs font-medium text-on-surface-variant"
              >
                שם האירוע
              </label>
              <input
                id="event_name_m"
                name="event_name"
                type="text"
                required
                placeholder="למשל: חתונת יוסי ודנה"
                className={`${mobileInput} px-4`}
              />
            </div>

            {/* Location */}
            <div className="space-y-2">
              <label
                htmlFor="event_location_m"
                className="block text-start text-xs font-medium text-on-surface-variant"
              >
                מיקום
              </label>
              <div className="relative">
                <span className={mobileIcon}>location_on</span>
                <input
                  id="event_location_m"
                  name="event_location"
                  type="text"
                  placeholder="חיפוש אולם או עיר"
                  className={`${mobileInput} ps-12 pe-4`}
                />
              </div>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <label
                htmlFor="event_date_m"
                className="block text-start text-xs font-medium text-on-surface-variant"
              >
                תאריך האירוע
              </label>
              <div className="relative">
                <span className={mobileIcon}>calendar_today</span>
                <input
                  id="event_date_m"
                  name="event_date"
                  type="date"
                  required
                  className={`${mobileInput} appearance-none ps-12 pe-4`}
                />
              </div>
            </div>

            {/* Auto-barcode preview (no toggle - always generated) */}
            <div className="rounded-[24px] border border-outline-variant/30 bg-surface-container-high p-5">
              <div className="mb-4 flex flex-col gap-1 text-end">
                <h3 className="text-lg font-bold text-on-surface">
                  הפקת ברקוד אוטומטית
                </h3>
                <p className="text-xs text-on-surface-variant">
                  האורחים יסרקו ויקבלו גישה לגלריה
                </p>
              </div>
              <div className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface">
                <div className="flex h-48 w-24 translate-y-4 rotate-6 flex-col rounded-xl border border-surface-bright bg-surface-container p-2 shadow-2xl">
                  <div className="mb-4 h-2 w-full rounded-full bg-outline-variant/30" />
                  <div className="mb-2 flex aspect-square w-full items-center justify-center rounded-lg bg-white">
                    <span className="material-symbols-outlined text-5xl text-black/80">
                      qr_code_2
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 w-10/12 rounded-full bg-outline-variant/40" />
                    <div className="h-1.5 w-8/12 rounded-full bg-outline-variant/40" />
                  </div>
                </div>
                <div className="absolute inset-x-6 bottom-4 flex items-center justify-center gap-2 text-primary">
                  <span className="material-symbols-outlined text-[16px]">
                    verified
                  </span>
                  <span className="text-xs font-medium">הפקה חכמה מופעלת</span>
                </div>
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-center text-sm text-error">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="mt-auto flex flex-col gap-3 pt-4">
              <button
                type="submit"
                disabled={submitState !== "idle"}
                className={`flex h-14 items-center justify-center gap-2 rounded-xl text-base font-bold shadow-lg transition-all active:scale-[0.98] disabled:active:scale-100 ${
                  submitState === "success"
                    ? "bg-success text-on-primary"
                    : "bg-primary text-on-primary hover:brightness-110"
                }`}
              >
                {submitState === "idle" && <span>הפקה גלריה וברקוד</span>}
                {submitState === "submitting" && (
                  <>
                    <span className="material-symbols-outlined animate-spin">
                      sync
                    </span>
                    <span>מעבד נתונים...</span>
                  </>
                )}
                {submitState === "success" && (
                  <>
                    <span className="material-symbols-outlined">
                      check_circle
                    </span>
                    <span>הושלם בהצלחה</span>
                  </>
                )}
              </button>
              <Link
                href="/admin"
                className="flex h-14 items-center justify-center rounded-xl border border-outline-variant/50 font-bold text-on-surface-variant transition-all hover:bg-surface-container-highest active:scale-[0.98]"
              >
                ביטול
              </Link>
            </div>
          </form>
        </div>
      </div>
    </AdminShell>
  );
}
