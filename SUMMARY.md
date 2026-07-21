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

## Open bugs — next session must fix these (root causes diagnosed)

1. **Gallery crash when consent declined** — `gallery/page.tsx` line 239 checks `data.personal_gallery.consent_required` in the RENDER without checking `?declined=1`. When user declines consent on the consent page, they go to `/gallery?declined=1` but the render shows the error screen. Fix: add `[declinedConsent, setDeclinedConsent]` state, set it inside the load() useEffect from the URL param, and use that state in the line-239 render check instead of reading the URL again (which doesn't work outside the effect). File: `apps/web/app/gallery/page.tsx`.

2. **Black photo preview in prints page (mobile)** — The mobile photo preview container at `premium-prints/page.tsx` line 115 is missing `relative` class. Next.js `<Image fill>` requires `position: relative` on the parent. Desktop container (line 286) already has `relative` and works. Fix: add `relative` to the mobile container div. File: `apps/web/app/premium-prints/page.tsx`.

3. **"Add to cart" immediately places order** — `handleOrder` in `premium-prints/page.tsx` calls the orders API and redirects to `/order-confirmation` on every button tap — there is no cart. Fix: rename both button labels from "הוספה לסל" / "הוספה לסל הקניות" to "הזמנת הדפסה עכשיו" so the label matches the real action. File: `apps/web/app/premium-prints/page.tsx`.

4. **PDF receipt** — defer to Stripe phase, no fix needed now.

5. **Category misclassification + missing categories** — `FESTIVE_CATEGORIES` in `gallery/page.tsx` has `ceremony`, `dances`, `reception`, `main_course`. The AI classification prompt in `apps/api/src/index.ts` needs to match these exact keys. Fix: grep for the classify prompt in index.ts and align category keys. Also add `"couple"` category for pre-wedding couple shots if it's missing from FESTIVE_CATEGORIES. File: `apps/api/src/index.ts` + `apps/web/app/gallery/page.tsx`.

6. **Demo photos too few** — upload more photos covering dancing/eating/celebration via the photographer dashboard at https://oura-web.oura-events.workers.dev/admin/upload. This is a manual data task, no code change needed.

## Key guardrails (NEVER violate)

- NEVER mutate `ofirdamr@gmail.com` auth credentials or send email to that address during testing
- Media binaries: R2 only
- Face-matching: NEVER before biometric consent
- Fonts: `--font-display` Latin-only; Rubik for Hebrew
- CSS: logical properties only (`ms-*`/`me-*`)
- Design is king: check `design/screens/` before coding any screen
- Update `docs/ARCHITECTURE.md` with any route/schema/auth change
