# SUMMARY — Oura

**Read this first. Then `docs/ARCHITECTURE.md` for structure, `PROGRESS.md` for recent session log.**

---

## Current State (2026-07-20)

Working MVP, live. A photographer can sign up → create event → brand it → upload photos → get QR. A guest scans QR → biometric consent → selfie → face-matching → gift-reveal → personal gallery with matched photos, name headline, match % badges. All deployed.

**Live URLs:**
- Frontend: https://oura-web.oura-events.workers.dev
- API: https://oura-api.oura-events.workers.dev
- Embedding: Cloud Run `ouraforphotographers / oura-embed`
- Demo: https://oura-web.oura-events.workers.dev/gallery-entry?code=WED-2024

**Deployed versions:** oura-api `28dfa8ac`, oura-web `c1cedcca`

---

## Current Mission — PRD §10.4

**Branch:** `claude/oura-10-4-migration-c8dmmn`  
**Migration 0011:** applied ✅

**⚠️ PENDING FOUNDER ACTION:**
Redeploy Cloud Run `oura-embed` → https://console.cloud.google.com/run/detail/us-central1/oura-embed/revisions?project=ouraforphotographers → Edit & Deploy New Revision → Deploy.

Once founder confirms Cloud Run redeploy done:
1. Merge PR #94
2. Proceed to §10.5/§10.6 per PRD order

---

## Open PRs

| PR | Branch | Status |
|----|--------|--------|
| **#94** | `claude/oura-10-3-deploy-wb0txc` | §10.3 smart crop / social export — awaiting founder Cloud Run redeploy, then merge |
| #16, #4, #7 | various | Old doc PRs with merge conflicts — low priority, resolve in a trim session |

---

## What's Real vs. Not

**Real end-to-end:** entire guest path (Stage 2 face-matching), photographer onboarding, event list, dashboard, photo delete, AI Optimization panel, photo editor, personal gallery (name + event + match badges), gallery theme selector, festive filter chips (category-labeled via LLaVA), multi-select + action bar, password reset (Brevo-immune confirm gate), rate-limited `/auth/forgot-password`, client-side ZIP upload engine (§10.2), smart crop / social-export (§10.3).

**Not real yet:** `/join`, `/festive-gallery`, `/minimal-gallery` (static UI, unused), Premium Prints / Checkout / Order Confirmation (Phase 2), Statistics / Messaging / Notifications / Reports (Phase 2).

---

## Key Guardrails (never violate)

- NEVER mutate `ofirdamr@gmail.com` auth credentials. Throwaway accounts for auth testing.
- Media binaries: R2 only, never Supabase storage.
- Face-matching: NEVER before biometric consent gate.
- Fonts: `--font-display` (Hanken Grotesk) for Latin-only branding; Rubik (`--font-sans`) for all Hebrew.
- CSS: logical properties only (`ms-*`/`me-*`/`ps-*`/`pe-*`), never physical `ml-*`/`mr-*`.
- Design is king: check `design/screens/<name>/screen.png` before coding any screen. All 42 exist.
- Update `docs/ARCHITECTURE.md` in the same commit as any route/schema/auth/deployment change.
- Follow PRD order. Don't ask the founder to pick — PM chooses the next mission.
- Every "done" ships with the clickable live link.
