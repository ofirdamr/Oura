# Oura — Architecture Reference

This is the as-built system, not the original plan. It reflects what's actually
deployed and running as of the last update below. If code and this file ever
disagree, the code is right and this file is stale — fix the file (see
"Keeping this current" at the bottom).

**Last updated:** 2026-07-05, after fixing a live bug found via a real guest
selfie test on `WED-2024`: pre-Stage-2 photos were never embedded (added
`POST /admin/backfill-embeddings`, §4) and the embed client had no request
timeout (added one, §8). Builds on the "working MVP" milestone (2026-07-04:
real photo-upload UI, real event list, de-mocked dashboard, real scannable
QR, photo delete) on top of Stage 1 (real guest path) and Stage 3
(photographer auth + admin CRUD).

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
/packages/processing-pipeline  face-embed service (InsightFace/ArcFace) — REAL, deployed (Cloud Run)
/packages/shared                shared TS types/schemas — DOES NOT EXIST YET
/design                         Stitch export, 42 reference screens + brand spec — REAL, source of truth for UI
/supabase/migrations             SQL migrations, applied via the Management API — REAL
/docs/ARCHITECTURE.md            this file
```

`packages/processing-pipeline` (FastAPI + InsightFace `buffalo_l`,
`POST /embed`/`GET /health`) is deployed to Cloud Run (project
`ouraforphotographers`, region `us-central1`, service `oura-embed`) — the
model itself was unreachable/untestable from this dev sandbox (its proxy
allowlist blocks GitHub release downloads), but Cloud Build's own network
access isn't sandbox-restricted, so the real weights downloaded and loaded
fine there. `apps/api/wrangler.toml`'s `EMBED_SERVICE_URL` points at the real
deployed host. `packages/shared` remains aspirational — no
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
  search RPC. Applied.
- `supabase/migrations/0004_guest_token_expiry.sql` — adds
  `guests.token_expires_at` (defaults to `created_at + 90 days` for new rows;
  backfilled to the same on existing rows), enforced in
  `apps/api/src/index.ts`'s `resolveGuest()` alongside the existing
  `token_hash` lookup. Closes the "guest tokens never expire" known gap
  (§8). Applied (2026-07-06) — verified `NOT NULL`/default landed correctly
  and all 8 live `guests` rows backfilled; `apps/api` redeployed with the
  enforcement live, verified against a throwaway `WED-2024` test guest (a
  backdated `token_expires_at` correctly produced `401 token_expired`).
- `supabase/migrations/0005_face_embeddings_delete_guard.sql` — DB-level guard
  making the retention-cron index-wipe bug (MISTAKES.md 2026-07-09) structurally
  impossible. Adds a `before delete` trigger on `face_embeddings` that REJECTS any
  delete while the row's parent photo still exists, unless a transaction-local
  opt-in flag (`oura.allow_face_delete`) is set. Two legitimate paths stay open:
  photo deletion (the `on delete cascade` from `photos` — parent already gone, so
  allowed) and force re-embed (routes its clear through the SECURITY DEFINER
  `admin_clear_faces_for_photos(uuid[])` RPC, which sets the flag). A guest-scoped
  cleanup (photos intact, no flag) — the original bug — now raises instead of
  wiping the shared index. **Status: written; applies via the Management API; the
  worker already tolerates its absence (falls back to a direct delete pre-apply).**

Key tables (see the migration files for full column lists/constraints):

- **`events`** — `id, photographer_id (→auth.users, NOT NULL), name, status
  ('draft'|'live'|'archived'), gallery_theme ('festive'|'minimal'), branding
  jsonb, code text (unique when set), created_at, updated_at`. `branding`
  jsonb currently holds `{ frame, primary_color, auto_watermark, logo_key,
  studio_name, event_title, share_caption }` — no fixed schema, additive by
  convention. `event_title` (set on `/admin/branding`) is the title composited
  onto guest-downloaded/shared photos; the guest gallery falls back to
  `events.name` when it's absent. `share_caption` is the marketing text
  pre-filled into the guest share sheet (falls back to a default built from the
  title + studio name).
- **`guests`** — one row per event-scoped guest session. `token_hash` only
  (SHA-256 of the opaque token) — the raw token is never stored.
  `token_expires_at` (migration 0004): defaults to `created_at + 90 days`,
  a plain column (not re-derived from the token payload) so an individual
  guest's access can be shortened/extended later without reissuing tokens.
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
| `GET /gallery/:token` | Verifies token, returns general event photos (always) + `personal_gallery` — `{consent_required:true}` pre-consent with **zero** face-data read, or `{consent_required:false, photos}` post-consent. `face_embeddings` is only ever queried in the consented branch — this is the CLAUDE.md consent-gate guardrail, enforced in code, not just in the UI. Also returns `event: { name, branding: { event_title, share_caption, logo_key, frame, primary_color, auto_watermark } }` (guest-safe display keys only) so the client can composite the photographer frame/logo/title onto downloaded/shared photos and pre-fill a marketing share caption. |
| `POST /consent/:token` | Records biometric consent. Idempotent (`unique(guest_id)`, returns `already:true` on repeat). Body **requires** `{ guardian_confirmed: true }` (400s otherwise, migration 0003) — `retention_expires_at` is now set by a DB trigger, not left NULL. |
| `POST /guests/:token/selfie` | **Stage 2.** Multipart `file` field (a selfie). Code-enforced consent gate (403 `consent_required` without a `biometric_consents` row — same guardrail philosophy as `/gallery`). Embeds the image via the self-hosted service, ANN-searches `face_embeddings` in-event via `match_faces`, and links `guest_id` onto every matched `person_id` cluster above `GUEST_MATCH_THRESHOLD`. **Zero-retention by design: the selfie and its embedding are never persisted anywhere** — only the resulting link (an update to existing rows). Returns `{matched:false}` (not an error) when nothing clears the threshold. |
| `GET /media/*` | Streams an R2 object by key (catch-all path, not a named param, so embedded `/` in keys survive). `Cache-Control: immutable` since keys are content-addressed per upload. Sends `Access-Control-Allow-Origin: *` (media is already public; CORS is needed so a photo can be used as a WebGL texture on the gift-reveal 3D card — the web app and API are different Worker origins). |
| `GET /events/by-code/:code` | Resolves a human event code (e.g. `WED-2024`) to an `event_id`. Powers manual code entry and `?code=` QR deeplinks. |
| `POST /admin/backfill-embeddings` | Operator-only. Body `{ event_id?: string, force?: boolean }`. Re-enqueues every photo not yet `embed_status:'done'` (or ALL of them when `force:true`) into `face-embed-queue`. Gated by a dedicated `ADMIN_BACKFILL_TOKEN` bearer secret, not photographer auth — exists because photos ingested before Stage 2's enqueue-on-upload existed (e.g. the hand-seeded `WED-2024` set) never got embedded and had no other path to catch up. On `force`, clears each photo's existing faces first — via the `admin_clear_faces_for_photos()` RPC (migration 0005), falling back to a direct delete only when that RPC isn't present yet. |
| `GET /admin/embed-status?event_id=` | Operator-only (`ADMIN_BACKFILL_TOKEN`). Read-only diagnostic: photo count, `embed_status` breakdown, `face_embeddings` row count, distinct person clusters. This is how you tell whether the shared index is intact vs. wiped without direct DB access. |
| `GET /admin/match-test?event_id=[&photo_id=]` | Operator-only (`ADMIN_BACKFILL_TOKEN`). Re-embeds one of the event's OWN photos and runs it through `match_faces`, returning nearest distances/similarities. Proves the embed service + stored vectors + matching all work (a photo should find its own stored face at distance ~0) without needing a guest selfie. |
| `POST /admin/selfie-test?event_id=` | Operator-only (`ADMIN_BACKFILL_TOKEN`). Multipart `file` field. Runs an UPLOADED selfie through the exact `embed → match_faces` path the guest `/selfie` route uses and returns the real per-face nearest distances/similarities + `would_match` at the current threshold — **zero-retention, writes nothing and links nothing** (pure diagnostic). This is what let the WED-2024 investigation read a real selfie's true match distances and decide "not a threshold problem" vs. "face not detected / not in index." |

**Opaque guest token format:** `base64url(JSON{event_id,guest_id,iat}).base64url(HMAC-SHA256)`,
signed/verified via Web Crypto in `apps/api/src/token.ts` (`signGuestToken`/
`verifyGuestToken`/`tokenHash`) — no JWT library. Constant-time verification.
The signed payload itself has no expiry claim; expiry is enforced via
`guests.token_expires_at` (migration 0004, applied and live — see §3) in
`resolveGuest()`, checked on the same row already fetched for the
`token_hash` lookup (no extra query). The token still travels in the URL
path (still loggable at proxies/CDNs — a separate, larger fix, not attempted
in this pass).

### 4a. Stage 2 pipeline architecture (live)

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
  `apps/api/src/scheduledCleanup.ts`) **un-links** (sets `guest_id = null`) the
  `face_embeddings` rows of guests whose `retention_expires_at` has passed. It
  MUST NEVER `.delete()` a `face_embeddings` row — those rows are the shared,
  photo-derived search index, not the guest's biometric data (the selfie is
  zero-retention and never stored). Deleting them (the pre-2026-07-09 bug) tore
  the match index out from under the whole event the moment any one guest's
  30 days elapsed, silently breaking face-matching until a manual re-embed —
  see `MISTAKES.md` 2026-07-09. Retention forgets the guest↔cluster *link*;
  the index survives for the life of the photos. The ONLY legitimate deletes of
  `face_embeddings` are the `on delete cascade` from deleting a photo/event.
  **Future hardening (not yet done):** the guest↔cluster link should live in its
  own table (e.g. `guest_matches(guest_id, event_id, person_id)`) so a shared
  index row is never stamped with guest identity at all; retention would then
  delete link rows, and the `face_embeddings` `guest_id` column could be
  dropped. If legal ever requires purging the photo-derived templates
  themselves, scope that to the event/photo lifecycle (all of an event's
  embeddings at once), never to one guest's consent clock.
- **Embedding service**: `packages/processing-pipeline` (self-hosted
  InsightFace/ArcFace, never a per-call managed API per CLAUDE.md), deployed
  to **Cloud Run** (project `ouraforphotographers`, region `us-central1`,
  service `oura-embed`). Publicly reachable at the network level
  (`--no-allow-unauthenticated` was tried first and reverted — Cloud Run's
  own IAM auth would reject the Worker's calls before they reach the app,
  since there's no VPC peering between Cloudflare and Cloud Run; the
  `EMBED_SERVICE_TOKEN` bearer check inside the FastAPI app is the actual
  access control). CPU boost enabled on the service to reduce cold-start
  latency without paying for an always-on instance (`min-instances` stays 0).
  The GCP service account used to deploy needed three roles added
  incrementally (Cloud Run Admin, Artifact Registry Writer, Service Account
  User — the standard trio for a Cloud-Run-deploying account) plus Cloud
  Run/Cloud Build/Artifact Registry APIs enabled on the project.
- **Guest flow fully wired**: `/consent`'s redirect now points to `/selfie`
  (not `/gallery`) on accept, and `/selfie`'s confirm-submit routes to
  `/gift-reveal` regardless of match outcome (both "matched" and "still
  searching" are legitimate, already-handled states) before landing on
  `/gallery`. Verified live end-to-end against throwaway test guests on the
  real `WED-2024` event: consent → selfie submission → real Cloud Run
  embedding call → correct `no_face_detected`/`matched` response.

## 5. Photographer-facing API (`apps/api`, JWT-authenticated + ownership-gated)

These routes exist ONLY because R2 is involved — everything else
photographer-facing is direct-to-Supabase from the browser (§2).

| Route | Purpose |
|---|---|
| `POST /events/:event_id/photos` | Multipart photo upload. Requires `Authorization: Bearer <supabase access token>` + event ownership. Writes to R2 (`events/<event_id>/orig/<uuid>.<ext>`), inserts a `photos` row (`status:'ready'` — no processing pipeline exists yet). |
| `POST /events/:event_id/branding/logo` | Multipart logo upload. Same auth. Content-addressed key per upload (`events/<event_id>/branding/logo-<uuid>.<ext>` — NOT a fixed filename; `/media/*` caches every key for a year as immutable, so a fixed key would keep serving the old bytes after a re-upload). Read-modify-writes `events.branding` jsonb, merging `logo_key` without clobbering sibling keys, then best-effort deletes the previous logo's R2 object. |
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
| `/gallery` | **Real** — real photos from R2 via the Worker; personal gallery is real Stage 2 face-matched photos (populated once consented) |
| `/festive-gallery`, `/minimal-gallery` | Static UI only — alternate gallery theme variants, never wired |
| `/gift-reveal` | **Real** Three.js/GSAP scene, wired into the guest flow — `/selfie`'s confirm-submit routes here (matched or not), landing on `/gallery` |
| `/photo-editor` | **Real** — reached from `/gallery`'s viewer ("עריכה"/tune icon) with `?photo=<id>`; re-reads the guest's gallery (opaque token) to load that real R2 photo, previews adjustments live via CSS filters, and Save/Share exports the **adjusted + branded** JPEG (same filter math baked into the canvas render via `lib/watermark.adjustmentsFilter` + rotation) to the phone via the share sheet. Ephemeral by design — no server-side persistence (guest flow is login-free) |

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

**Auth pages (no middleware, obviously):** `/login`, `/signup`,
`/forgot-password`, `/reset-password` — designed fresh (no Stitch source
existed), matching the `/consent` screen's dark-luxury card visual language.
`/forgot-password` calls Supabase Auth's `resetPasswordForEmail`;
`/reset-password` is where the emailed link lands — the browser client
auto-detects the recovery session from the URL, then `updateUser({password})`
sets the new one. Closes the "no password reset" known gap (§8).

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

## 6b. Design-to-Code master index (design is king — code is 1:1 wiring)

**The design is the source of truth. Code is a 1:1 wiring of each
`design/screens/*/screen.png`, and the design-spec flow is the leading build
order.** This section is the master map from every design screen → its code
file(s). "Indexing" here means paths, not contents — keep it a lookup table.

**Per-screen fidelity rule (CLAUDE.md guardrail):** implement to the actual
`screen.png` *content*, not the folder name — several folder/content
mismatches were found during the initial port (see §6a, `MISTAKES.md`). When a
screen has no `design/screens/*` source at all, it is either designed fresh
with founder sign-off or built from a separate Stitch export (noted per row);
never freehand a new visual.

### Design-spec source files (the master flow lives here)

| File | Role |
|---|---|
| `design/oura_design_specifications_final.md` | **Brand + flow source of truth.** Color palette, typography (Hanken Grotesk Latin / Rubik Hebrew), spacing/grid, component library, and — §6 "Functional Prototypes & Flows" — **the two canonical flows that set build order** (Photographer, Guest). Read this first before touching any screen. |
| `design/oura_final_production_index_42_screens.md` | The 42 logical screens, grouped by surface (Photographer Admin desktop/mobile, Guest desktop/mobile, Marketing). The `{{DATA:SCREEN:SCREEN_nn}}` tokens are the original Stitch export ids; the real per-screen assets live under `design/screens/<folder>/{screen.png,code.html}`. |
| `design/stitch-theme.json` | Machine-readable Stitch theme tokens (colors/type) backing the spec above. |

### Leading build order (from the design-spec flows — §6 of the spec)

This flow ordering, not the repo folder order, is how screens get built:

1. **Photographer flow:** Dashboard → Create Event → Configure Branding →
   Generate QR (→ upload/monitor). *All Real today.*
2. **Guest flow:** QR Scan → Landing Page → AI Recognition Explanation
   (consent + selfie) → Personal Gallery → Order Prints (Phase 2). *Guest path
   Real through the gallery; Order Prints onward is Phase 2.*

### Master map: design screen → code

Design folders share a `design/screens/oura_final_production_` prefix (elided
below; e.g. `dashboard_desktop_1` = `design/screens/oura_final_production_dashboard_desktop_1/`).
Each row's code path is relative to repo root. **Status** = wiring state (see
§6 for the full wired-vs-static rationale).

**Photographer Admin** (behind `/admin/*` auth middleware):

| # | Screen | Design folders (desktop / mobile) | Code | Status |
|---|---|---|---|---|
| 1/13 | Dashboard | `dashboard_desktop_1..3`, `dashboard_mobile_1..3` | `apps/web/app/admin/page.tsx` (+ `components/admin/AdminShell.tsx`) | **Real** |
| 2/14 | Event List | `event_list_desktop_1..3`, `event_list_mobile_1..3` | `apps/web/app/admin/events/page.tsx` | **Real** |
| 3/15 | Branding Settings | `branding_settings_desktop_1..3` (canonical: **desktop_3**), `branding_settings_mobile_1..3` (canonical: **mobile_3**; mobile_1 is a misfiled personal-gallery PNG) | `apps/web/app/admin/branding/page.tsx` (desktop_3 layout `md+`; dedicated mobile_3 layout below `md` — simpler set: logo + `studio_name` + single brand color + save/cancel) | **Real** |
| 4/16 | AI Optimization | `ai_optimization_desktop_1..2`, `ai_optimization_mobile` | `apps/web/app/admin/ai-optimization/page.tsx` | Static UI only (no real pipeline behind it — §8) |
| 5/17 | Statistics & Analytics | `statistics_desktop_1..3`, `statistics_mobile_1..2` | — not built — | Phase 2 |
| 6/18 | Messaging Center | `messaging_center_desktop`, `messaging_center_mobile` | — not built — | Phase 2 |
| 7 | Create New Event | `create_event_desktop` | `apps/web/app/admin/create-event/page.tsx` | **Real** |
| 8/19 | Barcode/QR Management | `barcode_management_desktop`, `barcode_management_mobile` | `apps/web/app/admin/qr-management/page.tsx` | **Real** |
| 9/20 | Notification Center | `notification_center_desktop`, `notification_center_mobile` | — not built — | Phase 2 |
| 10/21 | Reports Management | `reports_management_desktop`, `reports_management_mobile` | — not built — | Phase 2 |
| 11 | Event Book Designer | `event_book_designer_desktop` | — not built — | Phase 3 |
| 12 | Studio Profile | `studio_profile_desktop` | — not built — | Phase 2 |

**Guest Experience** (no auth, opaque-token gated, dark-luxury RTL):

| # | Screen | Design folders (desktop / mobile) | Code | Status |
|---|---|---|---|---|
| 22/32 | Landing Page | `guest_landing_page_desktop_1..2`, `guest_landing_page_mobile` | `apps/web/app/join/page.tsx` | Static UI only — superseded in practice by `/gallery-entry` (§6) |
| 23/33 | Gallery Entry | `gallery_entry_desktop`, `gallery_entry_mobile` | `apps/web/app/gallery-entry/page.tsx` | **Real** |
| 24/34 | Festive Gallery | `festive_gallery_desktop_1..3`, `festive_gallery_mobile_1..2` | `apps/web/app/festive-gallery/page.tsx` | Static UI only — the **real** festive theme renders through `/gallery` (`events.gallery_theme='festive'`) |
| 25/35 | Minimal Gallery | `minimal_gallery_desktop`, `minimal_gallery_mobile` | `apps/web/app/minimal-gallery/page.tsx` | Static UI only — real minimal theme also renders through `/gallery` |
| 26/36 | Personal Gallery | `personal_gallery_desktop_1..2`, `personal_gallery_mobile` | `apps/web/app/gallery/page.tsx` (+ `components/guest/PhotoViewer.tsx`, `BottomNav.tsx`, `BrandedFrame.tsx`) | **Real** — the live gallery; personal tab is Stage 2 face-matched |
| 27/37 | Photo Editor | `photo_editor_desktop`, `photo_editor_mobile` | `apps/web/app/photo-editor/page.tsx` | Local React state only — no persistence (§8) |
| 28/38 | Premium Prints | `premium_prints_desktop`, `premium_prints_mobile` | — not built — | Phase 2 |
| 29/39 | 3D Gift Box Reveal | `gift_box_reveal_desktop`, `gift_box_reveal_mobile` | `apps/web/app/gift-reveal/page.tsx` (+ `components/guest/GiftBoxReveal.tsx`) | **Real** — Three.js/GSAP, wired into the guest flow |
| 30/40 | Checkout | `checkout_desktop`, `checkout_mobile` | — not built — | Phase 2 |
| 31/41 | Order Confirmation | `order_confirmation_desktop`, `order_confirmation_mobile` | — not built — | Phase 2 |

**Marketing:**

| # | Screen | Design folder | Code | Status |
|---|---|---|---|---|
| 42 | Digital Brochure | `digital_brochure` | — not built — | Phase 3 (Oura's own marketing site) |

**Screens with NO `design/screens/*` source** (fresh design or separate export
— per CLAUDE.md, each got explicit founder sign-off; do not backfill a Stitch
folder for these retroactively):

| Screen | Code | Source |
|---|---|---|
| Splash / marketing root | `apps/web/app/page.tsx` | Fresh — static splash, no data |
| Biometric Consent gate | `apps/web/app/consent/page.tsx` | Fresh — new for MVP, not in the design export (matches the dark-luxury card pattern) |
| AI Recognition / Selfie | `apps/web/app/selfie/page.tsx` | Built from a **separate** Stitch AI export (`oura_ai_desktop.html`/`oura_ai_mobile.html`, not under `design/screens/`) — this is the guest flow's "AI Recognition Explanation" step (§4a step 5) |
| Login | `apps/web/app/login/page.tsx` | Fresh — matches `/consent` card language |
| Signup | `apps/web/app/signup/page.tsx` | Fresh |
| Forgot Password | `apps/web/app/forgot-password/page.tsx` | Fresh |
| Reset Password | `apps/web/app/reset-password/page.tsx` | Fresh |

**Backend has no design screens** — `apps/api`, `packages/processing-pipeline`,
and `supabase/migrations` are the wiring *behind* the guest/photographer
screens above; see §3–§5 for their structural map.

**Known navigation gaps (from the 2026-07-10 design audit, folded in here as
the single canonical index):** these are wiring gaps, not design gaps — the
screens exist and match their `screen.png`, but the links between them don't
yet.
- `/admin/qr-management` is reachable only by re-running the create→brand
  sequence — no sidebar link, and no "view QR" affordance on the event-detail
  page. Wiring it is a real task.
- Three dead admin sidebar links: `ארכיון אירועים`, `לקוחות VIP`,
  `ניתוח נתונים` (archive / VIP clients / analytics) — no destination yet.
- The Guest Landing Page (screens #22/#32, code `/join`) is unwired: `/`
  redirects straight to `/gallery-entry`, so `/join` is never entered in the
  real flow.

The raw `{{DATA:SCREEN:SCREEN_nn}}` tokens in
`design/oura_final_production_index_42_screens.md` are original Stitch export
ids, **not** on-disk paths — that file's own header now says so and points at
`design/screens/<folder>/screen.png`. Never conclude "no design exists" from a
token alone; `ls design/screens/` and open the `screen.png` first (CLAUDE.md
guardrail). This §6b table is the authoritative screen→code map; that file is
the human-readable inventory behind it.

## 7. Environment / secrets inventory (names only — never values)

**`apps/api` (Wrangler secrets, `wrangler secret put <name>`):**
`SUPABASE_URL` (bare project URL, NOT the `/rest/v1/`-suffixed PostgREST
base — see Known Gaps/Mistakes), `SUPABASE_SERVICE_ROLE_KEY`,
`GUEST_TOKEN_SECRET` (HMAC key for guest tokens), `EMBED_SERVICE_TOKEN`
(Stage 2 — bearer secret shared with `packages/processing-pipeline`; **set
live** via `wrangler secret put`, but the value it needs to match on the
embedding-service side doesn't matter yet since that service isn't deployed
anywhere real — will need to be re-set/confirmed once it is).
`ADMIN_BACKFILL_TOKEN` (gates `POST /admin/backfill-embeddings`, see §4 —
write-only like every other Wrangler secret; re-set via `wrangler secret put`
if it needs to be used again and the value has been lost).

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

**`packages/processing-pipeline` (Cloud Run env var):** `EMBED_SERVICE_TOKEN` —
same value as the Worker secret above (both re-set together whenever rotated,
since Cloudflare secrets are write-only and can't be read back to confirm a
match), checked on every `/embed` call. Set via `--set-env-vars` at deploy
time, not Secret Manager — a deliberate simplification consistent with the
project's MVP scale, equivalent in practice to the Worker-secret model (not
exposed in logs, just an env var on the container).

**GCP project (`ouraforphotographers`):** hosts the Cloud Run service. A
dedicated deploy-time service account needs three IAM roles — Cloud Run
Admin, Artifact Registry Writer, Service Account User — plus the Cloud Run,
Cloud Build, and Artifact Registry APIs enabled on the project. Any session
redeploying this service needs a fresh service-account JSON key from the
founder (same one-time-credential pattern as the Supabase access token).

**`apps/web` (build-time, `.env.local` / CI env — these get INLINED into the
client bundle, so "secret" here just means "not committed," not "hidden from
the browser"):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(anon key is meant to be public — RLS is the real gate, not key secrecy).

## 8. Known gaps (honest, not oversights — see PRD.md for phase boundaries)

- **Face-matching pipeline (Stage 2) is fully live** — see §4/§4a. Real
  guests now go consent → selfie → gift-reveal → gallery, with actual
  InsightFace/ArcFace matching running on Cloud Run. Residual, honest
  caveats: (a) `CLUSTER_MATCH_THRESHOLD`/`GUEST_MATCH_THRESHOLD` are initial
  domain-convention guesses, not measured against real pilot-event data yet
  — they're `wrangler.toml` vars specifically so they can be tuned without a
  redeploy once real match-rate data exists; (b) legal basis: **resolved** —
  the founder confirmed the formal signed legal opinion has now been
  received (previously an informal draft only, from a lawyer-friend). PRD §8
  should be updated to reflect this the next time it's touched.
- **Photos ingested before Stage 2's enqueue-on-upload existed never get
  embedded on their own** — fixed operationally via `POST
  /admin/backfill-embeddings` (§4), which re-enqueues any photo not yet
  `embed_status:'done'`. Run once already against the live `WED-2024` set
  (2026-07-05): 17/17 photos re-enqueued, 15 processed to `done` cleanly
  (262 `face_embeddings` rows, 96 person clusters), 1 landed in a terminal
  `failed` state, 1 still hung past the embed-client's own timeout on retry
  (see next bullet and `MISTAKES.md`) — worth a follow-up check on that one
  photo specifically if it matters for a real pilot event. Any future
  manually-seeded/bulk-imported event needs this same backfill run once.
- **`embedClient.ts`'s `fetch()` had no timeout**, so a stalled Cloud Run
  response could hang a queue consumer invocation indefinitely instead of
  failing into the existing retry/DLQ path. Fixed with a 25s
  `AbortController` timeout (2026-07-05). One photo still hung past that
  timeout on retry during the live backfill above — if this recurs, the
  stall likely isn't only in the embed round-trip; the R2 `.get()` call and
  the Supabase `match_faces`/insert calls have no timeouts of their own
  either.
- ~~Guest tokens never expire~~ **Resolved and deployed (2026-07-06):**
  `guests.token_expires_at` (migration 0004, 90 days from creation) is
  live and enforced in `resolveGuest()`, verified against a real expired
  test token (§3). Tokens still travel in the URL path (loggable at
  edges/proxies) — that half of the original flag is a separate, larger
  fix, not attempted here.
- ~~No photographer password-reset flow.~~ **Resolved (2026-07-05):**
  `/forgot-password` + `/reset-password` ship a real self-service flow (§6).
- ~~Password-reset email link redirects to `localhost:3000`.~~ **Resolved
  (2026-07-06):** the live Supabase Auth config's `site_url` was actually
  already pointed at the production domain (not `localhost:3000` as
  earlier documented — someone/some session had partially fixed this
  without updating the docs), but `uri_allow_list` had a real typo bug —
  `.../reset-passwordto` instead of `.../reset-password` — so the redirect
  never matched the app's actual `redirectTo` and silently fell back to
  `site_url` (the homepage, not `/reset-password`). Fixed via
  `PATCH /v1/projects/:ref/config/auth` (`uri_allow_list`); reset-email
  sender is still Supabase's unbranded shared sender — that part (needs
  custom SMTP + a founder-owned domain) is separately tracked in
  `SUMMARY.md`, not resolved here.
- **AI Optimization admin screen is UI-only** — local React state, no real
  backend. (The guest Photo Editor is now real end-to-end — it loads a real
  photo and exports the adjusted + branded result client-side; there is
  deliberately no server-side persistence of guest edits, matching the
  login-free ephemeral guest model, so "UI-only" no longer applies to it.)
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
4. ✅ Deployed `packages/processing-pipeline` to Cloud Run (project
   `ouraforphotographers`, region `us-central1`, service `oura-embed`) —
   founder created a GCP project + billing + a deploy service account (whose
   IAM roles had to be added incrementally: Cloud Run Admin, Artifact
   Registry Writer, Service Account User) and handed a service-account JSON
   key to this session. Fixed a real Dockerfile bug along the way
   (`insightface`/`stringzilla` need a C/C++ compiler to build from source —
   moved to a multi-stage build with `build-essential` in the builder stage
   only). Deployed with `--no-allow-unauthenticated` first, then reverted to
   public+bearer-token auth once it became clear Cloud Run's own IAM layer
   would reject the Worker's calls before they reached the app (no VPC
   peering exists between Cloudflare and Cloud Run). CPU boost enabled to
   reduce cold-start latency while keeping `min-instances=0`. Updated
   `EMBED_SERVICE_URL` in `wrangler.toml` to the real host and
   `re-wrangler deploy`'d `apps/api`. Verified live end-to-end.
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
6. ✅ Flipped `/consent`'s redirect target from `/gallery` to `/selfie`, and
   confirmed `/selfie`'s confirm-submit routes to `/gift-reveal` (both
   "matched" and "still searching" outcomes) before landing on `/gallery`.
   Deployed and verified live end-to-end against throwaway test guests on
   the real `WED-2024` event. **Stage 2 is now fully live**, no remaining
   deploy steps.

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
- **A design screen gets wired/moved/renamed, or any file the Design-to-Code
  index (§6b) points to moves — update the §6b row in the SAME commit as the
  code move.** The index is only useful while it's exact; a stale path there is
  the same "debugging in the dark" failure this whole file exists to prevent.

`SUMMARY.md` stays the narrative "what's the current story" snapshot for
session continuity; this file is the structural reference — endpoints,
schema, auth model, deployment topology. They serve different purposes and
both need to stay accurate, not just one.

## 12. Vendor portability — what's actually locked in vs. not

Written because the founder asked for this to be genuinely easy later, not
hypothetically. No code was restructured to "future-proof" this — the
project is at pilot scale, and adding abstraction layers for a migration
that isn't happening yet would be pure complexity tax. This is an honest
audit of what's already portable by how it was built, and what specifically
would need real work, per service — a playbook for when/if it's needed.

**Cloud Run (embedding service) — easiest to move, already achieved.**
`packages/processing-pipeline` is a plain Docker container, configured
entirely by two env vars (`EMBED_SERVICE_URL`, `EMBED_SERVICE_TOKEN`). No
Google Cloud SDK or API is called from inside the app itself — FastAPI +
InsightFace, nothing GCP-specific. Moving to Fly.io, AWS Fargate, or any
Docker host: deploy the same `Dockerfile` there, update
`EMBED_SERVICE_URL` in `apps/api/wrangler.toml`, re-set
`EMBED_SERVICE_TOKEN` to match on both sides, `wrangler deploy`. No code
changes. What doesn't move: the GCP project/billing/service-account setup
itself (that's Google-specific account admin, not portable, just re-done
fresh on whichever platform is next).

**Supabase — the database is portable, the auth system is not.**
The schema (`supabase/migrations/*.sql`) is vanilla Postgres plus the
open-source `vector` (pgvector) and `pgcrypto` extensions — nothing
Supabase-proprietary in the tables themselves. A `pg_dump`/`pg_restore` to
any Postgres host with `pgvector` installed (Neon, RDS, self-hosted, even a
different Supabase-like provider) carries the schema and data over cleanly.
The genuinely sticky part is **Supabase Auth**: `events.photographer_id`
references `auth.users(id)`, and every RLS policy is keyed on `auth.uid()`
— a function Supabase's Auth layer provides, not a table you own. Leaving
Supabase Auth means: migrating photographer accounts to a new provider (or
standing up a parallel `photographers` table), rewriting every RLS policy
to key on a different identity mechanism (or moving ownership checks into
`requireEventOwner()` in application code instead of the database), and
replacing the `auth.getUser(token)` verification call in `apps/api`. The
`supabase-js`/PostgREST query style (`.from().select().eq()`) used
throughout is a thin, mechanically-rewritable layer over plain SQL — real
effort to swap, but not a deep architectural dependency like Auth is.

**Cloudflare (Workers, R2, Queues, Cron) — mixed.** Hono itself (the
`apps/api` framework) is not Cloudflare-specific — it runs on Node/Bun/Deno
too, and none of the route *logic* depends on Cloudflare. What's actually
Cloudflare-specific is the `Env` bindings: the `R2Bucket` interface, the
`Queue<T>` binding + `queue()` handler, and the `ScheduledController` cron
handler. None of these have a drop-in universal replacement:
- **R2 → any other storage**: R2 already speaks the S3 API at the protocol
  level, so the *data* is portable via any S3-compatible sync tool
  (`rclone`, `aws s3 sync`). The *code* uses R2's native Worker binding
  (`c.env.MEDIA.get(key)`), which would become a generic S3 SDK call if
  moving off Workers entirely — a small, mechanical rewrite, not a redesign.
  Worth flagging: R2's zero-egress pricing is *why* it was chosen (CLAUDE.md)
  — moving to a provider that charges egress reintroduces a real cost on
  read-heavy media serving, a genuine tradeoff, not just an engineering one.
- **Queues → any other queue**: Cloudflare Queues' batching/retry/DLQ model
  (`src/queueConsumer.ts`) doesn't have a universal equivalent — swapping to
  SQS, Cloud Tasks, or a Postgres-backed queue is real rework, not a config
  change.
- **Cron → any scheduler**: trivial to replace (any host's own cron, a
  GitHub Actions schedule, a hosted cron service) — `scheduledCleanup.ts`'s
  actual logic doesn't depend on Cloudflare at all.
- **`apps/web`**: the OpenNext Cloudflare adapter is the only
  Cloudflare-specific layer — the app underneath is a standard Next.js app.
  Dropping the adapter and deploying with plain `next build`/`next start`
  (or to Vercel, or any Node host) is straightforward; Next.js itself isn't
  what's locking this in.

**Bottom line for a future move:** Cloud Run is a non-event (already
designed to be swappable). Supabase's *database* is a non-event; Supabase
*Auth* is the one genuinely hard migration in this stack. Cloudflare is the
mixed case — R2 and Cron are cheap to leave, Queues is the real work, and
`apps/web` is barely tied to Cloudflare at all under the adapter.
