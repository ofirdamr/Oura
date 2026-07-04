"use client";

// Photographer signup. New screen (founder approved building this fresh - no
// Stitch round-trip). Shares the exact dark-luxury card language of /login and
// the guest screens (/consent, /gallery-entry). RTL/logical properties only,
// Rubik by default. On success with an active session -> /admin. If the
// Supabase project requires email confirmation, signUp returns no session, so
// we show a "check your email" message instead of redirecting into /admin
// (which middleware would just bounce back to /login).

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { OuraLogo } from "@/components/brand/OuraLogo";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setConfirmMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("אנא מלאו אימייל וסיסמה");
      return;
    }
    if (password.length < 6) {
      setError("הסיסמה חייבת להכיל לפחות 6 תווים");
      return;
    }

    setPending(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
    });
    setPending(false);

    if (signUpError) {
      setError("ההרשמה נכשלה. ייתכן שכתובת האימייל כבר רשומה. נסו שוב.");
      return;
    }

    // No session means the project requires email confirmation - don't
    // redirect into /admin (middleware would bounce it straight back).
    if (!data.session) {
      setConfirmMessage("נשלח אליך מייל לאימות החשבון");
      return;
    }

    router.push("/admin");
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
          יצירת חשבון צלם
        </h1>
        <p className="px-2 leading-relaxed text-on-surface-variant">
          הצטרפו ל-Oura כדי ליצור אירועים, לנהל גלריות ולשתף רגעים עם האורחים.
        </p>
      </section>

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

        <div className="space-y-2">
          <label
            className="block text-start font-medium text-primary"
            htmlFor="password"
          >
            סיסמה
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="לפחות 6 תווים"
            className="h-14 w-full rounded-xl border border-outline-variant/30 bg-black/40 px-4 text-start text-on-surface outline-none transition-all placeholder:text-on-surface-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {error && (
          <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-center text-sm text-error">
            {error}
          </p>
        )}

        {confirmMessage && (
          <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-center text-sm text-primary">
            {confirmMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-on-primary shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-70"
        >
          {pending ? (
            <span className="material-symbols-outlined animate-spin">
              progress_activity
            </span>
          ) : (
            <span className="material-symbols-outlined">person_add</span>
          )}
          הרשמה
        </button>

        <p className="pt-1 text-center text-sm text-on-surface-variant">
          כבר יש לך חשבון?{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline underline-offset-4 transition-colors hover:opacity-80"
          >
            התחברות
          </Link>
        </p>
      </form>
    </main>
  );
}
