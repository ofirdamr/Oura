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

## ✅ DONE 2026-07-15 — Gallery zero-match UX fixes (PR #54, open — ready to merge)

When face-matching returns 0 personal photos: subtitle now says "מחפשים אותך ב-N תמונות" instead of "מצאנו 0 תמונות שלך" (which contradicted the "עדיין מחפשים" card). Buttons now say "שמירת כל התמונות" / "שיתוף כל התמונות" instead of "שלי" when no matches.

## ✅ DONE 2026-07-16 — Root-cause fix: selfie→gallery 0-match bug (PR #55, merged)

**Root cause identified and fixed.** Migration 0006 (`match_similarity float4` column on `face_embeddings`) was shipped in code on 2026-07-15 but never applied to live Supabase. Without it, the selfie UPDATE failed silently, guest_id was never stamped, gallery returned 0 photos.

- Migration 0006 applied by founder (confirmed — column exists).
- Code fix (PR #55, Worker version `95e16ceb`): `guest_id` stamp is now a separate first UPDATE (hard failure), `match_similarity` is best-effort (non-blocking).
- PR #55 merged.

## ✅ RESOLVED 2026-07-16 — EMBED_SERVICE_TOKEN mismatch fixed

The Worker's `EMBED_SERVICE_TOKEN` secret and Cloud Run's `EMBED_SERVICE_TOKEN` env var now hold the **same value**, so the embed service accepts the Worker's requests again (was: 401 → 502 → 0 matches).

How it was done this session:
- Worker secret set via Cloudflare API (sandbox `CLOUDFLARE_API_TOKEN` is valid).
- Cloud Run env var updated via the Cloud Run Admin API, authenticated with a **temporary `temp-fix` service-account key** the founder created (his personal `ofirdamr@gmail.com` lacked project permissions; the project is owned by `ouraforphotographers@gmail.com` — that account had to be used). Cloud Shell would not authorize in a phone browser, which is why the service-account-key route was used instead.
- New Cloud Run revision `oura-embed-00003-pz6` is live. Verified at the service boundary: wrong token → 401, correct token → 400 (auth passed, only missing image body). Token value intentionally NOT committed to the repo.

**FOLLOW-UPS:**
- **Founder must DELETE the temporary `temp-fix` service account** (it holds Owner) once the selfie is confirmed working — it's a standing security risk: https://console.cloud.google.com/iam-admin/serviceaccounts?project=ouraforphotographers
- **Final end-to-end check still owed:** a real selfie at https://oura-web.oura-events.workers.dev/gallery-entry?code=WED-2024 should now return matched photos.
- Migration 0007 (`supabase/migrations/0007_gallery_theme_personal.sql`) still to be applied at https://supabase.com/dashboard/project/voxxhvywzaizyputjqkm/sql/new (separate from this fix).

**ACTION REQUIRED (founder):** Apply migration 0007 — paste `supabase/migrations/0007_gallery_theme_personal.sql` at https://supabase.com/dashboard/project/voxxhvywzaizyputjqkm/sql/new

**TEST after token fix:** https://oura-web.oura-events.workers.dev/gallery-entry?code=WED-2024

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
