# SUMMARY — Oura

**Read this first, then `docs/ARCHITECTURE.md` for structural detail.**

## Current state (2026-07-20)

Working MVP live end-to-end:
- Photographer: sign up → login → create event → brand it (logo upload) → upload photos (ZIP or loose, client-side extraction + compression) → QR code
- Guest: scan QR → biometric consent → selfie → face-match → gift reveal → personal gallery with name/event/AI match badges → save/share photos → **order premium prints**
- All deployed and verified live

**Live URLs:**
- Frontend: https://oura-web.oura-events.workers.dev
- API: https://oura-api.oura-events.workers.dev
- Demo event: https://oura-web.oura-events.workers.dev/gallery-entry?code=WED-2024

## Open PRs

- **PR #95** (`claude/oura-prd-10-5-jvo389`) — §10.4 Premium Prints wired to real API, deployed oura-web `0deb2597`. Ready to merge.
- **PR #83** — adds ריקודים chip to festive gallery filter (small fix, ready to merge)
- **PR #75** — gallery UX fixes (save/share bar, chips), draft
- **PR #16, #4, #7** — old doc PRs with conflicts, low priority

## ✅ DONE 2026-07-20 — §10.4 Premium Prints & Order Confirmation (PR #95)

Guest-facing print order flow wired end-to-end:
- PhotoViewer: new print button → `/premium-prints?photo_id=…&photo_url=…&token=…`
- premium-prints page: fully interactive (size/paper/frame pickers, live price, calls `POST /gallery/:token/orders`)
- order-confirmation page: shows real order_id and today's date from URL params
- API: `POST /gallery/:token/orders`, `GET /admin/events/:id/orders`, `PUT /admin/orders/:id/mark-printed` — all live
- Migration 0011 (orders table, fulfillment ENUMs, auto-release trigger, RLS) — already applied

**NOT built:** Admin Print Queue dashboard (`/admin/print-queue`) — no Stitch design exists. Per project rules, must get design from founder before building.

## ✅ DONE 2026-07-19 — §10.3 Smart Crop & Social Export (PR #94, merged)

9:16 story framing engine: blurred backdrop + centered subject + watermark. Social export endpoint + guest share bottom sheet. Deployed.

## ✅ DONE 2026-07-19 — §10.2 Client-side upload engine (PR #92, deployed)

ZIP extraction in-browser, browser-image-compression, 5-parallel queue with retries. Single progress bar.

## ✅ DONE 2026-07-19 — LLaVA photo category labeling fixed (PR #82, merged)

All 17 WED-2024 photos correctly labeled (ceremony). Gallery category chips work.

## ✅ DONE 2026-07-18 — Password reset fully immune to Brevo click-tracking (PR #71, merged)

Confirm-gate on `/reset-password` page prevents token burn by Brevo's pre-scan. Verified e2e.

## PRD progress

- §10.1 Two-Stage Upload Pipeline: ✅ (migration 0010, Stage 2 sync button)
- §10.2 Extraction Engine: ✅
- §10.3 Smart Crop/Social Export: ✅
- §10.4 E-Commerce/Print Shop (guest flow): ✅ | Admin Print Queue: ❌ needs Stitch design
- §10.5 DB Schema: ✅ (migration 0011 applied)

## What's real vs. not

Real end-to-end: full guest path (face-matching), full photographer flow, print order placement.
Not real yet: payment (Stripe Phase 2), admin print queue dashboard, checkout flow, Premium Prints/Statistics/Messaging (Phase 2).

## Key guardrails (NEVER violate)
- NEVER mutate `ofirdamr@gmail.com` auth credentials
- Media binaries: R2 only
- Face-matching: NEVER before biometric consent
- Fonts: `--font-display` Latin-only; Rubik for Hebrew
- CSS: logical properties only (`ms-*`/`me-*`)
- Design is king: check `design/screens/` before coding any screen
- Update `docs/ARCHITECTURE.md` with any route/schema/auth change
