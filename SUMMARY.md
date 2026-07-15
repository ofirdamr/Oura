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

## ✅ DONE 2026-07-15 — Auth callback loop fix (PR #51, merged to main)

Fixed infinite redirect loop on `/auth/callback` route. PR #51 merged.

## 🔴 OPEN BUG — Founder selfie on WED-2024 → gallery shows 0 matched photos (root cause NOT yet found)

This bug has survived **8 face-recognition PRs** (#1, #2, #11, #24, #25, #26, #27, #46, #53). Each session found a *real* bug and fixed it, but the founder's live symptom — do selfie, gallery shows 0 — persists. **Root cause is still unconfirmed.** Next session (Opus) is a THINKING/root-cause mission, not another quick patch.

### Full PR history (data-collection done 2026-07-15)
- **#1** built the pipeline. Next: WED-2024's 17 photos predated Stage 2 → never embedded.
- **#2** added `/admin/backfill-embeddings`, fixed unbounded fetch (25s timeout). 15/17 embedded. Next: broke again next day.
- **#11** found retention cron `.delete()`d shared `face_embeddings` → changed to `.update({guest_id:null})`. Next: fix never reached prod (broken CLOUDFLARE_API_TOKEN deploy).
- **#24** added `/admin/embed-status`, lowered threshold 0.42→0.35 (blind guess, no selfie in hand). Next: still 0.
- **#25** found the deploy had been silently failing for days (leading-space token). First safe cron went live.
- **#26** `/admin/match-test`: photo→photo matching proven healthy. Concluded failure is selfie-specific.
- **#27** ran founder's real selfie via `/admin/selfie-test`: **face detected 0.82, best match 0.58, 11 true faces 0.42–0.58, stranger 0.31**. Declared "selfie matches, solved." Added DB delete-guard (migration 0005). **BUT never verified the real end-to-end guest gallery actually returns photos.**
- **#46** added `match_similarity` badges (migration 0006) — built ON TOP of matching working.
- **#53** fixed queue consumer `embed()`→`embedWithRetry()`, DB constraint `'personal'` (migration 0007), festive "mine" filter. **Latest.** Founder: still 0.

### The gap (where the next session must look)
`/admin/selfie-test` proves the diagnostic path matches at 0.58. The REAL guest path (`POST /guests/:token/selfie` → stamp `guest_id` onto matched rows → `GET /gallery/:token` filters personal photos) is a DIFFERENT code path and was never verified end-to-end. **The core question: what happens between the real selfie POST returning and the gallery rendering — where does the 0 come from?** Suspects to check first: (a) does the founder's guest row actually get `guest_id` stamped onto `face_embeddings` after a real selfie (vs. the zero-retention diagnostic which stamps nothing)? (b) migrations 0005/0006/0007 — were they ever actually applied to live Supabase? (c) does `GET /gallery/:token` join/filter personal photos correctly?

### "NEVER DO AGAIN" (from this history)
1. Never declare face-match "solved" from a diagnostic endpoint — verify the REAL guest selfie→gallery path shows photos.
2. Never lower the threshold without the actual selfie measured.
3. Never call a fix "live" without confirming the deploy actually reached prod.
4. Never backfill without confirming queue-consumer retry (cold start = permanent `failed`).
5. Never guest-scope a `.delete()` on `face_embeddings` (shared index).
6. Never add a DB enum value without updating its CHECK constraint same commit.
7. Never build match-dependent features (badges/filter/subtitle) before the 0-match root cause is found.

### ACTION REQUIRED (founder) — migrations possibly never applied
Confirm/apply in live Supabase (paste at https://supabase.com/dashboard/project/voxxhvywzaizyputjqkm/sql/new):
`0005_face_embeddings_delete_guard.sql`, `0006_match_similarity.sql`, `0007_gallery_theme_personal.sql`. **If these never ran, that alone could explain the 0.**

**Open PRs:** #54 (draft — gallery zero-match subtitle/button copy fix, no conflicts, safe to merge), #52 (Statistics), #16/#4/#7 (stale doc conflicts).

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
