# Progress Log

_Older entries archived to `PROGRESS-archive.md`._

### 2026-07-23 — Classification architecture: burst+clustering refine + one-tap correction
- Branch `claude/oura-classification-vit-se4lgf`, built on PR #131 (ViT-L/14 kept, not reverted per locked founder decision)
- Cloud Run: `/classify-category` now also returns the image embedding; new `POST /refine-categories` (`app/refine.py`, torch-free) — greedy visual clustering (embedding cosine sim, `CLUSTER_SIM=0.86`) pools bursts to consensus + rescues ambiguous frames; sequence-smoothing fills flanked nulls. Category-agnostic (4 or 7). Unit-tested `tests/test_refine.py` — 6/6 pass
- API: queue consumer + backfill persist `clip_embedding`/`clip_scores`/`category_source='ai'`; new operator `POST /admin/events/:id/refine-categories` (excludes + write-guards `manual`); new photographer `PATCH /events/:id/photos/:pid/category` sets `category_source='manual'` (AI+refine skip manual forever)
- Migration 0013: `clip_embedding` + `clip_scores` (jsonb) + `category_source` (checked) on `photos`
- Web: `lib/categories.ts` shared keys/labels; `setPhotoCategory` client; dashboard photo tiles get a category chip → bottom-sheet/centered re-tag picker (RTL). Screenshots mobile+desktop in `qa/screenshots/2026-07-23-category-correction-*` (local component render)
- Fixed a pre-existing compile-break inherited from #131: `createServerSupabaseClient` (undefined) in `/admin/photos/:id/restore` → switched to `supa()` + `getUser(token)`
- Verify: apps/api tsc clean, apps/web tsc+eslint clean + `next build` compiles (only unrelated `/reset-password` prerender fails — no Supabase env in sandbox), refine unit tests pass
- NOT live-verified: needs merge + Cloud Run redeploy at ≥6Gi. Founder actions still open: label 35 photos, raise Cloud Run to ≥6Gi, decide 4-vs-7

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
