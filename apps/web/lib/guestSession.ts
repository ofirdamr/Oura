// Client-side persistence for the guest's opaque event-scoped token.
//
// Storage choice: localStorage, not a cookie.
// - Guests never log in (CLAUDE.md guardrail) - there is no server session to
//   pair a cookie with, and every guest screen is a "use client" component
//   with no server-side rendering that would need the token before hydration.
// - The token travels as a literal URL path segment to a DIFFERENT origin
//   (the Worker at oura-api.oura-events.workers.dev, not this Next.js app's
//   origin) for every call (GET /gallery/:token, POST /consent/:token) - it's
//   not a header/cookie the browser attaches automatically, so a cookie would
//   buy us nothing here and would need explicit cross-site
//   `credentials: 'include'` + the Worker echoing a specific (non-wildcard)
//   CORS origin, which it doesn't (it's `cors()` with defaults, i.e. `*`, and
//   `*` + credentialed requests are mutually exclusive per the fetch spec).
// - localStorage survives reloads/reopens within the same event (the task's
//   actual requirement) and is trivial to read synchronously on mount, unlike
//   juggling `document.cookie` parsing for a value that's never sent
//   automatically anyway.
// - Not sessionStorage: a guest closing and reopening the gallery tab/PWA
//   later (same event, e.g. the next day) should not have to re-scan.

const STORAGE_KEY = "oura.guestSession.v1";

export type GuestSession = {
  token: string;
  event_id: string;
  guest_id: string;
};

export function saveGuestSession(session: GuestSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage disabled/full (private-browsing edge cases) - non-fatal, the
    // guest just won't have persistence across reloads this run.
  }
}

export function loadGuestSession(): GuestSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GuestSession>;
    if (!parsed.token || !parsed.event_id || !parsed.guest_id) return null;
    return parsed as GuestSession;
  } catch {
    return null;
  }
}

export function clearGuestSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
