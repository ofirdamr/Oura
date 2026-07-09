"use client";

// 3D Gift Box Reveal - the last MVP screen from the Stitch export. Ported from
// `oura_final_production_gift_box_reveal_desktop` (the DESKTOP screen.png is the
// real reveal: hero box + "זיכרונות מהאירוע" memories gallery). The MOBILE
// screen.png in the same export is a mismatched product-sales page ("Oura Pro"
// hardware, ₪1,299, buy button, shop/discover/account nav) with only the reveal
// widget embedded - same folder/content mismatch class flagged repeatedly in
// this export (see SUMMARY/MISTAKES). Per the CLAUDE.md "match screen.png, not
// folder name" guardrail, the product-sales chrome is intentionally NOT ported;
// this is the guest reveal, built responsively from the desktop composition.
//
// Where it fits in the guest flow: consent gate (accept) -> /selfie (capture)
// -> THIS reveal -> /gallery. It's the celebratory "your gift is ready" moment
// after the selfie submission (matched or not - both are legitimate outcomes,
// the personal gallery already handles "still searching for you" gracefully).
// Now genuinely reachable through the real flow, not just a direct URL - wired
// from /selfie's confirm-submit handler once the embedding service went live.
// The reveal's own CTA still routes forward to /gallery once the box is opened.
//
// The 3D scene (Three.js + GSAP) lives in GiftBoxReveal and is dynamic-imported
// with ssr:false, since WebGL/canvas APIs don't exist server-side.

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getGallery, type GuestPhoto } from "@/lib/api";
import { loadGuestSession } from "@/lib/guestSession";
import { OuraLogo } from "@/components/brand/OuraLogo";
import { StudioLogo } from "@/components/brand/StudioLogo";

const GiftBoxReveal = dynamic(
  () => import("@/components/guest/GiftBoxReveal").then((m) => m.GiftBoxReveal),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-3xl text-primary">
          progress_activity
        </span>
      </div>
    ),
  },
);

// Layout template for the memories grid: the first tile is a large 2x2 hero,
// the rest fall into a varied masonry rhythm. Applied cyclically to however
// many real event photos come back, so the grid keeps the Stitch composition
// regardless of photo count.
const TILE_LAYOUT = [
  "sm:col-span-2 sm:row-span-2 aspect-square sm:aspect-auto",
  "aspect-square",
  "aspect-square",
  "aspect-[4/5]",
  "aspect-[4/5]",
];
const tileClass = (i: number) => TILE_LAYOUT[i % TILE_LAYOUT.length];

// Fallback skeleton tiles shown only when there's no guest session / photos
// haven't loaded (e.g. the reveal reached by direct URL outside the flow), so
// the section still reads like the design instead of collapsing.
const PLACEHOLDER_TILES = TILE_LAYOUT;

export default function GiftRevealPage() {
  const router = useRouter();
  const [opened, setOpened] = useState(false);

  // Real event photos for the "memories" gallery below the reveal. Same source
  // the personal gallery uses (GET /gallery/:token -> general event photos);
  // this section previously rendered hardcoded empty placeholder tiles, which
  // made the reveal look like the guest's photos were missing. Best-effort: if
  // there's no session or the fetch fails, fall back to placeholder tiles
  // rather than blocking the celebratory reveal.
  const [memories, setMemories] = useState<GuestPhoto[]>([]);
  // The photo shown rising out of the box: prefer the guest's OWN first matched
  // photo (a real teaser of what's inside their personal gallery), falling back
  // to the first general event photo, then to the placeholder card if neither.
  const [heroPhotoUrl, setHeroPhotoUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const session = loadGuestSession();
    if (!session) return;
    getGallery(session.token).then((result) => {
      if (cancelled || !result.ok) return;
      setMemories(result.data.photos);
      const pg = result.data.personal_gallery;
      const matched = pg.consent_required === false ? pg.photos : [];
      setHeroPhotoUrl(matched[0]?.url ?? result.data.photos[0]?.url);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    // This screen's Stitch source (oura_final_production_gift_box_reveal_desktop)
    // defines primary as the rust #9f402d with white on-primary, NOT the app's
    // global coral #ff8a75 — the guest reveal/entry screens use rust in Stitch.
    // Per the founder's "match each screen to its own Stitch source" decision,
    // scope the rust primary to this page so every bg/text/border-primary utility
    // recolors at once (Tailwind v4 @theme inline resolves these to the var).
    <div
      className="relative min-h-screen overflow-x-hidden"
      style={
        {
          "--color-primary": "#9f402d",
          "--color-on-primary": "#ffffff",
        } as React.CSSProperties
      }
    >
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_-10%,_rgba(159,64,45,0.22)_0%,_transparent_55%)]" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl flex-row-reverse items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <OuraLogo size={36} />
            <span className="font-display text-2xl font-bold tracking-tight text-on-surface">
              Oura
            </span>
          </div>
          <div className="flex items-center gap-2 text-on-surface-variant">
            <StudioLogo size={22} />
            <span className="text-xs font-medium">Photo Santos</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6 py-10 md:py-14">
        {/* Hero + 3D reveal */}
        <section className="mb-16 text-center md:mb-24">
          <h1 className="mb-4 text-4xl font-bold leading-tight tracking-tight text-on-surface md:text-6xl">
            משהו מיוחד מחכה לך
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-on-surface-variant md:text-xl">
            הקופסה האישית שלך מוכנה. לחץ כדי לגלות את המתנה שלך.
          </p>

          <div className="relative mx-auto max-w-4xl">
            <div className="relative h-[360px] cursor-grab overflow-hidden rounded-luxury border border-white/5 bg-surface-container/60 shadow-2xl active:cursor-grabbing sm:h-[440px] md:h-[500px]">
              <GiftBoxReveal onOpenChange={setOpened} photoUrl={heroPhotoUrl} />

              {/* Instruction / status pill */}
              <div
                className={`glass-panel pointer-events-none absolute inset-x-0 bottom-6 z-10 mx-auto w-max max-w-[calc(100%-2rem)] rounded-full border px-5 py-2 text-center text-xs font-medium sm:whitespace-nowrap sm:px-6 sm:text-sm ${
                  opened
                    ? "border-primary/40 text-primary"
                    : "animate-bounce border-white/10 text-on-surface"
                }`}
              >
                {opened
                  ? "הקופסה נפתחה! המתנה שלך מוכנה"
                  : "גרור כדי לסובב | לחץ כדי לפתוח"}
              </div>
            </div>

            {/* Post-reveal CTA into the personal gallery */}
            <div
              className={`mt-8 transition-all duration-700 ${
                opened
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none translate-y-3 opacity-0"
              }`}
            >
              <button
                type="button"
                onClick={() => router.push("/gallery")}
                className="mx-auto flex items-center gap-2 rounded-full bg-primary px-10 py-4 text-lg font-bold text-on-primary shadow-[0_8px_30px_rgba(159,64,45,0.4)] transition-all hover:scale-[1.03] active:scale-95"
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  auto_awesome
                </span>
                כניסה לגלריה האישית שלך
              </button>
            </div>
          </div>
        </section>

        {/* Memories gallery */}
        <section className="mb-12">
          {/* Match screen.png (heading at RTL start/right, button at left). The
              Stitch code.html says flex-row-reverse here, but its own rendered
              screen.png shows the plain flex-row result — export code/image
              disagree, and the guardrail is to match the image. */}
          <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div className="text-start sm:text-start">
              <h2 className="mb-1 text-2xl font-bold text-on-surface md:text-3xl">
                זיכרונות מהאירוע
              </h2>
              <p className="text-on-surface-variant">
                הגלריה המלאה שלך מ-Oura Production
              </p>
            </div>
            <button className="flex items-center gap-2 rounded-full bg-primary px-8 py-3 font-bold text-on-primary shadow-[0_4px_20px_rgba(159,64,45,0.4)] transition-all hover:scale-105 active:scale-95">
              <span className="material-symbols-outlined">
                download_for_offline
              </span>
              הורדת כל הגלריה
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {memories.length > 0
              ? memories.map((photo, i) => (
                  <div
                    key={photo.id}
                    className={`group relative overflow-hidden rounded-2xl border border-white/5 bg-surface-container ${tileClass(
                      i,
                    )}`}
                  >
                    <Image
                      src={photo.url}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 240px, (min-width: 640px) 33vw, 50vw"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      <a
                        href={photo.url}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="הורדת התמונה"
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-on-primary transition-transform hover:scale-110"
                      >
                        <span className="material-symbols-outlined">download</span>
                      </a>
                    </div>
                  </div>
                ))
              : PLACEHOLDER_TILES.map((className, i) => (
                  <div
                    key={i}
                    className={`relative overflow-hidden rounded-2xl border border-white/5 bg-surface-container ${className}`}
                  >
                    <div className="flex h-full min-h-32 w-full items-center justify-center">
                      <span className="material-symbols-outlined text-4xl text-on-surface-variant/25">
                        image
                      </span>
                    </div>
                  </div>
                ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-surface py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row-reverse">
          <div className="flex items-center gap-3 opacity-70">
            <OuraLogo size={32} />
            <span className="font-medium text-on-surface-variant">
              Oura Production
            </span>
          </div>
          <nav className="flex gap-8 text-on-surface-variant">
            <a className="transition-colors hover:text-primary" href="#">
              בית
            </a>
            <a className="transition-colors hover:text-primary" href="#">
              גלריה
            </a>
            <a className="transition-colors hover:text-primary" href="#">
              תמיכה
            </a>
            <a className="transition-colors hover:text-primary" href="#">
              פרטיות
            </a>
          </nav>
          <p className="text-sm text-on-surface-variant">
            © 2024 Oura. כל הזכויות שמורות.
          </p>
        </div>
      </footer>
    </div>
  );
}
