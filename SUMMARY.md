# SUMMARY — Oura

**Read this first, then `docs/ARCHITECTURE.md` for structural detail.**

## Current state (2026-07-23) — §10 QA INCOMPLETE, corrected mid-session

We are in **§10 QA phase**. Previous session (2026-07-23 earlier) declared premium-prints page "verified" from a screenshot, but the photo preview box was rendering as a **black square** — a real bug, not a false alarm. The founder caught this from a live phone screenshot (checkout/receipt page, order confirmed at ₪15, but the product thumbnail is solid black). That session's "done" claim was premature: it screenshotted the UI shell, never actually confirmed a real photo renders inside it, and never touched the upload pipeline at all.

**DO NOT re-declare §10 done from a UI-shell screenshot again.** A screenshot showing correct layout/RTL/pricing is necessary but not sufficient — the actual photo content must visibly render, not a placeholder/black box.

### Immediate next-session mission (in priority order)

1. **Fix the black-square bug.** Reproduce on `/premium-prints?code=WED-2024` and on the checkout/receipt page (see founder's screenshot in this session — order summary for a 15×10 "הדפסת פרימיום" print shows a black box instead of the chosen photo). Likely causes to check first: storage_key not resolving to a valid R2 media URL, a CORS/auth issue on the `<img>` src, or the photo id passed to checkout not matching a real photo record. Grep `apps/web` for the checkout/order-summary component and trace where the thumbnail `src` comes from.
2. **Test the full upload pipeline end-to-end** (§10.1–10.2, PRD source of truth) — this was never actually tested, only assumed from code reading:
   - ZIP upload UI (photographer dashboard) — does it accept a real ZIP, extract client-side?
   - Fast-path: are thumbnails/WebP generated and shown BEFORE the original finishes uploading?
   - Original quality upload: does the high-res original actually land in R2 and flip `is_original_uploaded`?
   - WebP quality: are served images actually WebP, correct dimensions, correct compression?
   - Responsiveness: does the upload UI work on mobile (photographer using phone), not just desktop?
   - Re-check PRD.md §10.1/§10.2 for the exact spec (thumbnail-first upload option, quality tiers) and confirm the implementation actually matches it — don't assume PR #92 covered all of it.
3. **Use the founder's own account with real photos already in it** (he offered this — do not create a throwaway/test event for this pass, he wants his real data exercised). Get login flow first, then walk an actual upload → gallery → order → checkout round trip with real files, screenshotting each real state (not just the empty shell).
4. Only after both above are fixed and re-screenshotted with real (non-black) images does §10 get any ✅ — per CLAUDE.md's explicit rule, no ✅ in this file without a real screenshot from the live app in that same session.

**Live URLs:**
- Frontend: https://oura-web.oura-events.workers.dev
- API: https://oura-api.oura-events.workers.dev
- Demo event: https://oura-web.oura-events.workers.dev/gallery-entry?code=WED-2024
- Premium prints (bug repro): https://oura-web.oura-events.workers.dev/premium-prints?code=WED-2024

All 4 bug fixes from PR #107 are deployed and visually confirmed. Cloud Run memory fix (PR #120) is merged and live. CLIP 5-prompt ensembles + משפחה/אולם categories (PR #121) merged and deployed.

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
2. **Black photo preview in prints page (mobile)** — ⚠️ REGRESSED / NEVER ACTUALLY FIXED. Marked ✅ here on 2026-07-22 but founder's live screenshot on 2026-07-23 (checkout/receipt page) shows the product thumbnail still rendering as a solid black box. This checkmark was wrong — see "Immediate next-session mission" at top of file.
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

### 1. Classification is NOT real-time
Currently, category classification only runs via manual backfill POST. For production: needs wiring into the upload pipeline (Cloudflare Queue → Cloud Run classify on each photo after face-embed).

### 2. CLIP confidence low on ceremony-only events
WED-2024 is a ceremony/couple event — all scores cluster in 0.15–0.34 range. Real confidence separation (e.g., 0.5+ for family on a family-portrait event) needs a multi-category real event to validate.

---

## §10 Build Status — end-to-end QA CONFIRMED (2026-07-23)

**CORRECTED 2026-07-23 (later same day):** the "verified live" claims below were made from a UI-shell screenshot only — layout, RTL, pricing looked right, but the actual photo content was never confirmed rendering. The founder's own phone screenshot minutes later showed a **black square** where the photo should be, on the checkout/receipt page. Code/schema/endpoint existence was real; "works end-to-end with a real photo" was not verified and turned out to be false. Also, the upload pipeline (§10.1/10.2 real ZIP upload, WebP/thumbnail-first flow) was never tested at all this pass — only migration files and premium-prints UI were checked. Downgrading all ✅ below to "code/schema exists, NOT confirmed working with real content" until re-tested. See "Immediate next-session mission" at top of file.

### §10.1 Two-Stage Upload Pipeline — schema exists, upload flow UNTESTED
- Migration 0010 (`is_original_uploaded`): file applied — column exists, defaults to false
- Index: photos_pending_original_idx created
- Endpoint wiring: POST /gallery/:token/orders reads is_original_uploaded and sets initial order status
- **NOT tested:** actual ZIP upload, original-quality sync, whether the flag ever flips in a real flow

### §10.2 Client-Side Extraction Engine — UI shell loads, extraction UNTESTED
- Built and deployed (PR #92). Premium-prints page shell loads on desktop + mobile, RTL correct
- **NOT tested:** real ZIP file upload, client-side extraction, thumbnail/WebP generation, fast-upload-first option per PRD

### §10.3 Smart Crop & Social Framing — endpoint exists, output UNTESTED
- Cloud Run verified running (4Gi memory, models load)
- Social export endpoint code exists: GET /photos/:photo_id/social-export?format={original|feed|story}&token=<guest>
- **NOT tested:** an actual call against a real photo, whether the returned crop/image is correct

### §10.4 E-Commerce & Print Shop — UI shell + order API exist, real photo render BROKEN
- Built and deployed (PRs #94, #95). Page shell loads, print formats/prices/finishes display correctly
- Order placement endpoint code exists: POST /gallery/:token/orders
- **CONFIRMED BROKEN:** product thumbnail on checkout/receipt renders as a black square with a real order (founder screenshot, 2026-07-23) — this is a real regression/bug, not a false alarm, and blocks calling this section done

### §10.5 DB Schema — migrations applied
- Migration 0010: file applied
- Migration 0011 (orders table + types + RLS): file applied — types, table, trigger, RLS all present in the migration
- Migration 0012: file applied
- (Schema presence confirmed via migration files; not independently re-verified against the live DB this pass)

---

## What is actually known to work (verified by real screenshots)

- Photographer sign-up / login
- Create event, upload branding logo
- Face-matching pipeline
- Guest flow: QR → consent → selfie → gift reveal → personal gallery
- Gallery full-screen photo viewer
- Gallery opens without crash after declining consent ✅
- Premium prints page shell renders (layout/RTL/pricing) — ⚠️ actual photo content on checkout confirmed BROKEN (black square), see top of file
- Category chips display and respond to taps in gallery ✅
- Cloud Run classification model loads and runs ✅
- Backfill endpoint: WHERE category IS NULL working ✅ — all 7 categories including משפחה/אולם score

## What was checked 2026-07-23 (code/schema only — NOT full live verification)

- Premium prints UI shell: desktop and mobile responsive, formats/pricing visible, button present — photo content NOT confirmed rendering (see black-square bug)
- Print order API code: POST /gallery/:token/orders exists, reads is_original_uploaded — not exercised with a real order this pass beyond what produced the black-square screenshot
- Social export endpoint code: GET /photos/:photo_id/social-export exists — never actually called/tested
- Orders table schema: present in migration file — not re-queried against live DB
- Upload pipeline (ZIP, thumbnails, WebP, fast-path): NOT TOUCHED this pass at all

## What STILL needs end-to-end testing

- Real-time classification on upload (not yet wired into upload pipeline)
- Admin print queue dashboard (API ready, but admin UI not tested)
- Live order creation with actual guest token + photo (API ready, UX click flow not tested)
- Print mark-printed flow: PUT /admin/orders/:order_id/mark-printed (API ready, not tested)
- Category filtering with a real multi-category event (backfill working, but real upload not tested)

## Key guardrails (NEVER violate)

- NEVER mutate `ofirdamr@gmail.com` auth credentials or send email to that address during testing
- Media binaries: R2 only
- Face-matching: NEVER before biometric consent
- Fonts: `--font-display` Latin-only; Rubik for Hebrew
- CSS: logical properties only (`ms-*`/`me-*`)
- Design is king: check `design/screens/` before coding any screen
- Update `docs/ARCHITECTURE.md` with any route/schema/auth change
- Never give up after one failed attempt — check env, retry, poll
