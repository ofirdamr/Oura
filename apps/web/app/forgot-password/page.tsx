"use client";

// Photographer self-service password reset, step 1: request the email.
// Matches the dark-luxury card language of /login and /signup. Always shows
// the same success message regardless of whether the email exists - avoids
// leaking which emails have accounts (same reasoning as requireEventOwner's
// uniform 404 on the API side).

import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { OuraLogo } from "@/components/brand/OuraLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("אנא הזינו כתובת אימייל");
      return;
    }

    setPending(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setPending(false);
    setSent(true);
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
          שחזור סיסמה
        </h1>
        <p className="px-2 leading-relaxed text-on-surface-variant">
          הזינו את כתובת האימייל של החשבון ונשלח לכם קישור לאיפוס הסיסמה.
        </p>
      </section>

      {sent ? (
        <div className="relative z-10 w-full space-y-4 rounded-2xl border border-white/5 bg-surface-container/60 p-6 text-center shadow-2xl backdrop-blur-md">
          <p className="text-on-surface">
            אם הכתובת <span dir="ltr">{email.trim()}</span> משויכת לחשבון, נשלח
            אליה קישור לאיפוס הסיסמה. בדקו את תיבת הדואר שלכם.
          </p>
          <Link
            href="/login"
            className="font-medium text-primary underline underline-offset-4 transition-colors hover:opacity-80"
          >
            חזרה להתחברות
          </Link>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="relative z-10 w-full space-y-4 rounded-2xl border border-white/5 bg-surface-container/60 p-6 shadow-2xl backdrop-blur-md"
        >
          <div className="space-y-2">
            <label
              className="block text-start font-medium text-primary"
              htmlFor="email"
            >
              אימייל
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@studio.com"
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
            שליחת קישור לאיפוס
          </button>

          <p className="pt-1 text-center text-sm text-on-surface-variant">
            <Link
              href="/login"
              className="font-medium text-primary underline underline-offset-4 transition-colors hover:opacity-80"
            >
              חזרה להתחברות
            </Link>
          </p>
        </form>
      )}
    </main>
  );
}
