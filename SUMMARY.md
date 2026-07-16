# SUMMARY — Oura

**Read this first, then `docs/ARCHITECTURE.md` for structural detail and `PROGRESS.md` for history.**

## ✅ DONE 2026-07-15 — Personal gallery: guest name, event name, AI match % badges (PR #48, merged to main)

Three design gaps confirmed missing from the `personal_gallery_desktop/mobile` Stitch screens are now wired:
- Guest name in headline: "הגלריה האישית של {name}" (falls back to "הגלריה האישית שלך" when no name stored)
- Subtitle: "הבינה המלאכותית שלנו זיהתה X רגעים מושלמים מתוך Y תמונות באירוע '{event name}'"
- Per-photo match badge: numeric "96% ✓" (top-start corner, RTL) replacing the old text label

API change: `resolveGuest` now selects `display_name`; `GET /gallery/:token` returns `guest_display_name`.
Deployed: oura-api `e0adc7ac`, oura-web `6cf389ef`. PR #48 merged to main. Live: https://oura-web.oura-events.workers.dev/gallery

## ✅ DONE 2026-07-15 — Photo Editor edit persistence (PR #47, deployed + merged)

Guest photo adjustments (brightness, contrast, rotation, etc.) now persist per guest + photo in localStorage. PR #47 merged.

## ✅ DONE 2026-07-15 — PR #45 merged (dashboard fidelity)

Dashboard 3 stat cards + AI widget + tip card. PR #45 merged to main.

**Open PRs:** #16 (doc trim, conflicts in 5 files), #4 (universal-framework trim, 1-file conflict), #7 (MISTAKES.md corrections, 1-file conflict).

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

## ✅ DONE 2026-07-15 — Gallery Theme Selector wired end-to-end (PR #50, deployed)

All three layers wired:
- **Branding page**: "ערכת נושא לגלריה" picker (חגיגי / מינימל / שלי) saves to `events.gallery_theme`. Desktop + mobile layouts both have the picker.
- **API** `GET /gallery/:token`: now selects + returns `gallery_theme` in the event object.
- **Gallery page**: renders three distinct experiences:
  - Festive: 2-col grid, event-type filter chips (כל התמונות/חופה/קבלת פנים/מסיבה), mobile hero image
  - Minimal: editorial grid (2-col header row + 3-col body), STORY COLLECTION badge, photo count
  - Personal (שלי): existing 3-col square grid, unchanged

PR #50 merged to main.

## ✅ DONE 2026-07-16 — Festive gallery photo fix + filter chips (PR #59, merged)

- Festive theme now shows guest's personal matched photos (not all event photos)
- Filter chips (כל התמונות/חופה/קבלת פנים/מסיבה) are wired — clicking changes active state and filters photos
- Full MVP acceptance walk passed. Deployed `10cb402d`.

## ⚠️ KNOWN PRE-EXISTING ISSUE — Admin dashboard 500

`/admin/dashboard` and `/admin/events` return HTTP 500 because `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are not baked into the build at deploy time. This predates the current fixes — the middleware throws because it can't init the Supabase client. Next deploy touching admin routes must set these env vars in the build environment first.

## ✅ DONE 2026-07-15 — Auth callback loop fix (PR #51, merged to main)

Fixed infinite redirect loop on `/auth/callback` route. PR #51 merged.

## ✅ DONE 2026-07-15 — Gallery zero-match UX fixes (PR #54, open — ready to merge)

When face-matching returns 0 personal photos: subtitle now says "מחפשים אותך ב-N תמונות" instead of "מצאנו 0 תמונות שלך" (which contradicted the "עדיין מחפשים" card). Buttons now say "שמירת כל התמונות" / "שיתוף כל התמונות" instead of "שלי" when no matches.

## ✅ ROOT CAUSE FOUND + FIXED — selfie→gallery 0-match bug (branch `claude/selfie-gallery-match-debug-sodiv7`, PR pending founder deploy)

**The REAL root cause (token was a red herring — it's synced now, embed works).** Proven live on WED-2024: a fresh guest whose selfie matches an already-claimed face cluster gets `matched:true` but **0 gallery photos**. Why: the guest↔photo link was a **single-owner** stamp (`face_embeddings.guest_id`), but the match is **many-to-many** — the same person makes multiple guest sessions (re-scan, new device, incognito, lost session). The selfie UPDATE was guarded with `or(guest_id.is.null, guest_id.eq.self)`, so once the FIRST session claimed a cluster, every LATER session matched but updated 0 rows → its gallery (filtered by its own guest_id) showed 0. Founder's repeated incognito tests each = a new guest_id; the first claimed the clusters, the rest got "0 מתוך 17".

**Fix (migration 0008 + code):** new many-to-many `guest_photo_matches (guest_id, photo_id, event_id, match_similarity)` join table. Selfie upserts one row per matched photo; gallery reads from it filtered by guest_id; retention cron deletes the guest's join rows. `face_embeddings.guest_id` is now vestigial. API typecheck clean. This is exactly the "future hardening" `docs/ARCHITECTURE.md` §4a already prescribed.

**Verified live:** backend match path works end-to-end (submitting a real event face as a selfie → matched + appears in that guest's gallery, up to 9 cross-photo matches; threshold 0.35 is fine). The single-owner collision is the sole remaining defect and this fix removes it.

**Worker DEPLOYED this session** (version `ea58ade8`) — the sandbox HAS Cloudflare deploy creds (`CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`, but BOTH have stray whitespace — `tr -d '[:space:]'` them before `wrangler deploy` or you get code 6111/7003). So future API deploys can be done from the session; no founder terminal needed. New code is live but INERT until migration 0008 is applied (gallery personal query returns empty, selfie upsert 500s → frontend proceeds — no regression, still "0 matches" until then).

**ACTION REQUIRED (founder — clicks only, sandbox canNOT apply DDL: only SERVICE_ROLE_KEY present, no Supabase management/access token, PostgREST can't run DDL):**
1. Apply migration 0007: paste `supabase/migrations/0007_gallery_theme_personal.sql` at https://supabase.com/dashboard/project/voxxhvywzaizyputjqkm/sql/new → Run
2. Apply migration 0008: paste `supabase/migrations/0008_guest_photo_matches.sql` at the same page → Run

**TEST after both:** https://oura-web.oura-events.workers.dev/gallery-entry?code=WED-2024 (each fresh incognito selfie now gets its own matches — no more "first one wins").

**Note:** migration 0007 (`0007_gallery_theme_personal.sql`) — confirm whether it was ever applied; apply if not.

## ⏭️ NEXT MVP MISSION — (to be decided per PRD order)

**Navigation gaps — RESOLVED** (as of PR #43, merged to main):
- `/admin/qr-management` sidebar link: done (AdminShell navItems includes `ניהול QR`)
- Event-detail "view QR" link: done (`/admin/qr-management?event_id=…` already in event-detail page)
- Dead sidebar items (`ארכיון אירועים`, `לקוחות VIP`): render as non-clickable Phase 2 placeholders — intentional
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
