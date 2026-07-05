# Oura — Architecture Reference

This is the as-built system, not the original plan. It reflects what's actually
deployed and running as of the last update below. If code and this file ever
disagree, the code is right and this file is stale — fix the file (see
"Keeping this current" at the bottom).

**Last updated:** 2026-07-04, through the "working MVP" milestone (real
photo-upload UI, real event list, de-mocked dashboard, real scannable QR,
photo delete) — landed and verified live on top of Stage 1 (real guest path)
and Stage 3 (photographer auth + admin CRUD). Every section below reflects
this state; the "in flight" caveats that used to be here are resolved.

## 1. System overview

Guests scan a QR at an event → land on a Next.js guest gallery → (after a
biometric-consent gate) see event photos, personally face-matched once Stage 2
ships. Photographers sign up, create/brand events, and upload photos through a
separate admin area of the same Next.js app.

```
┌─────────────┐      ┌──────────────────────┐      ┌─────────────────────┐
│   Browser   │◄────►│  oura-web (Worker)   │      │  oura-api (Worker)  │
│ guest/photog│      │  Next.js/OpenNext     │      │  Hono               │
└─────────────┘      └──────────┬───────────┘      └──────────┬──────────┘
                                 │ direct RLS reads/writes      │ service-role
                                 │ (photographer CRUD only)     │ (bypasses RLS)
                                 ▼                              ▼
                      ┌────────────────────────────────────────────────┐
                      │              Supabase (Postgres)                │
                      │  events, guests, photos, face_embeddings,       │
                      │  biometric_consents + auth.users (photographers)│
                      └────────────────────────────────────────────────┘
                                                              │
                                                              ▼
                                                    ┌────────────────────┐
                                                    │  Cloudflare R2      │
                                                    │  bucket: ouramedia  │
                                                    │  (all photo bytes)  │
                                                    └────────────────────┘
```

Two independently deployed Cloudflare Workers, both under the same Cloudflare
account:

| Service | What | Live URL | Source |
|---|---|---|---|
| `oura-web` | Next.js App Router (guest + photographer UI), deployed via the OpenNext Cloudflare adapter | https://oura-web.oura-events.workers.dev | `apps/web` |
| `oura-api` | Hono API Worker | https://oura-api.oura-events.workers.dev | `apps/api` |

Deploy either with `npm run build && npx wrangler deploy` from the app's own
directory (`apps/web` uses `npx opennextjs-cloudflare build` instead of plain
`next build` before deploying — see its `wrangler.jsonc`).

## 1a. Repo layout — what's real vs. aspirational

```
/apps/web                      Next.js app (guest gallery + photographer dashboard) — REAL, deployed
/apps/api                      Cloudflare Worker (Hono), wrangler.toml — REAL, deployed
/packages/processing-pipeline  face-embed service (InsightFace/ArcFace) — REAL CODE, NOT YET DEPLOYED
/packages/shared                shared TS types/schemas — DOES NOT EXIST YET
/design                         Stitch export, 42 reference screens + brand spec — REAL, source of truth for UI
/supabase/migrations             SQL migrations, applied via the Management API — REAL
/docs/ARCHITECTURE.md            this file
```

`packages/processing-pipeline` now has real code (FastAPI + InsightFace
`buffalo_l`, `POST /embed`/`GET /health`, a portable `Dockerfile`) — but it
has never been deployed to a real host. This dev sandbox has no Fly.io/GCP
credentials, only Cloudflare's, so the container was built and its HTTP-layer
logic tested locally (model stubbed — the sandbox's proxy allowlist blocks
GitHub release downloads, so the actual InsightFace weights were never
fetched/exercised here). `apps/api/wrangler.toml`'s `EMBED_SERVICE_URL` is
still a placeholder until a real host (Fly.io vs Cloud Run, not yet decided)
is picked and deployed to. `packages/shared` remains aspirational — no
`/packages/shared` directory exists.

## 2. Two auth models — do not conflate them

This is the single most important thing to understand about the codebase.

**Guests never authenticate.** They get an opaque, signed, event-scoped
token (see §4). No Supabase Auth user, no session, no login. This is a
CLAUDE.md hard guardrail.

**Photographers use real Supabase Auth** (email+password, cookie-based
sessions via `@supabase/ssr`). `apps/web/middleware.ts` gates everything
under `/admin/*` — unauthenticated visitors are redirected to `/login`.
Guest-facing routes are explicitly excluded from that middleware and never
see an auth check.

| | Guests | Photographers |
|---|---|---|
| Identity | Opaque signed token (not a `auth.users` row) | Real Supabase Auth user |
| Where sessions live | `localStorage` (`apps/web/lib/guestSession.ts`) | Cookies (`@supabase/ssr`) |
| How the browser talks to data | Only via `oura-api` Worker routes (service-role key stays server-side) | Directly to Supabase via the anon key + RLS, from `apps/web` (browser Supabase client) |
| DB access model | Worker's service-role client bypasses RLS entirely — the Worker itself is the guardrail | RLS policies enforce `photographer_id = auth.uid()` on every table |

Photographer-facing pages (`create-event`, `branding`, `qr-management`, the
event list/detail) talk to Postgres **directly** from the browser via
`createSupabaseBrowserClient()` (`apps/web/lib/supabaseClient.ts`) — there is
**no** Worker round-trip for these reads/writes, RLS is the only gate. The
Worker (`oura-api`) is only involved when **R2 media bytes** are the payload
(photo upload, logo upload, photo delete) — because R2 credentials must never
reach the browser (CLAUDE.md guardrail: media never touches Supabase storage,
and by extension the browser never gets direct R2 access either).

## 3. Database schema (Supabase Postgres)

Migrations are append-only, applied via the Supabase Management API (direct
`psql`/port 5432 is unreachable from the sandboxed dev environment — HTTPS-only
egress). Never edit an already-applied migration file; add a new one.

- `supabase/migrations/0001_init.sql` — `events`, `guests`, `photos`,
  `face_embeddings`, `biometric_consents`, RLS enabled+forced on all five,
  photographer policies keyed on `auth.uid()`, zero `anon` policies.
- `supabase/migrations/0002_event_code.sql` — adds `events.code` (partial
  unique index, `where code is not null`) — the human-shareable code used
  for manual entry and QR deeplinks.
- `supabase/migrations/0003_stage2_pipeline.sql` — Stage 2 foundations:
  a trigger defaulting `biometric_consents.retention_expires_at` to
  `consented_at + 30 days` (plus a one-time backfill of pre-existing NULL
  rows), `biometric_consents.guardian_confirmed`, `photos.embed_status`, and
  the shared `match_faces(event_id, query_embedding, limit)` pgvector ANN-
  search RPC. **Written but NOT YET APPLIED to the live DB** — needs a fresh
  Supabase personal access token (see §9) before it can run.

Key tables (see the migration files for full column lists/constraints):

- **`events`** — `id, photographer_id (→auth.users, NOT NULL), name, status
  ('draft'|'live'|'archived'), gallery_theme ('festive'|'minimal'), branding
  jsonb, code text (unique when set), created_at, updated_at`. `branding`
  jsonb currently holds `{ frame, primary_color, auto_watermark, logo_key,
  studio_name }` — no fixed schema, additive by convention.
- **`guests`** — one row per event-scoped guest session. `token_hash` only
  (SHA-256 of the opaque token) — the raw token is never stored.
- **`photos`** — `id, event_id, storage_key (R2 key), status, width, height,
  bytes, content_type, phash, captured_at, created_at, embed_status
  ('pending'|'processing'|'done'|'failed', migration 0003)`. No binary data —
  `storage_key` is the only pointer to R2. `embed_status` is pipeline-only
  observability/retry state, deliberately separate from `status` (the
  upload/visibility lifecycle gating the general gallery — must never be
  coupled to face-processing state).
- **`face_embeddings`** — `pgvector(512)`, HNSW cosine index, `person_id`
  (cluster id, assigned by `apps/api/src/pipeline/cluster.ts`) + `guest_id`
  (nullable link, set by `POST /guests/:token/selfie` once a guest's selfie
  matches a cluster). **Still unpopulated on the live DB** — the pipeline code
  exists (queue consumer, embedding service) but the embedding service hasn't
  been deployed to a real host yet, so no photo has actually been embedded
  live.
- **`biometric_consents`** — one row per guest who has consented.
  `retention_expires_at`: as of migration 0003, defaults to `consented_at +
  30 days` (a decided value — the founder received an informal draft legal
  opinion recommending a 30-90 day window and formal sign-off is pending, see
  §8) — no longer left NULL. `guardian_confirmed boolean` (0003): required
  `true` by `POST /consent/:token`, folded into the existing `/consent`
  screen as an additional checkbox rather than a new "age gate" screen.

## 4. Guest-facing API (`apps/api`, service-role, bypasses RLS)

All routes below live in `apps/api/src/index.ts`. None require photographer
auth — they're the guest path, gated only by the opaque token.

| Route | Purpose |
|---|---|
| `GET /health` | Liveness + binding/secret presence check (never leaks values) |
| `POST /events/:event_id/guests` | Issues a fresh opaque guest token for an event. Generates `guest_id` server-side, stores only `SHA-256(token)`. |
| `GET /gallery/:token` | Verifies token, returns general event photos (always) + `personal_gallery` — `{consent_required:true}` pre-consent with **zero** face-data read, or `{consent_required:false, photos}` post-consent. `face_embeddings` is only ever queried in the consented branch — this is the CLAUDE.md consent-gate guardrail, enforced in code, not just in the UI. |
| `POST /consent/:token` | Records biometric consent. Idempotent (`unique(guest_id)`, returns `already:true` on repeat). Body **requires** `{ guardian_confirmed: true }` (400s otherwise, migration 0003) — `retention_expires_at` is now set by a DB trigger, not left NULL. |
| `POST /guests/:token/selfie` | **Stage 2.** Multipart `file` field (a selfie). Code-enforced consent gate (403 `consent_required` without a `biometric_consents` row — same guardrail philosophy as `/gallery`). Embeds the image via the self-hosted service, ANN-searches `face_embeddings` in-event via `match_faces`, and links `guest_id` onto every matched `person_id` cluster above `GUEST_MATCH_THRESHOLD`. **Zero-retention by design: the selfie and its embedding are never persisted anywhere** — only the resulting link (an update to existing rows). Returns `{matched:false}` (not an error) when nothing clears the threshold. |
| `GET /media/*` | Streams an R2 object by key (catch-all path, not a named param, so embedded `/` in keys survive). `Cache-Control: immutable` since keys are content-addressed per upload. |
| `GET /events/by-code/:code` | Resolves a human event code (e.g. `WED-2024`) to an `event_id`. Powers manual code entry and `?code=` QR deeplinks. |

**Opaque guest token format:** `base64url(JSON{event_id,guest_id,iat}).base64url(HMAC-SHA256)`,
signed/verified via Web Crypto in `apps/api/src/token.ts` (`signGuestToken`/
`verifyGuestToken`/`tokenHash`) — no JWT library. Constant-time verification.
The token never expires today (see Known Gaps) and travels in the URL path.

### 4a. Stage 2 pipeline architecture (built, not yet live)

- **Photo-side embedding**: `POST /events/:event_id/photos` best-effort
  enqueues `{photo_id, event_id, storage_key}` to the `face-embed-queue`
  Cloudflare Queue (non-blocking — upload response is unaffected either way).
  The Worker's own `queue()` handler (`apps/api/src/queueConsumer.ts`) pulls
  the photo from R2, calls the embedding service, and for each detected face
  assigns a `person_id` cluster (`apps/api/src/pipeline/cluster.ts` — greedy
  nearest-neighbor via `match_faces`, threshold `CLUSTER_MATCH_THRESHOLD`,
  deliberately conservative/high to avoid merging two different guests into
  one cluster) before inserting the `face_embeddings` row.
- **Guest-side matching**: see `POST /guests/:token/selfie` above.
  `GUEST_MATCH_THRESHOLD` is deliberately more lenient than the clustering
  threshold (a single uncontrolled selfie shot vs. curated event photos), and
  the route links every cluster above threshold in the top-`GUEST_MATCH_TOPK`
  results, not just the single nearest, to compensate for ingestion-time
  over-splitting.
- **Retention enforcement**: a daily Cloudflare Cron Trigger (`0 3 * * *`,
  `apps/api/src/scheduledCleanup.ts`) deletes `face_embeddings` rows whose
  guest's `retention_expires_at` has passed. Scoped to embeddings only —
  `guests`/`biometric_consents` rows are kept indefinitely as audit metadata.
- **Embedding service**: `packages/processing-pipeline` (self-hosted
  InsightFace/ArcFace, never a per-call managed API per CLAUDE.md) — see
  §1a for its deploy status.
- **Not yet built**: the real `/selfie` capture screen (needs a founder-run
  Stitch export — no design source exists for a camera-capture UI) and
  wiring `/consent`'s redirect + `/gift-reveal` into the post-selfie sequence.
  Both ship together in a follow-up pass, never split (splitting would 404
  live guests mid-flow).

## 5. Photographer-facing API (`apps/api`, JWT-authenticated + ownership-gated)

These routes exist ONLY because R2 is involved — everything else
photographer-facing is direct-to-Supabase from the browser (§2).

| Route | Purpose |
|---|---|
| `POST /events/:event_id/photos` | Multipart photo upload. Requires `Authorization: Bearer <supabase access token>` + event ownership. Writes to R2 (`events/<event_id>/orig/<uuid>.<ext>`), inserts a `photos` row (`status:'ready'` — no processing pipeline exists yet). |
| `POST /events/:event_id/branding/logo` | Multipart logo upload. Same auth. Fixed key per event (`events/<event_id>/branding/logo.<ext>` — re-upload overwrites by design). Read-modify-writes `events.branding` jsonb, merging `logo_key` without clobbering sibling keys. |
| `DELETE /events/:event_id/photos/:photo_id` | Deletes a photo: DB row first (so the gallery stops showing it immediately), then best-effort R2 object delete (a failed R2 delete doesn't fail the request — an orphaned R2 object is a harmless storage-cost leak, not a correctness bug). |

**Shared auth helper:** `requireEventOwner(c, db, event_id)` in
`apps/api/src/index.ts` — extracts the Bearer token, validates via
`supa(env).auth.getUser(token)` (calls Supabase Auth to verify, no local JWT
secret handling needed), then checks `events.photographer_id === user.id`.
Returns a **uniform 404** for both "event doesn't exist" and "exists but
belongs to someone else" — deliberately, so a non-owner can't distinguish the
two and enumerate event ids.

## 6. Frontend routes (`apps/web`)

**`/`** — static marketing/splash landing, no auth, no data.

**Guest-facing (no auth, dark-luxury RTL UI) — wired-vs-static status:**

| Route | Status |
|---|---|
| `/join` | Static UI only — the actual QR-scan guest landing per the Stitch design, never wired to real data (superseded in practice by `/gallery-entry`, which does the same job for real) |
| `/gallery-entry` | **Real** — resolves `?code=`/manual code entry to a real event, issues a real guest token |
| `/consent` | **Real** — calls the real consent endpoint |
| `/gallery` | **Real** — real photos from R2 via the Worker; personal gallery honestly empty (Stage 2 not built) |
| `/festive-gallery`, `/minimal-gallery` | Static UI only — alternate gallery theme variants, never wired |
| `/gift-reveal` | Real Three.js/GSAP scene, but **not wired into the guest flow** — no navigation currently routes a guest through it; it's a standalone reachable page |
| `/photo-editor` | Local React state only (adjustments preview live via CSS filters) — nothing persists back to a real photo |

**Photographer-facing (behind `/admin/*` auth middleware) — wired-vs-static status:**

| Route | Status |
|---|---|
| `/admin` | **Real** — the photographer's own recent events, real aggregate counts, no fabricated numbers |
| `/admin/create-event` | **Real** — inserts a real `events` row |
| `/admin/branding` | **Real** — persists `branding` jsonb, real R2-backed logo upload |
| `/admin/qr-management` | **Real** — real code/link, real scannable QR (client-side `qrcode` npm lib, downloadable PNG) |
| `/admin/events` (list) | **Real** — the photographer's own events via RLS, ported from `design/screens/oura_final_production_event_list_desktop_1` |
| `/admin/events/[event_id]` (upload/detail) | **Real** — multi-file upload to R2 via the Worker, live photo grid, per-photo delete |
| `/admin/ai-optimization` | Static UI only — fake processing queue/metrics, no real pipeline exists |

**Auth pages (no middleware, obviously):** `/login`, `/signup` — designed
fresh (no Stitch source existed), matching the `/consent` screen's
dark-luxury card visual language.

`create-event` → `branding` → `qr-management` are threaded together via a
`?event_id=` query param (not a separate studio-profile table — `branding`
lives per-event in this schema, so there's one event at a time moving through
the onboarding sequence).

## 6a. Frontend structural conventions (true since the project's first screens)

These predate Stage 1 and haven't changed — they're the visual/rendering
architecture, not the data architecture, but a "debugging in the dark"
incident is just as likely to be a rendering bug as an API bug.

- **RTL is structural, not cosmetic.** `<html lang="he" dir="rtl">` in
  `apps/web/app/layout.tsx`. Every component uses CSS logical properties
  (`ms-`/`me-`/`ps-`/`pe-`/`text-start`/`text-end`) — never physical
  `ml-`/`mr-`/`text-left`/`text-right`. This is a CLAUDE.md hard guardrail,
  not a style preference; physical properties silently break under RTL
  (see `MISTAKES.md` for the specific bug classes this has caused: bidi
  space-collapse around inline numbers, mis-centered elements when a logical
  inset is mixed with a physical transform, inverted toggle-switch
  directions).
- **Fonts are self-hosted npm packages** (`next/font/google` at build time,
  no CDN `<link>` tags) — Rubik (`--font-sans`, the default for all Hebrew
  text) and Hanken Grotesk (`--font-display`, Latin-only — it has no Hebrew
  glyphs, so it's only used on pure-Latin branding bits like the "OURA"
  wordmark, never on Hebrew copy; applying it to Hebrew text is a specific
  bug class already hit once).
- **Brand logos** are wrapped by `apps/web/components/brand/OuraLogo.tsx`
  and `StudioLogo.tsx` (both thin `next/image` wrappers, `variant:
  "icon"|"lockup"`). The two brands (Oura the platform, the demo "Photo
  Santos" studio) never share a label in the UI — each always shows only its
  own name, by explicit product decision.
- **The 3D Gift Box Reveal** (`/gift-reveal`) is the one non-static guest
  screen: a real Three.js + GSAP scene in
  `apps/web/components/guest/GiftBoxReveal.tsx`, dynamic-imported with
  `ssr:false` (WebGL/canvas don't exist server-side) and fully self-managing
  its lifecycle inside a single `useEffect` (rAF cancel, GSAP tween kill,
  listener/ResizeObserver cleanup, geometry/material/texture `.dispose()`,
  `renderer.dispose()` + `forceContextLoss()` on unmount) — this is the one
  place in the app doing manual GPU resource management, worth knowing about
  before debugging a memory leak or a blank canvas.
- **Design source of truth:** `/design` holds the original 42-screen Stitch
  export (reference `screen.png` + `code.html` per screen) plus the brand
  spec. Per CLAUDE.md, a screen's implementation must match its actual
  `screen.png` content, not its folder name — several folder/content
  mismatches were found and documented in `PROGRESS.md`/`MISTAKES.md` during
  the initial port (e.g. a folder named for one screen whose `screen.png`
  was actually a different screen entirely). Screens with no design source
  at all (`/consent`, `/login`, `/signup`) were designed fresh, matching the
  established dark-luxury card pattern, with explicit founder sign-off each
  time per CLAUDE.md's "never freehand new visuals without either an
  existing source or explicit approval" rule.

## 7. Environment / secrets inventory (names only — never values)

**`apps/api` (Wrangler secrets, `wrangler secret put <name>`):**
`SUPABASE_URL` (bare project URL, NOT the `/rest/v1/`-suffixed PostgREST
base — see Known Gaps/Mistakes), `SUPABASE_SERVICE_ROLE_KEY`,
`GUEST_TOKEN_SECRET` (HMAC key for guest tokens), `EMBED_SERVICE_TOKEN`
(Stage 2 — bearer secret shared with `packages/processing-pipeline`; **set
live** via `wrangler secret put`, but the value it needs to match on the
embedding-service side doesn't matter yet since that service isn't deployed
anywhere real — will need to be re-set/confirmed once it is).

**`apps/api` (R2 binding, `wrangler.toml`):** `MEDIA` → bucket `ouramedia`.

**`apps/api` (Queue binding + Cron, `wrangler.toml`):** `FACE_EMBED_QUEUE` →
`face-embed-queue` (+ `face-embed-queue-dlq` dead-letter queue) — **created
live** via `wrangler queues create` and deployed. Daily cron `0 3 * * *` for
retention cleanup, live (harmless no-op until real consents cross the 30-day
mark).

**`apps/api` (non-secret vars, `wrangler.toml`):** `EMBED_SERVICE_URL`
(placeholder until the embedding service is deployed), `CLUSTER_MATCH_THRESHOLD`
(0.5), `GUEST_MATCH_THRESHOLD` (0.42), `GUEST_MATCH_TOPK` (20) — cosine-
similarity tuning knobs, first things to adjust after watching real pilot-
event match rates.

**`packages/processing-pipeline` (container env):** `EMBED_SERVICE_TOKEN` —
same value as the Worker secret above, checked on every `/embed` call.

**`apps/web` (build-time, `.env.local` / CI env — these get INLINED into the
client bundle, so "secret" here just means "not committed," not "hidden from
the browser"):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(anon key is meant to be public — RLS is the real gate, not key secrecy).

## 8. Known gaps (honest, not oversights — see PRD.md for phase boundaries)

- **Face-matching pipeline (Stage 2) is deployed at the infrastructure level
  but the embedding service itself isn't live yet.** Migration 0003 is
  applied to the live DB (verified: zero NULL `retention_expires_at` rows,
  `guardian_confirmed`/`embed_status` columns present, `match_faces` RPC
  callable). `apps/api` is deployed with the queue (`face-embed-queue` +
  DLQ, created live), the daily retention cron, `POST /consent/:token`
  requiring `guardian_confirmed`, and `POST /guests/:token/selfie` — all
  verified live against a throwaway test guest on the real `WED-2024` event
  (guardian gate 400s correctly, consent sets `retention_expires_at` at
  exactly +30 days, selfie 403s pre-consent and 502s post-consent with
  `embed_service_unavailable` — expected, not a bug). `apps/web/app/selfie`
  is also built and deployed now (from the founder's returned Stitch
  export), verified with Playwright, but reachable only by direct URL —
  same status as `/gift-reveal`. What's still missing: the embedding service
  has never been deployed to a real host (no Fly.io/GCP credentials in this
  dev sandbox — built and logic-tested locally with the model stubbed out
  only, `EMBED_SERVICE_URL` is still a placeholder). Until it is, `/consent`'s
  redirect stays pointed at `/gallery` (not `/selfie`) on purpose —
  flipping it now would send every real guest through a camera prompt for a
  feature that can't yet match anything. Until the embedding host is live
  and that redirect is flipped, `face_embeddings` stays unpopulated and the
  personal gallery still honestly shows "still searching for you." Legal basis: the founder
  received an informal draft legal opinion (from a lawyer-friend, formal
  signed version to follow) recommending a 30-day retention window, an
  active consent gesture, and guardian/age confirmation — and explicitly
  decided to proceed building on that basis, accepting the risk ahead of the
  formal signed opinion. PRD §8 should be read alongside this note, not as
  fully resolved.
- **Guest tokens never expire** and travel in the URL path (loggable at
  edges/proxies). Flagged by an earlier security review, not yet addressed.
- **No photographer password-reset flow.** Founder's account had a password
  set once via the Supabase Admin API; there's no self-service reset UI.
- **AI Optimization admin screen and Photo Editor persistence are UI-only** —
  local React state, no real backend behind either.
- **Phase 2 features** (Stripe billing, print orders, statistics, messaging,
  Studio Profile) are not started — see `PRD.md` §4.

## 9. Deployment process (manual — there is no CI/CD)

There is no GitHub Actions workflow, no CI pipeline, nothing that deploys on
push. Every deploy so far has been a manual command run from a session:

```bash
# apps/api (Hono Worker)
cd apps/api && npx wrangler deploy

# apps/web (Next.js via OpenNext)
cd apps/web && npx opennextjs-cloudflare build && npx wrangler deploy
```

Both need `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in the
environment (in this sandboxed dev environment specifically, these arrive
with a leading space baked into the value — `echo "$VAR" | xargs` to trim
before use, or `wrangler` will fail with an opaque "no route for that URI"
error that looks like a wrong account id, not a whitespace bug). `apps/web`'s
build additionally inlines `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY` from `.env.local` at build time — if those
are wrong or missing, the deployed bundle silently ships with broken/empty
values baked in, not a build error.

**If this ever needs to become real CI/CD:** there's nothing to migrate away
from, just a `wrangler deploy` step to add to a workflow, per Worker, with
those same env vars as repo/environment secrets.

**Stage 2 deploy steps:**
1. ✅ Applied `supabase/migrations/0003_stage2_pipeline.sql` via the
   Management API (founder-issued `sbp_...` token, revoked immediately after
   — same one-time-use pattern as 0001/0002, see Mistakes). Verified live.
2. ✅ `npx wrangler queues create face-embed-queue` /
   `face-embed-queue-dlq`, both created live.
3. ✅ `wrangler secret put EMBED_SERVICE_TOKEN` and `npx wrangler deploy` —
   `oura-api` is live with the queue producer/consumer, cron, and new routes.
   Verified live against a throwaway test guest (see Known Gaps).
4. **Not done — needs external inputs this dev sandbox doesn't have:**
   deploy `packages/processing-pipeline`'s container to a real host (Fly.io
   vs Cloud Run, not yet decided — see recommendation below; the `Dockerfile`
   is portable to either; no Fly.io/GCP credentials in this sandbox), then
   update `EMBED_SERVICE_URL` in `wrangler.toml` to the real host and
   re-`wrangler deploy`.
5. ✅ Built `apps/web/app/selfie/page.tsx` from the founder's Stitch export
   (`oura_ai_desktop.html`/`oura_ai_mobile.html`) and deployed it — reachable
   at `/selfie` by direct URL only, same status as `/gift-reveal`. Verified
   with Playwright (fake-camera-device flags, mocked API routes): correct
   RTL/layout, camera → capture → review → confirm flow, navigates to
   `/gift-reveal` on completion, no console errors. Two real bugs fixed
   during the port, not just a literal copy of the export: (a) the desktop
   export's capture-button Hebrew text was set to Hanken Grotesk
   (`font-headline-md`), which has no Hebrew glyphs — moved to Rubik
   (`font-sans`), matching every other Hebrew element and the CLAUDE.md
   guardrail; (b) the export's CDN Tailwind/Google-Fonts `<script>`/`<link>`
   tags were dropped entirely in favor of the app's already-bundled
   fonts/Tailwind build (CLAUDE.md: no CDN tags in production builds). Also
   translated the export's ad-hoc local color-token names onto the app's
   actual `globals.css` theme rather than copying them literally — several
   collide with different meanings (the export's `text-primary` is white;
   the app's `--color-primary` is the copper accent, so a literal class copy
   would have silently recolored that text orange).
   **Deliberately NOT done yet, same reasoning as before:** `/consent`'s
   redirect target is still `/gallery`, not `/selfie`, and `/gift-reveal` is
   still unreachable through the normal flow. Flipping that redirect now
   would put every real guest through a camera-permission prompt for a
   feature that can't actually match anything yet (step 4 isn't done), so
   the guest would always land on the "matching unavailable" fallback path.
   That switch happens together with the embedding-service deploy.

## 10. Verification & testing conventions

No formal test suite exists (no Jest/Vitest/Playwright-config test files) —
verification for every stage so far has been: `tsc --noEmit` on both apps,
a production build (`next build`, or `opennextjs-cloudflare build` for the
Cloudflare-targeted build), and ad hoc Playwright scripts written per
verification pass (not checked in — they're throwaway scratch scripts).

**A sandbox-specific limitation shapes how that Playwright verification is
done, and matters if you're ever debugging "why didn't this get caught":**
this dev environment's outbound network is HTTPS-only through a local agent
proxy. `curl` and Node's own `fetch` (e.g. a Next.js server's own outbound
calls, like `middleware.ts` validating a session server-side) inherit that
proxy and reach the real internet fine. A **launched Playwright/Chromium
browser does not** — it can't reach real external hosts (the live Workers,
Supabase, anything) even with `proxy:` passed explicitly to `chromium.launch()`.
So the actual verification pattern used throughout this project is:
- Real backend/data-layer correctness (RLS isolation, endpoint auth, R2
  round-trips) → verified directly via `curl`/`node fetch`, never a browser.
- Real frontend logic/rendering correctness → verified via Playwright against
  a local production build (`npm run start`), with `page.route()` intercepting
  and mocking every call to the real Supabase/Worker URLs — this tests the
  actual React code paths (form submit → redirect → render) without needing
  the sandboxed browser to reach the real internet.
- The one exception: since `middleware.ts` runs server-side in the Next.js
  process (not the browser), a **real** session cookie (obtained via a real
  `curl` login) can be fed into the Playwright browser context so the
  middleware's own server-side `getUser()` call validates genuinely, while
  the browser's own calls stay mocked. Used once to verify the auth
  foundation end-to-end; worth reusing rather than re-deriving next time.
- Also: the Next.js **dev server** (`next dev`, Turbopack) does not hydrate
  in this sandbox — client `onClick` handlers and `useEffect` silently never
  fire, which looks exactly like a real bug. Always verify interactivity
  against `npm run build && npm run start`, never `next dev`.

## 11. Keeping this current

Update this file whenever any of the following changes, in the same commit
as the code change if practical:
- A route is added/removed/changed on either Worker (§4, §5).
- A new frontend route is added, or the `/admin/*` auth boundary changes (§6).
- A table, column, or RLS policy changes (§3) — add a new migration entry.
- A new secret/env var is introduced (§7).
- A "known gap" gets closed, or a new one is discovered.

`SUMMARY.md` stays the narrative "what's the current story" snapshot for
session continuity; this file is the structural reference — endpoints,
schema, auth model, deployment topology. They serve different purposes and
both need to stay accurate, not just one.
