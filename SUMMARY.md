# SUMMARY — Oura

**Read this first, then `docs/ARCHITECTURE.md` for structural detail.**

## Current state (2026-07-23, post-Mission B)

We are in **§10 architecture finalization**. All 4 bug fixes from PR #107 deployed and verified. Cloud Run memory fix (PR #120) live. CLIP classifier (PR #121) live. **Stage 2 upload + Tier-1 download merged to main (PRs #134 + #135, 2026-07-23).** Backlog is clean — no unmerged feature PRs remaining.

**Mission B (Test Data) + login scroll fix — MERGED & LIVE (PR #136, 2026-07-23):**
- 3 test orders in `Ready_For_Photographer_Print` state via `scripts/create-test-orders.mjs` (Test Guest 1 print_10x15 ×1, Test Guest 2 magnet ×2, Test Guest 3 photo_book ×1). Print queue: https://oura-web.oura-events.workers.dev/admin/print-queue
- **Login `/login` phantom-scroll bug FIXED & DEPLOYED LIVE.** Root cause: `min-h-screen` (100vh) > iOS visible viewport → empty scrollable band below the card. Fix: `min-h-[100dvh]` + `justify-center`. Verified live: `qa/screenshots/login-scroll-fix-mobile.png` (full page = exactly one viewport, card centered). https://oura-web.oura-events.workers.dev/login

**⚠️ WEB APP DEPLOYS ARE MANUAL — this is why past "fixed" claims weren't live.** There is NO CI auto-deploy for the frontend. A merge to `main` does NOT reach the live site. To deploy the web app: `cd apps/web && npm ci && npm run deploy` (Cloudflare creds are in env; deploy takes ~2 min; poll a chunk URL for 200 after, CDN lags a few seconds). Same for the API (`apps/api`). Only Cloud Run auto-builds via GH Actions.

**Parked thread (founder decision pending):** Manual photo-category corrections for the WED-2024 demo event were done directly in the live DB (3 bride/getting-ready shots ceremony→couple: `8cb9a140`, `56c00816`, `9368f886`; group shot `f144fec9` family→ceremony). Founder wants to come back and (a) upload the FULL wedding (not just 35 test photos) to properly test categorization at scale, and (b) add a one-tap "move photo to another category" control in the gallery — that control is a **design change → must go through Stitch first** (do not freehand).

**Classification roadmap (PRs #131–#132, draft, not ready for merge):** ViT-L/14 model upgrade + burst-clustering + one-tap correction UI (PR #131 + #132). PR #131 says "NOT yet live-verified" — needs Cloud Run ≥6Gi redeploy. PR #132 depends on #131. On hold pending founder review of classification approach.

**§10 migration status CONFIRMED LIVE via direct DB introspection (2026-07-23):** migrations 0010 (`photos.is_original_uploaded` + `photos.storage_keys`), 0011 (`orders` table w/ `fulfillment_type` + `order_status` enums), and 0012 (7-category CHECK) are ALL applied. `orders` now holds 6 test orders: 3 at `Awaiting_High_Res_Asset` (original batch), 3 at `Ready_For_Photographer_Print` (Mission B). Stage-2 auto-release trigger now testable. Note: schema landed on tables `photos`/`orders` (not `media_assets` as PRD §10.5 draft named); `focal_point_x/y` columns are NOT present on `photos` (smart-crop focal storage gap to confirm).

**Live URLs:**
- Frontend: https://oura-web.oura-events.workers.dev
- API: https://oura-api.oura-events.workers.dev
- Demo event: https://oura-web.oura-events.workers.dev/gallery-entry?code=WED-2024

---

## WED-2024 backfill re-run — confirmed (2026-07-22, post PR #125)

Backfill ran manually after Cloud Run redeploy. Category breakdown shifted as expected:

| | Before | After |
|---|---|---|
| ceremony | 30 (85.7%) | **8 (22.9%)** ✅ |
| couple | 5 (14.3%) | **7 (20.0%)** ✅ |
| dances | 0 | 3 (8.6%) |
| family | 0 | 2 (5.7%) |
| null | 0 | 15 (42.9%) |

**15 permanently null photos** — fail identically on two consecutive backfill passes (empty debug log both times, meaning they fail before R2 fetch completes or before CLIP returns). Root cause: either orphaned DB records with no R2 file, or photos exceeding the Cloudflare Worker 6MB subrequest limit. Not a classification bug. These 15 need a separate R2 audit to confirm which.

**`משפחה` and `אולם` register real scores.** Lower confidence on WED-2024 expected — event has only ceremony/couple photos.

**To validate high family/venue scores:** run backfill on a real multi-category event (family portraits, venue decor shots).

---

## Bug fix QA — confirmed live with real screenshots (2026-07-22)

Screenshots committed to `qa/screenshots/`:

1. **Gallery crash when consent declined** — CONFIRMED ✅
2. **Black photo preview in prints page (mobile)** — CONFIRMED ✅
3. **"הזמנת הדפסה עכשיו" button label** — CONFIRMED ✅
4. **Category chips** — CONFIRMED ✅ (keys: `dances`/`main_course`/`couple`/`ceremony`/`reception`/`family`/`venue`)

---

## Cloud Run status (2026-07-22) — FIXED
PR #120 merged. Memory 4Gi/2 CPU. Health: `{"ok":true,"models":["buffalo_l","clip-ViT-B-32"]}`.
**Note:** Cloud Run scales to zero — first call after idle takes 30–90s for models to load. Poll health before running backfill.

---

## Open PRs

**Draft (not ready for merge):**
- **PR #131:** ViT-L/14 classification + QA report. Says "NOT yet live-verified" — needs Cloud Run ≥6Gi redeploy.
- **PR #132:** Burst+clustering + one-tap correction UI. Depends on #131 + ≥6Gi Cloud Run.

**Merged to main (2026-07-23):**
- PR #134: Stage 2 sync dashboard UI
- PR #135: Tier-1 download + privacy/egress docs
- PR #133: DB state verification + WED-2024 corrections

## Migration 0012 — applied ✅

`photos_category_check` constraint live with all 7 values: `ceremony`, `couple`, `dances`, `reception`, `main_course`, `family`, `venue`. Verified 2026-07-22.

---

## Two open product gaps

### 1. Classification is NOT real-time
Currently, category classification only runs via manual backfill POST. For production: needs wiring into the upload pipeline (Cloudflare Queue → Cloud Run classify on each photo after face-embed).

### 2. CLIP confidence low on ceremony-only events
WED-2024 is a ceremony/couple event — all scores cluster in 0.15–0.34 range. Real confidence separation (e.g., 0.5+ for family on a family-portrait event) needs a multi-category real event to validate.

---

## §10 Build Status — honest accounting

### §10.1 Two-Stage Upload Pipeline
- Migration 0010 (`is_original_uploaded` + `storage_keys`): APPLIED ✅ confirmed live 2026-07-23
- Stage 1 (venue): ✅ Working — client compresses, uploads web-optimized, defaults `is_original_uploaded = false`
- **Stage 2 (studio) dashboard UI: ✅ BUILT (PR #134, merged 2026-07-23)** — photographers sync originals via file picker
- Backend endpoint (`PUT /events/:event_id/photos/:photo_id/original`): ✅ Implemented & functional
- Auto-release trigger: NOT tested end-to-end (3 test orders still `Awaiting_High_Res_Asset`)

### §10.2 Client-Side Extraction Engine
- Built and deployed (PR #92). Local screenshot only — not tested with real ZIP on live site.

### §10.3 Smart Crop & Social Framing
- Cloud Run redeployed with 4Gi memory (PR #120). Social export endpoint should work now that models load.

### §10.4 E-Commerce & Print Shop
- **VERIFIED LIVE (2026-07-23)** ✅
- Built and deployed (PRs #94, #95). `orders` table LIVE with fulfillment routing; 3 test orders confirmed at Ready_For_Photographer_Print state.
- **Mark-as-printed workflow verified end-to-end:** API endpoint accessible, order status updates to Completed, marked_printed_at timestamp set correctly. Database state changes persist. RLS authorization enforces photographer ownership.
- Test verification: `qa/screenshots/print-queue-verification-report.png` shows before/after states of print queue with successful status transition.

### §10.5 DB Schema
- Migrations 0010, 0011, 0012 ALL applied ✅ confirmed live 2026-07-23. Gap: `focal_point_x/y` not present on `photos` (§10.3 smart-crop focal storage to confirm).

---

## What is actually known to work (verified by real screenshots)

- Photographer sign-up / login
- Create event, upload branding logo
- Face-matching pipeline
- Guest flow: QR → consent → selfie → gift reveal → personal gallery
- Gallery full-screen photo viewer
- Gallery opens without crash after declining consent ✅
- Premium prints page: photo preview renders, button label correct ✅
- Category chips display and respond to taps in gallery ✅
- Cloud Run classification model loads and runs ✅
- Backfill endpoint: WHERE category IS NULL working ✅ — all 7 categories including משפחה/אולם score

## What has NEVER been verified live end-to-end

- Real-time classification on upload (not yet built)
- Social export / §10.3 (Cloud Run fixed but endpoint not QA'd)
- Stage 2 original upload (photographer sync of originals)
- Category filtering with a real multi-category event

## Key guardrails (NEVER violate)

- NEVER mutate `ofirdamr@gmail.com` auth credentials or send email to that address during testing
- Media binaries: R2 only
- Face-matching: NEVER before biometric consent
- Fonts: `--font-display` Latin-only; Rubik for Hebrew
- CSS: logical properties only (`ms-*`/`me-*`)
- Design is king: check `design/screens/` before coding any screen
- Update `docs/ARCHITECTURE.md` with any route/schema/auth change
- Never give up after one failed attempt — check env, retry, poll
