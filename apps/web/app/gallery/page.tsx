"use client";

// Guest-facing Personal Gallery: face-matched results for one guest within one
// event. No real event/media wiring yet (no backend) - placeholder tiles carry
// the match-percentage badges from the design so the layout and RTL behavior
// can be verified ahead of real photo data.

import { useState } from "react";
import { BottomNav } from "@/components/guest/BottomNav";

const FILTERS = ["כל התמונות", "חופה", "ריקודים", "קבלת פנים"];

const PHOTOS = [
  { aspect: "aspect-[3/4]", match: 98 },
  { aspect: "aspect-square", match: 96 },
  { aspect: "aspect-square", match: 94 },
  { aspect: "aspect-[3/4]", match: 91 },
];

function PhotoTile({ aspect, match }: { aspect: string; match: number }) {
  return (
    <div
      className={`${aspect} relative overflow-hidden rounded-2xl border border-white/5 bg-surface-container shadow-md`}
    >
      <div className="flex h-full w-full items-center justify-center">
        <span className="material-symbols-outlined text-3xl text-on-surface-variant/30">
          image
        </span>
      </div>
      <div className="absolute start-2 top-2 flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/70 px-2 py-1 backdrop-blur-md">
        <span
          className="material-symbols-outlined text-primary"
          style={{ fontSize: "14px", fontVariationSettings: "'FILL' 1" }}
        >
          verified
        </span>
        <span className="text-[11px] font-bold tracking-tight text-white">
          {match}%
        </span>
      </div>
    </div>
  );
}

export default function GalleryPage() {
  const [activeFilter, setActiveFilter] = useState(FILTERS[0]);

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg flex-row-reverse items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="material-symbols-outlined text-on-surface transition-opacity hover:opacity-70"
              aria-label="התראות"
            >
              notifications
            </button>
            <button
              type="button"
              className="material-symbols-outlined text-on-surface transition-opacity hover:opacity-70"
              aria-label="פרופיל"
            >
              account_circle
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-display text-2xl font-bold tracking-tight text-primary">
              Oura
            </span>
          </div>
          <button
            type="button"
            className="material-symbols-outlined text-on-surface transition-opacity hover:opacity-70"
            aria-label="חזרה"
          >
            arrow_forward
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-6 px-4 py-6">
        <section className="space-y-2">
          <h1 className="text-2xl font-bold text-on-surface md:text-3xl">
            הגלריה האישית של יונתן לוי
          </h1>
          <p className="text-base leading-relaxed text-on-surface-variant">
            מצאנו{" "}
            <span
              className="font-bold text-primary"
              style={{ unicodeBidi: "isolate" }}
            >
              12
            </span>{" "}
            תמונות
            שלך מתוך 842 תמונות באירוע &apos;החתונה של דניאל ומיכל&apos;.
          </p>
        </section>

        <div className="flex flex-col gap-3">
          <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-lg font-bold text-on-primary shadow-lg transition-all active:scale-[0.98]">
            <span className="material-symbols-outlined">download</span>
            הורדת כל התמונות שלי
          </button>
          <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/40 py-3 font-medium text-on-surface transition-all active:bg-white/5">
            <span className="material-symbols-outlined">share</span>
            שיתוף הגלריה האישית
          </button>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="rounded-xl bg-primary p-2.5">
            <span
              className="material-symbols-outlined text-on-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-primary">
              זיהוי פנים הושלם בהצלחה
            </h3>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              כל התמונות סוננו עבורך באופן אוטומטי
            </p>
          </div>
        </div>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={`shrink-0 whitespace-nowrap rounded-full px-6 py-2.5 text-sm transition-all ${
                activeFilter === filter
                  ? "bg-primary font-bold text-on-primary shadow-md"
                  : "border border-white/5 bg-surface-container font-medium text-on-surface-variant hover:bg-white/10"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 pb-8">
          {PHOTOS.map((photo, i) => (
            <PhotoTile key={i} aspect={photo.aspect} match={photo.match} />
          ))}
        </div>
      </main>

      <BottomNav active="gallery" />
    </div>
  );
}
