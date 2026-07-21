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

## Open PR — must deploy + QA before merging

**PR #107** (branch `claude/section-10-prints-qa-iys3c8`) — fixes bugs 1/2/3/5 below. Code-complete, TypeScript clean. NOT yet deployed to Cloudflare, NOT merged, NOT visually QA'd. Next session must: deploy (`wrangler deploy` for API, Cloudflare Pages/Workers for web), take a real Playwright screenshot of the live app confirming each fix, then merge.

## Open bugs — status after 2026-07-21 session

1. **Gallery crash when consent declined** — FIXED in PR #107 (code only, undeployed).
2. **Black photo preview in prints page (mobile)** — FIXED in PR #107 (code only, undeployed).
3. **"Add to cart" immediately places order** — FIXED in PR #107: buttons now say "הזמנת הדפסה עכשיו" (code only, undeployed).
4. **PDF receipt** — defer to Stripe phase, no fix needed now.
5. **Category misclassification + missing categories** — FIXED in PR #107: parseCat now returns 'dances'/'main_course'/'couple'; 'couple' chip added (code only, undeployed).
6. **Demo photos too few** — upload more photos via https://oura-web.oura-events.workers.dev/admin/upload. Manual data task, no code change needed.

## Key guardrails (NEVER violate)

- NEVER mutate `ofirdamr@gmail.com` auth credentials or send email to that address during testing
- Media binaries: R2 only
- Face-matching: NEVER before biometric consent
- Fonts: `--font-display` Latin-only; Rubik for Hebrew
- CSS: logical properties only (`ms-*`/`me-*`)
- Design is king: check `design/screens/` before coding any screen
- Update `docs/ARCHITECTURE.md` with any route/schema/auth change
