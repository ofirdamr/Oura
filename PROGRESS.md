# Progress Log

### 2026-07-19 (session — §10.3 smart crop + story framing engine)
- Created `FormatPickerSheet` component (3 formats: מקורי / פיד 4:5 / סטורי 9:16), wired into `PhotoViewer`
- Added `POST /social-frame` to Python processing service (PIL: focal-point 4:5 crop, 9:16 blurred canvas, pass-through)
- Added `GET /photos/:id/social-export` Worker route (guest token auth, R2 Tier 3 only, proxies to /social-frame)
- Deployed oura-api `28dfa8ac`. PR #93 open draft. Python Cloud Run redeploy pending (founder action).
- Watching PR #93 (trig_01SqruaKwFeRNF4AdXDX9WRa fires in ~1hr for check-in)

### 2026-07-19 — PRD §10.2 client-side upload engine (PR #92, merged)
- `jszip` + `browser-image-compression` added to apps/web
- Event upload page: drag-and-drop ZIP/JPEG/PNG, in-browser extraction (memory-safe, sequential entries), silent compression (≤1 MB, Web Worker), 5-parallel upload pool with exponential backoff (2s/4s/8s, 3 retries)
- Single unified "מייעל ומעלה נכסים בצורה בטוחה..." progress bar replaces per-file list
- Deployed oura-web `c1cedcca`; PR #92 merged

### 2026-07-19 (session — format picker bottom sheet)
- Created `FormatPickerSheet` component matching Stitch design (3 formats: מקורי / פיד 4:5 / סטורי 9:16)
- Wired into `PhotoViewer` share button → calls `/photos/:id/social-export?format=…&token=…`
- PR #85 open (draft) on branch `claude/format-picker-bottom-sheet-a5gjq5`

### 2026-07-19 (session — PR merges + full AI pipeline deploy)
- Merged PR #82 (LLaVA fix) — squash to main
- PR #80 already merged by founder; PR #77 already merged by founder
- Deployed apps/api (version 2fef59a1) — AI pipeline + backfill endpoint live
- Deployed apps/web (version f44ab3fd) — gallery multi-select + festive chips + reports screen live
- Migration 0009 still pending founder apply (adds category/ai_rejected/rejection_reason columns)

### 2026-07-19 (session — LLaVA category labeling fix, PR #82)
- Diagnosed 3 root-cause bugs in photo category classification:
  1. Wrong model ID: `@cf/llava-1.5-7b-hf` → `@cf/llava-hf/llava-1.5-7b-hf` (AiError 5007)
  2. Wrong response field: `result.response` → `result.description` (Workers AI LLaVA schema)
  3. Substring collision: `t.includes('ring')` matched "during"/"gathering"/"wearing" → fixed with word-boundary regex
  4. Backfill only re-ran NULL categories — now overwrites ALL photos to correct existing wrong labels
  5. `max_tokens` 10 → 50 to prevent cutoff
- Deployed fixes. Ran force-backfill on WED-2024: updated 17, skipped 0, total 17. All photos correctly labeled.
- Opened PR #82 (draft). Code already deployed live to oura-api `48349f47`.

### 2026-07-18 (session — finish PR #71: deploy + verify Brevo-immune reset)
- Finished the parked PR #71 work. Installed deps, `tsc --noEmit` clean for both apps/api and apps/web.
- Deployed both workers from the sandbox: oura-api version `b77a9986` (emails the `token_hash` link, not `action_link`), oura-web version `d2eae06b` (confirm-gate reset page). Both live and serving 200.
- Live-site headless browser is still blocked by the egress proxy (ERR_CONNECTION_RESET, matches prior sessions), so captured the confirm-gate screenshot on a localhost `next dev` build — RTL Hebrew, brand logo, protective copy, "המשך לאיפוס הסיסמה" tap button, zero console errors (proves no `verifyOtp` fires on mount → immune to Brevo/scanner prefetch).
- Ran a bounded real-Supabase e2e with a throwaway user (created + deleted, never the founder account): `generateLink` token_hash → `verifyOtp` redeem → `updateUser` password change → login with NEW password OK → old password rejected → token reuse rejected (one-time). RESULT: PASS.
- Marked PR #71 ready and merged to main; closed PR #70 as superseded (its commit is included in #71).

### 2026-07-18 (session — Brevo click-tracking token burn)
- Investigated remaining blocker from the prior password-reset session: Brevo's click-tracking wraps the reset link and pre-scans it, burning the single-use `token_hash` before the guest clicks. Researched Brevo's own docs directly: confirmed there is NO per-send API flag and NO dashboard setting to disable transactional click-tracking (only "anonymous tracking," which still wraps/pre-scans). Asked the founder via AskUserQuestion; he chose the code-side fix over chasing a nonexistent Brevo setting.
- Fix: `apps/web/app/reset-password/page.tsx` no longer calls `verifyOtp` on mount for the `token_hash` path — it renders a confirm gate and redeems only on user tap, so a tracker's pre-scan GET can no longer burn the token. Updated the `/auth/forgot-password` header comment in `apps/api/src/index.ts` to match (comment-only, no route/schema change). `tsc --noEmit` clean.
- Committed to branch `claude/brevo-click-tracking-disable-1hd7h1` (based on/includes PR #70's commit), pushed, opened **PR #71** (draft) against main. NOT yet deployed or e2e-verified — deploy, mailsac+curl e2e proof, and a localhost Playwright screenshot of the confirm gate are the next session's mission (see SUMMARY.md). PR #70 is superseded by #71 and should be closed once #71 merges.

