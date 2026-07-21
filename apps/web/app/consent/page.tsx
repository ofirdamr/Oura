"use client";

// Biometric-consent gate: NOT part of the original 42-screen Stitch export -
// CLAUDE.md flags it as still-missing and required before any face-matching
// ("Face-matching may not run before the guest accepts the biometric-consent
// gate. No exceptions"). Sits between Gallery Entry and Personal Gallery per
// PRD.md's guest flow. Designed fresh here to match the existing dark-luxury
// guest visual language (same card/typography pattern as /gallery-entry),
// since there's no design/screens reference for it.
//
// Wired to the now-live POST /consent/:token (apps/api). Accept requires the
// guardian/age-confirmation checkbox (Stage 2 legal-review requirement) and
// moves on to /selfie (the real capture screen, live now that the embedding
// service is deployed); decline routes to the general gallery WITHOUT ever
// calling the consent endpoint - declining must never create a consent
// record. (/gallery also enforces this server-side: it only unlocks
// personal_gallery once a biometric_consents row actually exists, so this
// screen isn't the only guardrail.)

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { postConsent } from "@/lib/api";
import { loadGuestSession } from "@/lib/guestSession";
import { OuraLogo } from "@/components/brand/OuraLogo";

const CONSENT_FACTS = [
  {
    icon: "face_6",
    title: "איך זה עובד",
    body: "נשווה את פרטי הפנים שלך מול כלל תמונות האירוע, ונרכז עבורך רק את הרגעים שבהם אתה/את מופיע/ה - בגלריה אישית ופרטית.",
  },
  {
    icon: "lock",
    title: "רק אתם רואים את התוצאה",
    body: "התאמות הפנים זמינות רק דרך הקישור האישי שלך, ולא חשופות לשאר האורחים באירוע או לצדדים שלישיים.",
  },
  {
    icon: "toggle_off",
    title: "לגמרי אופציונלי",
    body: "אפשר לוותר על הזיהוי האוטומטי בכל שלב - עדיין תוכל/י לדפדף ולהוריד תמונות מהגלריה הכללית של האירוע, בלי שום שיוך אישי.",
  },
];

export default function ConsentPage() {
  const router = useRouter();
  const [pending, setPending] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  // Guardian/age confirmation (Stage 2 legal-review requirement): folded into
  // this existing consent screen as an additional required checkbox rather
  // than a separate new "age gate" screen (avoids a second Stitch design
  // round-trip for what is substantively one more consent gesture). The API
  // enforces this server-side too - see POST /consent/:token in apps/api.
  const [guardianConfirmed, setGuardianConfirmed] = useState(false);

  useEffect(() => {
    const session = loadGuestSession();
    if (!session) {
      // No token at all - guest landed here without going through entry.
      router.replace("/gallery-entry");
      return;
    }
    setToken(session.token);
  }, [router]);

  async function handleAccept() {
    if (!token || !guardianConfirmed) return;
    setError(null);
    setPending("accept");
    const result = await postConsent(token, guardianConfirmed);
    setPending(null);

    if (!result.ok) {
      if (result.status === 401 || result.status === 404) {
        // Token invalid/unknown to the API - session is unusable, start over.
        router.replace("/gallery-entry");
        return;
      }
      setError("משהו השתבש בשמירת ההסכמה. נסו שוב.");
      return;
    }
    // Stage 2 embedding service is live (Cloud Run) - route into the real
    // selfie-capture step instead of straight to the gallery.
    router.push("/selfie");
  }

  function handleDecline() {
    // Deliberately no API call here - declining must never create a consent
    // record. /gallery will keep showing consent_required:true for this
    // guest, which is exactly the desired state.
    setPending("decline");
    router.push("/gallery?declined=1");
  }

  return (
    <main className="relative mx-auto flex min-h-screen max-w-sm flex-col items-center overflow-x-hidden p-6 md:p-10">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(255,138,117,0.15)_0%,_transparent_50%)]" />

      <header className="relative z-10 mb-6 mt-8">
        <OuraLogo size={72} />
      </header>

      <section className="relative z-10 mb-2 w-full text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
          <span
            className="material-symbols-outlined text-3xl text-primary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            face_6
          </span>
        </div>
        <h1 className="mb-2 text-2xl font-semibold leading-tight text-on-surface md:text-3xl">
          בואו נמצא אתכם בתמונות, אוטומטית
        </h1>
        <p className="px-2 leading-relaxed text-on-surface-variant">
          Oura יכולה לסרוק את תמונות האירוע ולאתר עבורך, אוטומטית, את הרגעים
          שבהם אתה/את מופיע/ה - כך שלא תצטרך/י לדפדף במאות תמונות. התהליך
          משתמש בזיהוי פנים (מידע ביומטרי) ודורש את הסכמתך המפורשת.
        </p>
      </section>

      <div className="relative z-10 my-6 w-full space-y-3 rounded-2xl border border-white/5 bg-surface-container/60 p-5 shadow-xl backdrop-blur-md">
        {CONSENT_FACTS.map((fact, i) => (
          <div key={fact.title}>
            <div className="flex items-start gap-3 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                <span className="material-symbols-outlined text-lg text-primary">
                  {fact.icon}
                </span>
              </div>
              <div className="text-start">
                <h3 className="text-sm font-bold text-on-surface">
                  {fact.title}
                </h3>
                <p className="mt-0.5 text-sm leading-relaxed text-on-surface-variant">
                  {fact.body}
                </p>
              </div>
            </div>
            {i < CONSENT_FACTS.length - 1 && (
              <div className="h-px w-full bg-white/5" />
            )}
          </div>
        ))}
      </div>

      {/* No privacy-policy page exists yet (needs real legal copy, not
          placeholder text) - showing it disabled rather than a dead link. */}
      <span className="relative z-10 mb-6 flex items-center gap-1.5 text-sm text-on-surface-variant/40">
        <span className="material-symbols-outlined text-base">
          privacy_tip
        </span>
        מדיניות הפרטיות המלאה (בקרוב)
      </span>

      <div className="relative z-10 mt-auto w-full space-y-3">
        {error && (
          <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-center text-sm text-error">
            {error}
          </p>
        )}
        <label className="flex items-start gap-3 rounded-xl border border-white/5 bg-surface-container/60 p-3 text-start">
          <input
            type="checkbox"
            checked={guardianConfirmed}
            onChange={(e) => setGuardianConfirmed(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
          />
          <span className="text-sm leading-relaxed text-on-surface-variant">
            אני מסכים/ה ומאשר/ת שאני מעל גיל 16 (או שהורה/אפוטרופוס אישר עבורי
            את השימוש), ומבקש/ת לבצע סריקה חד-פעמית של פניי לצורך איתור
            תמונותיי באירוע. ידוע לי שהמידע הביומטרי נמחק מיד לאחר ההתאמה
            ואינו נשמר.
          </span>
        </label>
        <button
          type="button"
          onClick={handleAccept}
          disabled={pending !== null || !token || !guardianConfirmed}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-on-primary shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-70"
        >
          {pending === "accept" ? (
            <span className="material-symbols-outlined animate-spin">
              progress_activity
            </span>
          ) : (
            <span className="material-symbols-outlined">check_circle</span>
          )}
          אני מסכים/ה לזיהוי אוטומטי
        </button>
        <button
          type="button"
          onClick={handleDecline}
          disabled={pending !== null || !token}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/40 py-4 font-medium text-on-surface transition-all active:bg-white/5 disabled:opacity-70"
        >
          {pending === "decline" && (
            <span className="material-symbols-outlined animate-spin">
              progress_activity
            </span>
          )}
          לא תודה, אני אעיין בגלריה הכללית
        </button>
        <p className="pt-1 text-center text-xs text-on-surface-variant/70">
          ניתן לשנות את ההעדפה הזו בכל עת דרך הגדרות הפרופיל.
        </p>
      </div>
    </main>
  );
}
