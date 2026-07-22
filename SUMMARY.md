# SUMMARY — Oura

**Read this first, then `docs/ARCHITECTURE.md` for structural detail.**

## Current state (2026-07-22)

We are in **§10 QA phase**. PR #121 (CLIP 5-prompt ensembles + משפחה/אולם categories) merged and Cloud Run redeploy triggered. **Migration 0012 pending** — must be applied manually in Supabase dashboard before backfill.

**Live URLs:**
- Frontend: https://oura-web.oura-events.workers.dev
- API: https://oura-api.oura-events.workers.dev
- Demo event: https://oura-web.oura-events.workers.dev/gallery-entry?code=WED-2024

---

## Bug fix QA — confirmed live with real screenshots (2026-07-22)

Screenshots committed to `qa/screenshots/`:

1. **Gallery crash when consent declined** — CONFIRMED ✅  
   Gallery opens, shows 34 general photos, no crash.

2. **Black photo preview in prints page (mobile)** — CONFIRMED ✅  
   Wedding photo displays correctly in the preview area.

3. **"הזמנת הדפסה עכשיו" button label** — CONFIRMED ✅  
   Correct text shown.

4. **Category chips** — CONFIRMED ✅  
   - Code correct (keys: `dances`/`main_course`/`couple`/`ceremony`/`reception`)
   - Chips show in gallery UI and respond to tap (chip highlights in orange)
   - Backfill ran: `{"updated":13,"skipped":22,"total":35}`
   - 13 photos classified: ~8 ceremony, 5 couple, 1 dances, 2 main_course
   - 22 skipped: below 0.20 CLIP confidence threshold
   - **Note:** test event (WED-2024) only has ceremony/couple photos — ריקודים and מנה עיקרית chips correctly show 0 results because those photo types were never uploaded to this test event

---

## Cloud Run status (2026-07-22) — FIXED

PR #120 merged. Deploy completed with `--memory 4Gi --cpu 2`. Health: `{"ok":true,"models":["buffalo_l","clip-ViT-B-32"]}`.

---

## Open PRs

None.

---

## Two open product gaps (next session must address)

### 1. Classification is NOT real-time
Currently, category classification only runs via manual backfill POST. For production: when a photographer uploads 100-500 photos, guests should see them categorized immediately. Classification needs to be wired into the upload pipeline (Cloudflare Queue → Cloud Run classify on each photo after face-embed). **This is not yet implemented.**

### 2. CLIP confidence is low on the test event
The 22 skipped photos scored similarly across all categories (all scores 0.15-0.25). This is because the test event only has ceremony-type photos — a real wedding with dancing, dinner, etc. would produce clearer signals. Before shipping, test backfill on a real multi-category event.

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
- Migration 0011: unverified

---

## What is actually known to work (verified by real screenshots)

- Photographer sign-up / login
- Create event, upload branding logo
- Face-matching pipeline
- Guest flow: QR → consent → selfie → gift reveal → personal gallery
- Gallery full-screen photo viewer
- Gallery opens without crash after declining consent ✅ (2026-07-22)
- Premium prints page: photo preview renders, button label correct ✅ (2026-07-22)
- Category chips display and respond to taps in gallery ✅ (2026-07-22)
- Cloud Run classification model loads and runs ✅ (2026-07-22)

## What has NEVER been verified live end-to-end

- Real-time classification on upload (not yet built)
- Social export / §10.3 (Cloud Run fixed but endpoint not QA'd)
- Print order flow end-to-end
- Admin print queue dashboard
- Stage 2 original upload (migration 0010 status unknown)
- Category filtering with a real multi-category event

## Open PRs

None.

## Key guardrails (NEVER violate)

- NEVER mutate `ofirdamr@gmail.com` auth credentials or send email to that address during testing
- Media binaries: R2 only
- Face-matching: NEVER before biometric consent
- Fonts: `--font-display` Latin-only; Rubik for Hebrew
- CSS: logical properties only (`ms-*`/`me-*`)
- Design is king: check `design/screens/` before coding any screen
- Update `docs/ARCHITECTURE.md` with any route/schema/auth change
