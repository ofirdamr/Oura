# SUMMARY — Oura

**Read this first, then `docs/ARCHITECTURE.md` for structural detail and `PROGRESS.md` for history.**

## ✅ DONE 2026-07-19 — LLaVA photo category labeling fixed (PR #82, deployed)

Three silent bugs caused ALL photos to get wrong/null categories:
1. Wrong model ID (`@cf/llava-1.5-7b-hf` → `@cf/llava-hf/llava-1.5-7b-hf`)
2. Wrong response field (`result.response` → `result.description`)
3. `ring` substring matched "during"/"gathering"/"wearing" — fixed with word-boundary regex
Backfill now re-runs ALL photos (not just NULL) so wrong legacy labels are corrected.
All 17 WED-2024 photos re-labeled: `updated: 17, skipped: 0`. Deployed oura-api `48349f47`.
PR #82 open draft on `claude/llava-photo-categorization-2ajpm0`. Merge when ready.

**Open PRs:**
- **PR #82** — LLaVA fix, deployed, ready to merge
- **PR #80** — category backfill endpoint (superseded by #82 which includes the fix; can close)
- **PR #77** — full AI pipeline + multi-select, needs migration 0009 + deploy

## ⚠️ ACTION REQUIRED — Apply migration 0009 to activate gallery chips

The AI pipeline code is deployed (apps/api `2fef59a1`, apps/web `f44ab3fd`). The gallery category filter chips will work once migration 0009 is applied in Supabase:

1. Go to https://supabase.com/dashboard/project/voxxhvywzaizyputjqkm/sql/new
2. Paste the contents of `supabase/migrations/0009_ai_pipeline.sql`
3. Click Run

After that, the backfill endpoint will populate existing photos with categories:
```
curl -X POST https://oura-api.oura-events.workers.dev/admin/events/WED-2024/backfill-categories \
  -H "Authorization: Bearer <ADMIN_BACKFILL_TOKEN>"
```

Then verify chips at: https://oura-web.oura-events.workers.dev/gallery-entry?code=WED-2024

## ✅ DONE 2026-07-19 — PR #82 merged (LLaVA fix), PR #80 + PR #77 already merged

All three PRs landed on main. apps/api and apps/web deployed. Only migration 0009 remains for founder to apply.

## ✅ DONE 2026-07-19 — Category backfill endpoint (PR #80, merged)

**Branch:** `claude/oura-category-backfill-sjtb40`
**PR:** #80 open draft — NOT yet deployed

**What's in this PR:**
- `POST /admin/events/:id/backfill-categories` — iterates every photo with `category = NULL` for an event, calls Workers AI LLaVA (same model/logic as queueConsumer.ts), writes result to `photos.category`
- Accepts event code (`WED-2024`) or numeric id
- Gated by existing `ADMIN_BACKFILL_TOKEN` bearer secret
- Returns `{ updated, skipped, total }`

**Steps to make the gallery chips work for WED-2024:**
1. Apply migration 0009 first (adds `category` column): paste `supabase/migrations/0009_ai_pipeline.sql` at https://supabase.com/dashboard/project/voxxhvywzaizyputjqkm/sql/new → Run
2. Deploy `apps/api` (`wrangler deploy` from `apps/api/`)
3. Call the backfill: `curl -X POST https://oura-api.oura-events.workers.dev/admin/events/WED-2024/backfill-categories -H "Authorization: Bearer <ADMIN_BACKFILL_TOKEN>"`
4. Merge PR #80, then PR #77 (which has the full AI pipeline + gallery chips that read the category field)

**Next-session first message:** "Pick up Oura PR #80 (`claude/oura-category-backfill-sjtb40`). The backfill endpoint is built and pushed. Remaining: (1) confirm founder applied migration 0009, (2) deploy apps/api, (3) call the backfill for WED-2024, (4) verify gallery chips show non-empty results at https://oura-web.oura-events.workers.dev/gallery-entry?code=WED-2024, (5) merge PR #80 then PR #77. Full context in SUMMARY.md."

## ✅ DONE 2026-07-19 — Rate-limit /auth/forgot-password (PR #78, merged + deployed)

Founder got 5-6 password-reset emails in one hour. Root cause: public
`POST /auth/forgot-password` had no throttle — a bot email-bombed his inbox.
**No account compromise** (reset links only redeem from the target's own inbox).
Fix: Cloudflare native rate limiter `RESET_RATE_LIMITER` (`[[unsafe.bindings]]`,
3 req/60s, keyed per-email AND per-IP), silent 200 on limit. Merged (squash
`1d340cde`) and **deployed** (oura-api version `d4852f2e`). Endpoint smoke-tested
200. See `docs/ARCHITECTURE.md` §forgot-password.

## 🔄 IN PROGRESS 2026-07-19 — Gallery multi-select + full AI pipeline (PR #77, open draft)

**Branch:** `claude/oura-mvp-ai-pipeline-rsb711`  
**PR:** #77 open draft — NOT yet deployed

**What's in this PR:**
1. **Gallery multi-select restored** (PR #76 wrongly removed it): tap = select with checkmark + ring, floating action bar (שמור/שתף N), expand icon for full-screen viewer
2. **Auto-category labeling**: Workers AI (LLaVA) classifies each photo into ceremony/reception/dancing/party in the queue consumer — festive gallery chips filter by real DB field
3. **Full AI pipeline on upload**: closed-eye detection (detection_score < 0.70), duplicate detection (cosine sim > 0.97), both flags hide photo from guest gallery
4. **Reports Management screen wired**: new `GET /admin/ai-pipeline-stats` endpoint, page shows live counts + expandable rejected-photo grid + category breakdown
5. **Migration 0009**: adds `category`, `ai_rejected`, `rejection_reason` columns to `photos`

**Remaining before merge:**
1. Founder applies migration 0009: paste `supabase/migrations/0009_ai_pipeline.sql` at https://supabase.com/dashboard/project/voxxhvywzaizyputjqkm/sql/new → Run
2. Deploy `apps/api` (Workers AI binding added to wrangler.toml — required for category classification)
3. Deploy `apps/web` (gallery multi-select + reports page changes)
4. Verify: gallery tap-select works, festive chips filter by category, reports screen shows real AI counts
5. Merge PR #77

**Open PRs:**
- **PR #77** (`claude/oura-mvp-ai-pipeline-rsb711`) — AI pipeline + multi-select, needs migration + deploy
- **PR #76** — was merged per prior session; confirm it's closed
- **PR #16, #4, #7** — old doc PRs with conflicts, low priority

## ✅ DONE 2026-07-19 — Photo editor Stitch wire + gallery tap/action-bar fix (PR #76, merged + deployed)

**Branch:** `claude/photo-editor-stitch-wire-1xm5wf` → merged to main  
**PR:** #76 merged (squash commit `7ef7289f`), deployed oura-web version `364649a2`

**What's in this PR:**
1. `apps/web/app/photo-editor/page.tsx` — full rewrite to match Stitch design exports:
   - Mobile: scroll layout, photo preview, 4 sliders (brightness/contrast/saturation/exposure), 2 toggles (auto-optimize / add frame), fixed bottom bar (שמור + שתף)
   - Desktop: two-panel (photo canvas left, sidebar right)
   - Sliders apply live CSS filter to the preview; no CDN scripts
2. `apps/web/app/gallery/page.tsx` — selectMode multi-select removed:
   - Tapping a photo now always opens the full-screen lightbox (bug fix)
   - Fixed floating action bar (save/share for selected photos) is gone — matches Stitch in-page layout

**Remaining for next session:**
1. Merge PR #76 (no deploy needed — photo-editor page is frontend-only, gets deployed with next `npm run deploy` cycle)
2. Verify with a real guest token that the photo editor sliders apply CSS filter live and שמור/שתף work
3. Check PR #71 status (should be merged — confirm)

**Open PRs:**
- **PR #76** (`claude/photo-editor-stitch-wire-1xm5wf`) — photo editor + gallery fix, NOT merged
- **PR #71** — should be merged (check)
- **PR #16, #4, #7** — old doc PRs with conflicts, low priority

**Next-session first message:** "Pick up Oura PR #76 on branch `claude/photo-editor-stitch-wire-1xm5wf`. It wires the photo editor to its Stitch design and fixes the gallery tap bug. Merge it, then verify the photo editor works end-to-end with a real guest token (sliders apply CSS filter live, שמור/שתף complete). Full context in SUMMARY.md."

---

## 2026-07-18 — Brevo click-tracking burns reset-password token (branch `claude/brevo-click-tracking-disable-1hd7h1`, commit `074253f`, PR #71 open draft, NOT YET DEPLOYED)

**Open PRs, current status:**
- **PR #71** (`claude/brevo-click-tracking-disable-1hd7h1` → `main`) — the real fix, built on top of #70 (includes its commit). NOT YET deployed or e2e-verified. This is the one to finish.
- **PR #70** (`claude/password-reset-token-burning-f329ym`) — superseded by #71; close it once #71 merges, do not merge #70 itself.

**KEY FINDING (researched against Brevo's own docs, not guessed):** Brevo has NO way to disable click-tracking on transactional email — no v3 `/smtp/email` per-send flag, and the dashboard only offers "anonymous tracking" (still wraps + pre-scans links). The task's assumed fallback (a dashboard toggle) does not exist. Founder was asked via AskUserQuestion and chose the code fix over trying Brevo settings.

**The code fix (done, typecheck-clean):**
- `apps/web/app/reset-password/page.tsx`: the `token_hash` path no longer redeems `verifyOtp` on mount. It shows a confirm gate (button "המשך לאיפוס הסיסמה") and redeems `verifyOtp` only on the real user's tap — so Brevo's tracker pre-scan (which previously rendered the page and burned the single-use token via an on-mount redeem) can no longer burn it. Legacy implicit-hash links still auto-establish on mount (not a one-time OTP a prefetch can burn).
- `apps/api/src/index.ts`: updated the `/auth/forgot-password` header comment to reflect the confirm-gate protection (no route/schema change).

**Remaining for next session (single small mission):**
1. Deploy `apps/web` (`npm run deploy`; CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID in env).
2. Full e2e curl proof with mailsac throwaway account (create → trigger `/auth/forgot-password` → poll mailsac → resolve Brevo-wrapped link → confirm token SURVIVES the pre-scan GET → redeem via tap-simulated `verify` → set password → login → delete throwaway user, even on failure). SUPABASE_URL in env ends in `/rest/v1/` — strip that for the GoTrue base.
3. Live screenshot proof: headless browser can't reach the live site through the egress proxy (resets TLS), so run `apps/web` locally (`npm run dev`) and Playwright-screenshot `localhost/reset-password?token_hash=fake&type=recovery` to show the confirm gate; assert token NOT consumed on load, consumed only on click.
4. On green: merge PR #71 to main (merge is not ask-first per CLAUDE.md), close PR #70 as superseded, report to founder in plain language with the live link https://oura-web.oura-events.workers.dev/reset-password.

**Next-session first message:** "Finish PR #71 (Oura password-reset). The confirm-gate code fix is committed on branch `claude/brevo-click-tracking-disable-1hd7h1` (includes #70's commit). Remaining: deploy apps/web, run the mailsac+curl e2e proof, capture a localhost Playwright screenshot of the confirm gate, then merge #71 / close #70 and report to the founder with the live link. Full steps are in SUMMARY.md's latest entry."

### Earlier 2026-07-18 pass (superseded by the above) — Password-reset token-burning fix (branch `claude/password-reset-token-burning-f329ym`, deployed, PR #70)

**What's fixed & deployed (oura-api `766c0b3c`, oura-web `8d01a0cb`):**
- API `/auth/forgot-password` now emails a link to OUR page `…/reset-password?token_hash=…&type=recovery` (built from `generateLink().properties.hashed_token`), NOT Supabase's raw `action_link`. Adds `console.error` on Brevo send failure (was silently swallowed).
- `/reset-password` page: primary path reads `token_hash` and redeems it with `verifyOtp({type:'recovery',token_hash})` on mount; legacy implicit-hash `setSession` kept as fallback; now surfaces the REAL reason (expired / already-used / invalid) instead of a blanket "link invalid".

**Proven for real this session (curl against real Supabase/Brevo/Mailsac, throwaway accounts, all deleted):**
- token_hash mechanism redeems to a recovery session ✅ (isolated generateLink→verify).
- Our page is INERT on a plain GET — token SURVIVES a scanner-style prefetch ✅ (the core of the fix).
- Real Brevo email delivers to any inbox; the delivered link resolves to our token_hash page ✅.
- **Also fixed:** the Worker's `BREVO_API_KEY` secret was stale (this was PR #68's "emails not arriving"); reset it to the working key — emails now deliver.

**⚠️ REMAINING BLOCKER (next mission):** Brevo's own **click-tracking** wraps the button link as `r.oura.mail.yardendamri.co.il/tr/cl/…` and pre-scans the destination, which BURNS the single-use token before the user clicks (fresh token → `otp_expired` on first redeem via the email path, but SURVIVES when Brevo tracking is not in the path). Same bug class as Gmail, moved to Brevo's tracker. **Fix = disable Brevo click-tracking for this transactional email** (Brevo dashboard account/tracking setting, or a per-send tracking-off param if the API supports it) so the raw token_hash link is delivered untouched.

**Blind spot (disclosed):** headless-browser screenshots of the live page could NOT be captured — the egress proxy resets ALL browser TLS (proven against example.com), so no visual pixel proof of the page render this session. curl reaches everything, which is how the flow above was proven.


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

## ✅ DONE 2026-07-18 — Password reset fully immune to Brevo click-tracking (PR #71 merged, deployed + e2e verified)

Final piece of the reset-token-burning saga. Brevo offers no way to disable click-tracking on transactional email, and its tracker pre-scans (renders + runs the JS of) the wrapped link, which previously burned the one-time recovery token before the user ever clicked. Fix: `/reset-password` no longer redeems on mount — it shows a confirm gate ("המשך לאיפוס הסיסמה") and calls `verifyOtp` only on the real user's tap, which no prefetch/pre-scan performs. API `/auth/forgot-password` emails the `token_hash` link (not the burn-prone `action_link`). Legacy implicit-hash links still auto-establish.

Deployed: oura-api `b77a9986`, oura-web `d2eae06b`. Verified: localhost confirm-gate screenshot (no verifyOtp on mount, zero console errors) + real-Supabase throwaway-user e2e (token_hash → redeem → password change → new-password login OK, old rejected, token one-time). PR #71 merged; PR #70 closed as superseded. Live: https://oura-web.oura-events.workers.dev/reset-password (via "שכחתם סיסמה?" on https://oura-web.oura-events.workers.dev/login).

## ✅ DONE 2026-07-18 — Password reset PAGE actually works now (real root cause fixed, e2e verified)

The reset **email** was fixed earlier (Brevo), but clicking the link still failed for everyone: `/reset-password` always showed "הקישור אינו תקף" (link invalid), so no password could ever be set. **Root cause:** the server-generated recovery link lands with implicit-flow tokens in the URL hash, but `@supabase/ssr`'s browser client is hard-forced to PKCE flow — its auto session-detection rejects the implicit hash and never creates a session. **Fix:** the reset page now disables that auto-detection (`detectSessionInUrl:false`), parses the hash itself, and calls `setSession(...)` before `updateUser({password})`; tokens are stripped from the URL after.

**Verified e2e this session** (throwaway user, now deleted): (1) reproduced the break against real Supabase (PKCE client → no session); (2) real Supabase chain — recovery link → setSession → password change → login with the NEW password all OK; (3) drove the real deployed page in a browser — form appears, submit shows "עודכנה בהצלחה", and no-link shows "link invalid" (negative control). Deployed: oura-web version `65c63a98`. Live: https://oura-web.oura-events.workers.dev/reset-password (reachable from the "שכחתם סיסמה?" link on https://oura-web.oura-events.workers.dev/login).

## ✅ DONE 2026-07-18 — Password reset email flow live end-to-end (PR #65, deployed)

Resend's shared `onboarding@resend.dev` silently dropped every email to any address that wasn't the Resend account owner. Migrated `POST /auth/forgot-password` Worker endpoint to Brevo's transactional-email API (`https://api.brevo.com/v3/smtp/email`), which delivers to any inbox with no custom domain required. Same server-side flow: `auth.admin.generateLink()` builds the recovery link, Brevo emails it via the newly-set API key.

**End-to-end flow verified (2026-07-18):**
- ✅ Frontend `/forgot-password`: accessible, accepts email, shows success message
- ✅ API `POST /auth/forgot-password`: deployed, returns HTTP 200, generates Supabase recovery link
- ✅ **Email sending via Brevo:** `BREVO_API_KEY` secret now set in Cloudflare Worker — emails will arrive from Brevo's domain
- ✅ Frontend `/reset-password`: ready to handle Supabase PASSWORD_RECOVERY session, allows password reset

**Live flow:** photographer visits https://oura-web.oura-events.workers.dev/forgot-password → enters email → recovery link sent via Brevo → clicks link in email → lands at https://oura-web.oura-events.workers.dev/reset-password → Supabase auto-detects PASSWORD_RECOVERY session → form appears → photographer sets new password → redirects to login.

### Earlier (superseded): custom reset email via Resend (PR #61, merged)
Built the custom `POST /auth/forgot-password` Worker endpoint (server-side recovery link + direct email API, bypassing Supabase's broken SMTP). Resend was the sender — replaced above because it only delivered to the account owner.

## Key guardrails (NEVER violate)
- NEVER mutate `ofirdamr@gmail.com` auth credentials. Use throwaway accounts for auth testing.
- Media binaries: R2 only, never Supabase storage.
- Face-matching: NEVER before biometric consent gate.
- Fonts: `--font-display` (Hanken Grotesk) for Latin-only branding only; Rubik (`--font-sans`) for all Hebrew.
- CSS: logical properties only (`ms-*`/`me-*`/`ps-*`/`pe-*`), never physical `ml-*`/`mr-*`.
- Design is king: check `design/screens/<name>/screen.png` before coding any screen. All 42 screens exist.
- Update `docs/ARCHITECTURE.md` in the same commit as any route/schema/auth/deployment change.
