"use client";

import Link from "next/link";

export default function CheckoutPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-[#141210] text-[#ede7e3] font-sans">
      {/* Top nav */}
      <header className="fixed top-0 w-full h-16 z-40 bg-[#0e0e0e] border-b border-[#56423e] flex items-center justify-between px-6 md:px-8">
        <div className="flex items-center gap-3">
          <span className="font-display text-lg font-bold text-[#e2725b]">OURA</span>
        </div>
        {/* Back breadcrumb */}
        <Link
          href="/premium-prints"
          className="flex items-center gap-2 text-sm text-[#a48b87] hover:text-[#ffb4a5] transition-colors"
        >
          <span>→</span>
          <span>חזרה להדפסות</span>
        </Link>
      </header>

      <main className="pt-24 pb-16 px-6 md:px-8 max-w-4xl mx-auto">
        {/* Progress steps */}
        <div className="flex items-center justify-center gap-3 mb-10 text-sm">
          {[
            { label: "גלריה", done: true },
            { label: "הדפסות", done: true },
            { label: "תשלום", active: true },
            { label: "אישור", done: false },
          ].map(({ label, done, active }, i) => (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-[#56423e]" />}
              <div className={`flex items-center gap-1.5 ${active ? "text-[#e2725b]" : done ? "text-[#a48b87]" : "text-[#56423e]"}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  active ? "bg-[#e2725b] text-white" : done ? "bg-[#56423e] text-[#ede7e3]" : "border border-[#56423e]"
                }`}>
                  {done && !active ? "✓" : i + 1}
                </div>
                <span className="hidden md:inline">{label}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left: Shipping + Payment Form */}
          <div className="space-y-6">
            {/* Shipping details */}
            <section className="bg-[#1d1b19] border border-[#56423e] rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-[#ffb4a5] mb-5">פרטי משלוח</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#a48b87] mb-1.5">שם פרטי</label>
                    <input
                      type="text"
                      className="w-full bg-[#0e0e0e] border border-[#56423e] rounded-lg px-3 py-2.5 text-sm text-[#ede7e3] outline-none focus:border-[#e2725b] transition-colors"
                      placeholder="יוסי"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#a48b87] mb-1.5">שם משפחה</label>
                    <input
                      type="text"
                      className="w-full bg-[#0e0e0e] border border-[#56423e] rounded-lg px-3 py-2.5 text-sm text-[#ede7e3] outline-none focus:border-[#e2725b] transition-colors"
                      placeholder="כהן"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#a48b87] mb-1.5">כתובת מייל</label>
                  <input
                    type="email"
                    dir="ltr"
                    className="w-full bg-[#0e0e0e] border border-[#56423e] rounded-lg px-3 py-2.5 text-sm text-[#ede7e3] outline-none focus:border-[#e2725b] transition-colors"
                    placeholder="yossi@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#a48b87] mb-1.5">כתובת</label>
                  <input
                    type="text"
                    className="w-full bg-[#0e0e0e] border border-[#56423e] rounded-lg px-3 py-2.5 text-sm text-[#ede7e3] outline-none focus:border-[#e2725b] transition-colors"
                    placeholder="רחוב הרצל 12, תל אביב"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#a48b87] mb-1.5">עיר</label>
                    <input
                      type="text"
                      className="w-full bg-[#0e0e0e] border border-[#56423e] rounded-lg px-3 py-2.5 text-sm text-[#ede7e3] outline-none focus:border-[#e2725b] transition-colors"
                      placeholder="תל אביב"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#a48b87] mb-1.5">מיקוד</label>
                    <input
                      type="text"
                      dir="ltr"
                      className="w-full bg-[#0e0e0e] border border-[#56423e] rounded-lg px-3 py-2.5 text-sm text-[#ede7e3] outline-none focus:border-[#e2725b] transition-colors"
                      placeholder="6100000"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Payment details */}
            <section className="bg-[#1d1b19] border border-[#56423e] rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-[#ffb4a5] mb-5">פרטי תשלום</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-[#a48b87] mb-1.5">מספר כרטיס אשראי</label>
                  <input
                    type="text"
                    dir="ltr"
                    className="w-full bg-[#0e0e0e] border border-[#56423e] rounded-lg px-3 py-2.5 text-sm text-[#ede7e3] outline-none focus:border-[#e2725b] transition-colors tracking-widest"
                    placeholder="0000 0000 0000 0000"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#a48b87] mb-1.5">תוקף (MM/YY)</label>
                    <input
                      type="text"
                      dir="ltr"
                      className="w-full bg-[#0e0e0e] border border-[#56423e] rounded-lg px-3 py-2.5 text-sm text-[#ede7e3] outline-none focus:border-[#e2725b] transition-colors"
                      placeholder="12/27"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#a48b87] mb-1.5">CVV</label>
                    <input
                      type="text"
                      dir="ltr"
                      className="w-full bg-[#0e0e0e] border border-[#56423e] rounded-lg px-3 py-2.5 text-sm text-[#ede7e3] outline-none focus:border-[#e2725b] transition-colors"
                      placeholder="123"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#a48b87] mb-1.5">שם בעל הכרטיס</label>
                  <input
                    type="text"
                    className="w-full bg-[#0e0e0e] border border-[#56423e] rounded-lg px-3 py-2.5 text-sm text-[#ede7e3] outline-none focus:border-[#e2725b] transition-colors"
                    placeholder="יוסי כהן"
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Right: Order Summary */}
          <div className="space-y-6">
            <section className="bg-[#1d1b19] border border-[#56423e] rounded-2xl p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-[#ffb4a5] mb-5">סיכום הזמנה</h2>

              {/* Cart item */}
              <div className="flex gap-4 pb-5 border-b border-[#56423e]">
                <div className="w-16 h-20 bg-[#2a2a2a] rounded-lg shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#ede7e3]">הדפסת תמונה מס׳ 421</p>
                  <p className="text-xs text-[#a48b87] mt-1">10×15 ס״מ • נייר מט</p>
                  <p className="text-xs text-[#a48b87]">מסגור: עץ יוקרתי</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-[#a48b87]">כמות: 1</span>
                    <span className="text-sm font-semibold text-[#ffdad3]">₪100.00</span>
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="pt-5 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[#a48b87]">סיכום ביניים</span>
                  <span className="text-[#ede7e3]">₪100.00</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#a48b87]">משלוח</span>
                  <span className="text-[#51dcba]">חינם</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#a48b87]">מע״מ (17%)</span>
                  <span className="text-[#ede7e3]">₪17.00</span>
                </div>
                <div className="h-px bg-[#56423e]" />
                <div className="flex justify-between text-base font-semibold">
                  <span className="text-[#ede7e3]">סה״כ לתשלום</span>
                  <span className="text-[#ffb4a5] text-lg">₪117.00</span>
                </div>
              </div>

              {/* Promo code */}
              <div className="mt-5 flex gap-2">
                <input
                  type="text"
                  placeholder="קוד קופון"
                  className="flex-1 bg-[#0e0e0e] border border-[#56423e] rounded-lg px-3 py-2 text-sm text-[#ede7e3] outline-none focus:border-[#e2725b] transition-colors"
                />
                <button className="px-4 py-2 border border-[#e2725b]/40 text-[#e2725b] text-sm rounded-lg hover:bg-[#e2725b]/10 transition-colors">
                  הפעל
                </button>
              </div>

              {/* Proceed CTA */}
              <Link
                href="/order-confirmation"
                className="mt-6 w-full py-4 bg-[#e2725b] text-white text-base font-semibold rounded-full shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex justify-center items-center gap-2"
              >
                <span>🔒</span>
                <span>אישור תשלום</span>
              </Link>

              <p className="text-center text-xs text-[#a48b87] mt-4">
                התשלום מאובטח ומוצפן. לא שומרים פרטי כרטיס.
              </p>

              {/* Back link */}
              <div className="mt-4 text-center">
                <Link
                  href="/premium-prints"
                  className="text-xs text-[#a48b87] hover:text-[#ffb4a5] transition-colors underline underline-offset-4"
                >
                  חזרה לבחירת הדפסות
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
