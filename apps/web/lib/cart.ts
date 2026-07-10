// Client-side print cart, persisted in localStorage (same rationale as
// guestSession.ts — guests never log in, there is no server session to hang a
// server-side cart off, and the cart is inherently a browser-local staging area
// until the guest commits by opening Stripe Checkout).
//
// The cart is scoped to a single guest session's event id: if a browser is
// reused across two different events, the cart is reset rather than mixing
// photos from different galleries into one order (the checkout route would
// reject cross-event photos anyway — this just avoids a confusing client state).

import type { PrintFrame, PrintPaper, PrintSize } from "@/lib/api";

const STORAGE_KEY = "oura.printCart.v1";

export type CartItem = {
  // A stable client id so a line can be removed without ambiguity.
  line_id: string;
  photo_id: string;
  photo_url: string;
  size: PrintSize;
  paper: PrintPaper;
  frame: PrintFrame;
  quantity: number;
};

type CartState = { event_id: string; items: CartItem[] };

function read(): CartState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CartState>;
    if (!parsed.event_id || !Array.isArray(parsed.items)) return null;
    return parsed as CartState;
  } catch {
    return null;
  }
}

function write(state: CartState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage disabled/full — cart just won't persist this run.
  }
}

// Items for the given event (empty if the stored cart belongs to another event).
export function getCartItems(eventId: string): CartItem[] {
  const state = read();
  if (!state || state.event_id !== eventId) return [];
  return state.items;
}

export function getCartCount(eventId: string): number {
  return getCartItems(eventId).reduce((n, it) => n + it.quantity, 0);
}

// Add a line. If the stored cart is for a different event, it's replaced.
export function addCartItem(eventId: string, item: Omit<CartItem, "line_id">): CartItem[] {
  const existing = read();
  const items =
    existing && existing.event_id === eventId ? [...existing.items] : [];
  items.push({ ...item, line_id: crypto.randomUUID() });
  write({ event_id: eventId, items });
  return items;
}

export function removeCartItem(eventId: string, lineId: string): CartItem[] {
  const items = getCartItems(eventId).filter((it) => it.line_id !== lineId);
  write({ event_id: eventId, items });
  return items;
}

export function clearCart(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
