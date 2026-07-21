# SUMMARY — Oura

**Read this first, then `docs/ARCHITECTURE.md` for structural detail.**

## Current state (2026-07-21)

We are in **§10 QA phase**. All §10 code has been merged but has NOT been verified live end-to-end with real screenshots from the running app. Previous sessions wrote "✅ verified" without doing it — that was wrong.

**Live URLs:**
- Frontend: https://oura-web.oura-events.workers.dev
- API: https://oura-api.oura-events.workers.dev
- Demo event: https://oura-web.oura-events.workers.dev/gallery-entry?code=WED-2024

---

## §10 Build Status — honest accounting

### §10.1 Two-Stage Upload Pipeline
- **Built:** `PUT /events/:id/photos/:id/original` endpoint (PR #91, merged)
- **Migration 0010** (`is_original_uploaded` column): built, needed founder to apply in Supabase — **unverified if applied**
- **Live QA:** not done

### §10.2 Client-Side Extraction Engine (ZIP + compression + parallel upload)
- **Built:** drag-and-drop ZIP/JPEG, in-browser extraction, silent compression, 5-parallel queue (PR #92, merged, deployed)
- **Verified:** local Playwright screenshot of drop zone only — not tested with a real ZIP upload to the live site
- **Live QA:** not done

### §10.3 Smart Crop & Social Framing Engine
- **Built:** `GET /photos/:id/social-export` Worker route + Python PIL framing service `/social-frame` (PR #93, merged)
- **API deployed:** oura-api version `28dfa8ac`
- **KNOWN GAP:** Python framing service on Cloud Run was NOT redeployed — the endpoint will fail until Cloud Run is rebuilt
- **Format picker UI:** built and wired (PR #85, merged)
- **Live QA:** not done; social export endpoint is known broken until Cloud Run redeploy

### §10.4 E-Commerce & Print Shop
- **Built:** `POST /gallery/:token/orders`, `GET /admin/events/:id/orders`, `PUT /admin/orders/:id/mark-printed`, admin print queue dashboard `/admin/print-queue`, guest `/premium-prints` + `/order-confirmation` flows (PRs #94, #95, merged)
- **Migration 0011** (orders table, fulfillment ENUMs, auto-release trigger): built — unverified if applied
- **Live QA:** not done

### §10.5 DB Schema
- **Migration 0011:** SUMMARY.md previously said "applied" — unverified

---

## What is actually known to work (verified by prior sessions)

- Photographer sign-up / login (Supabase Auth)
- Create event, upload branding logo
- Face-matching pipeline: embed service on Cloud Run, queue consumer, `match_faces` RPC
- Guest flow up to gallery: QR → consent → selfie → gift reveal → personal gallery
- Category chips filter in gallery
- Gallery full-screen photo viewer (PR #10)

## What has NEVER been verified live end-to-end

- The complete §10.3 social export (blocked: Cloud Run not redeployed)
- The complete §10.4 print order flow (migration 0011 status unknown)
- The Stage 2 original upload (migration 0010 status unknown)
- Admin print queue dashboard

## Open PRs

None — all clear.

## Recent changes (2026-07-21)

**PR #110 merged** — zero-cost CLIP category classification:
- Replaced Workers AI LLaVA with CLIP ViT-B/32 on Cloud Run (open-source, zero per-call cost)
- Workers AI binding removed — no more per-neuron charges (~$0.01–0.05/photo eliminated)
- Backfill endpoint now runs 10 photos in parallel + supports ?limit=200&offset=N pagination
- GitHub Actions workflow added: auto-deploys Cloud Run when `packages/processing-pipeline/` changes
- Cloudflare Worker deployed (version `f1e61ab8`) ✅

**PENDING: Cloud Run rebuild needed** — the `/classify-category` CLIP endpoint exists in code but Cloud Run hasn't been rebuilt yet. Until rebuilt:
- New photo uploads via queue consumer will get `null` category (endpoint returns 404)
- Backfill endpoint will skip all photos (CLIP endpoint not yet live)
- To trigger rebuild: add `GCP_SA_KEY` secret to GitHub → Actions auto-fires on next push to main touching `packages/processing-pipeline/`

## Next mission

1. **Cloud Run rebuild** — get `GCP_SA_KEY` added as GitHub secret to trigger auto-deploy of CLIP endpoint
2. **Run backfill** — `POST /admin/events/WED-2024/backfill-categories` with ADMIN_BACKFILL_TOKEN once Cloud Run is live
3. **§10 live QA** — real Playwright screenshots of every §10 flow

## Key guardrails (NEVER violate)

- NEVER mutate `ofirdamr@gmail.com` auth credentials or send email to that address during testing
- Media binaries: R2 only
- Face-matching: NEVER before biometric consent
- Fonts: `--font-display` Latin-only; Rubik for Hebrew
- CSS: logical properties only (`ms-*`/`me-*`)
- Design is king: check `design/screens/` before coding any screen
- Update `docs/ARCHITECTURE.md` with any route/schema/auth change
