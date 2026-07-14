"use client";

import { useState } from "react";
import Link from "next/link";

const MESSAGES = [
  {
    status: "מתוזמן",
    statusIcon: "schedule",
    statusColor: "text-tertiary",
    borderColor: "border-s-4 border-tertiary",
    time: "היום, 18:00",
    title: "הצעה אישית: צילומי תדמית 2024",
    preview: "שלום אלון, כאן יוסי דוסנטוס, התרשמנו מהתיק עבודות שלך...",
    tag: "SMS",
    recipients: "ל-154 נמענים",
  },
  {
    status: "נשלח",
    statusIcon: "check_circle",
    statusColor: "text-primary",
    borderColor: "border-s-4 border-primary/60",
    time: "אתמול, 14:20",
    title: "עדכון מערכת: גלריה חדשה זמינה",
    preview: "התמונות מהאירוע שלכם מוכנות לצפייה!",
    tag: "PUSH",
    recipients: "ל-320 נמענים",
  },
  {
    status: "טיוטה",
    statusIcon: "edit_note",
    statusColor: "text-on-surface-variant",
    borderColor: "border-s-4 border-outline-variant opacity-80",
    time: "לפני יומיים",
    title: "תזכורת: פגישת ייעוץ אסטרטגי",
    preview: "היי, רציתי לוודא שקיבלת את הלינק לזום...",
    tag: "SMS",
    recipients: null,
  },
  {
    status: "נשלח",
    statusIcon: "check_circle",
    statusColor: "text-primary",
    borderColor: "border-s-4 border-primary/60",
    time: "05/06/2024",
    title: "ברכות לרגל השקת הסטודיו",
    preview: "מזל טוב על הצעד החדש והמרגש!",
    tag: "PUSH",
    recipients: "ל-1,000 נמענים",
  },
];

const FILTERS = ["הכל", "SMS", "Push", "טיוטות"];

export default function BrochurePage() {
  const [activeFilter, setActiveFilter] = useState("הכל");

  return (
    <div
      dir="rtl"
      lang="he"
      className="flex min-h-screen flex-col bg-background pb-32 text-on-background font-sans"
    >
      {/* Top app bar */}
      <header className="fixed start-0 top-0 z-50 flex w-full items-center justify-between border-b border-outline-variant/10 bg-background/95 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button className="p-2 transition-opacity active:opacity-80">
            <span className="material-symbols-outlined text-primary">menu</span>
          </button>
          {/* "OURA" is Latin branding — font-display is intentional here */}
          <span className="font-display text-xl font-bold tracking-tight text-on-surface">
            OURA
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-on-surface-variant font-sans">
            יוסי דוסנטוס
          </span>
          <Link href="/gallery-entry">
            <button className="p-2 transition-opacity active:opacity-80">
              <span className="material-symbols-outlined text-primary">
                shopping_bag
              </span>
            </button>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-grow px-6 pt-24">
        {/* Page title */}
        <div className="mb-8 text-start">
          <h2 className="text-2xl font-bold text-on-background font-sans">
            מרכז הודעות — פלטינום
          </h2>
          <p className="mt-1 text-xs font-medium uppercase tracking-widest text-primary font-sans">
            ניהול תקשורת AI מתקדם
          </p>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1 rounded-xl border border-outline-variant/20 bg-surface-container p-4 shadow-sm">
            <span className="text-xs text-on-surface-variant font-sans">
              הודעות שנשלחו
            </span>
            <span className="text-xl font-bold text-primary font-sans">
              1,284
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl border border-outline-variant/20 bg-surface-container p-4 shadow-sm">
            <span className="text-xs text-on-surface-variant font-sans">
              תוזמנו להמשך
            </span>
            <span className="text-xl font-bold text-tertiary font-sans">
              42
            </span>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium transition-all font-sans ${
                activeFilter === f
                  ? "bg-primary-container text-on-primary shadow-md"
                  : "border border-outline-variant/10 bg-surface-container-high text-on-surface-variant"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Message list */}
        <div className="flex flex-col gap-4">
          {MESSAGES.map((msg, i) => (
            <div
              key={i}
              className={`rounded-2xl bg-surface-container-high p-4 shadow-xl transition-transform active:scale-[0.98] ${msg.borderColor}`}
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`material-symbols-outlined text-xl ${msg.statusColor}`}
                  >
                    {msg.statusIcon}
                  </span>
                  <span className={`text-xs font-medium ${msg.statusColor} font-sans`}>
                    {msg.status}
                  </span>
                </div>
                <span className="text-xs text-on-surface-variant font-sans">
                  {msg.time}
                </span>
              </div>
              <h3 className="mb-1 font-bold text-on-surface text-start font-sans">
                {msg.title}
              </h3>
              <p className="line-clamp-1 text-xs text-on-surface-variant text-start font-sans">
                {msg.preview}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded border border-outline-variant/30 bg-surface-container-lowest px-2 py-0.5 text-[10px] font-bold uppercase text-on-surface-variant">
                  {msg.tag}
                </span>
                {msg.recipients && (
                  <span className="text-[10px] text-on-surface-variant font-sans">
                    {msg.recipients}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* FAB */}
      <Link href="/gallery-entry">
        <button className="fixed bottom-24 end-6 z-[60] flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-container text-on-primary shadow-2xl transition-transform active:scale-95">
          <span
            className="material-symbols-outlined"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            add
          </span>
        </button>
      </Link>

      {/* Footer */}
      <footer className="flex w-full flex-col items-center gap-2 border-t border-outline-variant/30 bg-surface-container-lowest px-6 py-8 text-center">
        <p className="text-xs text-on-surface-variant font-sans">
          © 2024 OURA PHOTOGRAPHY PLATFORM. ARTIFICIAL INTELLIGENCE, HUMAN EMOTION.
        </p>
        <div className="flex gap-4">
          <Link
            href="#"
            className="text-xs text-secondary transition-colors hover:text-on-background font-sans"
          >
            Privacy Policy
          </Link>
          <Link
            href="#"
            className="text-xs text-secondary transition-colors hover:text-on-background font-sans"
          >
            Terms of Service
          </Link>
          <Link
            href="/gallery-entry"
            className="text-xs text-secondary transition-colors hover:text-on-background font-sans"
          >
            Contact Us
          </Link>
        </div>
      </footer>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 start-0 z-50 flex w-full items-center justify-around rounded-t-xl border-t border-outline-variant/20 bg-surface-container-lowest/95 px-4 py-2 shadow-2xl backdrop-blur-md">
        <Link
          href="/gallery-entry"
          className="flex flex-col items-center justify-center p-3 text-on-surface-variant transition-colors hover:text-primary"
        >
          <span className="material-symbols-outlined">home</span>
        </Link>
        <Link
          href="/gallery-entry"
          className="flex flex-col items-center justify-center p-3 text-on-surface-variant transition-colors hover:text-primary"
        >
          <span className="material-symbols-outlined">camera</span>
        </Link>
        <Link
          href="/brochure"
          className="flex flex-col items-center justify-center rounded-full border border-primary/20 bg-primary-container/15 p-3 text-primary shadow-inner transition-transform active:scale-90"
        >
          <span
            className="material-symbols-outlined"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            auto_awesome
          </span>
        </Link>
        <Link
          href="/gallery-entry"
          className="flex flex-col items-center justify-center p-3 text-on-surface-variant transition-colors hover:text-primary"
        >
          <span className="material-symbols-outlined">person</span>
        </Link>
      </nav>
    </div>
  );
}
