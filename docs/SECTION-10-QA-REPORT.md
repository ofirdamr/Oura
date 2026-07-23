# §10 QA Verification Report — Oura

**Date:** 2026-07-23 · **Author session:** `claude/section-10-qa-verification-hq3tjt`

This is the honest, code-reviewed accounting of everything built and set in §10
(Two-Stage Upload · Client Extraction · Smart Crop / Social Framing · Print Shop ·
DB Schema · Photo Classification), what is verified, what is not, and the concrete
plan to make classification accurate. Nothing here is marked ✅ without evidence in
this session.

---

## 1. Two-Stage Upload Pipeline (§10.1)

| Piece | State | Evidence |
|---|---|---|
| **Stage 1 — web-optimized tier (Tier 3)** | **Wired & working** | `apps/web/app/admin/events/[event_id]/page.tsx`: client compresses each photo (`browser-image-compression`), uploads to R2, inserts `photos` row `status='ready'`. Parallel pool (5 concurrent), retry with exponential backoff (2s→4s→8s). |
| **Media sizing / optimization** | **Wired** | `COMPRESS_OPTIONS`: `maxSizeMB: 1`, `maxWidthOrHeight: 4000`, `preserveExif: true`, web-worker. This is the tier guests actually receive. Share/watermark path caps the long edge at **1600px** (`apps/web/lib/watermark.ts`) for WhatsApp-friendly size. |
| **Stage 2 — original tier (Tier 1)** | **⚠️ NOT wired** | Endpoint `PUT /events/:id/photos/:id/original` exists (`apps/api/src/index.ts:840`) and sets `is_original_uploaded=true`, but **no code in the web app calls it**. Originals are never uploaded today — only the compressed tier. This is the biggest §10 gap. |
| **Migration 0010** (`is_original_uploaded`) | **Unverified** | Column is referenced in code; applied-status never confirmed against the live DB. |

## 2. Client-Side Extraction Engine (§10.2)

- **Wired & deployed** (PR #92). ZIP files are extracted in-browser via `jszip`
  (dynamic import), processed sequentially to avoid OOM on large archives, filtered
  to `jpg/png/webp/heic`. `apps/web/app/admin/events/[event_id]/page.tsx:44`.
- **Not verified** with a real large ZIP on the live site — only a local screenshot exists.

## 3. Smart Crop & Social Framing (§10.3)

- Cloud Run `/social-frame` (`packages/processing-pipeline/app/main.py`): `feed` =
  focal-point 4:5 crop (1080×1350), `story` = 9:16 blurred-backdrop canvas
  (1080×1920), `original` = pass-through. Worker `/social/...` route feeds it the
  **Tier 3 (web-optimized) key, never the original** — matches the PRD boundary.
- Cloud Run at 4Gi/2CPU (PR #120). **Endpoint never QA'd live end-to-end.**

## 4. E-Commerce & Print Shop (§10.4)

- Built & deployed (PRs #94, #95): premium prints page renders, correct button label
  (`הזמנת הדפסה עכשיו`), photo preview fixed on mobile — all confirmed by committed
  screenshots 2026-07-22 (`qa/screenshots/`).
- **Order flow end-to-end and admin print queue: never verified.** Migration 0011
  (print schema): applied-status never independently confirmed.

## 5. DB Schema (§10.5)

| Migration | What | State |
|---|---|---|
| 0010 | `is_original_uploaded` column + pending-sync index | Unverified |
| 0011 | Print-shop tables | Unverified |
| 0012 | `photos_category_check` — 7 category values | **Applied ✅** (verified 2026-07-22) |

## 6. Photo Classification — the recurring problem

**How it's wired (corrects a stale note in SUMMARY.md):** classification runs in
**two** places, both calling Cloud Run `/classify-category`:
1. **Real-time on upload** — `apps/api/src/queueConsumer.ts:138` (queue consumer,
   after face-embed). *SUMMARY.md previously said this was not real-time; the code
   shows it is.*
2. **Backfill** — `POST /admin/events/:id/backfill-categories` for photos where
   `category IS NULL`.

**7 categories:** `couple, ceremony, dances, reception, main_course, family, venue`.

**Why the last three attempts (PRs #121, #128, #130) failed to make it accurate:**

1. **No ground-truth to measure against.** Every session tweaked the text prompts,
   eyeballed a handful of photos, and declared better/worse by feel. There is no
   labeled set, so "did this change help?" was never actually measured. **You cannot
   improve what you cannot measure** — this is the true root cause of the loop.
2. **The model was too weak.** ViT-B/32 is the *smallest* CLIP. It cannot separate
   semantically close wedding scenes — a family group **under the white canopy**
   (which is *ceremony*) looks the same to it as a family portrait **on the stairs**
   (which is *family*). No prompt wording fixes a model that can't see the difference.
3. **Each photo is judged in isolation.** The founder's own insight: photos come in
   bursts at the same place/time; a lone "shoe" frame sitting inside a run of couple
   portraits belongs to *couple*. Per-photo classification throws away this context.

---

## 7. What this session changed (shipped, **verification pending**)

Two structural levers — not a fourth prompt reword:

1. **Model upgrade: ViT-B/32 → ViT-L/14** (`main.py` + `Dockerfile`). Markedly
   stronger fine-grained scene discrimination. ⚠️ **Raises the memory floor
   (~1.6GB weights)** — Cloud Run must be at **≥6Gi** before this is relied on;
   currently 4Gi. Confirm/raise memory at redeploy.
2. **Prompts rebuilt around the founder's real visual cues:** the **white draped
   chuppah canopy** is now the dominant tie-breaker for *ceremony* (a hug or toast
   under the canopy stays ceremony); *family* and *couple* prompts explicitly demand
   a **non-canopy** backdrop (stone wall, staircase, garden); *venue/אולם* keys on
   tables and decor. Added ceremony prompts for the close-up canopy moments the
   screenshots showed being mislabeled (group hug, mic+wine toast, flower girl on the
   white fabric).

**This is NOT verified accurate.** It cannot be measured in this environment
(no live Supabase access; backfill needs the redeployed Cloud Run). It must be
verified against a labeled set once deployed — see the roadmap.

---

## 8. Roadmap — how to actually make classification accurate

Ordered. **#1 is the unlock; skipping it is why we've looped three times.**

1. **Build a labeled ground-truth eval set — do this first, every time.** The
   founder hand-labels the ~35 WED-2024 photos (and later a 2nd real event) into the
   correct categories. This becomes the scoreboard: every change reports accuracy %
   before/after on the same set. No more tuning by feel.
2. **Reconcile the category list to the founder's real mental model.** He thinks in
   **4**: ceremony (חופה), family, אולם (venue), couple. The system has **7**. More
   categories on a borderline model spread probability thinner and cause errors.
   Decide: collapse to the 4–5 that matter, or keep 7 with clear rules.
3. **Verify the ViT-L/14 upgrade** (this session's change) against the eval set once
   Cloud Run is redeployed with ≥6Gi. Keep it only if measured accuracy improves.
4. **Add contextual / sequence intelligence — the founder's insight, the big lever:**
   - *Sequence smoothing:* order an event's photos by filename/timestamp; an
     ambiguous frame surrounded by confident "couple" frames inherits "couple" (the
     shoe-among-couple-photos case).
   - *Visual clustering:* cluster the event's photos by CLIP image embedding; a tight
     cluster shot in one place → one category (the "same place ⇒ probably ceremony"
     rule). Requires processing the event **holistically**, not per-photo — an
     architecture change to the backfill/queue flow.
5. **Human-in-the-loop correction UI.** Let the photographer re-tag a wrong category
   from the dashboard in one tap. For a premium product this *guarantees* guests
   never see an obvious AI error, and every correction becomes new eval/training data.
6. **Only if zero-shot plateaus:** train a small classifier head on the accumulated
   corrections, or move to a stronger vision model. Never before the eval set exists.

---

## 9. Founder actions required (write these forward every session)

- **Label the ~35 photos** into the correct categories (unblocks #1 above).
- **Confirm/raise Cloud Run memory to ≥6Gi** and redeploy the pipeline so ViT-L/14
  loads without OOM.
- **Decide the category list:** 4 (his model) vs 7 (current).
