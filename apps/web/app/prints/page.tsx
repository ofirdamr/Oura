"use client";

// Guest-facing Premium Prints screen — Mission A commerce.
// Ported from design/screens/oura_final_production_premium_prints_mobile
// (screen.png + code.html): framed photo preview, size/paper/frame selectors,
// sticky total + "add to cart" CTA. Reached from /gallery with ?photo=<id>.
//
// Per the standing "match each screen to its own Stitch source" decision, this
// screen's own Stitch config defines primary as the light salmon #ffb4a6 with a
// dark #601308 on-primary (NOT the app-global coral), applied via a scoped
// --color-primary override on the page root so every bg/text/border-primary
// utility recolors at once — same technique as /gift-reveal.
//
// Pricing is fetched from the Worker (GET /prints/pricing) — the SAME config the
// checkout route prices against server-side, so the displayed numbers and the
// charged amount can never drift. The cart is client-side (lib/cart.ts); the
// header cart icon opens Stripe-hosted Checkout for the whole cart.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  createCheckout,
  getGallery,
  getPrintPricing,
  type CheckoutItem,
  type PricingConfig,
  type PrintFrame,
  type PrintPaper,
  type PrintSize,
} from "@/lib/api";
import { loadGuestSession } from "@/lib/guestSession";
import { addCartItem, getCartCount, getCartItems } from "@/lib/cart";
import { OuraLogo } from "@/components/brand/OuraLogo";

// Money helpers — amounts are agorot (integer). Keep the "₪123.45" glued and
// LTR inside RTL copy via an isolate span so bidi never flips it.
function shekels(agorot: number): string {
  return (agorot / 100).toFixed(agorot % 100 === 0 ? 0 : 2);
}
function Price({ agorot, decimals }: { agorot: number; decimals?: boolean }) {
  const value = decimals ? (agorot / 100).toFixed(2) : shekels(agorot);
  return (
    <span style={{ unicodeBidi: "isolate", direction: "ltr" }}>₪{value}</span>
  );
}

// Frame swatch + main-frame colors, taken from the Stitch code.html.
const FRAME_SWATCH: Record<PrintFrame, { bg: string; border: string }> = {
  none: { bg: "#1c1b1b", border: "#2a2a2a" },
  black: { bg: "#0e0e0e", border: "#2a2a2a" },
  oak: { bg: "#3f0300", border: "#7f291c" },
  gold: { bg: "#201f1f", border: "#29c09f" },
};
const MAIN_FRAME: Record<PrintFrame, { bg: string; border: string }> = {
  none: { bg: "#1c1b1b", border: "rgba(255,255,255,0.1)" },
  black: { bg: "#1c1b1b", border: "#353534" },
  oak: { bg: "#752215", border: "#7f291c" },
  gold: { bg: "#00493a", border: "#29c09f" },
};

const PAPER_ICON: Record<PrintPaper, string> = {
  matte: "texture",
  glossy: "auto_awesome",
  silk: "settings_brightness",
};

function PrintsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const photoParam = params.get("photo");

  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [token, setToken] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [pricing, setPricing] = useState<PricingConfig | null>(null);

  const [size, setSize] = useState<PrintSize>("10x15");
  const [paper, setPaper] = useState<PrintPaper>("matte");
  const [frame, setFrame] = useState<PrintFrame>("none");

  const [cartCount, setCartCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const session = loadGuestSession();
      if (!session) {
        router.replace("/gallery-entry");
        return;
      }
      setToken(session.token);
      setEventId(session.event_id);
      setCartCount(getCartCount(session.event_id));

      const [gallery, price] = await Promise.all([
        getGallery(session.token),
        getPrintPricing(),
      ]);
      if (cancelled) return;

      if (!price.ok) {
        setStatus("error");
        return;
      }
      setPricing(price.data);

      if (gallery.ok) {
        const photo =
          gallery.data.photos.find((p) => p.id === photoParam) ??
          (!gallery.data.personal_gallery.consent_required
            ? gallery.data.personal_gallery.photos.find((p) => p.id === photoParam)
            : undefined) ??
          gallery.data.photos[0];
        setPhotoUrl(photo?.url ?? null);
      }
      setStatus("ready");
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [router, photoParam]);

  const priceOf = useMemo(() => {
    if (!pricing) return { size: 0, paper: 0, frame: 0, total: 0 };
    const s = pricing.sizes.find((x) => x.id === size)?.agorot ?? 0;
    const p = pricing.papers.find((x) => x.id === paper)?.agorot ?? 0;
    const f = pricing.frames.find((x) => x.id === frame)?.agorot ?? 0;
    return { size: s, paper: p, frame: f, total: s + p + f };
  }, [pricing, size, paper, frame]);

  function handleAddToCart() {
    if (!eventId || !photoParam || !photoUrl) return;
    addCartItem(eventId, {
      photo_id: photoParam,
      photo_url: photoUrl,
      size,
      paper,
      frame,
      quantity: 1,
    });
    setCartCount(getCartCount(eventId));
    setToast("נוסף לסל");
    window.setTimeout(() => setToast(null), 2200);
  }

  async function handleCheckout() {
    if (!token || !eventId || checkingOut) return;
    const items = getCartItems(eventId);
    if (items.length === 0) return;
    setCheckingOut(true);
    setCheckoutError(null);
    const payload: CheckoutItem[] = items.map((it) => ({
      photo_id: it.photo_id,
      size: it.size,
      paper: it.paper,
      frame: it.frame,
      quantity: it.quantity,
    }));
    const result = await createCheckout(token, payload);
    if (result.ok) {
      window.location.href = result.data.checkout_url;
      return;
    }
    setCheckingOut(false);
    setCheckoutError(
      result.error === "stripe_live_key_blocked"
        ? "התשלומים עדיין במצב בדיקה. נסו שוב מאוחר יותר."
        : "לא הצלחנו לפתוח את התשלום. נסו שוב.",
    );
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-3xl text-primary">
          progress_activity
        </span>
      </div>
    );
  }

  if (status === "error" || !pricing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          לא הצלחנו לטעון את מחירון ההדפסות. נסו שוב.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl border border-outline-variant/40 px-6 py-3 font-medium text-on-surface transition-all hover:bg-white/5"
        >
          נסו שוב
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-40"
      style={
        {
          "--color-primary": "#ffb4a6",
          "--color-on-primary": "#601308",
        } as React.CSSProperties
      }
    >
      {/* Top app bar: back (right in RTL), studio/brand (center), cart (left). */}
      <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-white/5 bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-md items-center justify-between px-4">
          <button
            type="button"
            onClick={() => router.push("/gallery")}
            aria-label="חזרה לגלריה"
            className="material-symbols-outlined rounded-full p-2 text-primary transition-colors hover:bg-white/5"
          >
            arrow_forward
          </button>
          <div className="flex items-center gap-2">
            <span className="font-display text-xl font-bold tracking-tight text-primary">
              Oura
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container-high">
              <OuraLogo variant="lockup" size={28} />
            </div>
          </div>
          <button
            type="button"
            onClick={handleCheckout}
            disabled={cartCount === 0 || checkingOut}
            aria-label={cartCount === 0 ? "הסל ריק" : "מעבר לתשלום"}
            className="relative rounded-full p-2 text-primary transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:text-on-surface/30"
          >
            <span className="material-symbols-outlined">
              {checkingOut ? "progress_activity" : "shopping_cart"}
            </span>
            {cartCount > 0 && !checkingOut && (
              <span
                className="absolute -top-0.5 end-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-on-primary"
                style={{ unicodeBidi: "isolate" }}
              >
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-20">
        {/* Photo preview inside a frame that recolors with the frame selection. */}
        <section className="mb-8 flex justify-center py-6">
          <div
            className="rounded-lg p-5 shadow-2xl transition-colors"
            style={{
              backgroundColor: MAIN_FRAME[frame].bg,
              border: `1px solid ${MAIN_FRAME[frame].border}`,
              transform: "perspective(1000px) rotateY(-5deg) rotateX(5deg)",
            }}
          >
            <div className="rounded-sm bg-black/40 p-1.5">
              {photoUrl ? (
                <Image
                  src={photoUrl}
                  alt="תצוגה מקדימה של ההדפסה"
                  width={256}
                  height={320}
                  className="h-80 w-64 rounded-sm object-cover"
                />
              ) : (
                <div className="flex h-80 w-64 items-center justify-center rounded-sm bg-surface-container">
                  <span className="material-symbols-outlined text-3xl text-on-surface/30">
                    image
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Title */}
        <div className="mb-8 text-start">
          <h1 className="mb-2 text-2xl font-semibold text-on-surface">הדפסת פרימיום</h1>
          <p className="text-base text-on-surface-variant">
            איכות מוזיאונית למזכרות הכי יפות שלכם
          </p>
        </div>

        {/* Size selection */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-medium text-on-surface">בחר גודל הדפסה</h2>
          <div className="grid grid-cols-3 gap-3">
            {pricing.sizes.map((s) => {
              const active = s.id === size;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSize(s.id)}
                  className={`flex flex-col items-center gap-1 rounded-xl p-4 transition-all ${
                    active
                      ? "border-2 border-primary bg-primary/10"
                      : "border border-primary/20 bg-surface-container-low"
                  }`}
                >
                  <span
                    className="text-sm font-medium text-on-surface"
                    style={{ unicodeBidi: "isolate", direction: "ltr" }}
                  >
                    {s.label}
                  </span>
                  <span className="text-xs font-medium text-primary">
                    <Price agorot={s.agorot} />
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Paper selection */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-medium text-on-surface">סוג נייר</h2>
          <div className="flex flex-col gap-3">
            {pricing.papers.map((p) => {
              const active = p.id === paper;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPaper(p.id)}
                  className={`flex items-center justify-between rounded-xl p-4 transition-all ${
                    active
                      ? "border-2 border-primary bg-primary/10"
                      : "border border-primary/20 bg-surface-container-low"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`material-symbols-outlined text-2xl ${
                        active ? "text-primary" : "text-on-surface-variant"
                      }`}
                    >
                      {PAPER_ICON[p.id]}
                    </span>
                    <div className="text-start">
                      <p className="text-sm font-medium text-on-surface">{p.label}</p>
                      <p className="text-xs text-on-surface-variant">{p.sublabel}</p>
                    </div>
                  </div>
                  {active && (
                    <span
                      className="material-symbols-outlined text-primary"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Frame selection (horizontal scroll) */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-medium text-on-surface">מסגור פרימיום</h2>
          <div className="no-scrollbar flex gap-4 overflow-x-auto pb-4">
            {pricing.frames.map((f) => {
              const active = f.id === frame;
              const swatch = FRAME_SWATCH[f.id];
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFrame(f.id)}
                  className="group w-[130px] flex-shrink-0 cursor-pointer text-center"
                  style={{ opacity: active ? 1 : 0.6 }}
                >
                  <div
                    className={`mb-3 flex aspect-square items-center justify-center rounded-lg border p-3 transition-colors ${
                      active ? "border-primary" : "border-primary/20"
                    }`}
                  >
                    {f.id === "none" ? (
                      <div className="flex h-full w-full items-center justify-center rounded-sm border border-dashed border-white/20">
                        <span className="material-symbols-outlined text-on-surface-variant">
                          crop_free
                        </span>
                      </div>
                    ) : (
                      <div
                        className="h-full w-full rounded-sm shadow-inner"
                        style={{
                          backgroundColor: swatch.bg,
                          border: `6px solid ${swatch.border}`,
                        }}
                      />
                    )}
                  </div>
                  <p className="mb-1 text-sm font-medium text-on-surface">{f.label}</p>
                  {f.agorot > 0 && (
                    <p className="text-xs text-primary">
                      +<Price agorot={f.agorot} />
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {checkoutError && (
          <p className="mb-4 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {checkoutError}
          </p>
        )}
      </main>

      {/* Sticky bottom: total (right in RTL) + add-to-cart (left). */}
      <footer className="glass-panel fixed inset-x-0 bottom-0 z-50 border-t border-white/5">
        <div className="mx-auto flex max-w-md items-center justify-between px-6 py-5">
          <div className="text-start">
            <p className="mb-1 text-xs text-on-surface-variant">סה״כ לתשלום</p>
            <p className="text-2xl font-semibold text-primary">
              <Price agorot={priceOf.total} decimals />
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddToCart}
            className="flex items-center gap-3 rounded-full bg-primary px-8 py-4 text-lg font-medium text-on-primary shadow-lg transition-all active:scale-95"
          >
            <span>הוספה לסל</span>
            <span className="material-symbols-outlined">add_shopping_cart</span>
          </button>
        </div>
      </footer>

      {/* Toast: added-to-cart confirmation with a checkout shortcut. */}
      {toast && (
        <div className="fixed inset-x-0 bottom-28 z-50 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full border border-primary/30 bg-surface-container-high/95 px-5 py-3 shadow-xl backdrop-blur-md">
            <span
              className="material-symbols-outlined text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
            <span className="text-sm font-medium text-on-surface">{toast}</span>
            <button
              type="button"
              onClick={handleCheckout}
              className="text-sm font-bold text-primary underline underline-offset-2"
            >
              מעבר לתשלום
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PrintsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <span className="material-symbols-outlined animate-spin text-3xl text-primary">
            progress_activity
          </span>
        </div>
      }
    >
      <PrintsInner />
    </Suspense>
  );
}
