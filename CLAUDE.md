# CLAUDE.md — Oura

## ⛔ "DONE" REQUIRES FULL VERIFICATION (non-negotiable)
You may only say a mission is "done" after ALL of the following are confirmed in that same session:
1. **Code review** — every file changed was read and checked for correctness.
2. **Visual review** — real Playwright screenshot of the live deployed app (not localhost, not a local build). Screenshots MUST be committed to the repo under `qa/screenshots/` — storing them only in `/tmp` or the scratchpad means they are lost forever when the session ends.
3. **End-to-end check** — every button, feature, and element in the mission scope was clicked/tested and works.
If any one of these three is missing, say what was verified and what was not — never say "done."

## ⛔ HANDOFF SUMMARY REQUIRED AT END OF EVERY SESSION (non-negotiable)
Before ending any session or mission, write a short summary directly in the chat:
- What was completed (with evidence — screenshot, PR link, or curl result).
- What was NOT completed or NOT verified.
- What the next session must do first.
Then commit an updated SUMMARY.md reflecting this honest state before the session ends.

## ⛔ SOLO MODE ONLY — NO AGENTS (non-negotiable)
**Do NOT spawn any sub-agents, background agents, or specialist agents.** Every task runs Solo in the top-level session. No Agent tool calls, no foreground or background spawns. This rule stays until the founder explicitly lifts it.

## ⛔ NEVER SAY "MVP" OR "LIVE END-TO-END" (non-negotiable)
**§10 (Two-Stage Upload, Smart Crop, Print Shop, DB Schema) has NOT been confirmed complete by the founder.** Until the founder explicitly says "§10 is done", never describe the product as "MVP", "live end-to-end", or "working end-to-end". Never write ✅ next to any §10 item without a real screenshot from the live running app taken in that same session. Writing false ✅ checkmarks in SUMMARY.md is the single biggest mistake this project has suffered — it causes every new session to start with a lie and wastes the founder's time.

## Agent Spawning Rule (non-negotiable)
**Never spawn a background agent (`run_in_background: true`) unless you can guarantee the ability to stop it in the same session.** If the session might end before the agent finishes, do NOT spawn it. Foreground agents only, so the founder always has control. Violating this rule is prohibited.

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
- **NEVER send any email to ofirdamr@gmail.com during testing — ever.** Triggering password reset, magic link, confirmation, or any transactional email to the founder's real address is prohibited. For any email-flow testing: create a throwaway account with a different email (e.g. a temp address), test with it, delete it when done. The founder's inbox was flooded by sessions testing the reset flow with his real account — this must never happen again.
- **NEVER mutate the real founder account's auth credentials.** Calling `auth.admin.updateUserById()`, the Supabase Management API (`PATCH /v1/projects/.../config/auth`), or any equivalent against `ofirdamr@gmail.com` or any live production Supabase user is **prohibited** during testing, debugging, or any session work. For auth testing: create a throwaway account with a different email, test with it, delete it when done. The founder's password has been randomized multiple times by sessions doing "quick tests" on the real account — this must never happen again.
- **The sole legitimate `auth.updateUser` call is `apps/web/app/reset-password/page.tsx`** — it is correctly gated behind a Supabase `PASSWORD_RECOVERY` session (requires the email link). Do not add any other password/auth mutation anywhere in the codebase without an explicit founder ask.
- Before reporting any change to `/packages/processing-pipeline` or `/apps/web` as done, run the `media-ui-verify` skill (lint/typecheck, RTL, font, R2-vs-Supabase boundary, consent-gate ordering, design fidelity, live screenshot — see `.claude/skills/media-ui-verify/`).
- **Live screenshots in this environment: use `scripts/qa-shot.mjs`.** Playwright's Chromium cannot reach live URLs directly (the agent proxy MITMs TLS with a CA Chromium doesn't trust → `ERR_CONNECTION_RESET`). The tool sidesteps it by fetching every request through curl. Run: `NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/qa-shot.mjs <url> <out.png> [mobile|desktop]`, then Read the PNG. Never report a "browser can't reach live pages" blind spot — this is solved. See `MISTAKES.md` 2026-07-21.
- Media binaries never touch Supabase storage — R2 only.
- Guests never require login/signup — signed opaque event-scoped token only.
- No CDN `<script>` tags in production builds (Tailwind/fonts/Three.js/GSAP must be bundled npm deps) — the Stitch export used CDN tags, that was fine for a mockup only.
- Face-matching may not run before the guest accepts the biometric-consent gate. No exceptions, no "just for the pilot."
- Per-screen implementation must match `design/*/screen.png`, not the folder name — a naming/content mismatch was already found once in the export.
- **Never claim a screen "has no design" — and never freehand one — without first running `ls design/screens/` and opening the matching `screen.png`.** All 42 screens exist as folders (`design/screens/oura_final_production_<name>_<desktop|mobile>[_N]/screen.png`); the map is `design/oura_final_production_index_42_screens.md`. The `{{DATA:SCREEN:SCREEN_###}}` tokens in older notes are Stitch export IDs, NOT file paths — resolving them off the index alone is what made past sessions wrongly declare a design missing and waste a whole conversation freehanding + re-wiring it (see `MISTAKES.md` 2026-07-11). Design leads; our job is to wire it, not invent it.
- `--font-display` (Hanken Grotesk) has no Hebrew glyphs — never apply it to elements that render Hebrew text (already caused one fallback-font bug). Use it only for pure-Latin branding bits (e.g. "OURA", "PLATINUM" badges). Rubik (`--font-sans`) is the default for everything else.
- Use CSS logical properties (`ms-*`/`me-*`/`ps-*`/`pe-*`/`text-start`/`text-end`), never physical `ml-*`/`mr-*`/`text-left`/`text-right`, per `hebrew-rtl-best-practices`.
- Every task starts with a visible Token Economist consult (leanest path / model / scope guard / orchestration mode) — see `MISTAKES.md` for why this is non-negotiable here.
- **Before starting any task that wires/fixes/builds a specific named feature, check for existing open PRs/branches touching the same area first** (`list_pull_requests`, `list_branches`). A real incident: the same "wire the dead gallery buttons" task got independently rebuilt from scratch three times (PRs #9, #17, #18) because nobody checked whether it was already done — and the best of the three versions (#10, live since 2026-07-08) sat unmerged for two days and nearly got overwritten by a later, worse duplicate. See `PROGRESS.md`'s 2026-07-10 "pileup" entry.
- **Merge is not an ask-first gate.** Once a change clears the verification it's actually capable of clearing in this environment (build/lint/typecheck, and live QA wherever the environment can reach it), merge it as part of closing out the mission — do not leave it as an open draft waiting on a "should I merge this?" reply that may never come. Revert is the safety net if the founder doesn't like the result, not a pre-merge approval gate. Deploying and merging unverified/broken code is still wrong — disclose blind spots honestly (per the Quality Gate) rather than silently skipping verification to merge faster.
- **Any question that genuinely does need the founder's answer** (not merge/deploy — those default to yes now) gets written into `SUMMARY.md`'s state explicitly, and every subsequent session must check for it and re-surface it before starting new work in that area — it never just quietly drops because a session ended before the founder replied.
- **When reporting a PR to the founder, speak plain non-technical language — no code, no file paths, no technical jargon.** The founder is not a programmer; technical output is noise to him. Use short bullets only, covering: what it does (in product terms), what problem it solves, risk if any, and what decision is needed from him (if any). If the PR is already deployed, merged, and verified — just say in one sentence what got fixed or added. Never describe the technical implementation unless he asks.
- **Every open/unmerged PR gets named in `SUMMARY.md`, every session, no exception.** If a PR can't be cleanly merged (real conflicts, needs a decision), it does not have to be merged right now, but it must be listed there with what it is and why — "founder said stop" is never a reason to skip this step; update the doc, then stop.
- **State the concrete plan before executing it.** After the Token Economist consult (leanest path/model/scope/mode), say in one or two lines what you're actually about to build/change/deploy before doing it — not just the abstract mode/model — so the founder can redirect before tokens are spent, not after finding out from the diff.
- **"Done" always ships with the clickable live link — no exceptions.** Any time you report something done/deployed/fixed/verified, the same message must include the exact live URL to *see it* — deep-linked to the specific screen or flow you changed (e.g. `https://oura-web.oura-events.workers.dev/gallery`), not just the site root, not "it's live." A completion report without a link is an incomplete report. This has been dropped repeatedly; treat the link as a required field of every "done", the same as verification itself.
- **The founder works exclusively from his iPhone via the Claude.ai app. He has no computer, no terminal, no CLI.** Never tell him to run a command, open a terminal, or use any developer tool. He cannot do any of that.
- **When any secret/token/API key is missing from this environment, ask him for it immediately with:** (1) a direct link to where he finds it, (2) exactly what to copy, (3) exactly where to paste it (a direct link to the Claude Code environment secrets page). One ask, one action, done — never vague instructions.
- **When the founder must do a manual step, give dead-simple numbered directions assuming zero technical knowledge.** Every step is one plain action with a clickable link. Say what to tap and what to paste, in order. Prefer: copy-this → go-here → paste-here → tap-this-button. No jargon, no file paths, no assumed tools.
- **Never design new visuals directly.** When a task needs a screen or UI element with no existing `design/*/screen.png` source, do not freehand it. Two valid paths — pick one: (a) **Use the Stitch MCP directly** — the founder's Oura project already exists in his Stitch account with full context; always work inside that existing project so designs stay consistent with the rest of the app. (b) **Write a ready-to-paste Stitch prompt** and hand it to the founder to run. Implement in code only once a real Stitch-exported `screen.png` exists in `design/screens/`. This does not apply to re-implementing an existing Stitch screen from `design/*` — that's normal code work. Never self-generate screen.png or reference HTML as a substitute for a real Stitch export.

## Session Budget Discipline (5-hour Pro cap — non-negotiable)
The Pro usage cap burns as (context size) × (turns) + every sub-agent spawn. A
prior session died mid-mission at the cap; the dominant waste was fixed
per-mission overhead (Token-Economist agent + Tooling-Scout network search +
multi-agent fan-out fired on *every* task). These rules exist to stop that:

1. **Token Economist & Tooling Scout run inline** — one line, no sub-agent
   spawn — for small/medium work. Spin up the full agent team only for
   genuinely large missions. Most tasks need neither a spawn nor any network
   search.
2. **Targeted reading.** `grep` for the symbol, read only the needed line
   range. Whole-file reads are the rare exception, not the default.
3. **Decide-once, no re-loops.** Don't re-derive a settled decision or re-read
   a file already in context.
4. **Batch independent tool calls** in a single turn. Never one-action-per-turn
   — it re-bills the whole conversation each turn and ~10×'s the 5-hour burn.
5. **Design is king; code is a 1:1 wiring of the design; the design-spec flow
   is the leading build order** (founder's decision — see `PRD.md` and
   `docs/ARCHITECTURE.md` §6b). The only exception is a live production bug,
   which may be fixed out of flow-order.
6. **Hand off via `context-steward`** at the context-guard threshold rather
   than dying mid-mission.
7. **Don't hardcode undecided scope** (e.g. Screens 2/3 scope) — the founder
   decides that later.
8. **No per-task network sweep.** Default is Solo + inline consults + LOCAL
   tooling only. Do NOT run WebSearch / `SearchMcpRegistry` /
   `discover_zapier_actions` / connector searches for routine build/fix/wire
   work — only when a mission genuinely adds a NEW external service the repo
   doesn't already integrate, and then a single targeted search, not a blanket
   sweep. (The `tooling-scout` hook was rewritten 2026-07-13 to stop forcing
   this; don't reintroduce it in prompt-flow.)
9. **Hand off before the window balloons.** Treat the context-guard BLOCK mark
   (~22%) as the real stop line, not a suggestion — park via `context-steward`
   and start a fresh session. A conversation that runs to ~100%+ of the window
   re-sends the whole thing on every Opus turn; that re-billing, not any single
   action, is the biggest usage leak. Keep each conversation to one small
   mission.

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
