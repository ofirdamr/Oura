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
  match_similarity?: number | null;
  category?: string | null;
};

export type PersonalGallery =
  | { consent_required: true }
  | {
      consent_required: false;
      consented_at: string;
      photos: GuestPhoto[];
    };

export type EventBranding = {
  event_title: string | null;
  share_caption: string | null;
  logo_key: string | null;
  frame: string;
  primary_color: string;
  auto_watermark: boolean;
};

export type GalleryEvent = {
  name: string | null;
  gallery_theme: string;
  branding: EventBranding;
};

export type GalleryResponse = {
  event_id: string;
  guest_id: string;
  guest_display_name?: string | null;
  event?: GalleryEvent;
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

export type ResolveEventCodeResponse = { event_id: string };

// GET /events/by-code/:code -> resolve a human-entered event code to an event_id.
export function resolveEventCode(code: string): Promise<ApiResult<ResolveEventCodeResponse>> {
  return request<ResolveEventCodeResponse>(`/events/by-code/${encodeURIComponent(code)}`);
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
// guardianConfirmed is REQUIRED by the API (Stage 2 legal-review requirement:
// an active guardian/age-confirmation gesture, folded into this same consent
// screen rather than a separate age-gate screen) - the API 400s without it.
export function postConsent(
  token: string,
  guardianConfirmed: boolean,
): Promise<ApiResult<ConsentResponse>> {
  return request<ConsentResponse>(`/consent/${encodeURIComponent(token)}`, {
    method: "POST",
    body: JSON.stringify({ guardian_confirmed: guardianConfirmed }),
  });
}

export type SelfieResponse = { matched: boolean; clusters_linked?: number };

// POST /guests/:token/selfie -> submit a guest selfie for face-matching.
// Multipart with a single `file` field (same reasoning as uploadEventPhoto:
// can't go through the json-only request() helper). Zero-retention by design
// on the server - the selfie/its embedding are never persisted, only the
// resulting match link.
export async function postSelfie(
  token: string,
  file: Blob,
): Promise<ApiResult<SelfieResponse>> {
  const formData = new FormData();
  formData.append("file", file, "selfie.jpg");

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/guests/${encodeURIComponent(token)}/selfie`, {
      method: "POST",
      body: formData,
    });
  } catch {
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

  return { ok: true, data: body as SelfieResponse };
}

export type UploadPhotoResponse = { id: string; event_id: string; storage_key: string };

// POST /events/:event_id/photos -> photographer-authenticated photo ingest.
// Multipart with a single `file` field, so this can't go through request()'s
// json-only fetch path (that helper hardcodes Content-Type: application/json,
// which would clobber the browser's multipart boundary header). Does its own
// fetch with an explicit bearer token instead - caller reads
// session.access_token off the Supabase client and passes it in, same as the
// existing branding-logo upload wiring.
export async function uploadEventPhoto(
  eventId: string,
  file: File,
  accessToken: string,
): Promise<ApiResult<UploadPhotoResponse>> {
  const formData = new FormData();
  formData.append("file", file);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/events/${encodeURIComponent(eventId)}/photos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
  } catch {
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

  return { ok: true, data: body as UploadPhotoResponse };
}

export type DeletePhotoResponse = { id: string; event_id: string };

// DELETE /events/:event_id/photos/:photo_id -> photographer-authenticated photo
// delete (also removes the R2 object server-side - never do this via a direct
// Supabase delete from the browser, per CLAUDE.md). No request body, so this
// can safely go through the shared json request() helper (its hardcoded
// Content-Type doesn't matter for a bodyless DELETE); only the Authorization
// header needs threading through per call.
export type ProcessingStatusResponse = {
  stats: { total: number; done: number; processing: number; pending: number; failed: number };
  recent: Array<{ photo_id: string; event_name: string; status: string; created_at: string }>;
  face_embeddings: number;
};

export function getProcessingStatus(accessToken: string): Promise<ApiResult<ProcessingStatusResponse>> {
  return request<ProcessingStatusResponse>("/admin/processing-status", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function deletePhoto(
  eventId: string,
  photoId: string,
  accessToken: string,
): Promise<ApiResult<DeletePhotoResponse>> {
  return request<DeletePhotoResponse>(
    `/events/${encodeURIComponent(eventId)}/photos/${encodeURIComponent(photoId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
}

export type SetCategoryResponse = {
  id: string;
  event_id: string;
  category: string | null;
  category_source: string | null;
};

// Photographer one-tap category correction. `category: null` clears the tag.
// The API stamps category_source='manual' so the AI/refine passes never overwrite it.
export function setPhotoCategory(
  eventId: string,
  photoId: string,
  category: string | null,
  accessToken: string,
): Promise<ApiResult<SetCategoryResponse>> {
  return request<SetCategoryResponse>(
    `/events/${encodeURIComponent(eventId)}/photos/${encodeURIComponent(photoId)}/category`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ category }),
    },
  );
}
