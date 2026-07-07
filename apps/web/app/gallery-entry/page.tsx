"use client";

// Distinct from /join (Guest Landing): this is the generic Oura entry point
// reached without event context yet, so it explains the auto face-matching
// mechanism up front. The explainer modal is informational only - it does not
// itself trigger face-matching, which still requires the separate
// biometric-consent gate (not yet built) before any embedding runs.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { issueGuestToken, resolveEventCode } from "@/lib/api";
import { saveGuestSession } from "@/lib/guestSession";
import { OuraLogo } from "@/components/brand/OuraLogo";

// Event codes are uppercase alphanumeric + hyphen (e.g. WED-2024). Normalize
// user input to that shape: uppercase, and drop anything else - critically the
// apostrophe/space iOS autocorrect injects (turning "wed-2024" into "We'd-2024"),
// which would otherwise never match a real code.
function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

const HOW_IT_WORKS_STEPS = [
  {
    icon: "qr_code_scanner",
    title: "סריקה מהירה",
    body: "סרקו את ה-QR באירוע או הזינו את הקוד האישי שקיבלתם.",
  },
  {
    icon: "face_6",
    title: "זיהוי חכם",
    body: "אלגוריתם ה-AI שלנו יסרוק את כלל התמונות ויזהה אתכם אוטומטית.",
  },
  {
    icon: "auto_awesome_motion",
    title: "גלריה אישית",
    body: "קבלו את כל הרגעים שלכם מרוכזים בגלריה פרטית ומעוצבת.",
  },
];

export default function GalleryEntryPage() {
  return (
    <Suspense fallback={null}>
      <GalleryEntryPageInner />
    </Suspense>
  );
}

function GalleryEntryPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [eventCode, setEventCode] = useState("");
  const [entering, setEntering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // QR deeplinks encode the event code as ?code=WED-2024 so a scan skips
  // manual typing entirely - prefill and auto-submit once on arrival.
  useEffect(() => {
    const codeFromQr = searchParams.get("code");
    if (codeFromQr && codeFromQr.trim()) {
      setEventCode(codeFromQr.trim());
      void handleManualEntry(codeFromQr.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleManualEntry(codeOverride?: string) {
    setError(null);

    const trimmedCode = normalizeCode(codeOverride ?? eventCode);
    if (!trimmedCode) {
      setError("אנא הזינו קוד אירוע");
      return;
    }

    setEntering(true);
    const resolveResult = await resolveEventCode(trimmedCode);

    if (!resolveResult.ok) {
      setEntering(false);
      setError(
        resolveResult.error === "event_not_found"
          ? "לא מצאנו את האירוע הזה. בדקו את הקוד ונסו שוב."
          : "משהו השתבש. בדקו את החיבור ונסו שוב.",
      );
      return;
    }

    const result = await issueGuestToken(resolveResult.data.event_id);
    setEntering(false);

    if (!result.ok) {
      setError(
        result.error === "event_not_found"
          ? "לא מצאנו את האירוע הזה. בדקו את הקוד ונסו שוב."
          : "משהו השתבש. בדקו את החיבור ונסו שוב.",
      );
      return;
    }

    saveGuestSession({
      token: result.data.token,
      event_id: result.data.event_id,
      guest_id: result.data.guest_id,
    });
    router.push("/consent");
  }

  return (
    <main className="relative mx-auto flex min-h-screen max-w-sm flex-col items-center overflow-x-hidden p-6 md:p-10">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(255,138,117,0.15)_0%,_transparent_50%)]" />

      <header className="relative z-10 mb-8 mt-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-container-high">
          <OuraLogo variant="lockup" size={56} />
        </div>
      </header>

      <section className="relative z-10 mb-8 w-full max-w-lg text-center">
        <h1 className="mb-2 text-2xl font-semibold leading-tight text-on-surface md:text-3xl">
          ברוכים הבאים ל-Oura
        </h1>
        <p className="px-4 leading-relaxed text-on-surface-variant">
          הזיכרונות שלכם כבר כאן. השתמשו בקוד האישי או סרקו את ה-QR כדי לצפות
          בגלריה המותאמת עבורכם.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-on-surface-variant/90">
          {/* Design (gallery_entry_mobile) places this info icon trailing
              at the far/left end of the line, opposite the help row below it
              (whose "?" icon sits at the right, leading the text) - DOM
              order here is text-then-icon (not the usual icon-then-text) so
              a plain RTL row lands the icon at the end (left) to match. */}
          <div className="flex items-center gap-1">
            <p className="text-sm font-medium">
              המערכת תזהה אתכם בתמונות באופן אוטומטי
            </p>
            <span className="material-symbols-outlined text-base">info</span>
          </div>
          <span className="hidden text-outline-variant/40 md:inline">|</span>
          <button
            type="button"
            onClick={() => setShowHowItWorks(true)}
            className="flex items-center gap-1 text-primary underline underline-offset-4 transition-colors hover:opacity-80"
          >
            <span className="material-symbols-outlined text-base">help</span>
            <span>איך זה עובד?</span>
          </button>
        </div>
      </section>

      <div className="relative z-10 w-full space-y-4">
        <div className="rounded-2xl border border-white/5 bg-surface-container/60 p-6 text-center shadow-2xl backdrop-blur-md">
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-48 w-48 overflow-hidden rounded-xl border border-primary/20 bg-primary/5">
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-outline-variant/60"
                  style={{ fontSize: "64px" }}
                >
                  qr_code_2
                </span>
              </div>
              <div className="absolute end-4 top-4 h-6 w-6 rounded-tr-sm border-t-2 border-e-2 border-primary/60" />
              <div className="absolute start-4 top-4 h-6 w-6 rounded-tl-sm border-t-2 border-s-2 border-primary/60" />
              <div className="absolute bottom-4 end-4 h-6 w-6 rounded-br-sm border-b-2 border-e-2 border-primary/60" />
              <div className="absolute bottom-4 start-4 h-6 w-6 rounded-bl-sm border-b-2 border-s-2 border-primary/60" />
            </div>
            <button
              type="button"
              disabled
              title="סריקה בתוך הדפדפן עדיין לא זמינה - סרקו עם מצלמת הטלפון הרגילה או הזינו קוד למטה"
              className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-primary/40 py-4 font-bold text-on-primary/60 shadow-lg shadow-primary/10"
            >
              {/* Design (gallery_entry_mobile) puts the camera icon at the
                  left of this label, not the right - text before icon in
                  DOM order matches that under a plain RTL row. */}
              הפעל מצלמה לסריקה (בקרוב)
              <span className="material-symbols-outlined">photo_camera</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 px-6 opacity-40">
          <div className="h-px flex-1 bg-outline-variant/20" />
          <span className="text-xs font-bold uppercase tracking-[0.2em]">
            או
          </span>
          <div className="h-px flex-1 bg-outline-variant/20" />
        </div>

        <div className="rounded-2xl border border-white/5 bg-surface-container/60 p-6 shadow-xl backdrop-blur-md">
          <div className="space-y-4">
            <label
              className="block text-start font-medium text-primary"
              htmlFor="event-code"
            >
              הכנס קוד אירוע ידנית
            </label>
            <div className="relative">
              <input
                id="event-code"
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                value={eventCode}
                // Uppercase as typed + strip anything that isn't a code char.
                // iOS autocorrect otherwise turns "wed-2024" into "We'd-2024"
                // (added apostrophe + capital), which never matches the code.
                onChange={(e) => setEventCode(normalizeCode(e.target.value))}
                placeholder="לדוגמה: WED-2024"
                className="h-14 w-full rounded-xl border border-outline-variant/30 bg-black/40 px-4 text-center font-bold tracking-widest text-on-surface outline-none transition-all placeholder:font-normal placeholder:tracking-normal placeholder:text-on-surface-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/50"
              />
              {/* material-symbols-outlined forces `direction: ltr` on itself
                  (needed so the ligature glyph name shapes correctly), so
                  inset-inline start/end on this element resolve LTR, not
                  page-RTL - `end-4` here actually lands at the physical
                  right (measured left:313/right:337 in a left:67/right:353
                  box). Design (gallery_entry_mobile) puts this icon at the
                  left, which needs `start-4` given the flipped direction. */}
              <span className="material-symbols-outlined absolute start-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50">
                key
              </span>
            </div>
            {error && (
              <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-center text-sm text-error">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => handleManualEntry()}
              disabled={entering}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/30 py-4 font-bold text-on-surface transition-all hover:bg-white/5 active:scale-[0.98] disabled:opacity-70"
            >
              {entering && (
                <span className="material-symbols-outlined animate-spin">
                  progress_activity
                </span>
              )}
              כניסה לגלריה
            </button>
          </div>
        </div>
      </div>

      <footer className="relative z-10 mt-auto w-full py-12 text-center">
        <p className="flex flex-wrap items-center justify-center gap-1 text-xs text-on-surface-variant/70">
          נתקלתם בבעיה? פנו לצלם/ת שהזמינו אתכם לאירוע
        </p>
      </footer>

      {showHowItWorks && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
            onClick={() => setShowHowItWorks(false)}
          />
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-surface-container/90 p-6 shadow-2xl backdrop-blur-md">
            <button
              type="button"
              onClick={() => setShowHowItWorks(false)}
              className="absolute end-4 top-4 p-2 text-on-surface-variant transition-colors hover:text-on-surface"
              aria-label="סגור"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="mb-6 text-center">
              <h2 className="mb-1 text-xl font-semibold text-on-surface">
                איך זה עובד?
              </h2>
              <p className="text-on-surface-variant">
                3 שלבים פשוטים לגישה לתמונות שלכם
              </p>
            </div>
            <div className="mb-6 space-y-4">
              {HOW_IT_WORKS_STEPS.map((step) => (
                <div key={step.title} className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                    <span className="material-symbols-outlined text-primary">
                      {step.icon}
                    </span>
                  </div>
                  <div className="text-start">
                    <h3 className="font-bold text-on-surface">
                      {step.title}
                    </h3>
                    <p className="text-on-surface-variant/80">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowHowItWorks(false)}
              className="w-full rounded-xl bg-on-surface py-4 font-bold text-background transition-all active:scale-[0.98]"
            >
              הבנתי, תודה
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
