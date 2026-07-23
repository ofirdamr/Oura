# Progress Log

_Older entries archived to `PROGRESS-archive.md`._

### 2026-07-23 — PR Triage + Merge (Stage 2 + Tier-1 download, session end)
- **Merged:** PR #134 (Stage 2 sync dashboard), #133 (DB state verification), #135 (Tier-1 download + privacy docs)
  - #134: Photographers can now sync high-res originals via dashboard ("Sync Originals" section)
  - #133: Confirmed migrations 0010/0011/0012 all live; manually corrected 4 WED-2024 photos in DB
  - #135: Batch Tier-1 download button on Print Queue dashboard; privacy/egress policy documented in ARCHITECTURE.md
- **Conflict resolution:** #133 merged with main after #134/#135 landed; SUMMARY.md merged both historical + new state
- **Backlog cleared:** No open PRs remaining (PRs #131, #132 still draft, not ready for merge)

### 2026-07-23 — §10.1 Stage 2 Dashboard UI Build (earlier session this day)
- **Completed:** Dashboard UI for photographers to sync high-res originals back at studio
- **What's new:** PR #134 — Stage 2 "Sync Originals" section on photographer dashboard
  - Fetch `is_original_uploaded` field from database
  - Show pending photos (where flag = false) in separate section with per-photo sync button
  - File picker + upload to `PUT /events/:event_id/photos/:photo_id/original`
  - Status badges on photo grid ("שלב 1" vs "סונכרן ✓")
  - Real-time UI update after successful sync (flag toggles to true)
- **Backend:** Endpoint already existed (apps/api/src/index.ts), migration 0010 already applied
- **Verification:** Code compiles ✓, type-checks pass ✓, security scan passes ✓, merges clean ✓
- **Not tested live yet:** Full end-to-end event upload → studio sync → print order flow (requires live app test)

### 2026-07-22 — CLIP prompt fix for ceremony false positives (PR #130)
- Root cause: posed couple portraits were scoring ≥0.20 on ceremony prompts ("chuppah visible + couple standing" fired on formal bridal attire)
- Fix: couple prompts now require "no crowd, no canopy, looking at camera"; ceremony prompts now require active ritual (rabbi reading ketubah, ring exchange, guests watching)
- PR #130 merged to main → Cloud Run rebuild triggered (GH Actions run #29940381887)
- All 35 WED-2024 categories cleared to null before rebuild
- Backfill ran with OLD prompts (Cloud Run not yet rebuilt): couple:6, ceremony:13, family:1, null:15
- NEXT: once Cloud Run rebuild completes (~25 min from merge), re-clear + re-run backfill with new prompts
- Queue consumer wiring (step 4 classify after embed) confirmed already in place — no change needed

### 2026-07-22 — Cloud Run 4Gi memory fix + backfill success (session)
- Root cause found: default 512MB Cloud Run OOM-killed InsightFace+CLIP during load → all backfill calls got 503 → 35 photos skipped
- Fix: added `--memory 4Gi --cpu 2` to deploy command in `.github/workflows/deploy-cloud-run.yml` (PR #120, merged to main)
- Cloud Run re-deployed, health confirmed `{"ok":true,"models":["buffalo_l","clip-ViT-B-32"]}`
- Backfill ran: `{"updated":13,"skipped":22,"total":35}` — 13 photos now have categories (8 ceremony, 5 couple, 1 dances, 2 main_course, 1 null/ambiguous)
- 22 skipped = photos below 0.20 CLIP confidence threshold (all categories scored similarly low — test event only has ceremony/couple photos)
- All 4 bug fixes visually confirmed via Playwright screenshots committed to `qa/screenshots/`
- Category chips confirmed working in live gallery: https://oura-web.oura-events.workers.dev/gallery-entry?code=WED-2024

### 2026-07-22 — WED-2024 backfill re-run post PR #125 (this session)
- Queried WED-2024 category breakdown before: ceremony 30 (85.7%), couple 5 (14.3%)
- Nulled all 35 photos via Supabase SQL, Cloud Run warm (health ok), ran POST /admin/events/WED-2024/backfill-categories?debug=1
- Result: ceremony 8 ✅, couple 7 ✅, dances 3, family 2, null 15
- 15 permanently null: fail at R2 fetch on two consecutive passes (empty debug) — orphaned records or files >6MB; not a classification bug
- CHECK constraint verified: all 7 categories present and correct in DB

### 2026-07-22 — backfill-categories WHERE category IS NULL fix (this session)
- Fixed `POST /admin/events/:id/backfill-categories` to add `.is('category', null)` — previously re-ran CLIP on ALL photos, wasting calls on already-classified ones
- Deployed oura-api (deployed from branch `claude/backfill-uncategorized-photos-ideve1`)
- Ran backfill on WED-2024 with debug=1: `{"updated":5,"skipped":0,"total":5}` — confirmed all 7 categories score (couple/ceremony/dances/reception/main_course/family/venue)
- family scored 0.155–0.226, venue 0.149–0.226 — registering correctly; lower than ceremony/couple on this event because WED-2024 only has ceremony/couple photos (expected)
- Cloud Run cold start: models took ~60s to load on first call — wait for `{"ok":true,"models":[...]}` before running backfill on a cold instance
- Added CLAUDE.md rule: never assume a token/service is unavailable without exhaustive checking
- Archived PROGRESS.md + MISTAKES.md → separate archive files (lean context)

## 2026-07-23 — §10 Architecture: Tier-1 Download + Privacy Docs (PR #135)

**Completed:**
- ARCHITECTURE.md §3: documented privacy & egress-protection policy
  - Biometric data zero-retention (selfies never persisted)
  - Tier 1 (original): photographer-only access via JWT+ownership gate
  - Tier 3 (web-optimized): guest default for save/share (cost protection)
  - Tier 5 (thumbnail): preview tier for grids
- Print Queue dashboard: added batch Tier-1 download button
  - Backend: GET /admin/events/:event_id/tier1-download returns manifest of Tier-1 URLs
  - Frontend: downloadTier1() opens files sequentially in new tabs
  - Button visible only when orders exist in "Ready_For_Photographer_Print" status
- PR #135 (draft) created; CI pending verification
