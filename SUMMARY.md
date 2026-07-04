# SUMMARY — Oura

**Read this first, then `docs/ARCHITECTURE.md` for structural detail (endpoints, schema, auth, deployment) and `PROGRESS.md` for history if you need it. This file is a snapshot — it gets rewritten, not appended.**

## Current state: working MVP, live

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
photo delete. Deliberately not real yet: face-matching (personal gallery
honestly shows "still searching for you"), Photo Editor persistence, AI
Optimization's pipeline, `/join`/`/festive-gallery`/`/minimal-gallery`
(static UI, superseded or unused so far), `/gift-reveal` (built, not wired
into any navigation flow yet).

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
3. **Stage 3** (Stage 2/face-matching deliberately deferred — see below):
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

**Process note for continuity:** this project runs on genuine hybrid
orchestration — a Plan/PM agent decides sequencing at each milestone
boundary (not the assistant solo), independent subagents do separable
implementation work in parallel git worktrees, the orchestrating session
integrates + verifies live + deploys. This is a standing rule, not a
one-off preference — see `.claude/skills/universal-framework/SKILL.md`.

## Next milestone: not yet decided

Two live candidates, deliberately not pre-chosen — per this project's
standing rule, whoever continues this should consult a Plan/PM agent for the
actual sequencing call rather than just picking one:
- **Stage 2:** self-hosted face-embedding pipeline (Fly.io/Cloud Run,
  InsightFace/ArcFace → `pgvector`), a new selfie-capture screen (no design
  source — needs a founder-run Stitch prompt), wiring `/gift-reveal` into
  the real consent→gallery flow. Blocked on PRD §8's biometric legal review,
  which the founder has explicitly deferred twice — check whether that's
  changed before assuming this is unblocked.
- Other rough edges not yet addressed: guest tokens never expire and travel
  in the URL path (flagged by an earlier security review), no photographer
  password-reset flow, `/join`/`/festive-gallery`/`/minimal-gallery` are
  orphaned static screens worth either wiring or removing, `/gift-reveal`
  has no navigation path leading to it.

**Open questions still blocking Phase 2 (not this milestone):** see `PRD.md`
§8 — biometric retention policy, final ILS pricing, print fulfillment
partner choice.
