# SUMMARY — Oura

**Read this first, then `docs/ARCHITECTURE.md` for structural detail (endpoints, schema, auth, deployment) and `PROGRESS.md` for history if you need it. This file is a snapshot — it gets rewritten, not appended.**

## Current state: working MVP, live; Stage 2 built but not deployed

A photographer can, with **zero founder DB/curl intervention**: sign up → log
in → create an event → brand it (incl. a real R2-backed logo upload) → open
the event and upload their own photos from the browser → get a real
scannable QR + copyable link → find the event again later in a real event
list → and a guest scanning that QR sees those exact photos in a real
branded gallery. All of this is deployed and verified live, not just typechecked.

**Live URLs:**
- Frontend: https://oura-web.oura-events.workers.dev (Next.js via OpenNext, Cloudflare Workers)
- API: https://oura-api.oura-events.workers.dev (Cloudflare Worker/Hono)

**One seeded demo event exists:** code `WED-2024`, 17 real wedding photos
(founder's own album), reachable via `https://oura-web.oura-events.workers.dev/gallery-entry?code=WED-2024`
or by scanning its QR. Founder's photographer account (`ofirdamr@gmail.com`)
has a real password (shared once in chat, not stored in any file) — no
password-reset flow exists yet if it's forgotten, would need a new one set
via the Supabase Admin API.

## What's real vs. not — see `docs/ARCHITECTURE.md` §6 for the full per-screen table

Real end-to-end: the entire guest path (code resolution → token → consent →
gallery, real R2-served photos), the entire photographer onboarding path
(auth → create event → brand → upload photos → QR), event list, dashboard,
photo delete. Deliberately not real yet: Photo Editor persistence, AI
Optimization's pipeline, `/join`/`/festive-gallery`/`/minimal-gallery`
(static UI, superseded or unused so far), `/gift-reveal` (built, not wired
into any navigation flow yet).

**Face-matching (Stage 2): infrastructure deployed, embedding service still
pending.** DB migration applied to the live DB (verified: retention backfill
clean, `guardian_confirmed`/`embed_status` columns present, `match_faces` RPC
callable). `apps/api` deployed with the queue-based photo embedding pipeline,
the guest selfie-matching endpoint (`POST /guests/:token/selfie`,
zero-retention by design), the 30-day retention cleanup cron, and the
guardian-confirmation consent gate — all verified live against a throwaway
test guest on the real `WED-2024` event (guardian gate 400s correctly,
consent sets `retention_expires_at` at exactly +30 days, selfie 403s
pre-consent and fails gracefully post-consent since no embedding host exists
yet). What's still pending:
- The self-hosted InsightFace/ArcFace embedding service
  (`packages/processing-pipeline`) has never been deployed to a real host —
  this dev sandbox has no Fly.io/GCP credentials, only Cloudflare's. Built
  and its HTTP-layer logic tested locally with the model stubbed (the
  sandbox's proxy allowlist blocks GitHub release downloads, so
  InsightFace's actual weights were never fetched here).
- The real selfie-capture screen doesn't exist — no design source, needs a
  founder-run Stitch export (prompt already handed over). `/consent`'s
  redirect and `/gift-reveal`'s wiring intentionally weren't touched yet —
  both ship together with the real `/selfie` screen in one deploy, never
  split (splitting would 404 live guests mid-flow).

Legal basis for building ahead of full sign-off: the founder received an
informal draft legal opinion (from a lawyer-friend, formal signed version to
follow) recommending a 30-day retention window, an active consent gesture,
and guardian/age confirmation, and explicitly decided to proceed on that
basis, accepting the risk. See `PRD.md` §8 and `docs/ARCHITECTURE.md` §8.

## How we got here (compressed — see `PROGRESS.md` for full detail)

1. Ported all 14 MVP screens from the 42-screen Stitch export (+1 designed
   fresh: the consent gate, since CLAUDE.md flagged it missing from the
   export). RTL/logical-properties throughout, self-hosted fonts, real
   brand logos (after a false start reconstructing fake transparency from a
   bad export — superseded once the founder re-exported properly).
2. **Stage 1:** made the entire guest path real (event-code resolution,
   guest tokens, consent, R2-served photos) and deployed `apps/web` publicly
   for the first time (it had only ever run in local dev before). Seeded one
   real demo event by hand.
3. **Stage 3** (Stage 2/face-matching deliberately deferred at the time):
   real photographer Supabase Auth (cookie sessions, `/admin/*` middleware),
   fresh login/signup screens, admin CRUD (create-event/branding/
   qr-management) wired to real Supabase writes under RLS.
4. **"Working MVP" milestone:** closed the gap where a photographer could
   create an event but had no browser path to actually add photos to it —
   real multi-file upload + delete screen, real event list (ported from a
   previously-skipped Stitch screen), de-mocked dashboard (was showing
   fabricated other-photographers'-events data), real scannable QR
   (`qrcode` npm package, replacing a static icon).
5. Added `docs/ARCHITECTURE.md` as a real, maintained structural reference —
   it didn't exist before despite PRD.md promising it; now a hard rule
   (in this project's `CLAUDE.md` and the `universal-framework` skill,
   generalized for any project) to update it in the same commit as any
   route/schema/auth/deployment change.
6. **Stage 2 build (this pass):** installed an `israeli-privacy-shield`
   reference skill for Israeli Privacy Law/Amendment 13 guidance; founder
   obtained an informal draft legal opinion and accepted the risk of
   proceeding ahead of formal sign-off; built the full face-matching
   pipeline (migration, queue consumer, selfie-match endpoint, retention
   cron, embedding service) per the sequencing in item 6 above — see the
   "Face-matching (Stage 2)" section for exactly what's live vs. pending.

**Process note for continuity:** this project runs on genuine hybrid
orchestration — a Plan/PM agent decides sequencing at each milestone
boundary (not the assistant solo), independent subagents do separable
implementation work in parallel git worktrees, the orchestrating session
integrates + verifies live + deploys. This is a standing rule, not a
one-off preference — see `.claude/skills/universal-framework/SKILL.md`.

## Next milestone: finish deploying Stage 2

Remaining (see `docs/ARCHITECTURE.md` §9 for exact steps):
1. Deploy `packages/processing-pipeline` to a real host (Fly.io vs Cloud
   Run — not yet decided) and wire its URL/token into `apps/api`.
2. Get the founder's Stitch export for the selfie-capture screen, build it,
   flip `/consent`'s redirect, wire `/gift-reveal` in — one deploy.

Other rough edges not yet addressed, still worth a Plan/PM consult on
sequencing: guest tokens never expire and travel in the URL path (flagged by
an earlier security review), no photographer password-reset flow,
`/join`/`/festive-gallery`/`/minimal-gallery` are orphaned static screens
worth either wiring or removing.

**Open questions still blocking Phase 2 (not this milestone):** see `PRD.md`
§8 — final ILS pricing, print fulfillment partner choice.
