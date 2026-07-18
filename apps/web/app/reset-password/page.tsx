"use client";

// Photographer self-service password reset, step 2: the link from the reset
// email lands here.
//
// The recovery link is generated server-side by the Worker via
// `auth.admin.generateLink({ type: 'recovery' })`. Supabase's /verify endpoint
// redirects here with IMPLICIT-flow tokens in the URL hash
// (#access_token=...&refresh_token=...&type=recovery). But our browser client
// (@supabase/ssr createBrowserClient) is hard-wired to `flowType: 'pkce'`, and
// its automatic detectSessionInUrl REJECTS an implicit hash with
// "Not a valid PKCE flow url" — so no session is ever created and the page used
// to show "link invalid" for every real reset link. That was the long-standing
// reset-never-works bug.
//
// Fix: parse the implicit hash ourselves and establish the session explicitly
// with setSession(), which is flow-type agnostic. We keep the
// onAuthStateChange/getSession paths as fallbacks (already-established session).
// No session after a short wait means the link is genuinely invalid/expired.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { OuraLogo } from "@/components/brand/OuraLogo";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // detectSessionInUrl:false — stop the PKCE client from choking on the
    // implicit recovery hash (see the file header + supabaseClient.ts). We
    // establish the session ourselves below.
    const supabase = createSupabaseBrowserClient({ detectSessionInUrl: false });
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    async function establishSession() {
      // Primary path: the recovery link's implicit tokens live in the URL hash.
      // Parse them and set the session directly (bypasses the PKCE-flow
      // detectSessionInUrl rejection described in the file header).
      const hash =
        typeof window !== "undefined" ? window.location.hash.slice(1) : "";
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
          // Strip the tokens from the URL so a refresh or copied link can't
          // leak the recovery session.
          window.history.replaceState(null, "", window.location.pathname);
          return;
        }
      }

      // Fallback: a session may already be established (link consumed in this
      // tab, or a future native-implicit Supabase config).
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (active && session) setReady(true);
    }

    void establishSession();

    const timeout = setTimeout(() => {
      setReady((current) => {
        if (!current) setLinkInvalid(true);
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
        {linkInvalid ? (
          <>
            <p className="text-center text-on-surface">
              הקישור אינו תקף או שפג תוקפו.
            </p>
            <Link
              href="/forgot-password"
              className="block text-center font-medium text-primary underline underline-offset-4 transition-colors hover:opacity-80"
            >
              בקשת קישור חדש
            </Link>
          </>
        ) : done ? (
          <p className="text-center text-on-surface">
            הסיסמה עודכנה בהצלחה. מעבירים אתכם ללוח הבקרה...
          </p>
        ) : !ready ? (
          <p className="text-center text-on-surface-variant">
            מאמתים את הקישור...
          </p>
        ) : (
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
        )}
      </div>
    </main>
  );
}
