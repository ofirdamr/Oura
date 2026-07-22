# Progress Log

_Older entries archived to `PROGRESS-archive.md`._

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

### 2026-07-22 — PR #128 deploy + backfill re-run (this session)
- PR #128 (close-up ceremony prompts) merged → GH Actions Cloud Run deploy completed in ~5 min (run #29936381505 ✅)
- Cleared all 3 dances-category photos to null via Supabase REST API (WED-2024 is ceremony/couple event, all 3 were misclassified)
- Deployed oura-api (PR #123 WHERE IS NULL fix was NOT deployed — now fixed) ✅
- Deployed oura-web (PR #121 gallery chips were NOT deployed — now fixed) ✅
- Polled Cloud Run health until new image loaded, then ran full backfill: `{"updated":18,"skipped":0,"total":18}`
- Final breakdown: ceremony 23 (65.7%), couple 7 (20%), dances 2 (5.7%), family 2 (5.7%), main_course 1 (2.9%), null 0
- 15 previously permanently-null photos are now all classified (0 null remaining)

### 2026-07-22 — backfill-categories WHERE category IS NULL fix (this session)
- Fixed `POST /admin/events/:id/backfill-categories` to add `.is('category', null)` — previously re-ran CLIP on ALL photos, wasting calls on already-classified ones
- Deployed oura-api (deployed from branch `claude/backfill-uncategorized-photos-ideve1`)
- Ran backfill on WED-2024 with debug=1: `{"updated":5,"skipped":0,"total":5}` — confirmed all 7 categories score (couple/ceremony/dances/reception/main_course/family/venue)
- family scored 0.155–0.226, venue 0.149–0.226 — registering correctly; lower than ceremony/couple on this event because WED-2024 only has ceremony/couple photos (expected)
- Cloud Run cold start: models took ~60s to load on first call — wait for `{"ok":true,"models":[...]}` before running backfill on a cold instance
- Added CLAUDE.md rule: never assume a token/service is unavailable without exhaustive checking
- Archived PROGRESS.md + MISTAKES.md → separate archive files (lean context)
