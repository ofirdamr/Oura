"use client";

// Full event gallery, "festive" branding theme (one of the photographer's
// selectable gallery styles - see Branding Settings). Distinct from the
// guest-specific Personal Gallery (/gallery): this shows every uploaded
// photo, with a bold hero and tap-to-select multi-download. No real event
// media/backend yet, so photo tiles are placeholders sized to approximate
// the source masonry layout.

import { useState } from "react";
import { BottomNav } from "@/components/guest/BottomNav";
import { OuraLogo } from "@/components/brand/OuraLogo";
import { StudioLogo } from "@/components/brand/StudioLogo";

const FILTERS = ["כל התמונות", "קבלת פנים", "חופה", "מסיבה"];

const SOCIAL_LINKS = [
  { key: "whatsapp", label: "WhatsApp", icon: "whatshot" },
  { key: "instagram", label: "Instagram", icon: "camera_enhance" },
  { key: "tiktok", label: "TikTok", icon: "music_note" },
] as const;

const PHOTOS = [
  { aspect: "aspect-[4/5]" },
  { aspect: "aspect-square" },
  { aspect: "aspect-[4/5]" },
  { aspect: "aspect-square" },
  { aspect: "aspect-[4/5]" },
  { aspect: "aspect-square" },
];

export default function FestiveGalleryPage() {
  const [activeFilter, setActiveFilter] = useState(FILTERS[0]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function toggleSelected(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className="min-h-screen overflow-x-hidden pb-24">
      <header className="relative h-[420px] w-full overflow-hidden bg-surface-container-high">
        <div className="absolute start-4 top-4 z-20 h-14 w-14 rounded-xl bg-surface-container-highest p-2 shadow-lg">
          <OuraLogo variant="lockup" size={40} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="material-symbols-outlined text-6xl text-on-surface-variant/20">
            celebration
          </span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-start gap-2 p-6">
          <span className="rounded-full bg-[#cca72f] px-3 py-1 text-sm font-medium text-black">
            12.05.2024
          </span>
          <h1 className="text-2xl font-bold leading-tight text-on-surface drop-shadow-lg">
            החתונה של נועה וגיא
          </h1>
          <p className="max-w-[85%] text-on-surface/90 drop-shadow-md">
            רגעים קסומים מהערב המיוחד שלנו. תודה שהייתם חלק!
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-on-surface/70 drop-shadow-md">
            <StudioLogo size={18} />
            <span className="text-xs font-medium">צולם על ידי Photo Santos</span>
          </div>
          <div className="mt-2 flex w-full items-center gap-2">
            <button className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-primary px-6 py-3 font-medium text-on-primary shadow-xl transition-all active:scale-95">
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                download
              </span>
              הורדת הגלריה
            </button>
            <button
              type="button"
              aria-label="שיתוף"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-on-surface backdrop-blur-md transition-all active:scale-95"
            >
              <span className="material-symbols-outlined">share</span>
            </button>
          </div>
        </div>
      </header>

      <section className="relative z-20 -mt-6 px-4">
        <div className="glass-panel flex items-center justify-between rounded-2xl border border-white/10 p-4 shadow-xl">
          <div className="flex gap-4">
            {SOCIAL_LINKS.map((social) => (
              <button
                key={social.key}
                type="button"
                className="flex flex-col items-center gap-1"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <span className="material-symbols-outlined">
                    {social.icon}
                  </span>
                </div>
                <span className="text-[10px] font-medium text-on-surface-variant">
                  {social.label}
                </span>
              </button>
            ))}
          </div>
          <div className="h-10 w-px bg-white/10" />
          {/* Design (festive_gallery_mobile_1) shows this stat flush against
              the card's far (left) edge, opposite the social icons/divider -
              `text-start` would hug the box's right edge instead, right next
              to the divider (measured at left:251/right:288 inside a
              left:33/right:296 box before this fix). `text-end` is the
              deliberate opposite-side exception documented in the RTL skill,
              not the usual body-text case. */}
          <div className="flex-1 px-2 text-end">
            <div
              className="text-lg font-bold leading-none text-on-surface"
              style={{ unicodeBidi: "isolate" }}
            >
              428
            </div>
            <div className="text-[10px] text-on-surface-variant">
              תמונות הועלו
            </div>
          </div>
        </div>
      </section>

      <nav className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-6">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
            className={`shrink-0 whitespace-nowrap rounded-full px-5 py-2 text-sm transition-all ${
              activeFilter === filter
                ? "bg-primary font-bold text-on-primary"
                : "border border-outline-variant bg-surface-container-high text-on-surface-variant"
            }`}
          >
            {filter}
          </button>
        ))}
      </nav>

      <main className="px-4">
        <div className="masonry-grid">
          {PHOTOS.map((photo, i) => {
            const isSelected = selected.has(i);
            return (
              <div
                key={i}
                onClick={() => toggleSelected(i)}
                className={`masonry-item relative cursor-pointer overflow-hidden rounded-lg bg-surface-container shadow-md ${photo.aspect} ${
                  isSelected ? "border-2 border-primary" : ""
                }`}
              >
                <div className="flex h-full w-full items-center justify-center">
                  <span className="material-symbols-outlined text-3xl text-on-surface-variant/30">
                    image
                  </span>
                </div>
                {isSelected && (
                  <div className="absolute end-2 top-2 rounded-full bg-primary p-1 shadow-lg">
                    <span
                      className="material-symbols-outlined text-xs text-on-primary"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {selected.size > 0 && (
        <div className="glass-panel fixed inset-x-4 bottom-24 z-40 flex items-center justify-between rounded-2xl border border-primary/30 p-4">
          <span className="font-medium text-on-surface">
            <span style={{ unicodeBidi: "isolate" }}>{selected.size}</span>{" "}
            תמונות נבחרו להורדה
          </span>
          <button className="rounded-lg bg-primary px-4 py-2 font-bold text-on-primary">
            בצע הורדה
          </button>
        </div>
      )}

      <BottomNav active="gallery" />
    </div>
  );
}
