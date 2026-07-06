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
has a real password (shared once in chat, not stored in any file). A real
self-service password-reset flow now exists (`/forgot-password` →
`/reset-password`, via Supabase Auth) if it's ever forgotten again — no
founder/Admin-API intervention needed.

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

One honest residual caveat, not a blocker: the cosine-similarity match
thresholds are initial domain-convention guesses, not yet tuned against real
pilot-event match rates — they're config vars specifically so that's cheap
to fix later without a redeploy. Legal basis is now resolved: the founder
confirmed the formal signed legal opinion has been received (previously an
informal draft only). See `PRD.md` §8 and `docs/ARCHITECTURE.md` §8.

**2026-07-05 fix: pre-Stage-2 photos weren't actually being matched.** A real
guest selfie test against the live `WED-2024` demo event found no match
despite the guest appearing in nearly every photo. Root cause: the event's 17
photos were seeded before Stage 2's enqueue-on-upload existed, so they were
stuck at `embed_status:'pending'` forever with zero `face_embeddings` rows —
nothing existed for a selfie to match against. Fixed with a new operator
route, `POST /admin/backfill-embeddings` (bearer-gated, re-enqueues any
photo not yet `done`), run live against `WED-2024`: 15/17 photos now fully
embedded (262 `face_embeddings` rows, 96 person clusters), 1 failed, 1 still
hangs on retry. Also fixed a related bug hit while running the backfill:
`embedClient.ts`'s `fetch()` to the Cloud Run embedding service had no
timeout, so a single stalled response could hang a queue message
indefinitely — added a 25s timeout so stalls now fail into the existing
retry/DLQ path instead. See `MISTAKES.md` and `docs/ARCHITECTURE.md` §4/§8
for detail; the one still-hanging photo is a narrow follow-up, not a
blocker — retest the selfie flow on `WED-2024` now, it should match.

**2026-07-05 (cont.): full visual RTL/design-fidelity audit across every
screen, plus a real logo-upload bug fix.** Founder pushed back hard on
visual QA rigor mid-session (several genuine RTL bugs had shipped and been
"fixed" backwards more than once by reasoning about CSS instead of
measuring the real DOM). Response: rebuilt `admin/events` for full design
fidelity (real search/status-filter/CSV-export/list-grid-toggle, not just
the bare table it had before); fixed ~15 confirmed `flex-row-reverse`
ordering bugs across `AdminShell`, `admin/create-event`, `admin/events/
[event_id]`, `admin/qr-management`, `admin/page.tsx` (dashboard), `admin/
branding`, `admin/ai-optimization`, `gift-reveal`, `gallery`, `gallery-
entry`, `join`, and `festive-gallery` — icons/labels/action rows that were
rendering backwards vs. their actual Stitch design references (mostly
`flex-row-reverse` inverting content, a couple of `text-start`/`text-end`
and `start-*`/`end-*` inversions, one caused by `material-symbols-outlined`
forcing `direction:ltr` on itself). Codified the fix into a permanent,
mandatory verification method in `hebrew-rtl-best-practices/SKILL.md` §Step
8: check the actual design screenshot first, then measure the live DOM with
`getBoundingClientRect()`/`getClientRects()` — never trust CSS reasoning or
an eyeballed screenshot alone, since every RTL bug this session was first
"fixed" wrong at least once that way.
Separately, found and fixed a real functional bug: re-uploading a studio
logo on `/admin/branding` silently appeared to do nothing. Root cause: the
logo was stored under a **fixed** per-event R2 key, but the shared
`GET /media/*` route caches every key for a year as `immutable` (correct for
content-addressed photo keys, wrong for a reusable logo URL) — a re-upload
changed the R2 bytes but not the URL, so the browser/CDN kept serving the
year-old cached image. Fixed by making the logo key content-addressed per
upload (matching how photos already work) and best-effort deleting the
previous logo object afterward. See `MISTAKES.md` for both write-ups.

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

## One known Supabase Auth config gap — needs a founder business decision

- **Reset email sends from Supabase's own shared sender, not "Oura."**
  Needs custom SMTP wired into Supabase (Authentication → SMTP Settings),
  which needs a real transactional-email provider account + a domain the
  founder controls (SPF/DKIM verification — no way around owning a domain).
  Recommended path, not yet actioned: register a small domain via Cloudflare
  Registrar (already using Cloudflare for everything else, at-cost pricing;
  avoid `oura.com`/`oura.io`, taken by the sleep-tracker brand), pair with
  Resend's free tier (3,000 emails/month, easy Supabase SMTP integration).
  Founder confirmed `.com` over `.co.il` is fine even for an Israel-first
  launch (`.co.il` needs a local registrar + Israeli ID/business-number
  verification, more friction for no real benefit here). **Still waiting on
  the founder to actually register a domain and pick a name** before this
  can move forward.

**2026-07-06: password-reset redirect fixed.** The previously-documented
"Site URL is stuck on `localhost:3000`" gap turned out to be stale — the
live Supabase Auth config's `site_url` was already correctly set to
`https://oura-web.oura-events.workers.dev/` (fixed by someone/some session
without updating this doc). The real live bug was in `uri_allow_list`: a
typo (`.../reset-passwordto`) meant the app's actual `redirectTo` never
matched the allow-list, so Supabase silently fell back to `site_url` (the
homepage) instead of landing on `/reset-password`. Fixed via
`PATCH /v1/projects/:ref/config/auth` using a founder-issued Supabase PAT;
verified the corrected value persisted on a fresh `GET`. Sender branding
(above) is still open and separate.

## Next milestone: not yet decided

**2026-07-06: guest token expiry — shipped and verified live.** Added
`guests.token_expires_at` (migration `0004_guest_token_expiry.sql`, 90 days
from creation, backfilled for existing rows) and enforced it in
`resolveGuest()` (`apps/api/src/index.ts`) — a leaked/logged guest token now
stops working after 90 days instead of granting indefinite access. Applied
the migration live via a founder-issued Supabase PAT (verified `NOT NULL` +
correct default + all 8 existing `guests` rows backfilled), redeployed
`apps/api`, and verified end-to-end against a throwaway `WED-2024` test
guest: fresh token → `200`, tampered token → `401 invalid_token`, a
deliberately backdated `token_expires_at` → `401 token_expired`. Test guest
row deleted afterward. The other half of the original flag — tokens
traveling in the URL path, loggable at proxies/CDNs — remains unaddressed,
deliberately out of scope for this pass (a larger structural change, see
`docs/ARCHITECTURE.md` §4). **Founder: the PAT used for this can now be
revoked** (supabase.com/dashboard/account/tokens), same as prior sessions.

Rough edges worth a Plan/PM consult on sequencing, none blocking:
- `/join`/`/festive-gallery`/`/minimal-gallery` are orphaned static screens —
  zero live inbound/outbound links today, but `PRD.md` §4 lists Festive/
  Minimal/Personal Gallery as three separate MVP features, so the intended
  scope (remove vs. build out as a real selectable per-event gallery theme)
  needs a founder call before more code gets written here, not another
  guess — see the PM consult in this session's history for the two very
  different implementation paths and their tradeoffs.
- Match thresholds (`CLUSTER_MATCH_THRESHOLD`/`GUEST_MATCH_THRESHOLD`) are
  untuned guesses — worth revisiting once a real pilot event generates
  actual match-rate data. Deliberately not manufacturing tuning data early
  (e.g. logging raw selfie match scores) since that would itself be new
  biometric-adjacent retained data requiring the same legal sign-off Stage 2
  already went through — parked until a real pilot happens, not actioned.
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
