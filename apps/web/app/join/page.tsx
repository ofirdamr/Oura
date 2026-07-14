// Guest entry point: QR scan or manual event code lands here. Not yet wired to
// a real event (no backend); this establishes the screen per the Stitch design.
// Preview photos are placeholders until real event media exists.

import Link from "next/link";
import { OuraLogo } from "@/components/brand/OuraLogo";

function PreviewTile({ aspect }: { aspect: string }) {
  return (
    <div
      className={`${aspect} overflow-hidden rounded-xl border border-white/5 bg-surface-container/60 backdrop-blur-md`}
    >
      <div className="flex h-full w-full items-center justify-center">
        <span className="material-symbols-outlined text-3xl text-on-surface-variant/30">
          image
        </span>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    // This screen's Stitch source (guest_landing_page_mobile) defines primary as
    // the rust #9f402d with white on-primary, not the app-global coral #ff8a75.
    // Per the founder's "match each screen to its own Stitch source" decision,
    // scope the rust primary here so every bg/text/border-primary utility
    // recolors at once (Tailwind v4 @theme inline resolves these to the var).
    <main
      className="relative mx-auto flex min-h-screen max-w-xl flex-col items-center overflow-x-hidden p-6 md:p-10"
      style={
        {
          "--color-primary": "#9f402d",
          "--color-on-primary": "#ffffff",
        } as React.CSSProperties
      }
    >
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(159,64,45,0.15)_0%,_transparent_50%)]" />

      <header className="relative z-10 mb-8 mt-8">
        <OuraLogo variant="lockup" size={72} />
      </header>

      <section className="relative z-10 mb-8 w-full text-center">
        <h1 className="mb-2 text-2xl font-semibold leading-tight text-on-surface md:text-3xl">
          ברוכים הבאים לאירוע שלכם
        </h1>
        <p className="px-4 leading-relaxed text-on-surface-variant">
          הזיכרונות שלכם מ-פוטו סנטוס כבר כאן. השתמשו בקוד האישי או סרקו את
          ה-QR כדי לצפות בגלריה המותאמת עבורכם מאת יוסי דוסנטוס.
        </p>
      </section>

      <section className="relative z-10 mb-8 w-full">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-lg font-medium text-primary">
            תמונות אחרונות מהאירוע
          </h2>
          <Link href="/gallery" className="flex items-center gap-1 text-sm font-medium text-[#f4cd4d] hover:opacity-80">
            <span>לגלריה המלאה</span>
            <span className="material-symbols-outlined text-base">
              arrow_forward
            </span>
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <PreviewTile aspect="aspect-[3/4]" />
            <PreviewTile aspect="aspect-square" />
          </div>
          <div className="mt-8 space-y-2">
            <PreviewTile aspect="aspect-square" />
            <PreviewTile aspect="aspect-[3/4]" />
          </div>
        </div>
      </section>

      <div className="relative z-10 w-full space-y-4">
        <div className="rounded-2xl border border-white/5 bg-surface-container/60 p-6 text-center shadow-2xl backdrop-blur-md">
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-52 w-52 overflow-hidden rounded-xl border border-primary/20 bg-primary/5">
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-outline-variant/60"
                  style={{ fontSize: "64px" }}
                >
                  qr_code_scanner
                </span>
              </div>
              <div className="absolute end-0 top-0 h-8 w-8 rounded-tl-xl border-t-2 border-s-2 border-primary/60" />
              <div className="absolute start-0 top-0 h-8 w-8 rounded-tr-xl border-t-2 border-e-2 border-primary/60" />
              <div className="absolute bottom-0 end-0 h-8 w-8 rounded-bl-xl border-b-2 border-s-2 border-primary/60" />
              <div className="absolute bottom-0 start-0 h-8 w-8 rounded-br-xl border-b-2 border-e-2 border-primary/60" />
            </div>
            <Link href="/gallery-entry" className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-on-primary transition-all active:scale-[0.98]">
              {/* Design (guest_landing_page_mobile) puts the camera icon at
                  the left of this label, not the right - measured live at
                  center-x 288 (right-of-center in a 49-371 button) before
                  this fix; text-then-icon under a plain RTL row lands it
                  left instead. */}
              הפעל מצלמה לסריקה
              <span className="material-symbols-outlined">
                camera_enhance
              </span>
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-4 px-6 opacity-40">
          <div className="h-px flex-1 bg-gradient-to-s from-transparent to-outline-variant" />
          <span className="text-xs font-bold">או</span>
          <div className="h-px flex-1 bg-gradient-to-e from-transparent to-outline-variant" />
        </div>

        <div className="rounded-2xl border border-white/5 bg-surface-container/60 p-6 backdrop-blur-md">
          <div className="space-y-4">
            <label
              className="block text-start font-medium text-primary"
              htmlFor="event-code"
            >
              הכנס קוד אירוע ידנית
            </label>
            <div className="relative">
              <input
                id="event-code"
                type="text"
                placeholder="לדוגמה: WED-2024"
                className="h-14 w-full rounded-xl border border-outline-variant/30 bg-black/40 px-4 text-center font-bold tracking-widest text-on-surface outline-none transition-all placeholder:font-normal placeholder:tracking-normal placeholder:text-on-surface-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/50"
              />
              <span className="material-symbols-outlined absolute start-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50">
                vpn_key
              </span>
            </div>
            <Link href="/gallery-entry" className="block w-full rounded-xl border-2 border-primary/40 py-4 text-center font-bold text-on-surface transition-all hover:bg-primary/10 active:scale-[0.98]">
              כניסה לגלריה
            </Link>
          </div>
        </div>
      </div>

      <footer className="relative z-10 mt-auto w-full py-12 text-center">
        <p className="flex items-center justify-center gap-1 text-xs text-on-surface-variant/70">
          נתקלתם בבעיה? צוות פוטו סנטוס זמין עבורכם ב
          <button className="font-medium text-primary underline underline-offset-4">
            מרכז הסיוע
          </button>
        </p>
      </footer>
    </main>
  );
}
