"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function fmt(agorot: string | null): string {
  const n = parseInt(agorot ?? "0", 10);
  if (isNaN(n) || n === 0) return "";
  return `₪${(n / 100).toFixed(0)}`;
}

function todayHe(): string {
  return new Date().toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}

function shortId(orderId: string): string {
  // Convert UUID to a short #OR- display code
  return `#OR-${orderId.slice(0, 6).toUpperCase()}`;
}

function downloadReceiptPdf(orderId: string, total: string | null) {
  const dateStr = new Date().toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
  const shortId = orderId ? `#OR-${orderId.slice(0, 6).toUpperCase()}` : "—";
  const totalFmt = total ? `₪${(parseInt(total, 10) / 100).toFixed(0)}` : "—";

  const win = window.open("", "_blank", "width=600,height=800");
  if (!win) return;
  win.document.write(`<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>קבלה ${shortId}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 40px; color: #111; direction: rtl; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .sub { color: #666; font-size: 13px; margin-bottom: 32px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th, td { text-align: end; padding: 10px 8px; border-bottom: 1px solid #eee; font-size: 14px; }
  th { font-weight: 600; color: #555; }
  .total-row td { font-weight: 700; font-size: 16px; border-top: 2px solid #111; }
  .brand { font-size: 24px; font-weight: 800; color: #e2725b; margin-bottom: 16px; letter-spacing: 2px; }
  @media print { button { display: none; } }
</style>
</head>
<body>
<div class="brand">OURA</div>
<h1>קבלה על הזמנה</h1>
<div class="sub">תאריך: ${dateStr}</div>
<table>
  <thead><tr><th>מספר הזמנה</th><th>פריט</th><th>משלוח</th><th>סה"כ</th></tr></thead>
  <tbody>
    <tr><td>${shortId}</td><td>הדפסת פרימיום</td><td>חינם</td><td>${totalFmt}</td></tr>
    <tr class="total-row"><td colspan="3">סה"כ לתשלום</td><td>${totalFmt}</td></tr>
  </tbody>
</table>
<p style="font-size:12px;color:#999;">תודה שרכשת ב-Oura. שמור קבלה זו לצרכי עזר.</p>
<button onclick="window.print()" style="margin-top:16px;padding:10px 24px;background:#e2725b;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;">הדפס / שמור PDF</button>
</body></html>`);
  win.document.close();
}

function OrderConfirmationContent() {
  const params = useSearchParams();
  const orderId = params.get("order_id") ?? "";
  const total = params.get("total");

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
          <div className="material-symbols-outlined text-[#e2e2e8]">shopping_bag</div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-grow pt-24 pb-16 flex items-center justify-center px-6">
        <div className="max-w-2xl w-full text-center">
          {/* Success icon */}
          <div className="mb-8 flex justify-center">
            <div
              className="w-24 h-24 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(226,114,91,0.12)", border: "1px solid rgba(226,114,91,0.25)", boxShadow: "0 0 48px rgba(255,180,165,0.12)" }}
            >
              <span className="material-symbols-outlined text-[#e2725b]" style={{ fontSize: "48px", fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
            </div>
          </div>

          <h1 className="text-2xl md:text-4xl font-semibold text-[#e2e2e8] mb-3 tracking-tight">
            ההזמנה שלך התקבלה בהצלחה!
          </h1>
          <p className="text-[#94a3b8] text-base mb-10 max-w-md mx-auto">
            תודה שרכשת ב-Oura. הזיכרונות שלך בדרך אליך.
          </p>

          {/* Order details card */}
          <div
            className="rounded-xl overflow-hidden text-start mb-10"
            style={{ border: "1px solid #33363d", background: "rgba(26,28,32,0.9)", backdropFilter: "blur(12px)" }}
          >
            {/* Order header */}
            <div className="p-6 border-b border-[#33363d] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-xs text-[#94a3b8] block mb-1">מספר הזמנה</span>
                <span className="text-xl font-semibold text-[#e2e2e8] tracking-widest font-mono">
                  {orderId ? shortId(orderId) : "—"}
                </span>
              </div>
              <div>
                <span className="text-xs text-[#94a3b8] block mb-1">תאריך</span>
                <span className="text-sm text-[#e2e2e8]">{todayHe()}</span>
              </div>
            </div>

            {/* Item */}
            <div className="p-6 flex items-start gap-4 border-b border-[#33363d]">
              <div className="w-16 h-20 bg-[#08090a] rounded border border-[#33363d] overflow-hidden shrink-0" />
              <div className="flex-1">
                <h3 className="text-base font-medium text-[#e2e2e8]">הדפסת פרימיום</h3>
                <p className="text-sm text-[#94a3b8] mt-1">תמונה שנבחרה מהגלריה שלך</p>
              </div>
              {total && <div className="text-base text-[#e2e2e8] font-medium shrink-0">{fmt(total)}</div>}
            </div>

            {/* Totals */}
            <div className="p-6 bg-[#08090a]/30 space-y-3">
              {total && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#94a3b8]">סיכום ביניים</span>
                  <span className="text-sm text-[#e2e2e8]">{fmt(total)}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#94a3b8]">משלוח</span>
                <span className="text-sm text-[#10b981] font-medium">חינם</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-[#33363d]">
                <span className="text-base font-semibold text-[#e2e2e8]">סה״כ לתשלום</span>
                <span className="text-xl font-semibold text-[#e2725b]">{fmt(total) || "—"}</span>
              </div>
            </div>
          </div>

          {/* Status */}
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
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>arrow_back</span>
            </Link>
            <button
              onClick={() => downloadReceiptPdf(orderId, total)}
              className="border border-[#33363d] text-[#e2e2e8] px-10 py-4 text-sm font-medium rounded-lg hover:border-[#94a3b8] transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>download</span>
              <span>הורדת קבלה (PDF)</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#08090a] border-t border-[#33363d]">
        <div className="max-w-5xl mx-auto py-8 px-6 md:px-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <span className="font-display text-base font-bold text-[#e2725b]">OURA</span>
          <div className="flex flex-wrap justify-center gap-6">
            {["תנאי שימוש", "מדיניות פרטיות", "מידע על משלוחים", "צור קשר"].map((link) => (
              <Link key={link} href="#" className="text-xs text-[#94a3b8] hover:text-[#e2e2e8] transition-colors">{link}</Link>
            ))}
          </div>
          <span className="text-xs text-[#94a3b8]">© 2024 Oura. כל הזכויות שמורות.</span>
        </div>
      </footer>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0c0e12] flex items-center justify-center text-[#94a3b8]">טוען...</div>}>
      <OrderConfirmationContent />
    </Suspense>
  );
}
