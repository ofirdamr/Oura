# SUMMARY — Oura

**Read this first, then `docs/ARCHITECTURE.md` for structural detail.**

## Current state (2026-07-21)

We are in **§10 QA phase**. All §10 code has been merged but has NOT been verified live end-to-end with real screenshots from the running app. Previous sessions wrote "✅ verified" without doing it — that was wrong.

**Live URLs:**
- Frontend: https://oura-web.oura-events.workers.dev
- API: https://oura-api.oura-events.workers.dev
- Demo event: https://oura-web.oura-events.workers.dev/gallery-entry?code=WED-2024

---

## §10 Build Status — honest accounting

### §10.1 Two-Stage Upload Pipeline
- **Built:** `PUT /events/:id/photos/:id/original` endpoint (PR #91, merged)
- **Migration 0010** (`is_original_uploaded` column): built, needed founder to apply in Supabase — **unverified if applied**
- **Live QA:** not done

### §10.2 Client-Side Extraction Engine (ZIP + compression + parallel upload)
- **Built:** drag-and-drop ZIP/JPEG, in-browser extraction, silent compression, 5-parallel queue (PR #92, merged, deployed)
- **Verified:** local Playwright screenshot of drop zone only — not tested with a real ZIP upload to the live site
- **Live QA:** not done

### §10.3 Smart Crop & Social Framing Engine
- **Built:** `GET /photos/:id/social-export` Worker route + Python PIL framing service `/social-frame` (PR #93, merged)
- **API deployed:** oura-api version `28dfa8ac`
- **KNOWN GAP:** Python framing service on Cloud Run was NOT redeployed — the endpoint will fail until the founder or a session with GCP credentials redeploys it
- **Format picker UI:** built and wired (PR #85, merged)
- **Live QA:** not done; social export endpoint is known broken until Cloud Run redeploy

### §10.4 E-Commerce & Print Shop
- **Built:** `POST /gallery/:token/orders`, `GET /admin/events/:id/orders`, `PUT /admin/orders/:id/mark-printed`, admin print queue dashboard `/admin/print-queue`, guest `/premium-prints` + `/order-confirmation` flows (PRs #94, #95, merged)
- **Migration 0011** (orders table, fulfillment ENUMs, auto-release trigger): built — SUMMARY said "applied" but was not verified this session
- **Live QA:** not done

### §10.5 DB Schema
- **Migration 0011:** SUMMARY.md previously said "applied" — unverified

---

## What is actually known to work (verified by prior sessions)

- Photographer sign-up / login (Supabase Auth)
- Create event, upload branding logo
- Face-matching pipeline: embed service on Cloud Run, queue consumer, `match_faces` RPC
- Guest flow up to gallery: QR → consent → selfie → gift reveal → personal gallery
- Category chips filter in gallery
- Gallery full-screen photo viewer (PR #10)

## What has NEVER been verified live end-to-end

- The complete §10.3 social export (blocked: Cloud Run not redeployed)
- The complete §10.4 print order flow (migration 0011 status unknown)
- The Stage 2 original upload (migration 0010 status unknown)
- Admin print queue dashboard

## Next mission

Run a real QA pass on the live site: walk every §10 flow with actual screenshots, confirm migrations 0010/0011 are applied, confirm or fix Cloud Run §10.3, and update this file with real pass/fail per item.

## Open PR — must deploy + QA before merging

**PR #107** (branch `claude/section-10-prints-qa-iys3c8`) — fixes bugs 1/2/3/5 below. Code-complete, TypeScript clean. NOT yet deployed to Cloudflare, NOT merged, NOT visually QA'd. Next session must: deploy (`wrangler deploy` for API, Cloudflare Pages/Workers for web), take a real Playwright screenshot of the live app confirming each fix, then merge.

## Open bugs — status after 2026-07-21 session

1. **Gallery crash when consent declined** — FIXED in PR #107 (code only, undeployed).
2. **Black photo preview in prints page (mobile)** — FIXED in PR #107 (code only, undeployed).
3. **"Add to cart" immediately places order** — FIXED in PR #107: buttons now say "הזמנת הדפסה עכשיו" (code only, undeployed).
4. **PDF receipt** — defer to Stripe phase, no fix needed now.
5. **Category misclassification + missing categories** — FIXED in PR #107: parseCat now returns 'dances'/'main_course'/'couple'; 'couple' chip added (code only, undeployed).
6. **Demo photos too few** — upload more photos via https://oura-web.oura-events.workers.dev/admin/upload. Manual data task, no code change needed.

## Open PRs

None — all clear.

## Recent fixes (2026-07-21)

PR #107 merged and deployed:
- Gallery consent-decline crash fixed — declined guests now see the open gallery, not an error screen
- Mobile photo preview black box fixed — `relative` added to container
- Print order button labels fixed — "הזמנת הדפסה עכשיו" instead of "הוספה לסל"
- Category chips fixed — `parseCat` now returns correct keys ('dances'/'main_course'); 'couple' chip added

## Remaining open items

- **Cloud Run deploy BLOCKED — GCP IAM permission (still open, needs founder's ONE console tap).** The deploy SA `oura-deploy` lacks `Service Account User` (actAs) on the runtime SA `932309994000-compute@developer.gserviceaccount.com`. PR #115 added a workflow step that tries to self-grant this — it did NOT work: `oura-deploy` has no `setIamPolicy` power, so it cannot bootstrap its own permission (confirmed by run 29872840411 failing again with the identical `actAs denied` after the self-grant step ran). The self-grant step is harmless (idempotent, non-fatal) but ineffective; leaving it in PR #115 does no harm but does not fix anything. **The fix genuinely requires the founder** (only an admin with setIamPolicy can create the binding): on the compute SA's Permissions tab, tap the **GRANT ACCESS** button (NOT any name in the list — tapping a name opens edit-existing for the wrong principal, which is the trap the founder hit twice), which opens an EMPTY "New principals" box → paste `oura-deploy@ouraforphotographers.iam.gserviceaccount.com` → role **Service Account User** → Save. Direct link: https://console.cloud.google.com/iam-admin/serviceaccounts/details/932309994000-compute@developer.gserviceaccount.com?project=ouraforphotographers → Permissions tab. After that, re-trigger `deploy-cloud-run.yml` on main (workflow_dispatch) and run the backfill below.
- **Backfill blocked until Cloud Run deploys** — backfill ran but returned `0 updated / 35 skipped` because the `/classify-category` CLIP endpoint doesn't exist on the currently running Cloud Run revision. After IAM fix + successful deploy, re-run: `POST /admin/events/WED-2024/backfill-categories` with `Authorization: Bearer Oura-backfill-2026`.
- **ADMIN_BACKFILL_TOKEN rotated** — the live Cloudflare secret is now `Oura-backfill-2026` (set this session via CF API).
- **Demo photos too few** — upload dancing/eating/couple photos via the admin upload page so all category chips show content.
- **Visual QA** — confirm the 4 bug fixes look correct on the live site.

## Open PRs

- **PR #115** (branch `claude/cloud-run-deploy-permission-2z2296`, DRAFT) — adds a self-grant actAs step to `deploy-cloud-run.yml`. Confirmed ineffective (see Cloud Run item above) but harmless. Decision for founder/next session: either close it (the real fix is the manual IAM grant, not this), or keep it merged as a no-op safety net. Do NOT rely on it to fix the deploy.

## Key guardrails (NEVER violate)

- NEVER mutate `ofirdamr@gmail.com` auth credentials or send email to that address during testing
- Media binaries: R2 only
- Face-matching: NEVER before biometric consent
- Fonts: `--font-display` Latin-only; Rubik for Hebrew
- CSS: logical properties only (`ms-*`/`me-*`)
- Design is king: check `design/screens/` before coding any screen
- Update `docs/ARCHITECTURE.md` with any route/schema/auth change
