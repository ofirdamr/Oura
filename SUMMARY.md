# SUMMARY — Oura

**Read this first, then `docs/ARCHITECTURE.md` for structural detail.**

## Current state (2026-07-23)

We are in **§10 QA phase**. Full honest §10 accounting is in **`docs/SECTION-10-QA-REPORT.md`** (read it — it supersedes the scattered notes below). All 4 bug fixes from PR #107 are deployed and visually confirmed. Cloud Run memory fix (PR #120) merged and live.

### ⚠️ Classification — approach changed this session (2026-07-23)
Three prompt-tweak attempts (PRs #121/#128/#130) failed because tuning was **blind** (no labeled ground-truth) on **ViT-B/32** (the weakest CLIP), judging each photo **in isolation**. This session shipped the two structural levers instead: **model ViT-B/32 → ViT-L/14** + prompts rebuilt on the founder's real cues (white chuppah canopy = ceremony tie-breaker; family/couple require non-canopy backdrop). **NOT verified accurate** — cannot measure without live Supabase + redeployed Cloud Run.

### 🧭 FOUNDER DECISIONS (2026-07-23) — locked, honor going forward
Model is **free either way** (self-hosted CLIP, no per-call cost) — the "paying for a higher model" worry is unfounded. Founder was asked to trade speed for accuracy and **chose accuracy**: categorization can lag guest viewing (guests see photos immediately, uncategorized; categories fill in a few minutes later). He accepts ~5–6 min for ~150 photos and ~15 min for ~500. So:
- **KEEP the bigger/more-accurate model (ViT-L/14 in PR #131) — do NOT revert.** Speed is no longer a blocker. May even go bigger if accuracy improves. Still needs Cloud Run ≥6Gi to avoid OOM.
- **BUILD the burst+visual clustering layer** (roadmap #4) — still free, boosts accuracy.
- **BUILD photographer one-tap correction** (roadmap #5), APPROVED: photographer reassigns a mis-categorized photo to the correct category from the dashboard. This delivers the "100% feeling" to guests AND accuracy confidence to the photographer. Rare 1–2 misses acceptable as long as he can fix them fast.

### 🔴 FOUNDER ACTIONS NEEDED (re-surface every session until done)
1. **Label the ~35 WED-2024 photos** into correct categories — this is the scoreboard; blind tuning is why we looped 3×.
2. **Raise Cloud Run memory to ≥6Gi and redeploy** the pipeline so ViT-L/14 loads without OOM (currently 4Gi).
3. **Decide category list:** 4 (founder's model: ceremony/family/אולם/couple) vs 7 (current).

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

None. PRs #121, #122, #123 all merged to main.

## Migration 0012 — applied ✅

`photos_category_check` constraint live with all 7 values: `ceremony`, `couple`, `dances`, `reception`, `main_course`, `family`, `venue`. Verified 2026-07-22.

---

## Two open product gaps

### 1. Classification accuracy (see report + founder actions above)
Correction to earlier note: classification **IS** wired real-time (`queueConsumer.ts:138`, after face-embed) **and** via backfill. The open problem is **accuracy**, not wiring. Also: **Stage 2 original-tier upload endpoint exists but is NOT called by the web app** — originals are never uploaded today (see report §1).

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
