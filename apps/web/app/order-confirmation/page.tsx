"use client";

import Link from "next/link";

export default function OrderConfirmationPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-[#0c0e12] text-[#e2e2e8] font-sans flex flex-col">
      {/* Top nav */}
      <header className="fixed top-0 w-full z-50 bg-[#0c0e12] border-b border-[#33363d] h-16 flex items-center px-6 md:px-10">
        <div className="flex justify-between items-center w-full max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <span className="font-display text-lg font-bold text-[#e2725b]">OURA</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/gallery" className="text-[#94a3b8] text-sm hover:text-[#ffb4a5] transition-colors">גלריה</Link>
            <Link href="#" className="text-[#94a3b8] text-sm hover:text-[#ffb4a5] transition-colors">הזמנות</Link>
            <Link href="#" className="text-[#94a3b8] text-sm hover:text-[#ffb4a5] transition-colors">פרופיל</Link>
          </nav>
          <button className="text-[#e2e2e8]">
            <span className="text-lg">🛍</span>
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-grow pt-24 pb-16 flex items-center justify-center px-6">
        <div className="max-w-2xl w-full text-center">
          {/* Success icon */}
          <div className="mb-8 flex justify-center">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center border border-[#e2725b]/20"
              style={{ background: "rgba(226,114,91,0.08)", boxShadow: "0 0 40px rgba(255,180,165,0.15)" }}
            >
              <span className="text-5xl text-[#e2725b]">✓</span>
            </div>
          </div>

          {/* Headlines */}
          <h1 className="text-2xl md:text-4xl font-semibold text-[#e2e2e8] mb-3 tracking-tight">
            ההזמנה שלך התקבלה בהצלחה!
          </h1>
          <p className="text-[#94a3b8] text-base mb-10 max-w-md mx-auto">
            תודה שרכשת ב-Oura. הזיכרונות שלך בדרך אליך.
          </p>

          {/* Order details card */}
          <div
            className="rounded-lg overflow-hidden text-start mb-10"
            style={{ border: "1px solid #33363d", background: "rgba(26,28,32,0.8)", backdropFilter: "blur(12px)" }}
          >
            {/* Order header */}
            <div className="p-6 border-b border-[#33363d] bg-[#282a2e]/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-xs text-[#94a3b8] block uppercase mb-1 tracking-wider">מספר הזמנה</span>
                <span className="text-xl font-semibold text-[#e2e2e8] tracking-widest">#OR-98421</span>
              </div>
              <div>
                <span className="text-xs text-[#94a3b8] block uppercase mb-1 tracking-wider">תאריך</span>
                <span className="text-sm text-[#e2e2e8]">24 באוקטובר, 2024</span>
              </div>
            </div>

            {/* Order items */}
            <div className="p-6 space-y-6">
              {[
                {
                  title: "סט הדפסים פרימיום",
                  desc: "12 הדפסים בגודל 15×20 ס\"מ, נייר מט ארכיוני",
                  price: "₪240",
                },
                {
                  title: "מארז עץ בעבודת יד",
                  desc: "אלון מושחר, סגירה מגנטית, חריטה אישית",
                  price: "₪350",
                },
              ].map(({ title, desc, price }) => (
                <div key={title} className="flex items-start gap-4">
                  <div className="w-20 h-24 bg-[#08090a] rounded border border-[#33363d] overflow-hidden shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-base font-medium text-[#e2e2e8]">{title}</h3>
                    <p className="text-sm text-[#94a3b8] mt-1">{desc}</p>
                  </div>
                  <div className="text-base text-[#e2e2e8] font-medium shrink-0">{price}</div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="p-6 bg-[#08090a]/30 border-t border-[#33363d] space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#94a3b8]">סיכום ביניים</span>
                <span className="text-sm text-[#e2e2e8]">₪590</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#94a3b8]">משלוח אקספרס</span>
                <span className="text-sm text-[#10b981] font-medium">חינם</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-[#33363d]">
                <span className="text-base font-semibold text-[#e2e2e8]">סה״כ לתשלום</span>
                <span className="text-xl font-semibold text-[#e2725b]">₪590</span>
              </div>
            </div>
          </div>

          {/* Status indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
            <span className="text-xs text-[#94a3b8]">ההזמנה בטיפול — עדכון ישלח למייל</span>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/gallery"
              className="bg-[#e2725b] text-white px-10 py-4 text-sm font-semibold rounded-lg hover:brightness-110 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <span>חזרה לגלריה</span>
              <span>←</span>
            </Link>
            <button className="border border-[#33363d] text-[#e2e2e8] px-10 py-4 text-sm font-medium rounded-lg hover:border-[#94a3b8] transition-colors flex items-center justify-center gap-2">
              <span>⬇</span>
              <span>הורדת קבלה (PDF)</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#08090a] border-t border-[#33363d]">
        <div className="max-w-5xl mx-auto py-8 px-6 md:px-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="font-display text-base font-bold text-[#e2725b]">OURA</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            {["תנאי שימוש", "מדיניות פרטיות", "מידע על משלוחים", "צור קשר"].map((link) => (
              <Link key={link} href="#" className="text-xs text-[#94a3b8] hover:text-[#e2e2e8] transition-colors">
                {link}
              </Link>
            ))}
          </div>
          <span className="text-xs text-[#94a3b8]">© 2024 Oura. כל הזכויות שמורות.</span>
        </div>
      </footer>
    </div>
  );
}
