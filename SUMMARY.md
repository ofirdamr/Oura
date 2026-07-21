# SUMMARY — Oura

**Read this first, then `docs/ARCHITECTURE.md` for structural detail.**

## Current state (2026-07-21)

Working MVP live end-to-end:
- Photographer: sign up → login → create event → brand it (logo upload) → upload photos (ZIP or loose, client-side extraction + compression) → QR code
- Guest: scan QR → biometric consent → selfie → face-match → gift reveal → personal gallery with name/event/AI match badges → save/share photos → order premium prints
- All deployed and verified live

**Live URLs:**
- Frontend: https://oura-web.oura-events.workers.dev
- API: https://oura-api.oura-events.workers.dev
- Demo event: https://oura-web.oura-events.workers.dev/gallery-entry?code=WED-2024

## Open PRs

None — all clear.

## PRD progress

- §10.1 Two-Stage Upload Pipeline: ✅
- §10.2 Extraction Engine: ✅
- §10.3 Smart Crop/Social Export: ✅
- §10.4 E-Commerce/Print Shop (guest flow): ✅ | Admin Print Queue: ✅
- §10.5 DB Schema: ✅ (migration 0011 applied)

## What's real vs. not

Real end-to-end: full guest path (face-matching), full photographer flow, print order placement, admin print queue.
Not real yet: payment processing (Stripe Phase 2), checkout flow, Premium Prints revenue/Statistics/Messaging (Phase 2).

## Recent fixes (2026-07-21)

- Gallery category chips filter correctly; consent decline redirects properly; print size/preview pickers work
- Face recognition sweep cron (`*/5 * * * *`) now recovers stuck/pending embeds automatically — no more silent batch failures
- `expandGuestMatches` links later-uploaded photos to returning guests on gallery reopen

## Open bugs found in manual QA (2026-07-21) — next session must fix these

1. **Gallery entry crash** — skipping selfie and going to general gallery throws an error (founder has screenshot)
2. **Black photo preview in prints page** — the preview window shows no image, just black
3. **"Add to cart" wrongly shows "order accepted"** — adding to cart/bucket triggers an order-confirmation message; cart and order are not properly separated (cart should not place an order)
4. **PDF receipt download broken** — expected for now (no real receipt yet); defer to Stripe phase
5. **Category misclassification** — ceremony photos land in reception; no dancing/eating category; couple-before-wedding photos not in their own category
6. **Demo photos too few** — only ~17 photos; need many more covering dancing, eating, celebration, so all categories populate correctly

## Key guardrails (NEVER violate)

- NEVER mutate `ofirdamr@gmail.com` auth credentials or send email to that address during testing
- Media binaries: R2 only
- Face-matching: NEVER before biometric consent
- Fonts: `--font-display` Latin-only; Rubik for Hebrew
- CSS: logical properties only (`ms-*`/`me-*`)
- Design is king: check `design/screens/` before coding any screen
- Update `docs/ARCHITECTURE.md` with any route/schema/auth change
