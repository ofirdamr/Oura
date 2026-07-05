# SUMMARY — Oura

**Read this first, then `docs/ARCHITECTURE.md` for structural detail (endpoints, schema, auth, deployment) and `PROGRESS.md` for history if you need it. This file is a snapshot — it gets rewritten, not appended.**

## Current state: working MVP, live, including Stage 2 face-matching

A photographer can, with **zero founder DB/curl intervention**: sign up → log
in → create an event → brand it (incl. a real R2-backed logo upload) → open
the event and upload their own photos from the browser → get a real
scannable QR + copyable link → find the event again later in a real event
list → and a guest scanning that QR sees those exact photos in a real
branded gallery, then goes through real biometric consent → a real selfie
capture → real self-hosted face-matching → a gift-reveal moment → their
personal gallery. All of this is deployed and verified live, not just
typechecked.

**Live URLs:**
- Frontend: https://oura-web.oura-events.workers.dev (Next.js via OpenNext, Cloudflare Workers)
- API: https://oura-api.oura-events.workers.dev (Cloudflare Worker/Hono)
- Embedding service: Cloud Run, project `ouraforphotographers`, region `us-central1`, service `oura-embed` (self-hosted InsightFace/ArcFace, never a per-call managed API)

**One seeded demo event exists:** code `WED-2024`, 17 real wedding photos
(founder's own album), reachable via `https://oura-web.oura-events.workers.dev/gallery-entry?code=WED-2024`
or by scanning its QR. Founder's photographer account (`ofirdamr@gmail.com`)
has a real password (shared once in chat, not stored in any file) — no
password-reset flow exists yet if it's forgotten, would need a new one set
via the Supabase Admin API.

## What's real vs. not — see `docs/ARCHITECTURE.md` §6 for the full per-screen table

Real end-to-end: the entire guest path including Stage 2 (code resolution →
token → consent with guardian confirmation → selfie capture → real face
embedding/matching → gift-reveal → personal gallery, real R2-served photos),
the entire photographer onboarding path (auth → create event → brand →
upload photos → QR), event list, dashboard, photo delete. Deliberately not
real yet: Photo Editor persistence, AI Optimization's pipeline,
`/join`/`/festive-gallery`/`/minimal-gallery` (static UI, superseded or
unused so far).

**Face-matching (Stage 2): fully live.** DB migration applied (30-day
retention TTL trigger, guardian-confirmation column, `match_faces` ANN RPC).
`apps/api` deployed with the queue-based photo embedding pipeline, the guest
selfie-matching endpoint (zero-retention by design — the guest's own selfie
and its embedding are never persisted, only the resulting match link), the
30-day retention cleanup cron, and the guardian-confirmation consent gate.
The embedding service is deployed to Cloud Run (public network access,
gated by a bearer-token secret rather than Google IAM, since no VPC peering
exists between Cloudflare and Cloud Run). `/consent`'s redirect now points
to the real `/selfie` capture screen (built from the founder's Stitch
export), which routes to `/gift-reveal` on completion, landing on
`/gallery`. Verified live end-to-end against throwaway test guests on the
real `WED-2024` event.

Two honest residual caveats, not blockers: (1) the cosine-similarity match
thresholds are initial domain-convention guesses, not yet tuned against real
pilot-event match rates — they're config vars specifically so that's cheap
to fix later without a redeploy; (2) legal basis is an informal draft
opinion (from a lawyer-friend, formal signed version still to follow) — the
founder explicitly decided to proceed on that basis, accepting the risk
ahead of formal sign-off. See `PRD.md` §8 and `docs/ARCHITECTURE.md` §8.

## How we got here (compressed — see `PROGRESS.md` for full detail)

1. Ported all 14 MVP screens from the 42-screen Stitch export (+1 designed
   fresh: the consent gate, since CLAUDE.md flagged it missing from the
   export). RTL/logical-properties throughout, self-hosted fonts, real
   brand logos.
2. **Stage 1:** made the entire guest path real (event-code resolution,
   guest tokens, consent, R2-served photos) and deployed `apps/web` publicly
   for the first time. Seeded one real demo event by hand.
3. **Stage 3** (Stage 2/face-matching deliberately deferred at the time):
   real photographer Supabase Auth (cookie sessions, `/admin/*` middleware),
   fresh login/signup screens, admin CRUD wired to real Supabase writes.
4. **"Working MVP" milestone:** real multi-file upload + delete screen, real
   event list, de-mocked dashboard, real scannable QR.
5. Added `docs/ARCHITECTURE.md` as a real, maintained structural reference —
   a hard rule (in `CLAUDE.md` and the `universal-framework` skill) to
   update it in the same commit as any route/schema/auth/deployment change.
6. **Stage 2, built and deployed:** installed an `israeli-privacy-shield`
   reference skill for Israeli Privacy Law/Amendment 13 guidance; founder
   obtained an informal draft legal opinion and accepted the risk of
   proceeding ahead of formal sign-off; built the full face-matching
   pipeline (migration, queue consumer, selfie-match endpoint, retention
   cron); founder set up a GCP project/billing/service account and handed
   over credentials; deployed the embedding service to Cloud Run (fixing a
   real Dockerfile compiler-dependency bug along the way, and working
   through three incremental IAM role additions); built the real `/selfie`
   screen from the founder's returned Stitch export (fixing a Hebrew/
   Hanken-Grotesk font bug and dropping the export's CDN tags); flipped
   `/consent`'s redirect and wired `/gift-reveal` in; verified live
   end-to-end.

**Process note for continuity:** this project runs on genuine hybrid
orchestration — a Plan/PM agent decides sequencing at each milestone
boundary (not the assistant solo), independent subagents do separable
implementation work in parallel git worktrees, the orchestrating session
integrates + verifies live + deploys. This is a standing rule, not a
one-off preference — see `.claude/skills/universal-framework/SKILL.md`.

## Next milestone: not yet decided

Rough edges worth a Plan/PM consult on sequencing, none blocking:
- Guest tokens never expire and travel in the URL path (flagged by an
  earlier security review).
- No photographer password-reset flow.
- `/join`/`/festive-gallery`/`/minimal-gallery` are orphaned static screens
  worth either wiring or removing.
- Match thresholds (`CLUSTER_MATCH_THRESHOLD`/`GUEST_MATCH_THRESHOLD`) are
  untuned guesses — worth revisiting once a real pilot event generates
  actual match-rate data.
- The formal signed legal opinion is still pending (informal draft only so
  far) — worth checking status before any real pilot with paying guests.
- **Supabase free-tier 500MB DB cap — not a concern yet, no action needed.**
  Checked live: current usage is a few KB (1 event, 4 guests, 17 photo
  metadata rows, 0 face-embedding rows — photo binaries live in R2, never
  Postgres). Rough math: a fully-processed real wedding (~500 photos, ~3
  faces/photo) costs ~4MB of DB space, dominated by face-embedding vectors;
  hitting 500MB would take 100+ such events, by which point paying
  Supabase's $25/mo is trivial next to that revenue, not a reason to
  migrate. Deliberately not worth an automated monitor at this growth rate
  — just re-check actual usage (`select count(*)` per table, or Supabase's
  own dashboard) if this project scales to many dozens of real events.

**Open questions still blocking Phase 2 (not this milestone):** see `PRD.md`
§8 — final ILS pricing, print fulfillment partner choice.
