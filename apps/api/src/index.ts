import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  signGuestToken,
  verifyGuestToken,
  tokenHash,
  type GuestTokenPayload,
} from './token';

// Bindings & secrets available on the Worker env.
// Secrets are injected via `wrangler secret put` — never hardcoded (CLAUDE.md).
export type Env = {
  MEDIA: R2Bucket;
  ENVIRONMENT?: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  // HMAC key for signing/verifying opaque guest tokens. Set via wrangler secret.
  GUEST_TOKEN_SECRET: string;
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
// (event_id, token_hash). Returns the payload + guest row, or an error code the
// caller maps to an HTTP status. Never compares or stores the raw token.
async function resolveGuest(
  db: SupabaseClient,
  token: string,
  secret: string,
): Promise<
  | { ok: true; payload: GuestTokenPayload; guest: { id: string; event_id: string } }
  | { ok: false; status: 401 | 404 }
> {
  const payload = await verifyGuestToken(token, secret);
  if (!payload) return { ok: false, status: 401 };

  const token_hash = await tokenHash(token);
  const { data: guest } = await db
    .from('guests')
    .select('id, event_id')
    .eq('event_id', payload.event_id)
    .eq('token_hash', token_hash)
    .maybeSingle();

  // Signature valid but no matching row (revoked/deleted, or id/hash mismatch).
  if (!guest || guest.id !== payload.guest_id) return { ok: false, status: 404 };
  return { ok: true, payload, guest };
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
      { error: resolved.status === 401 ? 'invalid_token' : 'guest_not_found' },
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
//   Verifies the token, then records the guest's biometric consent. Idempotent:
//   a second call for an already-consented guest confirms rather than errors.
//   This is what the (parallel-built) consent-gate screen's "I agree" calls.
//   Response 200: { ok, guest_id, event_id, consented_at, already: boolean }
// ---------------------------------------------------------------------------
app.post('/consent/:token', async (c) => {
  const token = c.req.param('token');
  if (!token) return c.json({ error: 'missing_token' }, 400);

  const db = supa(c.env);
  const resolved = await resolveGuest(db, token, c.env.GUEST_TOKEN_SECRET);
  if (!resolved.ok) {
    return c.json(
      { error: resolved.status === 401 ? 'invalid_token' : 'guest_not_found' },
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

  // NOTE: retention_expires_at is intentionally left NULL — the retention policy
  // is an open legal question (schema note / PRD §8). Do not backfill a default.
  const { data: inserted, error: insertErr } = await db
    .from('biometric_consents')
    .insert({ guest_id: guest.id, event_id: payload.event_id })
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
// Photo ingest (bulk load into a seeded event).
// POST /events/:event_id/photos
//   Called by a one-off local Node script the founder runs — NOT from the
//   browser — so no extra CORS/auth hardening beyond confirming the event exists.
//   Accepts multipart/form-data with a single `file` field. Uploads the bytes to
//   R2 and inserts a `photos` row marked 'ready' (Stage 1 has no processing
//   pipeline yet, so ingested photos are immediately visible).
//   Response 201: { id, event_id, storage_key }
// ---------------------------------------------------------------------------
app.post('/events/:event_id/photos', async (c) => {
  const event_id = c.req.param('event_id');
  if (!event_id) return c.json({ error: 'missing_event_id' }, 400);

  const db = supa(c.env);

  // Confirm the event exists (mirrors the guest-issuance route's 404 pattern).
  const { data: event, error: eventErr } = await db
    .from('events')
    .select('id')
    .eq('id', event_id)
    .maybeSingle();
  if (eventErr) return c.json({ error: 'lookup_failed' }, 500);
  if (!event) return c.json({ error: 'event_not_found' }, 404);

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

  return c.json({ id, event_id, storage_key }, 201);
});

// ---------------------------------------------------------------------------
// Event code resolution.
// GET /events/by-code/:code
//   Resolves a short human-shareable event code (e.g. WED-2024) to the internal
//   event UUID. Used by manual-entry / QR-deeplink guest entry. Contract with the
//   frontend is EXACTLY { event_id } — nothing more.
//   Response 200: { event_id } | 404 { error: 'event_not_found' }
// ---------------------------------------------------------------------------
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

export default app;
