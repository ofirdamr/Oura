# oura-api — deploy notes

Cloudflare Worker (Hono) for the Oura backend. Live URL:
`https://oura-api.oura-events.workers.dev`

## Secrets (never in git / wrangler.toml)

Set via Wrangler secrets:

```bash
# CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID must be in the environment.
# IMPORTANT: SUPABASE_URL must be the PROJECT BASE URL (https://<ref>.supabase.co),
# NOT a value ending in /rest/v1/ — supabase-js appends /rest/v1/ itself, so a
# base with the path baked in double-appends and every query 404s (lookup_failed).
printf %s "$SUPABASE_URL"              | npx wrangler secret put SUPABASE_URL
printf %s "$SUPABASE_SERVICE_ROLE_KEY" | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# HMAC key for signing/verifying opaque guest tokens. Generate a fresh random
# value; never commit it. (Rotating it invalidates every already-issued token.)
openssl rand -hex 32                    | npx wrangler secret put GUEST_TOKEN_SECRET
```

The service_role key bypasses Postgres RLS and lives ONLY on the Worker. It is
never shipped to the browser. Guests reach data through signed event-scoped
tokens the Worker resolves server-side.

## Guest token + endpoints

- `POST /events/:event_id/guests` → creates a `guests` row and returns a signed
  opaque event-scoped token `{ token, event_id, guest_id }` (201). Body optional:
  `{ "display_name": string }`. Only `SHA-256(token)` is stored (`token_hash`);
  the raw token is never persisted.
- `GET /gallery/:token` → verifies the token (401 if invalid/tampered), returns
  the event's general `photos` list, and a `personal_gallery` object that is
  `{ consent_required: true }` until the guest has consented, then
  `{ consent_required: false, consented_at, photos: [...] }`. Face-matched data
  is NEVER returned before a `biometric_consents` row exists (CLAUDE.md gate).
- `POST /consent/:token` → records biometric consent, idempotent
  (`{ ok, guest_id, event_id, consented_at, already }`).

Token = `base64url(JSON{event_id,guest_id,iat}) + "." + base64url(HMAC-SHA256)`.
See `src/token.ts`. R2 photo URLs are a `/media/<key>` stub for now (TODO: real
signed/CDN serving).

## Deploy

```bash
npm install
npx wrangler deploy
```

## Bindings

- `MEDIA` → R2 bucket `ouramedia` (existing).
- Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GUEST_TOKEN_SECRET`.

## DB schema

The Postgres schema is `../../supabase/migrations/0001_init.sql`, applied to the
live Supabase project (all 5 MVP tables live with RLS forced; service_role
bypasses RLS, anon is denied).
