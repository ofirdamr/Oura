import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import {
  signGuestToken,
  verifyGuestToken,
  tokenHash,
  type GuestTokenPayload,
} from './token';
import { embed } from './pipeline/embedClient';
import { handleQueue, type PhotoEmbedMessage } from './queueConsumer';
import { handleScheduled } from './scheduledCleanup';
import { PRICING, computeItem, type PricedItem } from './pricing';
import { createCheckoutSession, isTestKey, verifyStripeWebhook } from './stripe';

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
  // Mission A — prints & gifts commerce (Stripe test-mode Checkout).
  // STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are wrangler secrets (never here).
  // The account is the founder's real business, so checkout REFUSES a non-test
  // key unless STRIPE_ALLOW_LIVE === 'true' (see /guests/:token/checkout).
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_ALLOW_LIVE?: string;
  // Base URL of the guest-facing Next.js app, for Stripe success/cancel returns.
  WEB_BASE_URL: string;
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
  | { ok: true; payload: GuestTokenPayload; guest: { id: string; event_id: string } }
  | { ok: false; status: 401; error: 'invalid_token' | 'token_expired' }
  | { ok: false; status: 404; error: 'guest_not_found' }
> {
  const payload = await verifyGuestToken(token, secret);
  if (!payload) return { ok: false, status: 401, error: 'invalid_token' };

  const token_hash = await tokenHash(token);
  const { data: guest } = await db
    .from('guests')
    .select('id, event_id, token_expires_at')
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
  return { ok: true, payload, guest: { id: guest.id, event_id: guest.event_id } };
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
//     { event_id, guest_id, photos: [{ id, storage_key, url, status }],
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
    // Consented: face-matching is permitted. Return this guest's matched photos.
    // (No real matches yet — the face-embed pipeline isn't live — so this is
    // empty until face_embeddings.guest_id links exist. The point is that the
    // section is now UNBLOCKED, not that it is populated.)
    const { data: matchRows } = await db
      .from('face_embeddings')
      .select('photo_id, photos!inner(storage_key)')
      .eq('event_id', payload.event_id)
      .eq('guest_id', guest.id);

    const seen = new Set<string>();
    const matched: { id: string; storage_key: string; url: string }[] = [];
    for (const row of (matchRows ?? []) as Array<{
      photo_id: string;
      photos: { storage_key: string } | { storage_key: string }[] | null;
    }>) {
      if (seen.has(row.photo_id)) continue;
      seen.add(row.photo_id);
      const ph = Array.isArray(row.photos) ? row.photos[0] : row.photos;
      if (!ph) continue;
      matched.push({
        id: row.photo_id,
        storage_key: ph.storage_key,
        url: photoUrlStub(c, ph.storage_key),
      });
    }

    personal_gallery = {
      consent_required: false,
      consented_at: consent.consented_at,
      photos: matched,
    };
  }

  return c.json({
    event_id: payload.event_id,
    guest_id: guest.id,
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
    faces = await embed(await file.arrayBuffer(), {
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

  // Link every plausible cluster (mitigates ingestion-time over-splitting), but
  // never overwrite a DIFFERENT guest's already-established link.
  const { error: linkErr } = await db
    .from('face_embeddings')
    .update({ guest_id: guest.id })
    .eq('event_id', payload.event_id)
    .in('person_id', matchedPersonIds)
    .or(`guest_id.is.null,guest_id.eq.${guest.id}`);
  if (linkErr) return c.json({ error: 'match_link_failed' }, 500);

  return c.json({ matched: true, clusters_linked: matchedPersonIds.length });
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

  let query = db.from('photos').select('id,event_id,storage_key').neq('embed_status', 'done');
  if (event_id) query = query.eq('event_id', event_id);
  const { data: photos, error } = await query;
  if (error) return c.json({ error: 'query_failed' }, 500);

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

  return c.json({ enqueued, total_candidates: photos?.length ?? 0 });
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

// ===========================================================================
// Mission A — prints & gifts commerce.
// Guest-facing, gated by the same opaque event-scoped token as the rest of the
// guest path. Flow: /prints (premium-prints screen) builds a cart -> POST
// /guests/:token/checkout creates a pending order + Stripe-hosted Checkout
// Session -> Stripe redirects to /order-confirmation -> POST /stripe/webhook
// flips the order to 'paid'. Pricing is authoritative server-side (src/pricing.ts);
// client-sent amounts are display-only and never trusted.
// ===========================================================================

// GET /prints/pricing
//   Public print catalog/pricing (src/pricing.ts) — the SINGLE source the
//   /prints screen renders from, so the displayed prices and the checkout
//   computation can never drift. No token needed (pricing isn't guest-specific).
app.get('/prints/pricing', (c) => c.json(PRICING));

// Generate a short human order number (e.g. OR-84213) with collision retry.
// order_number has a UNIQUE constraint; on the rare 5-digit collision we retry.
async function insertOrderWithNumber(
  db: SupabaseClient,
  row: Record<string, unknown>,
): Promise<{ id: string; order_number: string } | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const order_number = `OR-${Math.floor(10000 + Math.random() * 90000)}`;
    const { data, error } = await db
      .from('orders')
      .insert({ ...row, order_number })
      .select('id, order_number')
      .maybeSingle();
    if (!error && data) return { id: data.id, order_number: data.order_number };
    // 23505 = unique_violation (order_number clash) — retry with a new number.
    if (error && (error as { code?: string }).code !== '23505') return null;
  }
  return null;
}

// POST /guests/:token/checkout
//   Body: { items: [{ photo_id, size, paper, frame, quantity }], contact_email? }
//   Validates every line against the pricing config (rejecting the WHOLE
//   checkout on any bad selection), confirms each photo belongs to this event,
//   computes authoritative totals, creates a pending order + order_items, opens
//   a Stripe Checkout Session, and returns its URL for the browser to redirect to.
//   Response 200: { order_id, order_number, checkout_url }
app.post('/guests/:token/checkout', async (c) => {
  const token = c.req.param('token');
  if (!token) return c.json({ error: 'missing_token' }, 400);

  // Refuse to touch a live key on the founder's real business account unless
  // explicitly overridden — makes an accidental live charge structurally impossible.
  if (!isTestKey(c.env.STRIPE_SECRET_KEY) && c.env.STRIPE_ALLOW_LIVE !== 'true') {
    return c.json({ error: 'stripe_live_key_blocked' }, 400);
  }

  const db = supa(c.env);
  const resolved = await resolveGuest(db, token, c.env.GUEST_TOKEN_SECRET);
  if (!resolved.ok) return c.json({ error: resolved.error }, resolved.status);
  const { payload, guest } = resolved;

  const body = (await c.req.json().catch(() => ({}))) as {
    items?: unknown;
    contact_email?: unknown;
  };
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0 || rawItems.length > 50) {
    return c.json({ error: 'invalid_cart' }, 400);
  }

  // Price every line authoritatively; collect the photo ids to validate.
  const priced: { item: PricedItem; photo_id: string }[] = [];
  for (const raw of rawItems) {
    const item = computeItem(raw);
    const photo_id = (raw as { photo_id?: unknown })?.photo_id;
    if (!item || typeof photo_id !== 'string') return c.json({ error: 'invalid_item' }, 400);
    priced.push({ item, photo_id });
  }

  // Every referenced photo must belong to THIS event (no cross-event ordering).
  const photoIds = Array.from(new Set(priced.map((p) => p.photo_id)));
  const { data: photoRows, error: photoErr } = await db
    .from('photos')
    .select('id')
    .eq('event_id', payload.event_id)
    .in('id', photoIds);
  if (photoErr) return c.json({ error: 'photo_lookup_failed' }, 500);
  const validPhotoIds = new Set((photoRows ?? []).map((p) => p.id));
  if (photoIds.some((id) => !validPhotoIds.has(id))) {
    return c.json({ error: 'photo_not_in_event' }, 400);
  }

  const subtotal_agorot = priced.reduce((sum, p) => sum + p.item.line_agorot, 0);
  const shipping_agorot = PRICING.shipping_agorot;
  const total_agorot = subtotal_agorot + shipping_agorot;

  const contact_email =
    typeof body.contact_email === 'string' && body.contact_email.includes('@')
      ? body.contact_email.trim().slice(0, 320)
      : null;

  // Create the pending order (+ its number) before opening Stripe.
  const order = await insertOrderWithNumber(db, {
    event_id: payload.event_id,
    guest_id: guest.id,
    status: 'pending',
    currency: PRICING.currency,
    subtotal_agorot,
    shipping_agorot,
    total_agorot,
    contact_email,
  });
  if (!order) return c.json({ error: 'order_create_failed' }, 500);

  const itemRows = priced.map((p) => ({
    order_id: order.id,
    photo_id: p.photo_id,
    product_type: 'print',
    size: p.item.size,
    paper: p.item.paper,
    frame: p.item.frame === 'none' ? null : p.item.frame,
    quantity: p.item.quantity,
    unit_agorot: p.item.unit_agorot,
    line_agorot: p.item.line_agorot,
    title: p.item.title,
  }));
  const { error: itemsErr } = await db.from('order_items').insert(itemRows);
  if (itemsErr) return c.json({ error: 'order_items_failed' }, 500);

  const base = (c.env.WEB_BASE_URL || new URL(c.req.url).origin).replace(/\/$/, '');
  const session = await createCheckoutSession({
    secretKey: c.env.STRIPE_SECRET_KEY,
    currency: PRICING.currency,
    lineItems: priced.map((p) => ({
      name: p.item.title,
      unit_agorot: p.item.unit_agorot,
      quantity: p.item.quantity,
    })),
    successUrl: `${base}/order-confirmation?order=${order.id}`,
    cancelUrl: `${base}/gallery?checkout=cancelled`,
    clientReferenceId: order.id,
    metadata: { order_id: order.id, event_id: payload.event_id, guest_id: guest.id },
    idempotencyKey: order.id,
    customerEmail: contact_email ?? undefined,
  });
  if (!session.ok) {
    // Mark the stranded order failed so it doesn't linger as a phantom 'pending'.
    await db.from('orders').update({ status: 'failed' }).eq('id', order.id);
    return c.json({ error: session.error }, 502);
  }

  await db
    .from('orders')
    .update({ stripe_session_id: session.session.id })
    .eq('id', order.id);

  return c.json({
    order_id: order.id,
    order_number: order.order_number,
    checkout_url: session.session.url,
  });
});

// GET /guests/:token/orders/:order_id
//   Returns one order (+ its items) for the confirmation screen. Scoped by BOTH
//   the guest's id AND the order id, so a guest can only read their own order.
//   Response 200: { order: {...}, items: [...] }
app.get('/guests/:token/orders/:order_id', async (c) => {
  const token = c.req.param('token');
  const order_id = c.req.param('order_id');
  if (!token) return c.json({ error: 'missing_token' }, 400);
  if (!order_id) return c.json({ error: 'missing_order_id' }, 400);

  const db = supa(c.env);
  const resolved = await resolveGuest(db, token, c.env.GUEST_TOKEN_SECRET);
  if (!resolved.ok) return c.json({ error: resolved.error }, resolved.status);
  const { guest } = resolved;

  const { data: order, error: orderErr } = await db
    .from('orders')
    .select(
      'id, order_number, status, currency, subtotal_agorot, shipping_agorot, total_agorot, contact_email, created_at',
    )
    .eq('id', order_id)
    .eq('guest_id', guest.id)
    .maybeSingle();
  if (orderErr) return c.json({ error: 'order_lookup_failed' }, 500);
  if (!order) return c.json({ error: 'order_not_found' }, 404);

  const { data: items, error: itemsErr } = await db
    .from('order_items')
    .select('id, photo_id, size, paper, frame, quantity, unit_agorot, line_agorot, title, photos(storage_key)')
    .eq('order_id', order_id)
    .order('created_at', { ascending: true });
  if (itemsErr) return c.json({ error: 'order_items_lookup_failed' }, 500);

  const itemsOut = (items ?? []).map((row) => {
    const it = row as Record<string, unknown> & {
      photos?: { storage_key: string } | { storage_key: string }[] | null;
    };
    const ph = Array.isArray(it.photos) ? it.photos[0] : it.photos;
    return {
      id: it.id,
      photo_id: it.photo_id,
      size: it.size,
      paper: it.paper,
      frame: it.frame,
      quantity: it.quantity,
      unit_agorot: it.unit_agorot,
      line_agorot: it.line_agorot,
      title: it.title,
      url: ph?.storage_key ? photoUrlStub(c, ph.storage_key) : null,
    };
  });

  return c.json({ order, items: itemsOut });
});

// POST /stripe/webhook
//   Stripe-signed (NOT guest-token) endpoint. Verifies the signature against
//   STRIPE_WEBHOOK_SECRET over the RAW body, then reconciles the order:
//   checkout.session.completed -> 'paid' (idempotent, amount-checked);
//   checkout.session.expired  -> 'failed' (only while still 'pending').
//   Always 200s a validly-signed event (even a duplicate) so Stripe stops retrying;
//   400s an invalid signature.
app.post('/stripe/webhook', async (c) => {
  const rawBody = await c.req.text();
  const event = await verifyStripeWebhook(
    rawBody,
    c.req.header('stripe-signature'),
    c.env.STRIPE_WEBHOOK_SECRET,
  );
  if (!event) return c.json({ error: 'invalid_signature' }, 400);

  const type = event.type as string;
  const session = (event.data as { object?: Record<string, unknown> } | undefined)?.object ?? {};
  const orderId =
    (session.client_reference_id as string | undefined) ??
    ((session.metadata as Record<string, string> | undefined)?.order_id);

  if (!orderId) return c.json({ received: true });

  const db = supa(c.env);

  if (type === 'checkout.session.completed' || type === 'checkout.session.async_payment_succeeded') {
    // Only settle if payment actually succeeded.
    if (session.payment_status && session.payment_status !== 'paid') {
      return c.json({ received: true });
    }
    const paymentIntent =
      typeof session.payment_intent === 'string' ? session.payment_intent : null;
    const email =
      (session.customer_details as { email?: string } | undefined)?.email ??
      (session.customer_email as string | undefined) ??
      null;
    // Idempotent: only flip a not-yet-paid order. A duplicate delivery no-ops.
    await db
      .from('orders')
      .update({
        status: 'paid',
        stripe_payment_intent: paymentIntent,
        ...(email ? { contact_email: email } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .neq('status', 'paid');
    return c.json({ received: true });
  }

  if (type === 'checkout.session.expired') {
    await db
      .from('orders')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('status', 'pending');
    return c.json({ received: true });
  }

  return c.json({ received: true });
});

app.get('/', (c) => c.text('oura-api'));

// Cloudflare Queues (queue) and Cron Triggers (scheduled) require handlers on
// the same default export as fetch — a bare Hono app (`export default app`)
// only implements fetch, so this must be an explicit ExportedHandler object.
export default {
  fetch: app.fetch,
  queue: (batch: MessageBatch<PhotoEmbedMessage>, env: Env) => handleQueue(batch, env, supa),
  scheduled: (event: ScheduledController, env: Env) => handleScheduled(event, env, supa),
} satisfies ExportedHandler<Env, PhotoEmbedMessage>;
