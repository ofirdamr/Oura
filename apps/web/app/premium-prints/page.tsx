"use client";

import Link from "next/link";

export default function PremiumPrintsPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-[#141210] text-[#ede7e3] font-sans overflow-x-hidden">
      {/* Two-column layout: gallery (receded) + print sidebar */}
      <div className="flex h-screen overflow-hidden">
        {/* Main Gallery Canvas — receded/dimmed */}
        <main className="flex-1 relative overflow-y-auto bg-[#141210] p-8">
          <header className="flex justify-between items-center mb-12">
            <div className="flex items-center gap-4">
              <span className="font-display text-lg font-bold text-[#e2725b]">OURA</span>
              <div className="h-8 w-px bg-[#56423e]/30 mx-2" />
              <h1 className="text-lg font-semibold text-[#ffb4a5]">גלריית Photo Santos</h1>
            </div>
            <Link
              href="/gallery"
              className="flex items-center gap-2 text-[#a48b87] hover:text-[#ffb4a5] transition-colors text-sm"
            >
              <span>→</span>
              <span>חזרה לגלריה</span>
            </Link>
          </header>

          {/* Gallery grid — dimmed, pointer-events-none to show it's background */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 opacity-30 grayscale pointer-events-none">
            {["3/4", "1/1", "4/3", "2/3"].map((ratio, i) => (
              <div key={i} className={`aspect-[${ratio}] bg-[#2a2a2a] rounded-xl`} />
            ))}
          </div>
        </main>

        {/* Print Shop Sidebar */}
        <aside className="w-full md:w-[480px] bg-[#1d1b19] border-s border-[#56423e] shadow-2xl z-50 flex flex-col h-full overflow-hidden">
          <div className="p-8 space-y-8 flex-1 overflow-y-auto">
            {/* Branding & Close */}
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-semibold text-[#ffb4a5]">הזמנת הדפסות</h2>
                <p className="text-sm text-[#a48b87] mt-1">Oura x Photo Santos</p>
              </div>
              <Link
                href="/gallery"
                className="p-2 hover:bg-[#2a2a2a] rounded-full transition-colors text-[#ffb4a5]"
                aria-label="סגור"
              >
                ✕
              </Link>
            </div>

            {/* Selected Photo Preview */}
            <div className="relative">
              <div className="aspect-video w-full rounded-xl overflow-hidden border border-[#56423e] bg-[#0e0e0e]">
                <div className="w-full h-full bg-[#2a2a2a] flex items-center justify-center text-[#a48b87] text-sm">
                  תמונה נבחרת
                </div>
              </div>
              <div className="absolute bottom-4 end-4 bg-[rgba(19,19,19,0.85)] backdrop-blur-md px-3 py-1 rounded-full">
                <p className="text-xs text-[#ffb4a5]">תמונה מס׳ 421</p>
              </div>
            </div>

            {/* Print Configuration */}
            <div className="space-y-8">
              {/* Size Selection */}
              <section>
                <h3 className="text-lg font-medium text-[#ffdad3] mb-4">מידות הדפסה</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "10×15 ס״מ", price: "₪15.00", active: true },
                    { label: "13×18 ס״מ", price: "₪22.00", active: false },
                    { label: "20×30 ס״מ", price: "₪45.00", active: false },
                  ].map(({ label, price, active }) => (
                    <button
                      key={label}
                      className={`p-4 border rounded-xl flex flex-col items-center gap-1 transition-all hover:scale-[1.02] ${
                        active
                          ? "border-[#e2725b] bg-[#e2725b]/10"
                          : "border-[#56423e] hover:bg-[#2a2a2a]"
                      }`}
                    >
                      <span className="text-sm font-medium text-[#ede7e3]">{label}</span>
                      <span className="text-xs text-[#a48b87]">{price}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Paper Type */}
              <section>
                <h3 className="text-lg font-medium text-[#ffdad3] mb-4">סוג נייר</h3>
                <div className="flex flex-wrap gap-2">
                  {["מט (Matte)", "מבריק (Glossy)", "משי (Silk)"].map((type, i) => (
                    <button
                      key={type}
                      className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                        i === 0
                          ? "border-2 border-[#e2725b] text-[#ffdad3]"
                          : "border border-[#56423e] text-[#a48b87] hover:border-[#e2725b]/50"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </section>

              {/* Premium Framing */}
              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-[#ffdad3]">מסגור פרימיום</h3>
                  <span className="text-xs bg-[#574500] text-[#ffe088] px-2 py-0.5 rounded">אופציונלי</span>
                </div>
                <div className="space-y-3">
                  {[
                    { name: "עץ יוקרתי (Luxury Wood)", desc: "עץ מהגוני כהה בגימור ידני", price: "+ ₪85.00", color: "#4A3728", border: "#D4AF37" },
                    { name: "כסף קלאסי (Classic Silver)", desc: "אלומיניום מוברש בסגנון מודרני", price: "+ ₪65.00", color: "#C0C0C0", border: "#E5E4E2" },
                    { name: "אקריליק קריסטל (Crystal Acrylic)", desc: "מראה שקוף ונקי ללא מסגרת חיצונית", price: "+ ₪120.00", color: "rgba(255,255,255,0.1)", border: "rgba(255,255,255,0.3)" },
                  ].map(({ name, desc, price, color, border }) => (
                    <label
                      key={name}
                      className="flex items-center justify-between p-4 rounded-xl border border-[#56423e] cursor-pointer hover:bg-[#2a2a2a] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded"
                          style={{ background: color, border: `2px solid ${border}` }}
                        />
                        <div>
                          <p className="text-sm font-medium text-[#ede7e3]">{name}</p>
                          <p className="text-xs text-[#a48b87]">{desc}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-[#ffdad3]">{price}</span>
                        <input type="radio" name="frame" className="w-4 h-4 accent-[#e2725b]" />
                      </div>
                    </label>
                  ))}
                </div>
              </section>
            </div>
          </div>

          {/* Footer Cart Summary */}
          <div className="p-8 border-t border-[#56423e] bg-[#1c1b1b]">
            <div className="flex justify-between items-end mb-6">
              <div>
                <p className="text-xs text-[#a48b87]">סה״כ לתשלום (1 מוצר)</p>
                <h4 className="text-2xl font-semibold text-[#ffb4a5] mt-1">₪100.00</h4>
              </div>
              <button className="p-3 border border-[#56423e] rounded-full text-[#a48b87] hover:bg-[#2a2a2a] transition-colors">
                🗑
              </button>
            </div>
            <Link
              href="/checkout"
              className="w-full py-4 bg-[#e2725b] text-white text-base font-semibold rounded-full shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex justify-center items-center gap-2"
            >
              <span>🛒</span>
              <span>הוספה לסל הקניות</span>
            </Link>
            <p className="text-center mt-4 text-xs text-[#a48b87]">משלוח חינם בהזמנה מעל ₪250</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
