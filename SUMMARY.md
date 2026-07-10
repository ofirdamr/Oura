# SUMMARY — Oura

**Snapshot — rewritten, not appended.** For structural detail (endpoints, schema, auth, deployment) read `docs/ARCHITECTURE.md`; for session history `PROGRESS.md`; for lessons `MISTAKES.md`.

## Current state: working MVP, live, including Stage 2 face-matching

A photographer can, with zero founder DB/curl intervention: sign up → log in → create an event → brand it (real R2-backed logo upload) → upload photos from the browser → get a real scannable QR + copyable link → find the event again in a real event list. A guest scanning that QR sees those photos in a branded gallery → real biometric consent (with guardian confirmation) → selfie capture → self-hosted face-matching → gift-reveal → personal gallery. All deployed and verified live.

**Live URLs**
- Frontend: https://oura-web.oura-events.workers.dev (Next.js/OpenNext on Cloudflare Workers)
- API: https://oura-api.oura-events.workers.dev (Cloudflare Worker/Hono)
- Embedding service: Cloud Run `oura-embed`, project `ouraforphotographers`, `us-central1` (self-hosted InsightFace/ArcFace, bearer-gated)

**Demo event:** code `WED-2024`, 17 real wedding photos, working face-match — https://oura-web.oura-events.workers.dev/gallery-entry?code=WED-2024 . Founder's account `ofirdamr@gmail.com` has a real password; self-service reset exists (`/forgot-password` → `/reset-password`).

## What's real vs. not (full per-screen table: `docs/ARCHITECTURE.md` §6)

Real end-to-end: whole guest path incl. Stage 2 (code → token → consent → selfie → embed/match → gift-reveal → personal gallery, R2-served photos); whole photographer path (auth → create event → brand → upload → QR); event list, dashboard, photo delete. **Not real yet:** Photo Editor persistence, AI Optimization pipeline, `/join` · `/festive-gallery` · `/minimal-gallery` (static UI, orphaned).

**Face-matching (Stage 2): fully live** — migration applied (30-day retention TTL, guardian-confirmation column, `match_faces` ANN RPC), queue-based embedding pipeline, zero-retention selfie-match endpoint (guest selfie + its embedding never persisted, only the match link), retention cron. Legal basis resolved (formal signed opinion received — `PRD.md` §8, `docs/ARCHITECTURE.md` §8). Residual, non-blocking: cosine match thresholds (`CLUSTER_MATCH_THRESHOLD`/`GUEST_MATCH_THRESHOLD`) are untuned config-var guesses, cheap to fix without redeploy once a real pilot gives match-rate data.

## Open items

**Founder decision needed**
- **Email sender branding:** reset emails send from Supabase's shared sender, not "Oura." Needs custom SMTP → needs a transactional-email provider + a domain the founder owns. Recommended (not actioned): register a `.com` via Cloudflare Registrar (avoid `oura.com`/`.io` — sleep-tracker brand) + Resend free tier. **Waiting on the founder to register a domain and pick a name.**
- **Orphaned screens** `/join` · `/festive-gallery` · `/minimal-gallery`: zero live links, but `PRD.md` §4 lists them as MVP features. Remove vs. build out as a real per-event gallery theme — founder is firmly against removing designed features; he floated using them as a demo/showcase, then parked it.
- **Demo-readiness (founder priority, strategic):** a fresh account looks empty to prospects. Real ask = finish the MVP to a demoable state. Best demo today is the seeded `WED-2024`. Options: seed a sample event on signup, or polish empty states. Not started.

**Known, real, NOT fixed** (confirmed in code)
- QR scanner opens the **front** camera despite requesting `facingMode:"environment"` — likely an in-app WKWebView ignoring it; hardening = enumerate devices and force rear. Confirm founder's browser first.
- Dead buttons (no handler): `/gallery` "download all" / "share gallery"; `/admin/qr-management` two print sub-options + fullscreen-display.
- Content missing vs. design (needs backend/feature work): personal-gallery name headline + event-name + per-photo match-confidence badges; dashboard 3rd stat card + AI panel + tip card; events-list 4th stat card.

**Not a concern yet:** Supabase 500MB free-tier cap — current usage a few KB; a full wedding ≈4MB; 100+ events away, re-check via dashboard if it scales.

## Process notes (important)

- **Every task starts with the Token Economist line, `universal-framework` loaded, and `hebrew-rtl-best-practices` before any UI edit** — hook-enforced. A whole session once ran without these (`MISTAKES.md` 2026-07-07).
- **Deploy is a separate step from commit.** Two fix commits were once committed and never deployed while the founder was shown "unchanged" screens — read the 2026-07-06 "never deployed" entry in `MISTAKES.md` and the live-verify method (`docs/ARCHITECTURE.md`) before any design-fidelity work: curl SSR routes; md5 the deployed `/_next/static/chunks/*.js` against the local build for client-rendered routes.
- RTL fidelity: check the real `design/*/screen.png` first, then measure the live DOM with `getBoundingClientRect()` — never CSS reasoning or an eyeballed screenshot (`hebrew-rtl-best-practices` §Step 8).

**Open questions blocking Phase 2** (not this milestone): `PRD.md` §8 — final ILS pricing, print-fulfillment partner.
