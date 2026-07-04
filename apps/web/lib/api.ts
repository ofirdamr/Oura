// Thin client for the live Cloudflare Worker guest-auth API (apps/api).
// Contract source of truth: apps/api/src/index.ts - read that file directly
// before trusting anything here if the two ever disagree.

// No build-time env plumbing exists yet for apps/web (no .env.local, no
// NEXT_PUBLIC_* vars in use anywhere in this app) - the Worker URL is stable
// and public (it's the deployed API's address, not a secret), so a constant
// is the leanest correct option here. Swap for NEXT_PUBLIC_API_BASE_URL if/when
// a staging Worker is stood up.
export const API_BASE_URL = "https://oura-api.oura-events.workers.dev";

export type GuestPhoto = {
  id: string;
  storage_key: string;
  url: string;
  status?: string;
};

export type PersonalGallery =
  | { consent_required: true }
  | {
      consent_required: false;
      consented_at: string;
      photos: GuestPhoto[];
    };

export type GalleryResponse = {
  event_id: string;
  guest_id: string;
  photos: GuestPhoto[];
  personal_gallery: PersonalGallery;
};

export type IssueGuestResponse = {
  token: string;
  event_id: string;
  guest_id: string;
};

export type ConsentResponse = {
  ok: true;
  guest_id: string;
  event_id: string;
  consented_at: string;
  already: boolean;
};

// Discriminated result type so callers don't need try/catch at every call
// site - network failures and API error bodies both land here as `ok: false`.
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number | null; error: string };

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    // Worker unreachable / offline / CORS-blocked - no HTTP status to report.
    return { ok: false, status: null, error: "network_error" };
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON body (shouldn't happen against this API, but don't crash on it).
  }

  if (!res.ok) {
    const error =
      body && typeof body === "object" && "error" in body && typeof (body as { error?: unknown }).error === "string"
        ? (body as { error: string }).error
        : `http_${res.status}`;
    return { ok: false, status: res.status, error };
  }

  return { ok: true, data: body as T };
}

// POST /events/:event_id/guests -> issue a fresh guest token for this event.
export function issueGuestToken(
  eventId: string,
  displayName?: string,
): Promise<ApiResult<IssueGuestResponse>> {
  return request<IssueGuestResponse>(`/events/${encodeURIComponent(eventId)}/guests`, {
    method: "POST",
    body: JSON.stringify(displayName ? { display_name: displayName } : {}),
  });
}

// GET /gallery/:token -> general event photos + this guest's personal gallery
// (consent-gated server-side; see apps/api's CONSENT GATE comment).
export function getGallery(token: string): Promise<ApiResult<GalleryResponse>> {
  return request<GalleryResponse>(`/gallery/${encodeURIComponent(token)}`);
}

// POST /consent/:token -> record biometric consent for this guest. Idempotent.
export function postConsent(token: string): Promise<ApiResult<ConsentResponse>> {
  return request<ConsentResponse>(`/consent/${encodeURIComponent(token)}`, {
    method: "POST",
  });
}
