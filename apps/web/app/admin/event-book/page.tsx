"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";

const CATEGORIES = [
  "קבלת פנים",
  "חופה",
  "ריקודים",
  "מנה עיקרית",
];

const PHOTO_GRID = [
  { span: "col-span-2 row-span-2", match: "99%" },
  { span: "", match: "98%" },
  { span: "", match: "95%" },
  { span: "aspect-square", match: "92%" },
  { span: "aspect-square", match: "97%" },
  { span: "", match: "99%" },
  { span: "", match: "94%" },
];

export default function EventBookPage() {
  const [activeTab, setActiveTab] = useState("התמונות שלי");
  const [activeCategory, setActiveCategory] = useState("חופה");

  return (
    <AdminShell active="אירועים פעילים">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="text-start">
          <h1 className="text-3xl font-bold text-on-surface font-sans">
            מעצב אלבומים
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant font-sans">
            עיצוב אלבום אישי ממוזג AI עבור האירוע שלכם
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="rounded-xl border border-outline-variant px-5 py-2 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container-high">
            תצוגה מקדימה
          </button>
          <button className="rounded-xl bg-primary px-6 py-2 text-sm font-bold text-on-primary transition-opacity hover:opacity-90">
            ייצוא אלבום
          </button>
        </div>
      </div>

      {/* Hero banner */}
      <section className="relative mb-6 h-64 overflow-hidden rounded-3xl bg-surface-container-high lg:h-80">
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-surface-container-high/40 to-surface-container-highest">
          <span className="material-symbols-outlined text-6xl text-on-surface-variant/20">
            photo_library
          </span>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/40 px-6 text-center">
          <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-black/40 px-4 py-2 backdrop-blur-sm">
            <span
              className="material-symbols-outlined text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>
            <p className="text-sm text-primary font-sans">
              זיהוי פנים הושלם עבור האירוע
            </p>
          </div>
          <h2 className="text-2xl font-bold text-on-surface font-sans lg:text-4xl">
            התמונות של יונתן לוי
          </h2>
          <p className="text-sm text-on-surface-variant font-sans">
            מצאנו 12 תמונות שלך מתוך 842 תמונות באירוע
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-on-primary transition-transform hover:scale-105">
              <span className="material-symbols-outlined text-lg">download</span>
              הורדת כל התמונות שלי
            </button>
            <Link
              href="/admin/event-book"
              className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-high px-6 py-2.5 text-sm font-bold text-on-surface transition-transform hover:scale-105"
            >
              <span className="material-symbols-outlined text-lg">
                auto_stories
              </span>
              עיצוב אלבום אישי
            </Link>
          </div>
        </div>
      </section>

      {/* Gallery controls */}
      <section className="mb-6 flex flex-col gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container p-4 lg:flex-row lg:items-center lg:justify-between">
        {/* View toggle */}
        <div className="flex rounded-xl bg-surface-container-highest p-1">
          {["התמונות שלי", "כל התמונות"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-5 py-2 text-sm font-bold transition-all ${
                activeTab === tab
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        {/* Category filters */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition-all ${
                activeCategory === cat
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-outline-variant text-on-surface-variant hover:border-primary hover:bg-primary/10"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Photo grid */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {PHOTO_GRID.map((p, i) => (
          <div
            key={i}
            className={`group relative cursor-zoom-in overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container ${p.span || "aspect-[3/4]"}`}
          >
            <div className="flex h-full min-h-[120px] w-full items-center justify-center bg-surface-container-high transition-transform duration-500 group-hover:scale-105">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant/20">
                image
              </span>
            </div>
            <div className="absolute end-2 top-2 rounded-full border border-white/10 bg-black/60 px-2 py-0.5 text-xs text-white backdrop-blur-md">
              {p.match}
            </div>
            <div className="absolute inset-0 flex items-end p-4 opacity-0 transition-opacity group-hover:opacity-100 bg-gradient-to-t from-black/60 to-transparent">
              <div className="flex gap-3">
                <span className="material-symbols-outlined cursor-pointer text-white transition-colors hover:text-primary">
                  favorite
                </span>
                <span className="material-symbols-outlined cursor-pointer text-white transition-colors hover:text-primary">
                  download
                </span>
                <span className="material-symbols-outlined cursor-pointer text-white transition-colors hover:text-primary">
                  add_to_photos
                </span>
              </div>
            </div>
          </div>
        ))}
      </section>
    </AdminShell>
  );
}
