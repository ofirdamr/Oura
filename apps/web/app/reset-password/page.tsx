"use client";

// Photographer self-service password reset, step 2: the link from the reset
// email lands here.
//
// PRIMARY path (token_hash): the Worker emails a link to THIS page carrying a
// one-time `?token_hash=…&type=recovery`. We redeem it client-side with
// `verifyOtp({ type:'recovery', token_hash })` — but ONLY when the real person
// taps the "המשך" button, never automatically on mount.
//
// Why a manual tap and not on-mount: the one-time token is spent by verifyOtp.
// Email link-scanners prefetch the link the moment the mail is delivered, and
// Brevo's own click-tracking (`…/tr/cl/…` wrapper) pre-scans the destination —
// both of which can RENDER this page and run its JS, which would spend the token
// before the human ever arrives (fresh token → `otp_expired` on the real click).
// Brevo offers no way to turn that tracking off for transactional email, so we
// make the page immune to it instead: a scanner loads the page but never taps a
// button, so the token survives every prefetch/pre-scan and is redeemed only by
// the real user's tap. (See the Worker's /auth/forgot-password header for the
// sending side.)
//
// LEGACY fallback (implicit hash): older links land with implicit-flow tokens
// in the URL hash (#access_token=…&refresh_token=…). Those are already-issued
// session tokens (not a one-time OTP that a prefetch can burn), so we still
// establish the session automatically on mount. The @supabase/ssr browser
// client is hard-wired to flowType 'pkce' and its auto detectSessionInUrl
// REJECTS an implicit hash, so we disable it and call setSession() ourselves.
//
// On failure we surface the REAL reason (expired / already used / invalid),
// derived from the actual verifyOtp/setSession error — not a blanket "invalid".

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { OuraLogo } from "@/components/brand/OuraLogo";

// Map a raw Supabase auth error to the real, human Hebrew reason — so the page
// tells the user WHY (expired / already used / invalid) instead of a blanket
// "link invalid". Module-scoped so both the mount effect and the confirm handler
// can use it.
function reasonFor(raw: string | undefined): string {
  const msg = (raw ?? "").toLowerCase();
  if (msg.includes("expired")) {
    return "פג תוקף הקישור. הקישור תקף ל-24 שעות. בקשו קישור חדש.";
  }
  if (msg.includes("already") || msg.includes("used") || msg.includes("consumed")) {
    return "הקישור כבר נוצל. כל קישור איפוס תקף לשימוש חד-פעמי בלבד. בקשו קישור חדש.";
  }
  if (msg) {
    return `לא הצלחנו לאמת את הקישור (${raw}). בקשו קישור חדש.`;
  }
  return "הקישור אינו תקף או שפג תוקפו. בקשו קישור חדש.";
}

export default function ResetPasswordPage() {
  const router = useRouter();
  // Single shared client for the whole page — avoids two-instance cookie conflicts
  // that cause "Invalid path specified in request URL" on Safari/iOS when handleConfirm
  // creates a second client while the useEffect's client is still alive.
  // detectSessionInUrl:false stops the PKCE client from rejecting the implicit hash tokens.
  const supabase = useMemo(
    () => createSupabaseBrowserClient({ detectSessionInUrl: false }),
    [],
  );
  const [ready, setReady] = useState(false);
  // token_hash link detected — show the confirm gate (redeem only on tap).
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // null = still verifying; string = link failed, with the REAL reason to show.
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    async function establishSession() {
      const url = new URL(window.location.href);

      // PRIMARY path: our own token_hash link. Do NOT redeem here — a scanner
      // prefetch/pre-scan runs this JS and would burn the one-time token. Show
      // the confirm gate; the token is redeemed only when the real user taps
      // (see handleConfirm + the file header).
      const tokenHash = url.searchParams.get("token_hash");
      if (tokenHash) {
        if (active) setAwaitingConfirm(true);
        return;
      }

      // LEGACY fallback: implicit tokens in the URL hash. Set the session
      // directly (bypasses the PKCE detectSessionInUrl rejection). These are
      // already-issued session tokens, not a one-time OTP, so auto-establishing
      // on mount is safe from prefetch burn.
      const hash = window.location.hash.slice(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error: setErr } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!active) return;
        if (!setErr) {
          setReady(true);
          window.history.replaceState(null, "", window.location.pathname);
          return;
        }
        setLinkError(reasonFor(setErr.message));
        return;
      }

      // Last resort: a session may already be established (link consumed in
      // this tab). Otherwise the link carried no usable token at all.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;
      if (session) {
        setReady(true);
        return;
      }
      // No token_hash, no hash tokens, no session — give the safety-net timeout
      // below a chance (onAuthStateChange may still fire), then fail with the
      // generic reason.
    }

    void establishSession();

    const timeout = setTimeout(() => {
      setReady((current) => {
        // Only fail if we're neither verified NOR waiting on the confirm tap.
        setAwaitingConfirm((waiting) => {
          if (!current && !waiting) setLinkError((e) => e ?? reasonFor(undefined));
          return waiting;
        });
        return current;
      });
    }, 4000);

    return () => {
      active = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [supabase]);

  // Redeem the one-time token_hash — fired only by the real user's tap, which is
  // what makes the link immune to email-scanner / Brevo-tracker prefetch.
  async function handleConfirm() {
    setConfirming(true);
    const url = new URL(window.location.href);
    const tokenHash = url.searchParams.get("token_hash");
    const otpType = url.searchParams.get("type"); // "recovery"

    if (!tokenHash) {
      setConfirming(false);
      setAwaitingConfirm(false);
      setLinkError(reasonFor(undefined));
      return;
    }

    const { error: otpErr } = await supabase.auth.verifyOtp({
      type: (otpType as "recovery") || "recovery",
      token_hash: tokenHash,
    });
    setConfirming(false);

    if (otpErr) {
      setAwaitingConfirm(false);
      setLinkError(reasonFor(otpErr.message));
      return;
    }

    setAwaitingConfirm(false);
    setReady(true);
    // Strip the token from the URL so a refresh / copied link can't reuse or
    // leak the recovery session.
    window.history.replaceState(null, "", window.location.pathname);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("הסיסמה חייבת להכיל לפחות 6 תווים");
      return;
    }
    if (password !== confirmPassword) {
      setError("הסיסמאות אינן תואמות");
      return;
    }

    setPending(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    setPending(false);

    if (updateError) {
      setError("לא הצלחנו לעדכן את הסיסמה. נסו לבקש קישור חדש.");
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/admin"), 1500);
  }

  return (
    <main className="relative mx-auto flex min-h-screen max-w-sm flex-col items-center overflow-x-hidden p-6 md:p-10">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(255,138,117,0.15)_0%,_transparent_50%)]" />

      <header className="relative z-10 mb-6 mt-8">
        <OuraLogo size={72} />
      </header>

      <section className="relative z-10 mb-6 w-full text-center">
        <h1 className="mb-2 text-2xl font-semibold leading-tight text-on-surface md:text-3xl">
          בחירת סיסמה חדשה
        </h1>
      </section>

      <div className="relative z-10 w-full space-y-4 rounded-2xl border border-white/5 bg-surface-container/60 p-6 shadow-2xl backdrop-blur-md">
        {done ? (
          <p className="text-center text-on-surface">
            הסיסמה עודכנה בהצלחה. מעבירים אתכם ללוח הבקרה...
          </p>
        ) : ready ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label
                className="block text-start font-medium text-primary"
                htmlFor="password"
              >
                סיסמה חדשה
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-14 w-full rounded-xl border border-outline-variant/30 bg-black/40 px-4 text-start text-on-surface outline-none transition-all placeholder:text-on-surface-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div className="space-y-2">
              <label
                className="block text-start font-medium text-primary"
                htmlFor="confirm-password"
              >
                אימות סיסמה
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                dir="ltr"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="h-14 w-full rounded-xl border border-outline-variant/30 bg-black/40 px-4 text-start text-on-surface outline-none transition-all placeholder:text-on-surface-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-center text-sm text-error">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-on-primary shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-70"
            >
              {pending && (
                <span className="material-symbols-outlined animate-spin">
                  progress_activity
                </span>
              )}
              עדכון סיסמה
            </button>
          </form>
        ) : awaitingConfirm ? (
          <div className="space-y-4">
            <p className="text-center text-on-surface-variant">
              כדי להגן על חשבונכם, לחצו על הכפתור כדי לאמת את הקישור ולהמשיך
              לבחירת סיסמה חדשה.
            </p>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirming}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-on-primary shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-70"
            >
              {confirming && (
                <span className="material-symbols-outlined animate-spin">
                  progress_activity
                </span>
              )}
              המשך לאיפוס הסיסמה
            </button>
          </div>
        ) : linkError ? (
          <>
            <p className="text-center text-on-surface">{linkError}</p>
            <Link
              href="/forgot-password"
              className="block text-center font-medium text-primary underline underline-offset-4 transition-colors hover:opacity-80"
            >
              בקשת קישור חדש
            </Link>
          </>
        ) : (
          <p className="text-center text-on-surface-variant">
            מאמתים את הקישור...
          </p>
        )}
      </div>
    </main>
  );
}
