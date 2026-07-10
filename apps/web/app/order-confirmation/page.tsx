"use client";

// Guest-facing Order Confirmation — Mission A commerce.
// Ported from design/screens/oura_final_production_order_confirmation_desktop
// (screen.png + code.html): success check, order number + date, itemized card,
// subtotal/shipping/total, back-to-gallery + receipt actions.
//
// Reached as Stripe Checkout's success_url (/order-confirmation?order=<id>).
// Loads the real order via GET /guests/:token/orders/:id. Because the webhook
// that flips the order to 'paid' can land a beat after Stripe's browser
// redirect, a still-'pending' order is polled a few times before settling into
// a graceful "finalizing" state — the payment itself already succeeded on
// Stripe's side by the time the guest is here.
//
// This screen's Stitch config uses the deeper terracotta #e2725b as its accent
// (the success icon, total, and primary CTA), applied via a scoped
// --color-primary override — same per-screen-source technique as /prints.

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { getOrder, type Order, type OrderItem, type PrintPaper } from "@/lib/api";
import { loadGuestSession } from "@/lib/guestSession";
import { clearCart } from "@/lib/cart";
import { OuraLogo } from "@/components/brand/OuraLogo";

const PAPER_LABEL: Record<PrintPaper, string> = {
  matte: "נייר מט",
  glossy: "נייר מבריק",
  silk: "נייר משי",
};

function money(agorot: number): string {
  return (agorot / 100).toFixed(agorot % 100 === 0 ? 0 : 2);
}
function Price({ agorot }: { agorot: number }) {
  return <span style={{ unicodeBidi: "isolate", direction: "ltr" }}>₪{money(agorot)}</span>;
}

function hebrewDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("he-IL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function ItemSpec(item: OrderItem): string {
  const paper = PAPER_LABEL[item.paper] ?? item.paper;
  const qty = `כמות: ${item.quantity}`;
  return `${paper} · ${qty}`;
}

function ConfirmationInner() {
  const router = useRouter();
  const params = useSearchParams();
  const orderId = params.get("order");

  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);

  const loadOnce = useCallback(
    async (token: string, id: string) => {
      const result = await getOrder(token, id);
      if (!result.ok) return { ok: false as const, status: result.status };
      return { ok: true as const, data: result.data };
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    async function poll() {
      const session = loadGuestSession();
      if (!session) {
        router.replace("/gallery-entry");
        return;
      }
      if (!orderId) {
        setStatus("error");
        return;
      }
      // The guest has completed checkout — the client cart is spent.
      clearCart();

      const res = await loadOnce(session.token, orderId);
      if (cancelled) return;

      if (!res.ok) {
        setStatus("error");
        return;
      }
      setOrder(res.data.order);
      setItems(res.data.items);
      setStatus("ready");

      // If the paid-webhook hasn't landed yet, re-check a few times.
      if (res.data.order.status === "pending" && attempts < 5) {
        attempts += 1;
        window.setTimeout(poll, 2000);
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [router, orderId, loadOnce]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-3xl text-primary">
          progress_activity
        </span>
      </div>
    );
  }

  if (status === "error" || !order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          לא הצלחנו למצוא את ההזמנה. נסו לרענן, או חזרו לגלריה.
        </p>
        <button
          type="button"
          onClick={() => router.push("/gallery")}
          className="rounded-xl border border-outline-variant/40 px-6 py-3 font-medium text-on-surface transition-all hover:bg-white/5"
        >
          חזרה לגלריה
        </button>
      </div>
    );
  }

  const settled = order.status === "paid" || order.status === "fulfilled";

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ "--color-primary": "#e2725b", "--color-on-primary": "#611205" } as React.CSSProperties}
    >
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="font-display text-xl font-bold tracking-tight text-on-surface">
              Oura
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container-high">
              <OuraLogo variant="lockup" size={28} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/gallery")}
            aria-label="חזרה לגלריה"
            className="material-symbols-outlined text-on-surface transition-opacity hover:opacity-70"
          >
            arrow_forward
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-grow px-4 pb-16 pt-24 text-center">
        {/* Success icon */}
        <div className="mb-6 flex justify-center">
          <div
            className="flex h-24 w-24 items-center justify-center rounded-full border border-primary/20 bg-primary/10"
            style={{ boxShadow: "0 0 40px rgba(226,114,91,0.15)" }}
          >
            <span
              className="material-symbols-outlined text-primary"
              style={{ fontSize: "64px", fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
          </div>
        </div>

        <h1 className="mb-2 text-3xl font-semibold tracking-tight text-on-surface">
          ההזמנה שלך התקבלה בהצלחה!
        </h1>
        <p className="mx-auto mb-10 max-w-md text-lg text-on-surface-variant">
          תודה שרכשת ב-Oura, הזיכרונות שלך בדרך אליך.
        </p>

        {/* Order card */}
        <div className="glass-panel mb-10 overflow-hidden rounded-2xl border border-white/10 text-start">
          <div className="flex flex-col items-start justify-between gap-4 border-b border-white/10 bg-surface-container-high/30 p-6 sm:flex-row sm:items-center">
            <div>
              <span className="mb-1 block text-xs font-semibold uppercase text-on-surface-variant">
                מספר הזמנה
              </span>
              <span
                className="text-2xl font-semibold uppercase tracking-wider text-on-surface"
                style={{ unicodeBidi: "isolate", direction: "ltr" }}
              >
                #{order.order_number}
              </span>
            </div>
            <div className="text-start sm:text-end">
              <span className="mb-1 block text-xs font-semibold uppercase text-on-surface-variant">
                תאריך
              </span>
              <span className="text-base text-on-surface" style={{ unicodeBidi: "isolate" }}>
                {hebrewDate(order.created_at)}
              </span>
            </div>
          </div>

          <div className="space-y-6 p-6">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-4">
                <div className="h-24 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-surface-container-lowest">
                  {item.url ? (
                    <Image
                      src={item.url}
                      alt=""
                      width={80}
                      height={96}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="material-symbols-outlined text-on-surface/30">image</span>
                    </div>
                  )}
                </div>
                <div className="flex-grow">
                  <h3 className="text-base text-on-surface">{item.title}</h3>
                  <p className="text-sm text-on-surface-variant">{ItemSpec(item)}</p>
                </div>
                <div className="text-end text-base text-on-surface">
                  <Price agorot={item.line_agorot} />
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 bg-surface-container-lowest/30 p-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-base text-on-surface-variant">סיכום ביניים</span>
              <span className="text-base text-on-surface">
                <Price agorot={order.subtotal_agorot} />
              </span>
            </div>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-base text-on-surface-variant">משלוח אקספרס</span>
              <span className="text-base text-success">
                {order.shipping_agorot === 0 ? "חינם" : <Price agorot={order.shipping_agorot} />}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-lg font-medium text-on-surface">סה״כ לתשלום</span>
              <span className="text-2xl font-semibold text-primary">
                <Price agorot={order.total_agorot} />
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <button
            type="button"
            onClick={() => router.push("/gallery")}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-10 py-4 text-sm font-medium text-on-primary transition-opacity hover:opacity-90"
          >
            <span>חזרה לגלריה</span>
            <span className="material-symbols-outlined text-sm">arrow_back</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-10 py-4 text-sm font-medium text-on-surface transition-colors hover:border-white/30"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            <span>הורדת קבלה (PDF)</span>
          </button>
        </div>

        {/* Status line */}
        <div className="mt-10 flex items-center justify-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              settled ? "animate-pulse bg-success" : "animate-pulse bg-primary"
            }`}
          />
          <span className="text-xs text-on-surface-variant">
            {settled
              ? "ההזמנה בטיפול - עדכון ישלח למייל"
              : "מאמתים את התשלום - רק רגע..."}
          </span>
        </div>
      </main>
    </div>
  );
}

export default function OrderConfirmationPage() {
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
      <ConfirmationInner />
    </Suspense>
  );
}
