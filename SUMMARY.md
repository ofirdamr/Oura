# SUMMARY — Oura

**Read this first, then `docs/ARCHITECTURE.md` for structural detail.**

## Current state (2026-07-22)

We are in **§10 QA phase**. All 4 bug fixes from PR #107 are deployed and visually confirmed. Cloud Run memory fix (PR #120) is merged and live. CLIP 5-prompt ensembles + משפחה/אולם categories (PR #121) merged and deployed.

**Live URLs:**
- Frontend: https://oura-web.oura-events.workers.dev
- API: https://oura-api.oura-events.workers.dev
- Demo event: https://oura-web.oura-events.workers.dev/gallery-entry?code=WED-2024

---

## WED-2024 backfill re-run — confirmed (2026-07-22, post PR #128)

PR #128 (close-up ceremony prompts) → Cloud Run rebuilt and deployed (GH Actions run #29936381505, ~5 min). All 3 misclassified dances photos cleared to null. Full backfill ran: `updated:18, skipped:0`.

| | Post PR #125 | Post PR #128 (final) |
|---|---|---|
| ceremony | 8 (22.9%) | **23 (65.7%)** ✅ |
| couple | 7 (20.0%) | 7 (20.0%) |
| dances | 3 (8.6%) | 2 (5.7%) |
| family | 2 (5.7%) | 2 (5.7%) |
| main_course | 0 | 1 (2.9%) |
| null | 15 (42.9%) | **0** ✅ |

Close-up ceremony prompts work: ceremony rose from 8 → 23. 0 null photos remain (previously 15 were permanently null — all now classified with improved prompts). 2 remaining dances photos may be real dance shots or need further prompt tuning.

**To validate family/venue scores:** run backfill on a real multi-category event.

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

## Deployment status (2026-07-22, this session)

| Service | Last deployed | Code version |
|---|---|---|
| Cloud Run | 16:10 UTC | PR #128 (close-up ceremony prompts) ✅ |
| oura-api | 16:13 UTC (this session) | PR #123 (WHERE IS NULL backfill) ✅ |
| oura-web | 16:15 UTC (this session) | PR #121 (gallery chips 7 categories) ✅ |

## Open PRs

None. PRs #121–#128 all merged to main and deployed.

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
- Migration 0010 (`is_original_uploaded`): status unknown — never confirmed applied

### §10.2 Client-Side Extraction Engine
- Built and deployed (PR #92). Local screenshot only — not tested with real ZIP on live site.

### §10.3 Smart Crop & Social Framing
- Cloud Run redeployed with 4Gi memory (PR #120). Social export endpoint should work now that models load.

### §10.4 E-Commerce & Print Shop
- Built and deployed (PRs #94, #95). Migration 0011 status: never independently verified.

### §10.5 DB Schema
- Migration 0011: unverified. Migration 0012 (7-category CHECK constraint): applied ✅ verified 2026-07-22.

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
- Print order flow end-to-end
- Admin print queue dashboard
- Stage 2 original upload (migration 0010 status unknown)
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
