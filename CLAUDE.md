# CLAUDE.md — Oura

Event-photography SaaS. Guests scan a QR at an event → live, face-matched, branded gallery on their phone. See `PRD.md` for full product detail, `SUMMARY.md` for current state.

## Stack
- Frontend: Next.js (App Router), PWA, RTL/Hebrew-first (`hebrew-rtl-best-practices` skill applies to all UI work). Three.js + GSAP for the gift-box reveal. Self-hosted Rubik/Hanken Grotesk fonts.
- Backend/API: Cloudflare Workers + Hono.
- DB: Postgres via Supabase (Auth + Realtime + `pgvector`).
- Media: Cloudflare R2 (zero egress) + Cloudflare CDN. Video via Cloudflare Stream.
- Background processing: Cloudflare Queues (light) + Fly.io/Cloud Run compute pool (face-embed, transcode, culling — heavy CPU).
- Face recognition: self-hosted InsightFace/ArcFace → `pgvector`, never a per-call managed API.
- Payments: Stripe Billing (subscriptions) + Stripe Checkout (pay-per-event); Stripe Connect only once print commissions are live.

## Guardrails (do not violate)
- Before reporting any change to `/packages/processing-pipeline` or `/apps/web` as done, run the `media-ui-verify` skill (lint/typecheck, RTL, font, R2-vs-Supabase boundary, consent-gate ordering, design fidelity, live screenshot — see `.claude/skills/media-ui-verify/`).
- Media binaries never touch Supabase storage — R2 only.
- Guests never require login/signup — signed opaque event-scoped token only.
- No CDN `<script>` tags in production builds (Tailwind/fonts/Three.js/GSAP must be bundled npm deps) — the Stitch export used CDN tags, that was fine for a mockup only.
- Face-matching may not run before the guest accepts the biometric-consent gate. No exceptions, no "just for the pilot."
- Per-screen implementation must match `design/*/screen.png`, not the folder name — a naming/content mismatch was already found once in the export.
- `--font-display` (Hanken Grotesk) has no Hebrew glyphs — never apply it to elements that render Hebrew text (already caused one fallback-font bug). Use it only for pure-Latin branding bits (e.g. "OURA", "PLATINUM" badges). Rubik (`--font-sans`) is the default for everything else.
- Use CSS logical properties (`ms-*`/`me-*`/`ps-*`/`pe-*`/`text-start`/`text-end`), never physical `ml-*`/`mr-*`/`text-left`/`text-right`, per `hebrew-rtl-best-practices`.
- Every task starts with a visible Token Economist consult (leanest path / model / scope guard / orchestration mode) — see `MISTAKES.md` for why this is non-negotiable here.
- **Before starting any task that wires/fixes/builds a specific named feature, check for existing open PRs/branches touching the same area first** (`list_pull_requests`, `list_branches`). A real incident: the same "wire the dead gallery buttons" task got independently rebuilt from scratch three times (PRs #9, #17, #18) because nobody checked whether it was already done — and the best of the three versions (#10, live since 2026-07-08) sat unmerged for two days and nearly got overwritten by a later, worse duplicate. See `PROGRESS.md`'s 2026-07-10 "pileup" entry.
- **Merge is not an ask-first gate.** Once a change clears the verification it's actually capable of clearing in this environment (build/lint/typecheck, and live QA wherever the environment can reach it), merge it as part of closing out the mission — do not leave it as an open draft waiting on a "should I merge this?" reply that may never come. Revert is the safety net if the founder doesn't like the result, not a pre-merge approval gate. Deploying and merging unverified/broken code is still wrong — disclose blind spots honestly (per the Quality Gate) rather than silently skipping verification to merge faster.
- **Any question that genuinely does need the founder's answer** (not merge/deploy — those default to yes now) gets written into `SUMMARY.md`'s state explicitly, and every subsequent session must check for it and re-surface it before starting new work in that area — it never just quietly drops because a session ended before the founder replied.
- **Every open/unmerged PR gets named in `SUMMARY.md`, every session, no exception.** If a PR can't be cleanly merged (real conflicts, needs a decision), it does not have to be merged right now, but it must be listed there with what it is and why — "founder said stop" is never a reason to skip this step; update the doc, then stop.
- **State the concrete plan before executing it.** After the Token Economist consult (leanest path/model/scope/mode), say in one or two lines what you're actually about to build/change/deploy before doing it — not just the abstract mode/model — so the founder can redirect before tokens are spent, not after finding out from the diff.
- **"Done" always ships with the clickable live link — no exceptions.** Any time you report something done/deployed/fixed/verified, the same message must include the exact live URL to *see it* — deep-linked to the specific screen or flow you changed (e.g. `https://oura-web.oura-events.workers.dev/gallery`), not just the site root, not "it's live." A completion report without a link is an incomplete report. This has been dropped repeatedly; treat the link as a required field of every "done", the same as verification itself.
- **Never design new visuals directly.** Founder runs new/missing-screen design through Stitch himself. When a task needs a screen or UI element with no existing `design/*/screen.png` source, do not freehand it — write a clear, ready-to-paste Stitch prompt (what the screen is for, key content/actions, how it fits the existing dark-luxury Hebrew/RTL visual language) and hand it to the founder to run through Stitch. Implement in code only once he brings back the resulting export. This does not apply to re-implementing an existing Stitch screen from `design/*` — that's normal code work.

## Repo layout
```
/apps/web                      Next.js app (guest gallery + photographer dashboard)
/apps/api                      Cloudflare Worker (Hono), wrangler.toml
/packages/processing-pipeline  face-embed, culling, transcode, overlay compositing workers
/packages/shared               shared TS types/schemas
/design                        Stitch export, 42 reference screens + brand spec (source of truth for UI)
```

## Docs
- `PRD.md` — product spec, personas, feature phases, pricing, open questions (living doc).
- `SUMMARY.md` — current build state snapshot, read first each session.
- `PROGRESS.md` — append-only session log.
- `MISTAKES.md` — append-only lessons log.
- `docs/ARCHITECTURE.md` — structural reference: endpoints, DB schema, auth model, deployment topology. **Hard rule: update it in the same commit as any change to a route, table/column/RLS policy, frontend route, or env var/secret** — this is what stands between a real incident and debugging blind. `SUMMARY.md` is the narrative snapshot; this is the structural one. Never let it silently drift stale.
