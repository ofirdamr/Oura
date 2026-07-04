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
/packages/processing-pipeline  face-embed, culling, transcode, overlay compositing — DOES NOT EXIST YET
/packages/shared                shared TS types/schemas — DOES NOT EXIST YET
/design                         Stitch export, 42 reference screens + brand spec — REAL, source of truth for UI
/supabase/migrations             SQL migrations, applied via the Management API — REAL
/docs/ARCHITECTURE.md            this file
```

`CLAUDE.md`'s repo-layout diagram lists `/packages/processing-pipeline` and
`/packages/shared` as if they're standing directories — they are not; there
is no `/packages` directory in this repo at all as of this writing. They're
the intended home for Stage 2's face-embedding/culling/transcode pipeline
once it's built (self-hosted compute, per CLAUDE.md, on Fly.io/Cloud Run —
deliberately never a Cloudflare Worker, since that workload is heavy CPU/ML,
not request/response). Don't go looking for code there; there isn't any yet.

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

Key tables (see the migration files for full column lists/constraints):

- **`events`** — `id, photographer_id (→auth.users, NOT NULL), name, status
  ('draft'|'live'|'archived'), gallery_theme ('festive'|'minimal'), branding
  jsonb, code text (unique when set), created_at, updated_at`. `branding`
  jsonb currently holds `{ frame, primary_color, auto_watermark, logo_key,
  studio_name }` — no fixed schema, additive by convention.
- **`guests`** — one row per event-scoped guest session. `token_hash` only
  (SHA-256 of the opaque token) — the raw token is never stored.
- **`photos`** — `id, event_id, storage_key (R2 key), status, width, height,
  bytes, content_type, phash, captured_at, created_at`. No binary data —
  `storage_key` is the only pointer to R2.
- **`face_embeddings`** — `pgvector(512)`, HNSW cosine index, `person_id`
  (cluster id) + `guest_id` (nullable link once a guest's consented selfie
  matches). **Unpopulated** — Stage 2 (the face pipeline) hasn't been built.
- **`biometric_consents`** — one row per guest who has consented.
  `retention_expires_at` is deliberately nullable with no default — the
  retention policy is an open legal question (PRD §8), not decided in code.

## 4. Guest-facing API (`apps/api`, service-role, bypasses RLS)

All routes below live in `apps/api/src/index.ts`. None require photographer
auth — they're the guest path, gated only by the opaque token.

| Route | Purpose |
|---|---|
| `GET /health` | Liveness + binding/secret presence check (never leaks values) |
| `POST /events/:event_id/guests` | Issues a fresh opaque guest token for an event. Generates `guest_id` server-side, stores only `SHA-256(token)`. |
| `GET /gallery/:token` | Verifies token, returns general event photos (always) + `personal_gallery` — `{consent_required:true}` pre-consent with **zero** face-data read, or `{consent_required:false, photos}` post-consent. `face_embeddings` is only ever queried in the consented branch — this is the CLAUDE.md consent-gate guardrail, enforced in code, not just in the UI. |
| `POST /consent/:token` | Records biometric consent. Idempotent (`unique(guest_id)`, returns `already:true` on repeat). `retention_expires_at` left NULL. |
| `GET /media/*` | Streams an R2 object by key (catch-all path, not a named param, so embedded `/` in keys survive). `Cache-Control: immutable` since keys are content-addressed per upload. |
| `GET /events/by-code/:code` | Resolves a human event code (e.g. `WED-2024`) to an `event_id`. Powers manual code entry and `?code=` QR deeplinks. |

**Opaque guest token format:** `base64url(JSON{event_id,guest_id,iat}).base64url(HMAC-SHA256)`,
signed/verified via Web Crypto in `apps/api/src/token.ts` (`signGuestToken`/
`verifyGuestToken`/`tokenHash`) — no JWT library. Constant-time verification.
The token never expires today (see Known Gaps) and travels in the URL path.

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
`GUEST_TOKEN_SECRET` (HMAC key for guest tokens).

**`apps/api` (R2 binding, `wrangler.toml`):** `MEDIA` → bucket `ouramedia`.

**`apps/web` (build-time, `.env.local` / CI env — these get INLINED into the
client bundle, so "secret" here just means "not committed," not "hidden from
the browser"):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(anon key is meant to be public — RLS is the real gate, not key secrecy).

## 8. Known gaps (honest, not oversights — see PRD.md for phase boundaries)

- **Face-matching pipeline (Stage 2) doesn't exist.** `face_embeddings` is
  never written to. The personal gallery honestly shows "still searching for
  you," not fake matches. Blocked on PRD §8's biometric legal review, which
  is deferred (founder's explicit call, not yet started).
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
