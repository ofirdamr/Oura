"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";

const EVENTS = [
  {
    name: "חתונה - עדי ורועי",
    date: "14.05.2024",
    photos: "452 תמונות",
    views: "1.2k צפיות",
  },
  {
    name: "בר מצווה - איתן",
    date: "10.05.2024",
    photos: "280 תמונות",
    views: "840 צפיות",
  },
];

export default function StudioProfilePage() {
  const [search, setSearch] = useState("");

  const filtered = EVENTS.filter((e) => e.name.includes(search));

  return (
    <AdminShell active="הגדרות">
      {/* Studio header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-full border border-primary/30 bg-surface-container-high flex items-center justify-center">
            <span className="material-symbols-outlined text-primary">
              camera_alt
            </span>
          </div>
          <h1 className="text-2xl font-bold text-on-surface font-sans lg:text-3xl">
            סטודיו: Photo Santos
          </h1>
        </div>
        <button className="rounded-xl bg-primary px-6 py-2 text-sm font-bold text-on-primary transition-opacity hover:opacity-90">
          שמירת שינויים
        </button>
      </div>

      {/* Stats */}
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col justify-between rounded-xl border border-outline/5 bg-surface-container-high p-6 transition-colors hover:bg-surface-bright">
          <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant font-sans">
            אירועים פעילים
          </span>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-4xl font-bold text-primary font-sans">12</span>
            <span className="material-symbols-outlined text-3xl text-primary">
              event_available
            </span>
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-xl border border-outline/5 bg-surface-container-high p-6 transition-colors hover:bg-surface-bright">
          <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant font-sans">
            סה&quot;כ הורדות
          </span>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-4xl font-bold text-tertiary font-sans">
              1.4k
            </span>
            <span className="material-symbols-outlined text-3xl text-tertiary">
              download
            </span>
          </div>
        </div>
      </section>

      {/* Search + create */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row">
        <div className="relative flex-grow">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש אירוע..."
            dir="rtl"
            className="w-full rounded-xl border border-outline/10 bg-surface-container-high py-4 pe-12 ps-4 text-start text-on-surface placeholder-on-surface-variant/60 outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/50 font-sans"
          />
          <span className="material-symbols-outlined absolute end-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
            search
          </span>
        </div>
        <Link
          href="/admin/create-event"
          className="flex items-center justify-center gap-3 rounded-xl bg-primary-container px-8 py-4 text-on-primary shadow-lg transition-all hover:brightness-110 active:scale-[0.98] md:w-auto"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-on-primary/10">
            <span className="material-symbols-outlined font-bold">add</span>
          </div>
          <span className="text-lg font-bold font-sans">יצירת אירוע חדש</span>
        </Link>
      </div>

      {/* Event list */}
      <div className="space-y-4">
        <h3 className="text-start text-xs font-medium uppercase tracking-widest text-on-surface-variant font-sans">
          אירועים אחרונים
        </h3>
        {filtered.map((ev) => (
          <div
            key={ev.name}
            className="group relative flex cursor-pointer items-start gap-6 overflow-hidden rounded-xl border border-outline/10 bg-surface-container p-4 transition-all hover:border-outline/30 hover:bg-surface-container-high"
          >
            {/* QR placeholder */}
            <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-lg bg-surface-container-highest sm:h-32 sm:w-32">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant/30">
                qr_code
              </span>
            </div>
            <div className="flex flex-grow flex-col justify-between py-1 text-start">
              <div>
                <h4 className="text-xl font-bold leading-tight text-on-surface transition-colors group-hover:text-primary font-sans">
                  {ev.name}
                </h4>
                <p className="mt-2 flex items-center gap-2 text-sm text-on-surface-variant font-sans">
                  <span className="material-symbols-outlined text-base">
                    calendar_today
                  </span>
                  <span dir="ltr">{ev.date}</span>
                </p>
              </div>
              <div className="mt-4 flex gap-6">
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <span className="material-symbols-outlined text-xl">
                    photo_library
                  </span>
                  <span className="text-sm font-medium font-sans">
                    {ev.photos}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <span className="material-symbols-outlined text-xl">
                    visibility
                  </span>
                  <span className="text-sm font-medium font-sans">
                    {ev.views}
                  </span>
                </div>
              </div>
            </div>
            <button className="absolute end-4 top-4 rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-bright">
              <span className="material-symbols-outlined">more_vert</span>
            </button>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
