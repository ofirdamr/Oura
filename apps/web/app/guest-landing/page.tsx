"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { API_BASE_URL, getGallery, type GalleryResponse } from "@/lib/api";
import { loadGuestSession } from "@/lib/guestSession";
import { OuraLogo } from "@/components/brand/OuraLogo";

export default function GuestLandingPage() {
  return (
    <Suspense fallback={null}>
      <GuestLandingInner />
    </Suspense>
  );
}

function GuestLandingInner() {
  const router = useRouter();
  const [data, setData] = useState<GalleryResponse | null>(null);

  useEffect(() => {
    const session = loadGuestSession();
    if (!session?.token) return;
    getGallery(session.token).then((res) => {
      if (res.ok) setData(res.data);
    });
  }, []);

  const eventName = data?.event?.name ?? null;
  const logoUrl = data?.event?.branding?.logo_key
    ? `${API_BASE_URL}/media/${data.event.branding.logo_key}`
    : null;
  const previewPhotos = data?.photos?.slice(0, 4) ?? [];

  const welcomeSubtitle = eventName
    ? `הזיכרונות שלכם מהאירוע ${eventName} כבר כאן. השתמשו בקוד האישי או סרקו את ה-QR כדי לצפות בגלריה המותאמת עבורכם.`
    : "הזיכרונות שלכם מהאירוע כבר כאן. השתמשו בקוד האישי או סרקו את ה-QR כדי לצפות בגלריה המותאמת עבורכם.";

  return (
    <main
      dir="rtl"
      className="relative mx-auto flex min-h-screen max-w-sm flex-col items-center overflow-x-hidden px-6 md:px-8"
      style={
        {
          "--color-primary": "#9f402d",
          "--color-on-primary": "#ffffff",
        } as React.CSSProperties
      }
    >
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(159,64,45,0.15)_0%,_transparent_50%)]" />

      {/* Branding header */}
      <header className="relative z-10 mb-8 mt-8 text-center">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt="לוגו הסטודיו"
            width={72}
            height={72}
            className="mx-auto mb-2 h-16 w-16 rounded-xl object-contain"
          />
        ) : (
          <OuraLogo variant="lockup" size={72} />
        )}
      </header>

      {/* Welcome */}
      <section className="relative z-10 mb-8 w-full text-center">
        <h1 className="mb-2 text-2xl font-semibold leading-tight text-on-surface md:text-3xl">
          ברוכים הבאים לאירוע שלכם
        </h1>
        <p className="px-4 text-sm leading-relaxed text-on-surface-variant">
          {welcomeSubtitle}
        </p>
      </section>

      {/* Preview Gallery */}
      <section className="relative z-10 mb-8 w-full">
        <div className="mb-4 flex items-center justify-between px-1">
          <h2 className="text-base font-medium text-primary">תמונות אחרונות מהאירוע</h2>
          <Link
            href="/gallery-entry"
            className="flex items-center gap-1 text-sm text-[#e9c349] transition-opacity hover:opacity-80"
          >
            <span>לגלריה המלאה</span>
            <span className="material-symbols-outlined text-base rtl:-scale-x-100">
              arrow_forward
            </span>
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {/* Left column: tall + square */}
          <div className="space-y-2">
            {previewPhotos[0] ? (
              <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-white/5 bg-surface-container">
                <Image src={previewPhotos[0].url} alt="" fill className="object-cover" sizes="45vw" />
              </div>
            ) : (
              <div className="aspect-[3/4] rounded-xl border border-white/5 bg-surface-container" />
            )}
            {previewPhotos[1] ? (
              <div className="relative aspect-square overflow-hidden rounded-xl border border-white/5 bg-surface-container">
                <Image src={previewPhotos[1].url} alt="" fill className="object-cover" sizes="45vw" />
              </div>
            ) : (
              <div className="aspect-square rounded-xl border border-white/5 bg-surface-container" />
            )}
          </div>
          {/* Right column: offset — square + tall */}
          <div className="mt-8 space-y-2">
            {previewPhotos[2] ? (
              <div className="relative aspect-square overflow-hidden rounded-xl border border-white/5 bg-surface-container">
                <Image src={previewPhotos[2].url} alt="" fill className="object-cover" sizes="45vw" />
              </div>
            ) : (
              <div className="aspect-square rounded-xl border border-white/5 bg-surface-container" />
            )}
            {previewPhotos[3] ? (
              <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-white/5 bg-surface-container">
                <Image src={previewPhotos[3].url} alt="" fill className="object-cover" sizes="45vw" />
              </div>
            ) : (
              <div className="aspect-[3/4] rounded-xl border border-white/5 bg-surface-container" />
            )}
          </div>
        </div>
      </section>

      {/* Entry Interface */}
      <div className="relative z-10 w-full space-y-4 pb-8">
        {/* QR Scanner card */}
        <div className="rounded-2xl border border-white/5 bg-surface-container/60 p-6 text-center shadow-2xl backdrop-blur-md">
          <div className="flex flex-col items-center gap-4">
            <div className="relative flex h-48 w-48 items-center justify-center rounded-xl border border-primary/20 bg-primary/5">
              <span
                className="material-symbols-outlined text-on-surface-variant/30"
                style={{ fontSize: "64px" }}
              >
                qr_code_2
              </span>
              <div className="absolute end-4 top-4 h-6 w-6 rounded-tr-sm border-e-2 border-t-2 border-primary/60" />
              <div className="absolute start-4 top-4 h-6 w-6 rounded-tl-sm border-s-2 border-t-2 border-primary/60" />
              <div className="absolute bottom-4 end-4 h-6 w-6 rounded-br-sm border-b-2 border-e-2 border-primary/60" />
              <div className="absolute bottom-4 start-4 h-6 w-6 rounded-bl-sm border-b-2 border-s-2 border-primary/60" />
            </div>
            <Link
              href="/gallery-entry"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <span>הפעל מצלמה לסריקה</span>
              <span className="material-symbols-outlined">photo_camera</span>
            </Link>
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 px-6 opacity-40">
          <div className="h-px flex-1 bg-outline-variant/20" />
          <span className="text-xs font-bold uppercase tracking-[0.2em]">או</span>
          <div className="h-px flex-1 bg-outline-variant/20" />
        </div>

        {/* Manual code entry */}
        <div className="rounded-2xl border border-white/5 bg-surface-container/60 p-6 shadow-xl backdrop-blur-md">
          <div className="space-y-4">
            <label className="block text-start font-medium text-primary" htmlFor="event-code">
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
                placeholder="לדוגמה: WED-2024"
                className="h-14 w-full rounded-xl border border-outline-variant/30 bg-black/40 px-4 text-center font-bold tracking-widest text-on-surface outline-none transition-all placeholder:font-normal placeholder:tracking-normal placeholder:text-on-surface-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/50"
              />
              <span className="material-symbols-outlined absolute start-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50">
                key
              </span>
            </div>
            <Link
              href="/gallery-entry"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/30 py-4 font-bold text-on-surface transition-all hover:bg-white/5 active:scale-[0.98]"
            >
              כניסה לגלריה
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 mt-auto w-full py-8 text-center">
        <p className="flex flex-wrap items-center justify-center gap-1 text-xs text-on-surface-variant/70">
          <button
            type="button"
            onClick={() => router.push("/gallery-entry")}
            className="text-primary underline underline-offset-4"
          >
            מרכז הסיוע
          </button>
          <span>זמין עבורכם</span>
        </p>
      </footer>
    </main>
  );
}
