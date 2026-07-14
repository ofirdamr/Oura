"use client";

import Link from "next/link";

export default function GuestLandingPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-[#121414] text-white font-sans overflow-x-hidden">
      {/* Ambient radial glow */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(159,64,45,0.15)_0%,_transparent_50%)]" />
      </div>

      <main className="relative z-10 flex flex-col items-center min-h-screen px-6 md:px-8 max-w-xl mx-auto">
        {/* Branding */}
        <header className="mt-8 mb-8 text-center">
          <div className="font-display text-4xl font-bold text-[#ffb4a5] tracking-tight">OURA</div>
          <p className="text-[#a48b87] text-sm mt-1">תצלומי אירועים</p>
        </header>

        {/* Welcome */}
        <section className="text-center mb-8 w-full">
          <h1 className="text-2xl md:text-3xl font-semibold text-white mb-3 leading-tight">
            ברוכים הבאים לאירוע שלכם
          </h1>
          <p className="text-[#a48b87] leading-relaxed px-4 text-sm">
            הזיכרונות שלכם מהאירוע כבר כאן. השתמשו בקוד האישי או סרקו את ה-QR כדי לצפות בגלריה המותאמת עבורכם.
          </p>
        </section>

        {/* Preview Gallery */}
        <section className="w-full mb-8">
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-[#ffb4a5] font-medium text-base">תמונות אחרונות מהאירוע</h2>
            <Link
              href="/gallery-entry"
              className="flex items-center gap-1 text-[#e9c349] text-sm hover:opacity-80 transition-opacity"
            >
              <span>לגלריה המלאה</span>
              <span className="text-xs">←</span>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <div className="rounded-xl overflow-hidden aspect-[3/4] bg-[#1e1e1e] border border-white/5" />
              <div className="rounded-xl overflow-hidden aspect-square bg-[#1e1e1e] border border-white/5" />
            </div>
            <div className="space-y-2 mt-8">
              <div className="rounded-xl overflow-hidden aspect-square bg-[#1e1e1e] border border-white/5" />
              <div className="rounded-xl overflow-hidden aspect-[3/4] bg-[#1e1e1e] border border-white/5" />
            </div>
          </div>
        </section>

        {/* Entry Interface */}
        <div className="w-full space-y-4 mb-8">
          {/* QR Scanner card */}
          <div className="bg-[rgba(30,30,30,0.6)] backdrop-blur-xl rounded-2xl p-6 border border-white/5 shadow-2xl text-center">
            <div className="flex flex-col items-center gap-4">
              {/* Scanner frame */}
              <div className="relative w-48 h-48 rounded-xl border border-[#e2725b]/20 bg-[rgba(159,64,45,0.05)] flex items-center justify-center">
                <div className="text-[#a48b87]/30 text-6xl select-none">▦</div>
                {/* Corner accents */}
                <div className="absolute top-0 end-0 w-7 h-7 border-t-2 border-e-2 border-[#e2725b]/60 rounded-te-xl" />
                <div className="absolute top-0 start-0 w-7 h-7 border-t-2 border-s-2 border-[#e2725b]/60 rounded-ts-xl" />
                <div className="absolute bottom-0 end-0 w-7 h-7 border-b-2 border-e-2 border-[#e2725b]/60 rounded-be-xl" />
                <div className="absolute bottom-0 start-0 w-7 h-7 border-b-2 border-s-2 border-[#e2725b]/60 rounded-bs-xl" />
              </div>
              <Link
                href="/gallery-entry"
                className="w-full py-4 bg-[#e2725b] hover:brightness-110 text-white font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <span>📷</span>
                <span>הפעל מצלמה לסריקה</span>
              </Link>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 px-6 opacity-40">
            <div className="h-px flex-1 bg-[#a48b87]" />
            <span className="text-xs font-bold text-[#a48b87]">או</span>
            <div className="h-px flex-1 bg-[#a48b87]" />
          </div>

          {/* Manual code entry */}
          <div className="bg-[rgba(30,30,30,0.6)] backdrop-blur-xl rounded-2xl p-6 border border-white/5">
            <div className="space-y-4">
              <label className="block text-sm font-medium text-[#ffb4a5] text-start" htmlFor="event-code">
                הכנס קוד אירוע ידנית
              </label>
              <input
                id="event-code"
                type="text"
                placeholder="לדוגמה: WED-2024"
                className="w-full bg-black/40 border border-[#a48b87]/30 text-white h-14 px-4 rounded-xl focus:ring-2 focus:ring-[#e2725b]/50 focus:border-[#e2725b] outline-none transition-all text-center tracking-widest font-bold placeholder:font-normal placeholder:tracking-normal placeholder:text-[#a48b87]/40"
              />
              <Link
                href="/gallery-entry"
                className="block w-full py-4 border-2 border-[#e2725b]/40 hover:bg-[#e2725b]/10 text-white font-bold rounded-xl transition-all duration-300 text-center active:scale-[0.98]"
              >
                כניסה לגלריה
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="py-8 mt-auto text-center w-full">
          <p className="text-xs text-[#a48b87]/70">
            נתקלתם בבעיה?{" "}
            <button className="text-[#ffb4a5] underline underline-offset-4 font-medium">מרכז הסיוע</button>
          </p>
        </footer>
      </main>
    </div>
  );
}
