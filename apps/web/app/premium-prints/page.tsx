"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { API_BASE_URL } from "@/lib/api";

const SIZES = [
  { key: "print_10x15" as const, label: "10×15 ס״מ", comparison: "גודל כרטיס ביקור כפול", priceAgorot: 1500, previewW: 60, previewH: 90 },
  { key: "print_13x18" as const, label: "13×18 ס״מ", comparison: "גודל תמונת ארנק", priceAgorot: 2200, previewW: 80, previewH: 110 },
  { key: "print_20x30" as const, label: "20×30 ס״מ", comparison: "גודל A4 ומעלה", priceAgorot: 4500, previewW: 120, previewH: 180 },
];

const PAPERS = [
  { key: "matte", label: "מט (Matte)", desc: "גימור רך ללא השתקפויות" },
  { key: "glossy", label: "מבריק (Glossy)", desc: "צבעים עזים וחדות מקסימלית" },
  { key: "silk", label: "משי (Silk)", desc: "טקסטורה יוקרתית ועמידה" },
];

const FRAMES = [
  { key: "none", label: "ללא מסגרת", priceAgorot: 0, color: "transparent", border: "#56423e" },
  { key: "matte_black", label: "שחור מט", priceAgorot: 7500, color: "#1a1a1a", border: "#3a3a3a" },
  { key: "natural_oak", label: "אלון טבעי", priceAgorot: 8900, color: "#8B6914", border: "#D4AF37" },
  { key: "luxury_wood", label: "עץ יוקרתי", priceAgorot: 12000, color: "#4A3728", border: "#D4AF37" },
];

function agorotToShekel(agorot: number) {
  return `₪${(agorot / 100).toFixed(2)}`;
}

// Map print_10x15/print_13x18/print_20x30 to DB format
function sizeKeyToDbFormat(key: string): string {
  if (key === "print_13x18" || key === "print_20x30") return "photo_book"; // closest mapping
  return "print_10x15";
}

function PremiumPrintsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const photoId = params.get("photo_id") ?? "";
  const photoUrl = params.get("photo_url") ?? "";
  const token = params.get("token") ?? "";

  const [selectedSize, setSelectedSize] = useState(SIZES[0]);
  const [selectedPaper, setSelectedPaper] = useState(PAPERS[0]);
  const [selectedFrame, setSelectedFrame] = useState(FRAMES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = selectedSize.priceAgorot + selectedFrame.priceAgorot;

  // Determine DB format enum value from size key
  const dbFormat = (
    selectedSize.key === "print_10x15" ? "print_10x15"
    : selectedSize.key === "print_13x18" ? "print_10x15"
    : "block"
  );

  async function handleOrder() {
    if (!token || !photoId) {
      setError("חסרים פרטי תמונה. חזרו לגלריה ונסו שוב.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/gallery/${encodeURIComponent(token)}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photo_id: photoId,
          format: dbFormat,
          price_agorot: total,
          notes: `${selectedSize.label} | ${selectedPaper.label}${selectedFrame.key !== "none" ? ` | ${selectedFrame.label}` : ""}`,
        }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setError(body.error === "photo_not_found" ? "התמונה לא נמצאה. חזרו לגלריה." : "שגיאה בשליחת ההזמנה. נסו שוב.");
        return;
      }
      const data = await res.json() as { order_id: string };
      router.push(`/order-confirmation?order_id=${encodeURIComponent(data.order_id)}&total=${total}`);
    } catch {
      setError("שגיאת רשת. בדקו את החיבור ונסו שוב.");
    } finally {
      setBusy(false);
    }
  }

  const photoExists = !!photoUrl;

  return (
    <div dir="rtl" className="min-h-screen bg-[#141210] text-[#ede7e3] font-sans overflow-x-hidden">
      {/* ── Mobile layout (< md) ── */}
      <div className="md:hidden flex flex-col min-h-screen">
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-[#56423e]">
          <div className="flex items-center gap-2">
            <span className="text-lg text-[#a48b87]">🛒</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center overflow-hidden">
              <span className="material-symbols-outlined text-[#e2725b]" style={{ fontSize: "18px" }}>photo_camera</span>
            </div>
            <span className="font-semibold text-[#ffb4a5] text-sm">Photo Santos</span>
          </div>
          <Link href="/gallery" className="text-[#a48b87] text-sm">
            ←
          </Link>
        </header>

        {/* Photo preview */}
        <div className="relative mx-5 mt-6 rounded-2xl overflow-hidden border-8 border-[#1a1a1a] shadow-2xl bg-[#0e0e0e] aspect-[3/4]">
          {photoExists ? (
            <Image src={photoUrl} alt="תמונה נבחרת" fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#a48b87] text-sm">תמונה נבחרת</div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 px-5 py-6 space-y-6 overflow-y-auto">
          <div>
            <h1 className="text-xl font-semibold text-[#ffb4a5]">הדפסת פרימיום</h1>
            <p className="text-sm text-[#a48b87] mt-1">איכות מוזיאונית למזכרות הכי יפות שלכם</p>
          </div>

          {/* Size */}
          <section>
            <h2 className="text-sm font-medium text-[#ffdad3] mb-3">בחר גודל הדפסה</h2>
            <div className="grid grid-cols-3 gap-2">
              {SIZES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSelectedSize(s)}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                    selectedSize.key === s.key
                      ? "border-[#e2725b] bg-[#e2725b]/10 text-[#ffb4a5]"
                      : "border-[#56423e] text-[#a48b87] hover:bg-[#2a2a2a]"
                  }`}
                >
                  <span className="text-sm font-semibold">{s.label}</span>
                  <span className="text-xs text-center leading-tight">{s.comparison}</span>
                  <span className="text-xs font-medium">{agorotToShekel(s.priceAgorot).replace(".00", "")}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Live preview */}
          <section>
            <h2 className="text-sm font-medium text-[#ffdad3] mb-3">תצוגה מקדימה</h2>
            <div className="flex items-end justify-center gap-6 py-4 rounded-xl bg-[#0e0e0e] border border-[#56423e]">
              {SIZES.map((s) => (
                <div key={s.key} className={`flex flex-col items-center gap-2 transition-all ${selectedSize.key === s.key ? "opacity-100" : "opacity-30"}`}>
                  <div
                    className="relative overflow-hidden rounded"
                    style={{
                      width: `${s.previewW * 0.5}px`,
                      height: `${s.previewH * 0.5}px`,
                      border: selectedFrame.key !== "none" ? `${selectedSize.key === s.key ? 4 : 2}px solid ${selectedFrame.border}` : "1px solid #56423e",
                      background: selectedFrame.key !== "none" ? selectedFrame.color : "transparent",
                    }}
                  >
                    {photoExists && (
                      <img src={photoUrl} alt="" className="w-full h-full object-cover" style={{ padding: selectedFrame.key !== "none" ? "3px" : "0" }} />
                    )}
                  </div>
                  <span className="text-[10px] text-[#a48b87]">{s.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Paper */}
          <section>
            <h2 className="text-sm font-medium text-[#ffdad3] mb-3">סוג נייר</h2>
            <div className="space-y-2">
              {PAPERS.map((p) => (
                <label key={p.key} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedPaper.key === p.key ? "border-[#e2725b] bg-[#e2725b]/08" : "border-[#56423e] hover:bg-[#2a2a2a]"
                }`}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedPaper.key === p.key ? "border-[#e2725b]" : "border-[#56423e]"}`}>
                    {selectedPaper.key === p.key && <div className="w-2.5 h-2.5 rounded-full bg-[#e2725b]" />}
                  </div>
                  <input type="radio" name="paper" value={p.key} checked={selectedPaper.key === p.key} onChange={() => setSelectedPaper(p)} className="sr-only" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#ede7e3]">{p.label}</p>
                    <p className="text-xs text-[#a48b87]">{p.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* Frame */}
          <section>
            <h2 className="text-sm font-medium text-[#ffdad3] mb-3">מסגור פרימיום</h2>
            <div className="grid grid-cols-2 gap-3">
              {FRAMES.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setSelectedFrame(f)}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                    selectedFrame.key === f.key ? "border-[#e2725b] bg-[#e2725b]/10" : "border-[#56423e] hover:bg-[#2a2a2a]"
                  }`}
                >
                  <div className="w-10 h-10 rounded" style={{ background: f.color, border: `2px solid ${f.border}` }} />
                  <span className="text-xs text-[#ede7e3]">{f.label}</span>
                  {f.priceAgorot > 0 && <span className="text-xs text-[#a48b87]">+{agorotToShekel(f.priceAgorot).replace(".00", "")}</span>}
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Sticky bottom */}
        <div className="sticky bottom-0 bg-[#141210] border-t border-[#56423e] px-5 py-4">
          {error && <p className="text-sm text-red-400 mb-3 text-center">{error}</p>}
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-[#a48b87]">סה״כ לתשלום</span>
            <span className="text-xl font-bold text-[#ffb4a5]">{agorotToShekel(total)}</span>
          </div>
          <button
            onClick={handleOrder}
            disabled={busy}
            className="w-full py-4 bg-[#e2725b] text-white text-base font-semibold rounded-full shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex justify-center items-center gap-2 disabled:opacity-60"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>shopping_cart</span>
            <span>{busy ? "שולח הזמנה..." : "הזמנת הדפסה עכשיו"}</span>
          </button>
        </div>
      </div>

      {/* ── Desktop layout (≥ md) ── */}
      <div className="hidden md:flex h-screen overflow-hidden">
        {/* Gallery backdrop */}
        <main className="flex-1 relative overflow-y-auto bg-[#141210]">
          <header className="flex justify-between items-center px-8 py-5 border-b border-[#56423e]/40">
            <div className="flex items-center gap-3">
              <span className="font-display text-lg font-bold text-[#e2725b]">OURA</span>
              <div className="h-6 w-px bg-[#56423e]" />
              <span className="text-[#ffb4a5] text-sm font-medium">גלריית Photo Santos</span>
            </div>
            <Link href="/gallery" className="flex items-center gap-1 text-[#a48b87] hover:text-[#ffb4a5] text-sm transition-colors">
              <span>חזרה לגלריה</span>
              <span>→</span>
            </Link>
          </header>
          {/* Dimmed gallery grid */}
          <div className="p-8 grid grid-cols-4 gap-4 opacity-25 grayscale pointer-events-none">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square bg-[#2a2a2a] rounded-xl" />
            ))}
          </div>
          {/* Selected photo overlay */}
          {photoExists && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-56 h-64 rounded-2xl overflow-hidden border-4 border-[#e2725b]/60 shadow-2xl">
                <Image src={photoUrl} alt="תמונה נבחרת" fill className="object-cover" />
                <div className="absolute bottom-2 end-2 bg-black/70 text-[#ffb4a5] text-xs px-2 py-0.5 rounded-full">
                  תמונה נבחרת
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Print sidebar */}
        <aside className="w-[460px] bg-[#1d1b19] border-s border-[#56423e] flex flex-col h-full">
          {/* Header */}
          <div className="p-7 border-b border-[#56423e] flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-semibold text-[#ffb4a5]">הזמנת הדפסות</h2>
              <p className="text-sm text-[#a48b87] mt-0.5">Oura x Photo Santos</p>
            </div>
            <Link href="/gallery" className="p-2 hover:bg-[#2a2a2a] rounded-full text-[#a48b87] hover:text-[#ffb4a5] transition-colors" aria-label="סגור">
              <span className="material-symbols-outlined">close</span>
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto p-7 space-y-7">
            {/* Photo preview */}
            <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-[#0e0e0e] border border-[#56423e]">
              {photoExists ? (
                <Image src={photoUrl} alt="תמונה נבחרת" fill className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#a48b87] text-sm">תמונה נבחרת</div>
              )}
            </div>

            {/* Size */}
            <section>
              <h3 className="text-base font-medium text-[#ffdad3] mb-3">מידות הדפסה</h3>
              <div className="grid grid-cols-3 gap-2">
                {SIZES.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSelectedSize(s)}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                      selectedSize.key === s.key
                        ? "border-[#e2725b] bg-[#e2725b]/10 text-[#ffb4a5]"
                        : "border-[#56423e] text-[#a48b87] hover:bg-[#2a2a2a]"
                    }`}
                  >
                    <span className="text-sm font-semibold">{s.label}</span>
                    <span className="text-xs text-center leading-tight">{s.comparison}</span>
                    <span className="text-xs font-medium">{agorotToShekel(s.priceAgorot)}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Live preview */}
            <section>
              <h3 className="text-base font-medium text-[#ffdad3] mb-3">תצוגה מקדימה</h3>
              <div className="flex items-end justify-around py-5 rounded-xl bg-[#0e0e0e] border border-[#56423e]">
                {SIZES.map((s) => (
                  <div key={s.key} className={`flex flex-col items-center gap-2 transition-all duration-300 ${selectedSize.key === s.key ? "opacity-100 scale-110" : "opacity-30"}`}>
                    <div
                      className="relative overflow-hidden rounded"
                      style={{
                        width: `${s.previewW * 0.55}px`,
                        height: `${s.previewH * 0.55}px`,
                        border: selectedFrame.key !== "none" ? `4px solid ${selectedFrame.border}` : "1px solid #56423e",
                        background: selectedFrame.key !== "none" ? selectedFrame.color : "transparent",
                        padding: selectedFrame.key !== "none" ? "3px" : "0",
                      }}
                    >
                      {photoExists ? (
                        <img src={photoUrl} alt="" className="w-full h-full object-cover rounded-sm" />
                      ) : (
                        <div className="w-full h-full bg-[#2a2a2a] rounded-sm" />
                      )}
                    </div>
                    <span className="text-[10px] text-[#a48b87]">{s.label}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Paper */}
            <section>
              <h3 className="text-base font-medium text-[#ffdad3] mb-3">סוג נייר</h3>
              <div className="flex flex-wrap gap-2">
                {PAPERS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setSelectedPaper(p)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      selectedPaper.key === p.key
                        ? "border-2 border-[#e2725b] text-[#ffdad3]"
                        : "border border-[#56423e] text-[#a48b87] hover:border-[#e2725b]/50"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Frame */}
            <section>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-base font-medium text-[#ffdad3]">מסגור פרימיום</h3>
                <span className="text-xs bg-[#574500] text-[#ffe088] px-2 py-0.5 rounded">אופציונלי</span>
              </div>
              <div className="space-y-2">
                {FRAMES.map((f) => (
                  <label key={f.key} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedFrame.key === f.key ? "border-[#e2725b] bg-[#e2725b]/08" : "border-[#56423e] hover:bg-[#2a2a2a]"
                  }`}>
                    <input type="radio" name="frame-desktop" value={f.key} checked={selectedFrame.key === f.key} onChange={() => setSelectedFrame(f)} className="sr-only" />
                    <div className="w-8 h-8 rounded shrink-0" style={{ background: f.color, border: `2px solid ${f.border}` }} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#ede7e3]">{f.label}</p>
                    </div>
                    {f.priceAgorot > 0 && (
                      <span className="text-sm font-medium text-[#ffdad3]">+{agorotToShekel(f.priceAgorot)}</span>
                    )}
                    <div className={`w-4 h-4 rounded-full border-2 ${selectedFrame.key === f.key ? "border-[#e2725b] bg-[#e2725b]" : "border-[#56423e]"}`} />
                  </label>
                ))}
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="p-7 border-t border-[#56423e] bg-[#1c1b1b]">
            {error && <p className="text-sm text-red-400 mb-3 text-center">{error}</p>}
            <div className="flex justify-between items-end mb-5">
              <div>
                <p className="text-xs text-[#a48b87]">סה״כ לתשלום (1 מוצר)</p>
                <p className="text-2xl font-semibold text-[#ffb4a5] mt-1">{agorotToShekel(total)}</p>
              </div>
            </div>
            <button
              onClick={handleOrder}
              disabled={busy}
              className="w-full py-4 bg-[#e2725b] text-white text-base font-semibold rounded-full shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex justify-center items-center gap-2 disabled:opacity-60"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>shopping_cart</span>
              <span>{busy ? "שולח הזמנה..." : "הזמנת הדפסה עכשיו"}</span>
            </button>
            <p className="text-center mt-3 text-xs text-[#a48b87]">משלוח חינם בהזמנה מעל ₪250</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function PremiumPrintsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#141210] flex items-center justify-center text-[#a48b87]">טוען...</div>}>
      <PremiumPrintsContent />
    </Suspense>
  );
}
