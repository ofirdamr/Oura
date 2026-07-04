"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AdminShell } from "@/components/admin/AdminShell";

type SubmitState = "idle" | "submitting" | "success";

const inputClasses =
  "h-12 w-full rounded-lg border border-outline-variant bg-surface-container-high ps-4 pe-11 text-end font-medium text-on-surface placeholder:font-normal placeholder:text-on-surface-variant/50 transition-all focus:border-2 focus:border-primary focus:outline-none";

const iconClasses =
  "material-symbols-outlined pointer-events-none absolute end-3 top-3 text-on-surface-variant/60";

export default function CreateEventPage() {
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitState !== "idle") return;
    // TODO: wire to POST /events (backend agent working in parallel) — this
    // is a UI-only local-state simulation for now, matching the source
    // design's own front-end-only interaction script.
    setSubmitState("submitting");
    setTimeout(() => setSubmitState("success"), 1500);
  }

  return (
    <AdminShell active="אירועים">
      <div className="flex justify-center">
        <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-outline-variant bg-surface-container shadow-2xl">
          {/* Header */}
          <div className="flex flex-row-reverse items-center justify-between border-b border-outline-variant bg-surface-container-high px-6 py-5 md:px-8 md:py-6">
            <div className="flex flex-col items-end">
              <h1 className="text-2xl font-bold text-primary md:text-3xl">
                אירוע חדש
              </h1>
              <p className="text-sm text-on-surface-variant">
                הזן פרטים ליצירת גלריה חכמה עבור Photo Santos
              </p>
            </div>
            <Link
              href="/admin"
              className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
              aria-label="סגור"
            >
              <span className="material-symbols-outlined">close</span>
            </Link>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-8 p-6 md:p-8">
            {/* Event name */}
            <div className="space-y-1.5">
              <label
                htmlFor="event_name"
                className="block text-end text-sm font-bold text-on-surface-variant"
              >
                שם האירוע
              </label>
              <div className="relative">
                <input
                  id="event_name"
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
                  className="block text-end text-sm font-bold text-on-surface-variant"
                >
                  תאריך האירוע
                </label>
                <div className="relative">
                  <input
                    id="event_date"
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
                  className="block text-end text-sm font-bold text-on-surface-variant"
                >
                  מיקום
                </label>
                <div className="relative">
                  <input
                    id="event_location"
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
              <div className="flex-1 text-end">
                <div className="text-sm font-bold text-primary">
                  הפקת ברקוד אוטומטית
                </div>
                <div className="text-xs text-on-surface-variant">
                  לאחר היצירה יופק דף נחיתה וברקוד לסריקה עבור האורחים.
                </div>
              </div>
            </div>

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
    </AdminShell>
  );
}
