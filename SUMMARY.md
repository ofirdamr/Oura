# SUMMARY — Oura

**Read this first, then `docs/ARCHITECTURE.md` for structural detail.**

## Current state (2026-07-21)

Working MVP live end-to-end:
- Photographer: sign up → login → create event → brand it (logo upload) → upload photos (ZIP or loose, client-side extraction + compression) → QR code
- Guest: scan QR → biometric consent → selfie → face-match → gift reveal → personal gallery with name/event/AI match badges → save/share photos → **order premium prints**
- All deployed and verified live

**Live URLs:**
- Frontend: https://oura-web.oura-events.workers.dev
- API: https://oura-api.oura-events.workers.dev
- Demo event: https://oura-web.oura-events.workers.dev/gallery-entry?code=WED-2024

## Open PRs

None — all clear.

## ✅ DONE 2026-07-21 — Face recognition never ran on later upload batches (permanent fix, deployed)

Root cause: the inline enqueue-on-upload in `POST /events/:id/photos` is best-effort; when a queue send is lost (transient error / consumer death mid-batch), photos strand at `embed_status:'pending'` with zero face rows forever and no retry. Real incident: all 18 WED-2024 second-batch photos sat unprocessed for days → guests saw none of them.
- **Permanent fix (all photographers/guests, forever):** the `*/5 * * * *` cron now also runs `sweepStuckEmbeds` — atomically claims any `pending` photo and re-enqueues it, plus recovers `processing` stuck >1h. Every uploaded batch is now recognized within minutes even if its inline enqueue failed.
- **Guest side:** `expandGuestMatches` on every gallery read links photos that joined the guest's own clusters after their scan (leak-proof per-cluster ownership test — bystander clusters excluded), so later batches appear on reopen.
- Old WED-2024 backlog cleared via one-time backfill; deployed to `oura-api`.

## ✅ DONE 2026-07-21 — §10.4B Admin Print Queue Dashboard (PR #96, merged to main)

Photographer admin screen `/admin/print-queue`:
- Orders grouped by print format (מגנט, הדפסה 10×15, בלוק עץ, ספר תמונות)
- Status filter chips (הכל / ממתין לקובץ / מוכן להדפסה / הושלם) with live counts
- WhatsApp reminder modal: 3 Hebrew templates, live preview, opens wa.me link
- CSV export of filtered view, sync button, mark-printed action
- RTL logical properties throughout; mobile card layout
- Design files (screen.png) are real Stitch exports — designed together with founder in Stitch session.

## ✅ DONE 2026-07-20 — §10.4 Premium Prints & Order Confirmation (PR #95)

Guest-facing print order flow wired end-to-end:
- PhotoViewer: new print button → `/premium-prints?photo_id=…&photo_url=…&token=…`
- premium-prints page: fully interactive (size/paper/frame pickers, live price, calls `POST /gallery/:token/orders`)
- order-confirmation page: shows real order_id and today's date from URL params
- API: `POST /gallery/:token/orders`, `GET /admin/events/:id/orders`, `PUT /admin/orders/:id/mark-printed` — all live
- Migration 0011 (orders table, fulfillment ENUMs, auto-release trigger, RLS) — already applied

**Admin Print Queue:** `/admin/print-queue` — built and live (PR #96, merged). See §10.4B entry above.

## ✅ DONE 2026-07-19 — §10.3 Smart Crop & Social Export (PR #94, merged)

9:16 story framing engine: blurred backdrop + centered subject + watermark. Social export endpoint + guest share bottom sheet. Deployed.

## ✅ DONE 2026-07-19 — §10.2 Client-side upload engine (PR #92, deployed)

ZIP extraction in-browser, browser-image-compression, 5-parallel queue with retries. Single progress bar.

## ✅ DONE 2026-07-19 — LLaVA photo category labeling fixed (PR #82, merged)

All 17 WED-2024 photos correctly labeled (ceremony). Gallery category chips work.

## ✅ DONE 2026-07-21 — Gallery UX fixes (PRs #75 + #83, merged)

Festive category chips now show correct Hebrew labels (ריקודים, מנה עיקרית) and filter the full event gallery. Mobile save now opens blob in new tab as fallback when Web Share v2 not available. Save/share buttons restored to in-page position (not fixed bottom). Regression from `category` column fix deployed.

**NOTE:** `category` column not yet in DB — chips will filter correctly once migration 0012 (adds `category` to photos table) is applied. Chip "כל התמונות" works now; others show 0 results until then.

## ✅ DONE 2026-07-18 — Password reset fully immune to Brevo click-tracking (PR #71, merged)

Confirm-gate on `/reset-password` page prevents token burn by Brevo's pre-scan. Verified e2e.

## PRD progress

- §10.1 Two-Stage Upload Pipeline: ✅ (migration 0010, Stage 2 sync button)
- §10.2 Extraction Engine: ✅
- §10.3 Smart Crop/Social Export: ✅
- §10.4 E-Commerce/Print Shop (guest flow): ✅ | Admin Print Queue: ✅ live
- §10.5 DB Schema: ✅ (migration 0011 applied)

## What's real vs. not

Real end-to-end: full guest path (face-matching), full photographer flow, print order placement.
Not real yet: payment (Stripe Phase 2), checkout flow, Premium Prints/Statistics/Messaging (Phase 2).

## Key guardrails (NEVER violate)
- NEVER mutate `ofirdamr@gmail.com` auth credentials
- Media binaries: R2 only
- Face-matching: NEVER before biometric consent
- Fonts: `--font-display` Latin-only; Rubik for Hebrew
- CSS: logical properties only (`ms-*`/`me-*`)
- Design is king: check `design/screens/` before coding any screen
- Update `docs/ARCHITECTURE.md` with any route/schema/auth change
