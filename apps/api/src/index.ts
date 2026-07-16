import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import {
  signGuestToken,
  verifyGuestToken,
  tokenHash,
  type GuestTokenPayload,
} from './token';
import { embed, embedWithRetry } from './pipeline/embedClient';
import { handleQueue, type PhotoEmbedMessage } from './queueConsumer';
import { handleScheduled } from './scheduledCleanup';
import { keepEmbedWarm } from './keepEmbedWarm';

// Bindings & secrets available on the Worker env.
// Secrets are injected via `wrangler secret put` — never hardcoded (CLAUDE.md).
export type Env = {
  MEDIA: R2Bucket;
  ENVIRONMENT?: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  // HMAC key for signing/verifying opaque guest tokens. Set via wrangler secret.
  GUEST_TOKEN_SECRET: string;
  // Stage 2 face-matching pipeline.
  FACE_EMBED_QUEUE: Queue<PhotoEmbedMessage>;
  EMBED_SERVICE_URL: string;
  EMBED_SERVICE_TOKEN: string;
  CLUSTER_MATCH_THRESHOLD: string;
  GUEST_MATCH_THRESHOLD: string;
  GUEST_MATCH_TOPK: string;
  // Bearer secret gating /admin/backfill-embeddings — an operator action, not
  // a photographer-dashboard feature, so it isn't behind requireEventOwner.
  ADMIN_BACKFILL_TOKEN: string;
  // Resend API key for transactional email (password reset). Set via wrangler secret.
  RESEND_API_KEY: string;
  // Verified sending address, e.g. "Oura <noreply@yourdomain.com>". Falls back to
  // Resend's shared test address (only reaches the Resend account owner's inbox).
  FROM_EMAIL?: string;
};

// Service-role Supabase client. Bypasses RLS — lives ONLY inside the Worker,
// never exposed to the browser. Guest access is mediated here behind an opaque
// event-scoped token, so guests never touch Postgres directly (CLAUDE.md guardrail).
function supa(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Build an absolute URL to the Worker's own /media/:key streaming route for a
// stored R2 object key. Absolute (not a bare relative path) so it works as an
// <img src> from the separate Next.js origin. The origin is derived from the
// incoming request — never a hardcoded prod hostname — so dev/preview work too.
function photoUrlStub(c: Context, storageKey: string): string {
  return `${new URL(c.req.url).origin}/media/${storageKey}`;
}

// ---------------------------------------------------------------------------
// Photographer auth + event ownership gate.
// Shared by every photographer-authenticated route (photo ingest, branding).
// Steps: (1) pull the Supabase access token from `Authorization: Bearer <jwt>`;
// (2) validate it server-side via `auth.getUser(token)` — this calls Supabase
// Auth to verify the token using the service-role client, so no JWT-secret
// handling lives here; (3) confirm the event exists AND is owned by the caller.
//
// Ownership failures are DELIBERATELY indistinguishable from "no such event":
// both return 404 event_not_found so a non-owner can't probe which event ids
// exist. Returns a discriminated result the caller maps to a JSON response.
type OwnerResult =
  | { ok: true; user: User }
  | { ok: false; status: 401 | 404 | 500; error: string };

async function requireEventOwner(
  c: Context,
  db: SupabaseClient,
  event_id: string,
): Promise<OwnerResult> {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : undefined;
  if (!token) return { ok: false, status: 401, error: 'missing_auth' };

  // Validate the access token against Supabase Auth and resolve the user.
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return { ok: false, status: 401, error: 'invalid_auth' };

  const { data: event, error: eventErr } = await db
    .from('events')
    .select('id, photographer_id')
    .eq('id', event_id)
    .maybeSingle();
  if (eventErr) return { ok: false, status: 500, error: 'lookup_failed' };
  // Uniform 404 for both "missing" and "owned by someone else" — no existence leak.
  if (!event || event.photographer_id !== data.user.id) {
    return { ok: false, status: 404, error: 'event_not_found' };
  }

  return { ok: true, user: data.user };
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

// Health check — confirms the Worker is live and reports which bindings/secrets
// are wired, without ever leaking their values.
app.get('/health', (c) => {
  return c.json({
    ok: true,
    service: 'oura-api',
    environment: c.env.ENVIRONMENT ?? 'unknown',
    bindings: {
      media_r2: typeof c.env.MEDIA?.get === 'function',
      supabase_url: Boolean(c.env.SUPABASE_URL),
      supabase_service_key: Boolean(c.env.SUPABASE_SERVICE_ROLE_KEY),
      guest_token_secret: Boolean(c.env.GUEST_TOKEN_SECRET),
    },
    time: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Guest token issuance.
// POST /events/:event_id/guests
//   Body (optional): { "display_name": string }
//   Creates a guest session row for the event and returns a freshly signed
//   opaque event-scoped token. This is what the (future) QR-scan / manual-code
//   guest entry flow calls. We generate the guest id here so we can bake it into
//   the signed token, then store only SHA-256(token) — never the raw token.
//   Response 201: { token, event_id, guest_id }
// ---------------------------------------------------------------------------
app.post('/events/:event_id/guests', async (c) => {
  const event_id = c.req.param('event_id');
  if (!event_id) return c.json({ error: 'missing_event_id' }, 400);

  let display_name: string | undefined;
  try {
    const body = (await c.req.json().catch(() => ({}))) as { display_name?: unknown };
    if (typeof body?.display_name === 'string' && body.display_name.trim()) {
      display_name = body.display_name.trim().slice(0, 120);
    }
  } catch {
    // no/invalid body is fine — display_name is optional
  }

  const db = supa(c.env);

  // Confirm the event exists (clean 404 instead of a raw FK-violation 500).
  const { data: event, error: eventErr } = await db
    .from('events')
    .select('id')
    .eq('id', event_id)
    .maybeSingle();
  if (eventErr) return c.json({ error: 'lookup_failed' }, 500);
  if (!event) return c.json({ error: 'event_not_found' }, 404);

  // Generate the guest id up front so it can be embedded in the signed token.
  const guest_id = crypto.randomUUID();
  const iat = Math.floor(Date.now() / 1000);
  const payload: GuestTokenPayload = { event_id, guest_id, iat };
  const token = await signGuestToken(payload, c.env.GUEST_TOKEN_SECRET);
  const token_hash = await tokenHash(token);

  const { error: insertErr } = await db.from('guests').insert({
    id: guest_id,
    event_id,
    token_hash,
    display_name: display_name ?? null,
  });
  if (insertErr) return c.json({ error: 'guest_create_failed' }, 500);

  return c.json({ token, event_id, guest_id }, 201);
});

// Shared token resolution: verify signature, then look the guest up by
// (event_id, token_hash), then check expiry. Returns the payload + guest row, or
// an error the caller maps to an HTTP response. Never compares or stores the raw token.
async function resolveGuest(
  db: SupabaseClient,
  token: string,
  secret: string,
): Promise<
  | { ok: true; payload: GuestTokenPayload; guest: { id: string; event_id: string; display_name: string | null } }
  | { ok: false; status: 401; error: 'invalid_token' | 'token_expired' }
  | { ok: false; status: 404; error: 'guest_not_found' }
> {
  const payload = await verifyGuestToken(token, secret);
  if (!payload) return { ok: false, status: 401, error: 'invalid_token' };

  const token_hash = await tokenHash(token);
  const { data: guest } = await db
    .from('guests')
    .select('id, event_id, token_expires_at, display_name')
    .eq('event_id', payload.event_id)
    .eq('token_hash', token_hash)
    .maybeSingle();

  // Signature valid but no matching row (revoked/deleted, or id/hash mismatch).
  if (!guest || guest.id !== payload.guest_id) {
    return { ok: false, status: 404, error: 'guest_not_found' };
  }
  // Expiry lives on the guest row (migration 0004), not re-derived from the token
  // payload — so access can be shortened/extended per-guest without reissuing tokens.
  if (new Date(guest.token_expires_at).getTime() <= Date.now()) {
    return { ok: false, status: 401, error: 'token_expired' };
  }
  return { ok: true, payload, guest: { id: guest.id, event_id: guest.event_id, display_name: guest.display_name ?? null } };
}

// ---------------------------------------------------------------------------
// Guest gallery.
// GET /gallery/:token
//   Verifies the opaque token, resolves the guest, and returns the event's
//   GENERAL photo list (browsing the shared gallery does NOT require consent).
//   The face-matched "personal gallery" section is included ONLY when a
//   biometric_consents row exists for the guest. Pre-consent, we return
//   consent_required:true and NO face data — the one guardrail we never bypass.
//   Response 200:
//     { event_id, guest_id, event: { name, branding },
//       photos: [{ id, storage_key, url, status }],
//       personal_gallery: { consent_required: true }
//                       |  { consent_required: false, photos: [...] } }
// ---------------------------------------------------------------------------
app.get('/gallery/:token', async (c) => {
  const token = c.req.param('token');
  if (!token) return c.json({ error: 'missing_token' }, 400);

  const db = supa(c.env);
  const resolved = await resolveGuest(db, token, c.env.GUEST_TOKEN_SECRET);
  if (!resolved.ok) {
    return c.json(
      { error: resolved.error },
      resolved.status,
    );
  }
  const { payload, guest } = resolved;

  // Touch last_seen_at (best-effort; ignore failure).
  await db.from('guests').update({ last_seen_at: new Date().toISOString() }).eq('id', guest.id);

  // Event name + guest-safe branding — used client-side to composite the
  // photographer frame/logo/title onto downloaded/shared photos. Only the
  // display-safe branding keys are surfaced (no secrets live in this jsonb).
  const { data: eventRow } = await db
    .from('events')
    .select('name, branding, gallery_theme')
    .eq('id', payload.event_id)
    .maybeSingle();
  const rawBranding = (eventRow?.branding ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
  const event = {
    name: str(eventRow?.name),
    gallery_theme: str(eventRow?.gallery_theme) ?? 'festive',
    branding: {
      event_title: str(rawBranding.event_title),
      share_caption: str(rawBranding.share_caption),
      logo_key: str(rawBranding.logo_key),
      frame: str(rawBranding.frame) ?? 'crystal',
      primary_color: str(rawBranding.primary_color) ?? '#FF8A75',
      auto_watermark: rawBranding.auto_watermark !== false,
    },
  };

  // General event gallery — no consent needed. Exclude culled photos.
  const { data: photoRows, error: photosErr } = await db
    .from('photos')
    .select('id, storage_key, status')
    .eq('event_id', payload.event_id)
    .neq('status', 'culled')
    .order('created_at', { ascending: false });
  if (photosErr) return c.json({ error: 'photos_lookup_failed' }, 500);

  const photos = (photoRows ?? []).map((p) => ({
    id: p.id,
    storage_key: p.storage_key,
    url: photoUrlStub(c, p.storage_key),
    status: p.status,
  }));

  // CONSENT GATE — the face-matched personal gallery is included only when a
  // biometric_consents row exists for THIS guest. No face_embeddings-derived
  // data is read or returned before that (CLAUDE.md: non-negotiable).
  const { data: consent } = await db
    .from('biometric_consents')
    .select('id, consented_at')
    .eq('guest_id', guest.id)
    .maybeSingle();

  let personal_gallery:
    | { consent_required: true }
    | {
        consent_required: false;
        consented_at: string;
        photos: { id: string; storage_key: string; url: string }[];
      };

  if (!consent) {
    // Pre-consent: signal the frontend to show the consent-gate screen. No face data.
    personal_gallery = { consent_required: true };
  } else {
    // Consented: face-matching is permitted. Return this guest's matched photos,
    // read from the many-to-many guest_photo_matches join table (migration 0008).
    // One row per (guest, photo), so this guest sees exactly the photos its own
    // selfie linked — independent of any other guest that matched the same clusters.
    const { data: matchRows, error: matchErr } = await db
      .from('guest_photo_matches')
      .select('photo_id, match_similarity, photos!inner(storage_key, status)')
      .eq('guest_id', guest.id);
    if (matchErr) console.error('personal gallery query failed', matchErr);

    const matchedMap = new Map<string, { id: string; storage_key: string; url: string; match_similarity: number | null }>();
    for (const row of (matchRows ?? []) as Array<{
      photo_id: string;
      match_similarity: number | null;
      photos: { storage_key: string; status: string } | { storage_key: string; status: string }[] | null;
    }>) {
      const ph = Array.isArray(row.photos) ? row.photos[0] : row.photos;
      if (!ph || ph.status === 'culled') continue; // parity with the general gallery
      matchedMap.set(row.photo_id, {
        id: row.photo_id,
        storage_key: ph.storage_key,
        url: photoUrlStub(c, ph.storage_key),
        match_similarity: row.match_similarity ?? null,
      });
    }
    const matched = Array.from(matchedMap.values());

    personal_gallery = {
      consent_required: false,
      consented_at: consent.consented_at,
      photos: matched,
    };
  }

  return c.json({
    event_id: payload.event_id,
    guest_id: guest.id,
    guest_display_name: guest.display_name,
    event,
    photos,
    personal_gallery,
  });
});

// ---------------------------------------------------------------------------
// Biometric consent.
// POST /consent/:token
//   Body: { guardian_confirmed: true } — REQUIRED. The founder's Stage 2 legal
//   review (informal draft, formal version pending) requires an active
//   guardian/age-confirmation gesture before biometric consent is recorded,
//   folded into the existing consent screen as an additional checkbox rather
//   than a new screen. Enforced here in code, not trusted from the UI alone —
//   same guardrail philosophy as the rest of the consent gate.
//   Verifies the token, then records the guest's biometric consent. Idempotent:
//   a second call for an already-consented guest confirms rather than errors.
//   This is what the (parallel-built) consent-gate screen's "I agree" calls.
//   Response 200: { ok, guest_id, event_id, consented_at, already: boolean }
// ---------------------------------------------------------------------------
app.post('/consent/:token', async (c) => {
  const token = c.req.param('token');
  if (!token) return c.json({ error: 'missing_token' }, 400);

  const body = (await c.req.json().catch(() => ({}))) as { guardian_confirmed?: unknown };
  if (body?.guardian_confirmed !== true) {
    return c.json({ error: 'guardian_confirmation_required' }, 400);
  }

  const db = supa(c.env);
  const resolved = await resolveGuest(db, token, c.env.GUEST_TOKEN_SECRET);
  if (!resolved.ok) {
    return c.json(
      { error: resolved.error },
      resolved.status,
    );
  }
  const { payload, guest } = resolved;

  // Idempotent: unique(guest_id) means a re-consent is a no-op. Check first so a
  // repeat call is a clean confirm, not a 409.
  const { data: existing } = await db
    .from('biometric_consents')
    .select('id, consented_at')
    .eq('guest_id', guest.id)
    .maybeSingle();

  if (existing) {
    return c.json({
      ok: true,
      guest_id: guest.id,
      event_id: payload.event_id,
      consented_at: existing.consented_at,
      already: true,
    });
  }

  // retention_expires_at is set automatically by the DB trigger added in
  // migration 0003 (consented_at + 30 days) — no longer left NULL now that the
  // founder has accepted the risk of proceeding on an informal legal draft.
  const { data: inserted, error: insertErr } = await db
    .from('biometric_consents')
    .insert({ guest_id: guest.id, event_id: payload.event_id, guardian_confirmed: true })
    .select('consented_at')
    .maybeSingle();

  if (insertErr) {
    // Handle the race where a concurrent request inserted first (unique violation).
    const { data: raced } = await db
      .from('biometric_consents')
      .select('consented_at')
      .eq('guest_id', guest.id)
      .maybeSingle();
    if (raced) {
      return c.json({
        ok: true,
        guest_id: guest.id,
        event_id: payload.event_id,
        consented_at: raced.consented_at,
        already: true,
      });
    }
    return c.json({ error: 'consent_write_failed' }, 500);
  }

  return c.json({
    ok: true,
    guest_id: guest.id,
    event_id: payload.event_id,
    consented_at: inserted?.consented_at ?? new Date().toISOString(),
    already: false,
  });
});

// ---------------------------------------------------------------------------
// Guest selfie submission (Stage 2 face-matching).
// POST /guests/:token/selfie
//   Body: raw image bytes (multipart 'file' field). Zero-retention design: the
//   guest's own selfie and its computed embedding are NEVER persisted anywhere
//   — the embedding lives only as a local variable used as the match query,
//   then falls out of scope when the request ends. Only the resulting
//   guest_id<->person_id LINK (an update to EXISTING face_embeddings rows) is
//   persisted.
//   CONSENT GATE — enforced in code, not trusted from the frontend sequence:
//   no face computation happens before a biometric_consents row exists for
//   this guest, same guardrail as the /gallery personal-gallery section.
//   Response 200: { matched: boolean, clusters_linked?: number }
// ---------------------------------------------------------------------------
app.post('/guests/:token/selfie', async (c) => {
  const token = c.req.param('token');
  if (!token) return c.json({ error: 'missing_token' }, 400);

  const db = supa(c.env);
  const resolved = await resolveGuest(db, token, c.env.GUEST_TOKEN_SECRET);
  if (!resolved.ok) {
    return c.json(
      { error: resolved.error },
      resolved.status,
    );
  }
  const { payload, guest } = resolved;

  // CONSENT GATE — see header note. No exceptions.
  const { data: consent } = await db
    .from('biometric_consents')
    .select('id')
    .eq('guest_id', guest.id)
    .maybeSingle();
  if (!consent) return c.json({ error: 'consent_required' }, 403);

  const body = await c.req.parseBody();
  const file = body['file'];
  if (!(file instanceof File)) return c.json({ error: 'missing_file' }, 400);

  let faces: Awaited<ReturnType<typeof embed>>;
  try {
    // Retry across a Cloud Run cold start so a returning guest doesn't get an
    // intermittent "face not recognized" on the first (still-warming) request.
    faces = await embedWithRetry(await file.arrayBuffer(), {
      EMBED_SERVICE_URL: c.env.EMBED_SERVICE_URL,
      EMBED_SERVICE_TOKEN: c.env.EMBED_SERVICE_TOKEN,
    });
  } catch (err) {
    console.error('selfie embed failed', err);
    return c.json({ error: 'embed_service_unavailable' }, 502);
  }
  if (faces.length === 0) return c.json({ error: 'no_face_detected' }, 422);

  // A selfie is expected to contain one person — pick the highest-confidence
  // detection if more than one face is found (simplest defensible MVP heuristic).
  const selfieFace = faces.reduce((best, f) => (f.detection_score > best.detection_score ? f : best));

  const { data: candidates } = await db.rpc('match_faces', {
    p_event_id: payload.event_id,
    p_query_embedding: selfieFace.embedding,
    p_match_limit: Number(c.env.GUEST_MATCH_TOPK ?? '20'),
  });

  const threshold = Number(c.env.GUEST_MATCH_THRESHOLD ?? '0.42');
  const matchedPersonIds = Array.from(
    new Set(
      ((candidates ?? []) as { person_id: string | null; distance: number }[])
        .filter((row) => row.person_id && 1 - row.distance >= threshold)
        .map((row) => row.person_id as string),
    ),
  );

  if (matchedPersonIds.length === 0) {
    return c.json({ matched: false });
  }

  // Build a person_id → best similarity map so we can store it on the link.
  const similarityByPerson = new Map<string, number>();
  for (const row of ((candidates ?? []) as { person_id: string | null; distance: number }[])) {
    if (!row.person_id) continue;
    const sim = Number((1 - row.distance).toFixed(4));
    const prev = similarityByPerson.get(row.person_id) ?? 0;
    if (sim > prev) similarityByPerson.set(row.person_id, sim);
  }

  // Resolve every plausible cluster (mitigates ingestion-time over-splitting) to
  // the actual PHOTOS those clusters appear in, then record a per-(guest, photo)
  // match. This is a MANY-TO-MANY link (migration 0008): many guest sessions can
  // legitimately match the same person cluster — the same person re-scanning the
  // QR, a new device, an incognito window, a lost session, or a look-alike — so
  // the link can NOT live as a single owner column on the shared face index. That
  // let the first guest session "claim" a cluster and every later session silently
  // matched but got 0 photos (the "0 מתוך 17" bug). A join row per (guest, photo)
  // has no such collision: each session gets its own rows.
  const { data: clusterPhotos, error: cpErr } = await db
    .from('face_embeddings')
    .select('photo_id, person_id')
    .eq('event_id', payload.event_id)
    .in('person_id', matchedPersonIds);
  if (cpErr) {
    console.error('cluster→photo resolve failed', cpErr);
    return c.json({ error: 'match_link_failed' }, 500);
  }

  // photo_id → best similarity across all of this guest's matched clusters in it.
  const simByPhoto = new Map<string, number | null>();
  for (const row of ((clusterPhotos ?? []) as { photo_id: string; person_id: string | null }[])) {
    if (!row.person_id) continue;
    const sim = similarityByPerson.get(row.person_id) ?? null;
    const prev = simByPhoto.get(row.photo_id);
    if (prev === undefined || (sim !== null && (prev === null || sim > prev))) {
      simByPhoto.set(row.photo_id, sim);
    }
  }

  const linkRows = Array.from(simByPhoto.entries()).map(([photo_id, sim]) => ({
    guest_id: guest.id,
    event_id: payload.event_id,
    photo_id,
    match_similarity: sim,
  }));

  if (linkRows.length > 0) {
    const { error: upErr } = await db
      .from('guest_photo_matches')
      .upsert(linkRows, { onConflict: 'guest_id,photo_id' });
    if (upErr) {
      console.error('guest_photo_matches upsert failed', upErr);
      return c.json({ error: 'match_link_failed' }, 500);
    }
  }

  return c.json({ matched: linkRows.length > 0, photos_linked: linkRows.length });
});

// ---------------------------------------------------------------------------
// Media streaming.
// GET /media/*
//   Streams a single R2 object by its stored key (the `photos.storage_key`
//   value, e.g. events/<event_id>/orig/<uuid>.jpg — the key contains slashes, so
//   this is a catch-all route and the key is read from the path, NOT c.req.param).
//   Keys are content-addressed/unique per upload, so the response is immutably
//   cacheable. 404s to { error: 'not_found' } when the object is missing.
// ---------------------------------------------------------------------------
app.get('/media/*', async (c) => {
  // Everything after the literal "/media/" prefix is the R2 object key. Using the
  // pathname (not a named param) so embedded slashes are preserved.
  const key = c.req.path.slice('/media/'.length);
  if (!key) return c.json({ error: 'not_found' }, 404);

  const object = await c.env.MEDIA.get(key);
  if (!object) return c.json({ error: 'not_found' }, 404);

  const headers: Record<string, string> = {
    'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
    // Content-addressed keys are unique per upload — safe to cache forever.
    'Cache-Control': 'public, max-age=31536000, immutable',
    // Media is already public (guests view it in the gallery). CORS is opened so
    // the same image can be used as a WebGL texture on the gift-reveal 3D card
    // (cross-origin: the web app and this API are different Worker subdomains,
    // and a WebGL texture from another origin requires an ACAO header).
    'Access-Control-Allow-Origin': '*',
  };
  if (object.httpEtag) headers['etag'] = object.httpEtag;

  return c.body(object.body, 200, headers);
});

// ---------------------------------------------------------------------------
// Photo ingest.
// POST /events/:event_id/photos
//   Photographer-authenticated: requires `Authorization: Bearer <supabase jwt>`
//   and the caller must own the event (see requireEventOwner). Originally an
//   unauthenticated founder-run bulk-ingest endpoint; it is now called from the
//   photographer dashboard in the browser, so real auth is enforced here.
//   Accepts multipart/form-data with a single `file` field. Uploads the bytes to
//   R2 and inserts a `photos` row marked 'ready' (Stage 1 has no processing
//   pipeline yet, so ingested photos are immediately visible).
//   Response 201: { id, event_id, storage_key }
// ---------------------------------------------------------------------------
app.post('/events/:event_id/photos', async (c) => {
  const event_id = c.req.param('event_id');
  if (!event_id) return c.json({ error: 'missing_event_id' }, 400);

  const db = supa(c.env);

  const auth = await requireEventOwner(c, db, event_id);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status);

  const body = await c.req.parseBody();
  const file = body['file'];
  if (!(file instanceof File)) return c.json({ error: 'missing_file' }, 400);

  const id = crypto.randomUUID();
  // Derive a safe extension from the filename, falling back to content-type, then .jpg.
  const nameExt = /\.([a-z0-9]{1,8})$/i.exec(file.name ?? '')?.[1]?.toLowerCase();
  const typeExt = file.type?.split('/')[1]?.toLowerCase();
  const ext = `.${nameExt || typeExt || 'jpg'}`;
  const storage_key = `events/${event_id}/orig/${id}${ext}`;

  await c.env.MEDIA.put(storage_key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || 'image/jpeg' },
  });

  const { error: insertErr } = await db.from('photos').insert({
    id,
    event_id,
    storage_key,
    status: 'ready',
    content_type: file.type || null,
    bytes: file.size ?? null,
  });
  if (insertErr) return c.json({ error: 'photo_create_failed' }, 500);

  // Best-effort enqueue for face-embedding (Stage 2). Never blocks or fails the
  // upload response — `photos.status` stays 'ready' immediately, exactly as
  // before; `embed_status` (default 'pending') is separate, pipeline-only state.
  try {
    await c.env.FACE_EMBED_QUEUE.send({ photo_id: id, event_id, storage_key });
  } catch (err) {
    console.error('enqueue face-embed failed for', id, err);
  }

  return c.json({ id, event_id, storage_key }, 201);
});

// ---------------------------------------------------------------------------
// Photo delete.
// DELETE /events/:event_id/photos/:photo_id
//   Photographer-authenticated: requires `Authorization: Bearer <supabase jwt>`
//   and the caller must own the event (same requireEventOwner gate as ingest,
//   uniform 404 for missing/foreign event). Deletes a single photo.
//
//   The photo is scoped by BOTH id AND event_id, so a photo id belonging to a
//   different event can't be deleted through this route (404 photo_not_found).
//
//   Ordering is deliberate and load-bearing: we delete the DB row FIRST so the
//   gallery immediately stops showing it, THEN best-effort delete the R2 object.
//   A failed R2 delete is non-critical (an orphaned object is a harmless
//   storage-cost leak) and does NOT fail the request; a DB row still visible in
//   a gallery after "delete" WOULD be a correctness bug, hence DB-first. If the
//   DB delete itself fails we return 500 and never touch R2.
//   Response 200: { id, event_id }
// ---------------------------------------------------------------------------
app.delete('/events/:event_id/photos/:photo_id', async (c) => {
  const event_id = c.req.param('event_id');
  const photo_id = c.req.param('photo_id');
  if (!event_id) return c.json({ error: 'missing_event_id' }, 400);
  if (!photo_id) return c.json({ error: 'missing_photo_id' }, 400);

  const db = supa(c.env);

  const auth = await requireEventOwner(c, db, event_id);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status);

  // Scope the lookup by BOTH id and event_id — a photo id from another event
  // must not be deletable through this event's route.
  const { data: photo, error: lookupErr } = await db
    .from('photos')
    .select('id, storage_key')
    .eq('id', photo_id)
    .eq('event_id', event_id)
    .maybeSingle();
  if (lookupErr) return c.json({ error: 'photo_delete_failed' }, 500);
  if (!photo) return c.json({ error: 'photo_not_found' }, 404);

  // DB row FIRST (see header note). Scoped by both columns again so we only ever
  // delete the row we just authorized.
  const { error: deleteErr } = await db
    .from('photos')
    .delete()
    .eq('id', photo_id)
    .eq('event_id', event_id);
  if (deleteErr) return c.json({ error: 'photo_delete_failed' }, 500);

  // R2 cleanup is best-effort: an orphaned object is a harmless storage-cost
  // leak, not a correctness bug, so a failure here must NOT fail the request.
  try {
    await c.env.MEDIA.delete(photo.storage_key);
  } catch (err) {
    console.error('R2 delete failed for', photo.storage_key, err);
  }

  return c.json({ id: photo_id, event_id });
});

// ---------------------------------------------------------------------------
// Studio logo upload (branding settings).
// POST /events/:event_id/branding/logo
//   Photographer-authenticated: same `Authorization: Bearer <supabase jwt>` +
//   event-ownership gate as photo ingest (uniform 404 for missing/foreign event).
//   Accepts multipart/form-data with a single `file` field (an image). The bytes
//   land in R2 — NEVER Supabase storage (CLAUDE.md hard guardrail) — under a
//   fresh, content-addressed key per upload (a random id, same as photo ingest),
//   NOT a fixed per-event filename. The shared `/media/*` route below serves
//   every key with a one-year `immutable` Cache-Control, which is only safe for
//   keys that never change contents — a fixed `.../logo.png` key would mean a
//   re-uploaded logo keeps the exact same URL, so the browser (and any CDN edge
//   cache) would keep serving the byte-for-byte OLD image for up to a year after
//   a "successful" re-upload, which looked from the UI like the upload silently
//   did nothing. Old logo object is best-effort deleted from R2 after the DB
//   write succeeds (mirrors the delete-photo cleanup below), since a studio only
//   ever has one current logo.
//   Response 200: { logo_key, url }
// ---------------------------------------------------------------------------
app.post('/events/:event_id/branding/logo', async (c) => {
  const event_id = c.req.param('event_id');
  if (!event_id) return c.json({ error: 'missing_event_id' }, 400);

  const db = supa(c.env);

  const auth = await requireEventOwner(c, db, event_id);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status);

  const body = await c.req.parseBody();
  const file = body['file'];
  if (!(file instanceof File)) return c.json({ error: 'missing_file' }, 400);

  // Derive a safe extension from the filename, falling back to content-type, then
  // .png (logos are typically PNG). Mirrors the photo-ingest extension logic.
  const nameExt = /\.([a-z0-9]{1,8})$/i.exec(file.name ?? '')?.[1]?.toLowerCase();
  const typeExt = file.type?.split('/')[1]?.toLowerCase();
  const ext = `.${nameExt || typeExt || 'png'}`;
  // Unique per upload — see the route comment above for why a fixed filename breaks caching.
  const storage_key = `events/${event_id}/branding/logo-${crypto.randomUUID()}${ext}`;

  await c.env.MEDIA.put(storage_key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || 'image/png' },
  });

  // Merge logo_key into the existing branding jsonb without clobbering sibling
  // keys (read-modify-write, since Postgres jsonb has no partial patch here).
  const { data: current, error: readErr } = await db
    .from('events')
    .select('branding')
    .eq('id', event_id)
    .maybeSingle();
  if (readErr) return c.json({ error: 'lookup_failed' }, 500);

  const existingBranding =
    current?.branding && typeof current.branding === 'object' && !Array.isArray(current.branding)
      ? (current.branding as Record<string, unknown>)
      : {};
  const previousLogoKey =
    typeof existingBranding.logo_key === 'string' ? existingBranding.logo_key : undefined;
  const branding = { ...existingBranding, logo_key: storage_key };

  const { error: updateErr } = await db.from('events').update({ branding }).eq('id', event_id);
  if (updateErr) return c.json({ error: 'branding_update_failed' }, 500);

  if (previousLogoKey && previousLogoKey !== storage_key) {
    try {
      await c.env.MEDIA.delete(previousLogoKey);
    } catch (err) {
      console.error('R2 delete failed for', previousLogoKey, err);
    }
  }

  return c.json({ logo_key: storage_key, url: photoUrlStub(c, storage_key) });
});

// ---------------------------------------------------------------------------
// Event code resolution.
// GET /events/by-code/:code
//   Resolves a short human-shareable event code (e.g. WED-2024) to the internal
//   event UUID. Used by manual-entry / QR-deeplink guest entry. Contract with the
//   frontend is EXACTLY { event_id } — nothing more.
//   Response 200: { event_id } | 404 { error: 'event_not_found' }
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Backfill: re-enqueues photos whose embed_status isn't 'done' yet.
// POST /admin/backfill-embeddings  body: { event_id?: string }
//   Exists because the enqueue-on-upload (above) only fires for photos
//   ingested after Stage 2 shipped — photos inserted earlier (e.g. the
//   hand-seeded WED-2024 demo set) never passed through it and are stuck at
//   the default 'pending' forever with zero face_embeddings rows. Gated by a
//   dedicated bearer secret rather than requireEventOwner: this is an
//   operator action, not something the photographer dashboard exposes.
// ---------------------------------------------------------------------------
app.post('/admin/backfill-embeddings', async (c) => {
  const authHeader = c.req.header('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!c.env.ADMIN_BACKFILL_TOKEN || token !== c.env.ADMIN_BACKFILL_TOKEN) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  const db = supa(c.env);
  const body = await c.req.json().catch(() => ({}) as Record<string, unknown>);
  const event_id = typeof body.event_id === 'string' ? body.event_id : undefined;
  // force=true re-embeds photos even if embed_status is already 'done' — needed
  // when the shared photo index was wiped (e.g. by the retention cron) but the
  // photos still read 'done'. The normal path only picks up non-'done' photos.
  const force = body.force === true;

  let query = db.from('photos').select('id,event_id,storage_key');
  if (!force) query = query.neq('embed_status', 'done');
  if (event_id) query = query.eq('event_id', event_id);
  const { data: photos, error } = await query;
  if (error) return c.json({ error: 'query_failed' }, 500);

  // On a force re-embed, delete any existing face rows for these photos FIRST —
  // the queue consumer inserts (not upserts), so without this we'd duplicate
  // every already-embedded face.
  //
  // The delete goes through admin_clear_faces_for_photos() (migration 0005): the
  // DB-level BEFORE DELETE guard rejects any face_embeddings delete while the
  // photo still exists UNLESS this RPC's transaction-local opt-in flag is set —
  // that guard is what makes the retention-cron index-wipe bug impossible to
  // repeat. A plain `.delete()` here is the exact shape the guard blocks.
  // Fallback to the direct delete only when the RPC is absent (i.e. migration
  // 0005 not applied yet), so this deploy is safe to ship ahead of the migration
  // and self-heals once it lands.
  let cleared = 0;
  if (force) {
    const photoIds = (photos ?? []).map((p) => p.id);
    if (photoIds.length) {
      const { data: clearedCount, error: rpcErr } = await db.rpc(
        'admin_clear_faces_for_photos',
        { p_photo_ids: photoIds },
      );
      if (rpcErr) {
        // 42883 = function does not exist (migration 0005 not applied yet).
        if (rpcErr.code === 'PGRST202' || /does not exist|find the function/i.test(rpcErr.message ?? '')) {
          const { error: delErr, count } = await db
            .from('face_embeddings')
            .delete({ count: 'exact' })
            .in('photo_id', photoIds);
          if (delErr) return c.json({ error: 'clear_failed' }, 500);
          cleared = count ?? 0;
        } else {
          return c.json({ error: 'clear_failed' }, 500);
        }
      } else {
        cleared = typeof clearedCount === 'number' ? clearedCount : 0;
      }
    }
  }

  let enqueued = 0;
  for (const photo of photos ?? []) {
    try {
      await c.env.FACE_EMBED_QUEUE.send({
        photo_id: photo.id,
        event_id: photo.event_id,
        storage_key: photo.storage_key,
      });
      enqueued++;
    } catch (err) {
      console.error('backfill enqueue failed for', photo.id, err);
    }
  }

  return c.json({ enqueued, total_candidates: photos?.length ?? 0, cleared, force });
});

// ---------------------------------------------------------------------------
// GET /admin/embed-status?event_id=...   (same operator bearer secret)
//   Read-only diagnostic: for an event, how many photos exist, their
//   embed_status breakdown, how many face_embeddings rows exist, and how many
//   distinct person clusters. This is what tells you WHY guest matching fails
//   (zero embeddings / all 'done' with no rows = index was wiped) without
//   needing direct DB access.
// ---------------------------------------------------------------------------
app.get('/admin/embed-status', async (c) => {
  const authHeader = c.req.header('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!c.env.ADMIN_BACKFILL_TOKEN || token !== c.env.ADMIN_BACKFILL_TOKEN) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const event_id = c.req.query('event_id');
  if (!event_id) return c.json({ error: 'event_id_required' }, 400);

  const db = supa(c.env);
  const { data: photos, error: pErr } = await db
    .from('photos')
    .select('id,embed_status')
    .eq('event_id', event_id);
  if (pErr) return c.json({ error: 'photos_query_failed' }, 500);

  const { data: faces, error: fErr } = await db
    .from('face_embeddings')
    .select('person_id')
    .eq('event_id', event_id);
  if (fErr) return c.json({ error: 'faces_query_failed' }, 500);

  const statusBreakdown: Record<string, number> = {};
  for (const p of photos ?? []) {
    const s = (p.embed_status as string) ?? 'null';
    statusBreakdown[s] = (statusBreakdown[s] ?? 0) + 1;
  }
  const clusters = new Set((faces ?? []).map((f) => f.person_id).filter(Boolean));

  return c.json({
    event_id,
    photos: photos?.length ?? 0,
    embed_status: statusBreakdown,
    face_embeddings: faces?.length ?? 0,
    distinct_clusters: clusters.size,
  });
});

// ---------------------------------------------------------------------------
// GET /admin/match-test?event_id=...[&photo_id=...]   (operator bearer secret)
//   Re-embeds one of the event's OWN photos and runs it through match_faces,
//   returning the nearest stored faces + distances. Diagnoses guest-match
//   failure without needing a guest selfie:
//     - a photo re-embedded should find its OWN stored face at distance ~0.
//       If the smallest distance is large, the embed service is returning
//       vectors inconsistent with what's stored (model drift / normalization)
//       — that breaks matching AND explains cluster over-splitting.
//     - if self-distance is ~0 but same-person faces sit above the guest
//       threshold, the fix is the threshold, not the pipeline.
// ---------------------------------------------------------------------------
app.get('/admin/match-test', async (c) => {
  const authHeader = c.req.header('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!c.env.ADMIN_BACKFILL_TOKEN || token !== c.env.ADMIN_BACKFILL_TOKEN) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const event_id = c.req.query('event_id');
  if (!event_id) return c.json({ error: 'event_id_required' }, 400);
  const wantPhoto = c.req.query('photo_id');

  const db = supa(c.env);
  let pQuery = db.from('photos').select('id,storage_key').eq('event_id', event_id).eq('embed_status', 'done').limit(1);
  if (wantPhoto) pQuery = db.from('photos').select('id,storage_key').eq('id', wantPhoto).limit(1);
  const { data: photos, error: pErr } = await pQuery;
  if (pErr) return c.json({ error: 'photos_query_failed' }, 500);
  const photo = photos?.[0];
  if (!photo) return c.json({ error: 'no_done_photo' }, 404);

  const object = await c.env.MEDIA.get(photo.storage_key);
  if (!object) return c.json({ error: 'r2_object_missing', storage_key: photo.storage_key }, 404);

  let faces: Awaited<ReturnType<typeof embed>>;
  try {
    faces = await embed(await object.arrayBuffer(), {
      EMBED_SERVICE_URL: c.env.EMBED_SERVICE_URL,
      EMBED_SERVICE_TOKEN: c.env.EMBED_SERVICE_TOKEN,
    });
  } catch (err) {
    return c.json({ error: 'embed_failed', detail: String(err) }, 502);
  }

  const guestThreshold = Number(c.env.GUEST_MATCH_THRESHOLD ?? '0.35');
  const results = [];
  for (const face of faces) {
    const { data: rows } = await db.rpc('match_faces', {
      p_event_id: event_id,
      p_query_embedding: face.embedding,
      p_match_limit: 5,
    });
    const nn = ((rows ?? []) as { id: string; person_id: string | null; distance: number }[]).map((r) => ({
      distance: Number(r.distance.toFixed(4)),
      similarity: Number((1 - r.distance).toFixed(4)),
      would_match: 1 - r.distance >= guestThreshold,
    }));
    results.push({ detection_score: Number(face.detection_score.toFixed(3)), nearest: nn });
  }

  return c.json({
    photo_id: photo.id,
    faces_detected_now: faces.length,
    guest_threshold: guestThreshold,
    embed_service_ok: true,
    results,
  });
});

// ---------------------------------------------------------------------------
// POST /admin/selfie-test?event_id=...   (operator bearer secret)
//   Body: raw image bytes (multipart 'file' field). Runs an UPLOADED selfie
//   through the exact same embed -> match_faces path the guest /selfie route
//   uses, and returns the real per-face nearest distances/similarities against
//   the event's stored photo index — WITHOUT persisting anything or writing any
//   guest link (pure diagnostic, zero-retention like the guest route).
//   This is what lets us read a real selfie's true match distances to decide
//   between "tune the threshold" and "the selfie face isn't detected / doesn't
//   match" — the exact gap that blocked the WED-2024 investigation.
// ---------------------------------------------------------------------------
app.post('/admin/selfie-test', async (c) => {
  const authHeader = c.req.header('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!c.env.ADMIN_BACKFILL_TOKEN || token !== c.env.ADMIN_BACKFILL_TOKEN) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const event_id = c.req.query('event_id');
  if (!event_id) return c.json({ error: 'event_id_required' }, 400);

  const body = await c.req.parseBody();
  const file = body['file'];
  if (!(file instanceof File)) return c.json({ error: 'missing_file' }, 400);

  let faces: Awaited<ReturnType<typeof embed>>;
  try {
    faces = await embed(await file.arrayBuffer(), {
      EMBED_SERVICE_URL: c.env.EMBED_SERVICE_URL,
      EMBED_SERVICE_TOKEN: c.env.EMBED_SERVICE_TOKEN,
    });
  } catch (err) {
    return c.json({ error: 'embed_failed', detail: String(err) }, 502);
  }

  const guestThreshold = Number(c.env.GUEST_MATCH_THRESHOLD ?? '0.35');
  if (faces.length === 0) {
    // Mirrors the guest route's 422 no_face_detected — the selfie's face was
    // not detected at all (e.g. a sideways/EXIF-unrotated image), so there is
    // nothing to match and no threshold change could ever help.
    return c.json({
      event_id,
      faces_detected: 0,
      guest_threshold: guestThreshold,
      embed_service_ok: true,
      would_match: false,
      note: 'no_face_detected',
    });
  }

  // Same selection the guest route makes: the single highest-confidence face.
  const primary = faces.reduce((best, f) => (f.detection_score > best.detection_score ? f : best));
  const { data: rows } = await db_match(c, event_id, primary.embedding);
  const nearest = ((rows ?? []) as { person_id: string | null; distance: number }[]).map((r) => ({
    distance: Number(r.distance.toFixed(4)),
    similarity: Number((1 - r.distance).toFixed(4)),
    would_match: 1 - r.distance >= guestThreshold,
    person_id: r.person_id,
  }));
  const best = nearest[0]?.similarity ?? null;

  return c.json({
    event_id,
    faces_detected: faces.length,
    primary_detection_score: Number(primary.detection_score.toFixed(3)),
    guest_threshold: guestThreshold,
    embed_service_ok: true,
    best_similarity: best,
    would_match: nearest.some((n) => n.would_match),
    nearest,
  });
});

// Small helper so selfie-test reads the same match_faces RPC the guest/selfie
// and match-test routes use, with the shared top-k.
async function db_match(c: Context<{ Bindings: Env }>, event_id: string, embedding: number[]) {
  const db = supa(c.env);
  return db.rpc('match_faces', {
    p_event_id: event_id,
    p_query_embedding: embedding,
    p_match_limit: Number(c.env.GUEST_MATCH_TOPK ?? '20'),
  });
}

// ---------------------------------------------------------------------------
// GET /admin/processing-status
//   Photographer-auth (Supabase access token). Returns real embed_status
//   breakdown across ALL of this photographer's events, used by the
//   /admin/ai-optimization screen to show a live processing queue.
// ---------------------------------------------------------------------------
app.get('/admin/processing-status', async (c) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : undefined;
  if (!token) return c.json({ error: 'missing_auth' }, 401);

  const db = supa(c.env);
  const { data: authData, error: authErr } = await db.auth.getUser(token);
  if (authErr || !authData?.user) return c.json({ error: 'invalid_auth' }, 401);

  const user_id = authData.user.id;

  // All events owned by this photographer.
  const { data: events, error: evErr } = await db
    .from('events')
    .select('id, name')
    .eq('photographer_id', user_id);
  if (evErr) return c.json({ error: 'events_query_failed' }, 500);
  if (!events?.length) return c.json({ stats: { total: 0, done: 0, processing: 0, pending: 0, failed: 0 }, recent: [], face_embeddings: 0 });

  const event_ids = events.map((e) => e.id);
  const eventNameMap: Record<string, string> = Object.fromEntries(events.map((e) => [e.id, e.name]));

  const { data: photos, error: pErr } = await db
    .from('photos')
    .select('id, event_id, embed_status, created_at')
    .in('event_id', event_ids)
    .order('created_at', { ascending: false })
    .limit(200);
  if (pErr) return c.json({ error: 'photos_query_failed' }, 500);

  const stats = { total: 0, done: 0, processing: 0, pending: 0, failed: 0 };
  for (const p of photos ?? []) {
    stats.total++;
    const s = (p.embed_status as string) ?? 'pending';
    if (s === 'done') stats.done++;
    else if (s === 'processing') stats.processing++;
    else if (s === 'failed') stats.failed++;
    else stats.pending++;
  }

  const { data: faces } = await db
    .from('face_embeddings')
    .select('id', { count: 'exact', head: true })
    .in('event_id', event_ids);

  const recent = (photos ?? []).slice(0, 20).map((p) => ({
    photo_id: p.id,
    event_name: eventNameMap[p.event_id] ?? '',
    status: (p.embed_status as string) ?? 'pending',
    created_at: p.created_at,
  }));

  return c.json({ stats, recent, face_embeddings: (faces as unknown as { count?: number } | null)?.count ?? 0 });
});

// POST /auth/forgot-password
//   Public endpoint. Takes { email } body, generates a Supabase recovery link
//   server-side (no email sent by Supabase), then sends it via Resend's direct
//   API — bypassing Supabase's unreliable shared SMTP entirely.
//   Always returns 200 with the same body regardless of whether the email
//   exists, to avoid leaking account existence (same pattern as requireEventOwner).
app.post('/auth/forgot-password', async (c) => {
  let email = '';
  try {
    const body = await c.req.json<{ email?: string }>();
    email = (body?.email ?? '').trim().toLowerCase();
  } catch {
    return c.json({ ok: true }); // malformed body — silent
  }

  if (!email) return c.json({ ok: true });

  const db = supa(c.env);

  // Generate a recovery link without sending email. Admin-only Supabase method.
  const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: {
      redirectTo: 'https://oura-web.oura-events.workers.dev/reset-password',
    },
  });

  // If the email doesn't exist in Supabase, generateLink returns an error.
  // Silently return ok so the caller can't enumerate accounts.
  if (linkErr || !linkData?.properties?.action_link) {
    return c.json({ ok: true });
  }

  const resetLink = linkData.properties.action_link;

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: c.env.FROM_EMAIL ?? 'Oura <onboarding@resend.dev>',
      to: [email],
      subject: 'איפוס סיסמה - Oura',
      html: `
        <div dir="rtl" style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0a0a0a;color:#f5f5f5;border-radius:16px;">
          <h1 style="font-size:24px;font-weight:700;margin-bottom:8px;">Oura</h1>
          <h2 style="font-size:18px;font-weight:600;margin-bottom:16px;color:#ff8a75;">איפוס סיסמה</h2>
          <p style="color:#aaa;line-height:1.6;margin-bottom:24px;">
            קיבלנו בקשה לאיפוס הסיסמה של חשבונך. לחצו על הכפתור למטה כדי לבחור סיסמה חדשה.
          </p>
          <a href="${resetLink}" style="display:inline-block;background:#ff8a75;color:#fff;font-weight:700;padding:14px 32px;border-radius:12px;text-decoration:none;font-size:16px;">
            איפוס סיסמה
          </a>
          <p style="color:#666;font-size:12px;margin-top:24px;">
            הקישור תקף ל-24 שעות. אם לא ביקשתם לאפס את הסיסמה, ניתן להתעלם מהודעה זו.
          </p>
        </div>
      `,
    }),
  });

  if (!resendRes.ok) {
    const resendErr = await resendRes.json().catch(() => ({ status: resendRes.status }));
    console.error('Resend error:', JSON.stringify(resendErr));
    return c.json({ ok: false, resend_error: resendErr }, 500);
  }

  return c.json({ ok: true });
});

app.get('/events/by-code/:code', async (c) => {
  const code = c.req.param('code');
  if (!code) return c.json({ error: 'event_not_found' }, 404);

  const db = supa(c.env);
  const { data: event, error } = await db
    .from('events')
    .select('id')
    .eq('code', code)
    .maybeSingle();
  if (error) return c.json({ error: 'lookup_failed' }, 500);
  if (!event) return c.json({ error: 'event_not_found' }, 404);

  return c.json({ event_id: event.id });
});

app.get('/', (c) => c.text('oura-api'));

// Cloudflare Queues (queue) and Cron Triggers (scheduled) require handlers on
// the same default export as fetch — a bare Hono app (`export default app`)
// only implements fetch, so this must be an explicit ExportedHandler object.
export default {
  fetch: app.fetch,
  queue: (batch: MessageBatch<PhotoEmbedMessage>, env: Env) => handleQueue(batch, env, supa),
  scheduled: (event: ScheduledController, env: Env) => {
    // Two crons share this handler; dispatch on which one fired.
    // "0 3 * * *"  → daily biometric-retention cleanup.
    // "*/5 * * * *" → keep the embed service warm so guest selfies never hit a
    //                 cold start (SUMMARY.md 2026-07-14). Fire-and-forget.
    if (event.cron === '0 3 * * *') {
      return handleScheduled(event, env, supa);
    }
    return keepEmbedWarm(env);
  },
} satisfies ExportedHandler<Env, PhotoEmbedMessage>;
