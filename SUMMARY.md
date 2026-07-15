# SUMMARY — Oura

**Read this first, then `docs/ARCHITECTURE.md` for structural detail and `PROGRESS.md` for history.**

## ✅ DONE 2026-07-15 — Personal gallery: guest name, event name, AI match % badges (PR #48, deployed)

Three design gaps confirmed missing from the `personal_gallery_desktop/mobile` Stitch screens are now wired:
- Guest name in headline: "הגלריה האישית של {name}" (falls back to "הגלריה האישית שלך" when no name stored)
- Subtitle: "הבינה המלאכותית שלנו זיהתה X רגעים מושלמים מתוך Y תמונות באירוע '{event name}'"
- Per-photo match badge: numeric "96% ✓" (top-start corner, RTL) replacing the old text label

API change: `resolveGuest` now selects `display_name`; `GET /gallery/:token` returns `guest_display_name`.
Deployed: oura-api `e0adc7ac`, oura-web `6cf389ef`. **PR #48** (`claude/next-mvp-mission-ftbaja`, draft, open). Live: https://oura-web.oura-events.workers.dev/gallery

## ✅ DONE 2026-07-15 — Photo Editor edit persistence (PR #47, deployed + merged)

Guest photo adjustments (brightness, contrast, rotation, etc.) now persist per guest + photo in localStorage. PR #47 merged.

## ✅ DONE 2026-07-15 — PR #45 merged (dashboard fidelity)

Dashboard 3 stat cards + AI widget + tip card. PR #45 merged to main.

**Open PRs:** #48 (personal gallery content — this session, watching), #16 (doc trim, conflicts in 5 files), #4 (universal-framework trim, 1-file conflict), #7 (MISTAKES.md corrections, 1-file conflict).

## ✅ DONE 2026-07-14 — /admin/ai-optimization wired to real data (PR #42, deployed + merged)

`GET /admin/processing-status` added. Returns real stats, polls every 10s. PR #42 merged. Live: https://oura-web.oura-events.workers.dev/admin/ai-optimization

## ✅ DONE 2026-07-14 — /guest-landing wired to real data (PR #38, deployed)

Real event name, studio logo, first 4 photos in preview grid. PR #38 open (draft). Live: https://oura-web.oura-events.workers.dev/guest-landing

## ✅ DONE 2026-07-14 — create-event modal header RTL fixed (PR #40, merged + deployed)

Desktop/mobile bottom-sheet header DOM order corrected (title right, close-X left). PR #40 merged.

## Current state: working MVP, live, including Stage 2 face-matching

A photographer can: sign up → log in → create an event → brand it (real R2 logo upload) → upload photos → get a scannable QR → find the event in a real event list. A guest scanning that QR sees a branded gallery, goes through biometric consent → real selfie capture → real self-hosted face-matching → gift-reveal → personal gallery with their matched photos, name headline, event name, and per-photo AI match % badges. All deployed and verified live.

**Live URLs:**
- Frontend: https://oura-web.oura-events.workers.dev
- API: https://oura-api.oura-events.workers.dev
- Embedding service: Cloud Run, project `ouraforphotographers`, service `oura-embed`

**Demo event:** code `WED-2024`, 17 real wedding photos. Entry: https://oura-web.oura-events.workers.dev/gallery-entry?code=WED-2024

## ⏭️ NEXT SESSION — next MVP missions in PRD order

1. **Merge PR #48** (personal gallery content — code deployed, typecheck clean, no CI). Then the personal gallery screen is fully faithful to the Stitch design.
2. **Navigation gaps** (from `docs/ARCHITECTURE.md` §6b known gaps):
   - `/admin/qr-management` has no sidebar link — unreachable from the nav after create/brand flow
   - 3 dead admin sidebar links: `ארכיון אירועים`, `לקוחות VIP`, `ניתוח נתונים` (Phase 2 — decide: hide or stub)
   - Guest Landing Page `/join` is unwired (`/` redirects to `/gallery-entry`, bypassing it)
3. **Demo-readiness / first-run empty state** — a brand-new photographer account has no events/photos so the app looks empty when shown to prospects. Options: seed a sample event on signup, or polish empty states.
4. **Resolve conflicted PRs #16, #4, #7** in a dedicated trim session (doc-only, but stale).

**Founder standing directive:** follow PRD order, don't jump to prints/gifts. You (PM/assistant) pick the next mission — don't ask the founder to choose. Every "done" ships with the clickable live link.

## What's real vs. not

Real end-to-end: entire guest path (Stage 2 face-matching live), entire photographer onboarding, event list, dashboard, photo delete, AI Optimization panel, photo editor persistence, personal gallery (name + event + match badges).

Deliberately not real yet: `/join`/`/festive-gallery`/`/minimal-gallery` (static UI, superseded or unused), Premium Prints/Checkout/Order Confirmation (Phase 2), Statistics/Messaging/Notifications/Reports (Phase 2).

## Known Supabase Auth gap

Reset email sends from Supabase's shared sender, not "Oura." Needs custom SMTP + a real transactional email provider + a domain the founder controls. **Waiting on founder to register a domain and pick a name.** Recommended path: Cloudflare Registrar + Resend free tier.

## Key guardrails (NEVER violate)
- NEVER mutate `ofirdamr@gmail.com` auth credentials. Use throwaway accounts for auth testing.
- Media binaries: R2 only, never Supabase storage.
- Face-matching: NEVER before biometric consent gate.
- Fonts: `--font-display` (Hanken Grotesk) for Latin-only branding only; Rubik (`--font-sans`) for all Hebrew.
- CSS: logical properties only (`ms-*`/`me-*`/`ps-*`/`pe-*`), never physical `ml-*`/`mr-*`.
- Design is king: check `design/screens/<name>/screen.png` before coding any screen. All 42 screens exist.
- Update `docs/ARCHITECTURE.md` in the same commit as any route/schema/auth/deployment change.
