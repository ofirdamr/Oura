"use client";

// Photographer-facing Barcode/QR Management, ported from
// oura_final_production_barcode_management_desktop. Shown right after Create
// New Event completes: the event's QR code, physical/digital distribution
// options, and a direct gallery link. UI only for this pass - print/download/
// share actions are not wired to anything real yet (no PDF/PNG generation, no
// share-target integration); copy-to-clipboard on the ID and link IS real,
// since it's pure client-side and free.

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";

const EVENT_ID = "PHOTO-8829-PS";
const GALLERY_LINK = "photosantos.co/gallery/ps-8829-xl";

const SHARE_TARGETS = [
  { label: "אימייל", accent: false },
  { label: "WhatsApp", accent: true },
  { label: "Telegram", accent: false },
  { label: "Instagram", accent: false },
] as const;

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard API unavailable (permissions/non-secure context) - non-fatal.
        }
      }}
      className="flex items-center gap-1.5 text-on-surface-variant transition-colors hover:text-primary"
      aria-label={label}
    >
      <span className="material-symbols-outlined text-base">
        {copied ? "check" : "content_copy"}
      </span>
    </button>
  );
}

export default function QrManagementPage() {
  const [printOpen, setPrintOpen] = useState(false);

  return (
    <AdminShell active="אירועים">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <span className="material-symbols-outlined text-3xl text-primary">
            check_circle
          </span>
        </div>
        <h1 className="text-2xl font-bold text-on-surface">
          האירוע נוצר בהצלחה!
        </h1>
        <p className="mt-1 text-on-surface-variant">
          הגלריה של Photo Santos מוכנה. הנה הקוד לסריקה וגישה מהירה.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-end text-sm font-bold text-on-surface">
              <span className="material-symbols-outlined text-base">print</span>
              ניהול פיזי ותצוגה
            </h2>
            <div className="space-y-2">
              <div className="overflow-hidden rounded-xl">
                <button
                  type="button"
                  onClick={() => setPrintOpen((v) => !v)}
                  className="flex w-full flex-row-reverse items-center justify-between bg-primary px-5 py-3.5 font-bold text-on-primary transition-all hover:brightness-110"
                >
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined">print</span>
                    הדפסת קוד QR
                  </span>
                  <span
                    className={`material-symbols-outlined transition-transform ${printOpen ? "rotate-180" : ""}`}
                  >
                    expand_more
                  </span>
                </button>
                {printOpen && (
                  <div className="flex flex-col divide-y divide-outline-variant/20 bg-surface-container-high">
                    <button className="px-5 py-3 text-end text-sm text-on-surface transition-colors hover:text-primary">
                      עמוד מלא (A4)
                    </button>
                    <button className="px-5 py-3 text-end text-sm text-on-surface transition-colors hover:text-primary">
                      מדבקות מיתוג (Photo Santos)
                    </button>
                  </div>
                )}
              </div>
              <button className="flex w-full flex-row-reverse items-center justify-between rounded-xl border border-outline-variant px-5 py-3.5 font-medium text-on-surface transition-all hover:bg-surface-container-highest">
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined">fullscreen</span>
                  הצגה על מסך מלא באירוע
                </span>
              </button>
              <button className="flex w-full flex-row-reverse items-center justify-between rounded-xl border border-outline-variant px-5 py-3.5 font-medium text-on-surface transition-all hover:bg-surface-container-highest">
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined">download</span>
                  הורדה כקובץ PNG איכותי
                </span>
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-end text-sm font-bold text-on-surface">
              <span className="material-symbols-outlined text-base">share</span>
              שיתוף דיגיטלי
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {SHARE_TARGETS.map((target) => (
                <button
                  key={target.label}
                  className={`rounded-xl border px-4 py-3 text-sm font-bold transition-all ${
                    target.accent
                      ? "border-success/40 text-success hover:bg-success/10"
                      : "border-outline-variant text-on-surface hover:bg-surface-container-highest"
                  }`}
                >
                  {target.label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-row-reverse items-center justify-between gap-3 rounded-xl bg-background px-4 py-3">
              <div className="min-w-0 text-end">
                <p className="text-xs text-on-surface-variant">
                  קישור ישיר לגלריה של Photo Santos
                </p>
                <p className="truncate font-mono text-sm text-primary" dir="ltr">
                  {GALLERY_LINK}
                </p>
              </div>
              <CopyButton value={`https://${GALLERY_LINK}`} label="העתק קישור" />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className="rounded-3xl bg-white p-4 shadow-2xl">
            <div className="flex h-72 w-72 items-center justify-center rounded-xl bg-[#0d1b1e]">
              <div className="relative h-56 w-56 rounded-lg bg-[#f6efe6]">
                <div className="flex h-full w-full items-center justify-center">
                  <span
                    className="material-symbols-outlined text-black/70"
                    style={{ fontSize: "120px" }}
                  >
                    qr_code_2
                  </span>
                </div>
                <div className="absolute start-2 top-2 h-6 w-6 rounded-tl-sm border-t-2 border-s-2 border-primary" />
                <div className="absolute end-2 top-2 h-6 w-6 rounded-tr-sm border-t-2 border-e-2 border-primary" />
                <div className="absolute bottom-2 start-2 h-6 w-6 rounded-bl-sm border-b-2 border-s-2 border-primary" />
                <div className="absolute bottom-2 end-2 h-6 w-6 rounded-br-sm border-b-2 border-e-2 border-primary" />
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-4 py-2">
            <CopyButton value={EVENT_ID} label="העתק מזהה" />
            <span className="font-mono text-sm font-bold tracking-wide text-primary" dir="ltr">
              ID: {EVENT_ID}
            </span>
          </div>
          <p className="mt-2 max-w-xs text-center text-sm text-on-surface-variant">
            סרקו כדי לצפות בגלריה בזמן אמת דרך Photo Santos
          </p>
        </div>
      </div>

      <div className="flex flex-row-reverse items-center justify-between border-t border-outline-variant/30 pt-6">
        <button className="rounded-xl bg-primary px-6 py-3 font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:brightness-110 active:scale-95">
          מעבר לניהול האירוע
        </button>
        <a
          href="/admin/branding"
          className="text-sm font-medium text-on-surface-variant transition-colors hover:text-primary"
        >
          עריכת פרטי הגלריה
        </a>
      </div>
    </AdminShell>
  );
}
