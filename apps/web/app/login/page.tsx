"use client";

// Photographer login. New screen (founder approved building this fresh - no
// Stitch round-trip). Matches the dark-luxury guest-card visual language of
// /consent and /gallery-entry: OuraLogo header in a rounded surface box, a
// radial-gradient backdrop, and a rounded-2xl blurred surface card. RTL/logical
// properties only (Rubik by default). Guests never see this - it's the entry
// point for the /admin area gated by middleware.ts.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { OuraLogo } from "@/components/brand/OuraLogo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("אנא מלאו אימייל וסיסמה");
      return;
    }

    setPending(true);
    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    setPending(false);

    if (signInError) {
      setError("האימייל או הסיסמה שגויים. נסו שוב.");
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
          התחברות לאזור הצלמים
        </h1>
        <p className="px-2 leading-relaxed text-on-surface-variant">
          הזינו את פרטי החשבון שלכם כדי להיכנס ללוח הבקרה ולנהל את האירועים.
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
            autoComplete="current-password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {pending ? (
            <span className="material-symbols-outlined animate-spin">
              progress_activity
            </span>
          ) : (
            <span className="material-symbols-outlined">login</span>
          )}
          התחברות
        </button>

        <p className="pt-1 text-center text-sm text-on-surface-variant">
          אין לך חשבון?{" "}
          <Link
            href="/signup"
            className="font-medium text-primary underline underline-offset-4 transition-colors hover:opacity-80"
          >
            הרשמה
          </Link>
        </p>
      </form>
    </main>
  );
}
