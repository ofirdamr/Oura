"use client";

// Full event gallery, "minimal" branding theme (third photographer-selectable
// gallery style, after Personal Gallery and Festive Gallery - see Branding
// Settings). Stark/luxury bento-grid treatment: dark canvas, sharp cards,
// asymmetric grid, understated typography - opposite of Festive's bold hero
// + masonry approach. No real event media/backend yet, so photo tiles are
// placeholders sized to approximate the source bento layout.
//
// Design QA: design/screens/oura_final_production_minimal_gallery_desktop's
// screen.png renders the literal string "Oura_Final_Production_Minimal_
// Gallery_Desktop" as a real on-page <h1> - a debug artifact left in the
// source, not intentional copy. Not a folder/content mismatch (both mobile
// and desktop are genuinely the same Minimal Gallery concept - same bento
// grid, filters, load-more, Photo Santos photography credit), so both were
// used as structural reference, but that placeholder heading text was not
// ported. Built primarily off the mobile pair to match our mobile viewport.

import { useState } from "react";
import { BottomNav } from "@/components/guest/BottomNav";

const FILTERS = ["הכל", "קבלת פנים", "החופה", "המסיבה"];

type ViewMode = "grid" | "agenda";

const BENTO_PHOTOS: { span: string }[] = [
  { span: "col-span-2 row-span-2" },
  { span: "" },
  { span: "" },
  { span: "col-span-2" },
  { span: "" },
  { span: "" },
];

function BentoTile({ span }: { span: string }) {
  return (
    <div
      className={`${span} group relative cursor-pointer overflow-hidden rounded-lg border-2 border-transparent bg-surface-container transition-all hover:border-primary`}
    >
      <div className="flex h-full w-full items-center justify-center">
        <span className="material-symbols-outlined text-3xl text-on-surface-variant/30">
          image
        </span>
      </div>
    </div>
  );
}

export default function MinimalGalleryPage() {
  const [activeFilter, setActiveFilter] = useState(FILTERS[0]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  return (
    <div className="min-h-screen overflow-x-hidden pb-24">
      <header className="sticky top-0 z-50 border-b border-outline-variant/20 bg-surface-container-low/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg flex-row-reverse items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-high">
              <span className="font-display text-sm font-bold text-primary">
                O
              </span>
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-primary">
              Oura
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="material-symbols-outlined text-on-surface-variant transition-colors hover:text-primary"
              aria-label="התראות"
            >
              notifications
            </button>
            <button
              type="button"
              className="material-symbols-outlined text-on-surface-variant transition-colors hover:text-primary"
              aria-label="פרופיל"
            >
              account_circle
            </button>
          </div>
        </div>
      </header>

      <section className="relative flex h-[220px] w-full items-center justify-center overflow-hidden bg-surface-container-high">
        <span className="material-symbols-outlined absolute text-8xl text-on-surface-variant/10">
          image
        </span>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
        <div className="relative z-10 text-center">
          <span className="font-display text-4xl font-bold tracking-tight text-primary">
            Oura
          </span>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-on-surface-variant">
            Photo Santos Photography
          </p>
        </div>
      </section>

      <section className="sticky top-16 z-40 border-y border-outline-variant/20 bg-background/95 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
          <div className="no-scrollbar flex flex-row-reverse items-center gap-2 overflow-x-auto">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors ${
                  activeFilter === filter
                    ? "bg-primary font-bold text-on-primary"
                    : "bg-surface-container-high text-on-surface-variant hover:text-primary"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              aria-label="תצוגת רשת"
              className={`material-symbols-outlined transition-colors ${
                viewMode === "grid" ? "text-primary" : "text-on-surface-variant"
              }`}
              style={
                viewMode === "grid"
                  ? { fontVariationSettings: "'FILL' 1" }
                  : undefined
              }
            >
              grid_view
            </button>
            <button
              type="button"
              onClick={() => setViewMode("agenda")}
              aria-label="תצוגת רשימה"
              className={`material-symbols-outlined transition-colors ${
                viewMode === "agenda"
                  ? "text-primary"
                  : "text-on-surface-variant"
              }`}
              style={
                viewMode === "agenda"
                  ? { fontVariationSettings: "'FILL' 1" }
                  : undefined
              }
            >
              view_agenda
            </button>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-lg px-4 py-8">
        <div className="grid grid-cols-2 gap-3 [grid-auto-rows:170px]">
          {BENTO_PHOTOS.map((photo, i) => (
            <BentoTile key={i} span={photo.span} />
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            className="rounded-xl border-2 border-primary px-8 py-3 font-bold text-primary transition-all active:scale-95"
          >
            טעינת תמונות נוספות
          </button>
        </div>
      </main>

      <div className="fixed bottom-24 end-4 z-40 flex flex-col gap-3">
        <button
          type="button"
          aria-label="שיתוף"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-tertiary text-background shadow-xl transition-transform active:scale-90"
        >
          <span className="material-symbols-outlined text-xl">share</span>
        </button>
        <button
          type="button"
          aria-label="הורדת הגלריה"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-xl transition-transform active:scale-90"
        >
          <span className="material-symbols-outlined text-2xl">
            download_for_offline
          </span>
        </button>
      </div>

      <footer className="mt-4 border-t border-outline-variant/20 bg-surface-container-high px-4 pb-8 pt-10">
        <div className="mx-auto flex max-w-lg flex-col gap-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-highest">
              <span className="font-display text-sm font-bold text-primary">
                O
              </span>
            </div>
            <h3 className="font-display text-xl font-bold text-primary">
              Oura
            </h3>
          </div>
          <p className="text-sm leading-relaxed text-on-surface">
            הופכים כל אירוע ליצירת אמנות נצחית עם Oura. הטכנולוגיה שלנו
            מאפשרת לכם ליהנות מהזיכרונות שלכם ברזולוציה הגבוהה ביותר ובחוויה
            המזמינה ביותר.
          </p>

          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col gap-3">
              <h4 className="text-sm font-bold text-on-surface">
                קישורים מהירים
              </h4>
              <a
                href="#"
                className="text-sm text-on-surface-variant transition-colors hover:text-primary"
              >
                האירועים שלי
              </a>
              <a
                href="#"
                className="text-sm text-on-surface-variant transition-colors hover:text-primary"
              >
                גלריית אורחים
              </a>
              <a
                href="#"
                className="text-sm text-on-surface-variant transition-colors hover:text-primary"
              >
                הזמנת אלבומים
              </a>
            </div>
            <div className="flex flex-col gap-3">
              <h4 className="text-sm font-bold text-on-surface">תמיכה</h4>
              <a
                href="#"
                className="text-sm text-on-surface-variant transition-colors hover:text-primary"
              >
                שאלות נפוצות
              </a>
              <a
                href="#"
                className="text-sm text-on-surface-variant transition-colors hover:text-primary"
              >
                צור קשר
              </a>
              <a
                href="#"
                className="text-sm text-on-surface-variant transition-colors hover:text-primary"
              >
                תנאי שימוש
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-bold text-on-surface">עקבו אחרינו</h4>
            <div className="flex gap-3">
              <button
                type="button"
                aria-label="אימייל"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant text-on-surface-variant transition-all hover:bg-primary hover:text-on-primary"
              >
                <span className="material-symbols-outlined text-xl">
                  alternate_email
                </span>
              </button>
              <button
                type="button"
                aria-label="אתר"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant text-on-surface-variant transition-all hover:bg-primary hover:text-on-primary"
              >
                <span className="material-symbols-outlined text-xl">
                  language
                </span>
              </button>
            </div>
            <p className="text-xs text-on-surface-variant/70">
              כל הזכויות שמורות © 2024
            </p>
            <p className="text-xs text-on-surface-variant/70">
              צולם באהבה על ידי סטודיו Photo Santos &amp; Oura
            </p>
          </div>
        </div>
      </footer>

      <BottomNav active="gallery" />
    </div>
  );
}
