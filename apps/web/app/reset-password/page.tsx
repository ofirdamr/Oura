"use client";

// Photographer self-service password reset, step 2: the link from the reset
// email lands here.
//
// PRIMARY path (token_hash): the Worker emails a link to THIS page carrying a
// one-time `?token_hash=…&type=recovery`. We redeem it client-side with
// `verifyOtp({ type:'recovery', token_hash })` on mount, which establishes a
// PASSWORD_RECOVERY session. This is the fix for the "Gmail burned the token"
// bug: emailing Supabase's raw /auth/v1/verify `action_link` let email-client
// link scanners prefetch (GET) the one-time URL and spend the token before the
// user tapped. A plain GET of THIS page consumes nothing — the token is only
// redeemed by the verifyOtp JS a scanner never runs. (See the Worker's
// /auth/forgot-password header for the sending side.)
//
// LEGACY fallback (implicit hash): older links land with implicit-flow tokens
// in the URL hash (#access_token=…&refresh_token=…). The @supabase/ssr browser
// client is hard-wired to flowType 'pkce' and its auto detectSessionInUrl
// REJECTS an implicit hash, so we disable it and call setSession() ourselves.
//
// On failure we surface the REAL reason (expired / already used / invalid),
// derived from the actual verifyOtp/setSession error — not a blanket "invalid".

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { OuraLogo } from "@/components/brand/OuraLogo";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  // null = still verifying; string = link failed, with the REAL reason to show.
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // detectSessionInUrl:false — stop the PKCE client from choking on the
    // legacy implicit recovery hash (see the file header + supabaseClient.ts).
    // We establish the session ourselves below.
    const supabase = createSupabaseBrowserClient({ detectSessionInUrl: false });
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    // Map a raw Supabase auth error to the real, human Hebrew reason — so the
    // page tells the user WHY (expired / already used / invalid) instead of a
    // blanket "link invalid".
    function reasonFor(raw: string | undefined): string {
      const msg = (raw ?? "").toLowerCase();
      if (msg.includes("expired")) {
        return "פג תוקף הקישור. הקישור תקף ל-24 שעות. בקשו קישור חדש.";
      }
      if (
        msg.includes("already") ||
        msg.includes("used") ||
        msg.includes("consumed")
      ) {
        return "הקישור כבר נוצל. כל קישור איפוס תקף לשימוש חד-פעמי בלבד. בקשו קישור חדש.";
      }
      if (msg) {
        return `לא הצלחנו לאמת את הקישור (${raw}). בקשו קישור חדש.`;
      }
      return "הקישור אינו תקף או שפג תוקפו. בקשו קישור חדש.";
    }

    async function establishSession() {
      const url = new URL(window.location.href);

      // PRIMARY path: our own token_hash link. Redeem the one-time token with
      // verifyOtp — this is what survives email-scanner prefetch (see header).
      const tokenHash = url.searchParams.get("token_hash");
      const otpType = url.searchParams.get("type"); // "recovery"
      if (tokenHash) {
        const { error: otpErr } = await supabase.auth.verifyOtp({
          type: (otpType as "recovery") || "recovery",
          token_hash: tokenHash,
        });
        if (!active) return;
        if (!otpErr) {
          setReady(true);
          // Strip the token from the URL so a refresh / copied link can't reuse
          // or leak the recovery session.
          window.history.replaceState(null, "", window.location.pathname);
          return;
        }
        setLinkError(reasonFor(otpErr.message));
        return;
      }

      // LEGACY fallback: implicit tokens in the URL hash. Set the session
      // directly (bypasses the PKCE detectSessionInUrl rejection).
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
        if (!current) setLinkError((e) => e ?? reasonFor(undefined));
        return current;
      });
    }, 4000);

    return () => {
      active = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

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
    const supabase = createSupabaseBrowserClient();
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
