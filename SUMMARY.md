# SUMMARY — Oura

**Read this first, then `docs/ARCHITECTURE.md` for structural detail.**

## Current state (2026-07-22)

We are in **§10 QA phase**. The 4 bug fixes from PR #107 are deployed and visually confirmed. The Cloud Run memory fix (PR #120) is now merged.

**Live URLs:**
- Frontend: https://oura-web.oura-events.workers.dev
- API: https://oura-api.oura-events.workers.dev
- Demo event: https://oura-web.oura-events.workers.dev/gallery-entry?code=WED-2024

---

## Bug fix QA — confirmed live with real screenshots (2026-07-22)

Screenshots committed to `qa/screenshots/`:

1. **Gallery crash when consent declined** — CONFIRMED ✅  
   Gallery opens, shows 34 general photos, no crash.  
   Test: https://oura-web.oura-events.workers.dev/gallery-entry?code=WED-2024 → tap "לא תודה"

2. **Black photo preview in prints page (mobile)** — CONFIRMED ✅  
   Wedding photo displays correctly in the preview area.

3. **"הזמנת הדפסה עכשיו" button label** — CONFIRMED ✅  
   Correct text shown, not "הוספה לסל".

4. **Category chips** — Code correct (keys: `dances`/`main_course`/`couple`). Chips show in gallery UI.  
   **PENDING:** backfill must re-run to actually classify the 35 photos with correct categories.

---

## Cloud Run status (2026-07-22)

**Root cause found:** previous deploy used default 512MB memory — not enough for InsightFace + CLIP ViT-B/32. All backfill calls got 503 `models_loading` → 35 photos skipped.

**Fix merged (PR #120):** `--memory 4Gi --cpu 2` added to deploy command. A new deploy was triggered via workflow_dispatch at ~06:55 UTC on branch `claude/oura-deploy-backfill-qa-jro02z`. PR #120 is now merged to main.

**Next session must:**
1. Check if the workflow_dispatch deploy completed (run ID from ~06:55 UTC on the branch).
2. Poll `https://oura-embed-932309994000.us-central1.run.app/health` until `{"ok":true}`.
3. Re-run backfill: `POST https://oura-api.oura-events.workers.dev/admin/events/WED-2024/backfill-categories` with `Authorization: Bearer Oura-backfill-2026`.
4. Confirm `updated > 0` in the response.
5. Screenshot the live gallery showing category chips actually filtering photos.
6. Update this file.

A `send_later` reminder fires at 07:10 UTC in the current session — if that session is still alive, it will handle steps 1-4 automatically.

---

## §10 Build Status — honest accounting

### §10.1 Two-Stage Upload Pipeline
- Migration 0010 (`is_original_uploaded`): status unknown — never confirmed applied

### §10.2 Client-Side Extraction Engine
- Built and deployed (PR #92). Local screenshot only — not tested with real ZIP on live site.

### §10.3 Smart Crop & Social Framing
- Cloud Run redeployed with 4Gi memory (PR #120). Social export endpoint should work once models load.

### §10.4 E-Commerce & Print Shop
- Built and deployed (PRs #94, #95). Migration 0011 status: SUMMARY previously said "applied" — never independently verified.

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

## What has NEVER been verified live end-to-end

- Category chip filtering (backfill not yet successfully run)
- Social export / §10.3 (Cloud Run was broken until today)
- Print order flow end-to-end
- Admin print queue dashboard
- Stage 2 original upload (migration 0010 status unknown)

## Open PRs

None — PR #120 merged (2026-07-22).

## Key guardrails (NEVER violate)

- NEVER mutate `ofirdamr@gmail.com` auth credentials or send email to that address during testing
- Media binaries: R2 only
- Face-matching: NEVER before biometric consent
- Fonts: `--font-display` Latin-only; Rubik for Hebrew
- CSS: logical properties only (`ms-*`/`me-*`)
- Design is king: check `design/screens/` before coding any screen
- Update `docs/ARCHITECTURE.md` with any route/schema/auth change
