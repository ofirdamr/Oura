"use client";

// Photographer self-service password reset, step 2: the link from the reset
// email lands here. The Supabase browser client auto-detects the recovery
// session from the URL (hash tokens or a PKCE `code` param, depending on the
// project's auth flow type) on init - we don't parse the URL ourselves, we
// just wait for either an existing session or the PASSWORD_RECOVERY event
// before showing the "set new password" form. No session after a short wait
// means the link is invalid/expired.

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
    const supabase = createSupabaseBrowserClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    // Covers the case where the session/event was already established before
    // this listener attached.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    const timeout = setTimeout(() => {
      setReady((current) => {
        if (!current) setLinkInvalid(true);
        return current;
      });
    }, 4000);

    return () => {
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
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-container-high">
          <OuraLogo size={56} />
        </div>
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
