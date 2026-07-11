# Oura predefined agent team

These are the reusable subagents the PM/orchestrator picks from. Roles, model
tier, tool scope, and project guardrails are baked into each file's frontmatter
and body, so the orchestrator can select an agent **by name** without being told
its job each time. The full doctrine lives in the `universal-framework` skill
(§0.4 Orchestration mode + §1a Predefined team).

## Leadership (run at the top level — they coordinate, they aren't leaf workers)
| Agent | Role | Model |
|-------|------|-------|
| `pm-orchestrator` | Owns the GOAL, splits it into missions, picks the mode, assigns work, watches, escalates, drives to done autonomously | Opus |
| `token-economist` | Mandatory first-consult: leanest path, per-mission model choice, scope guard, mode recommendation | Sonnet |
| `context-steward` | Watches conversation cost; when long/wasteful, parks the thread, updates the MD files, records open questions, flags a live PR to merge, writes the next conversation's first message | Sonnet |

## Specialists (the PM spawns these for missions)
| Agent | Role | Model |
|-------|------|-------|
| `planner` | Up-front edge-case interrogation (concurrency, double-submit, network loss, idempotency) — solves problems from the basics | Opus |
| `backend-architect` | Workers/Hono, Postgres/pgvector, R2, queues, idempotent concurrency-safe writes | Opus |
| `frontend-rtl` | Next.js PWA, Hebrew RTL, Three.js/GSAP reveal, faithful Stitch screens | Sonnet |
| `qa-verifier` | Live Playwright visual + functional verification, front and back, every control + whole flow | Sonnet |
| `security-auditor` | Secrets, authz, RLS, consent-gate integrity, Amendment 13 privacy | Opus |
| `tooling-scout` | Finds better skills/MCPs/plugins/connectors on the network; adopts skills, proposes tool-scope edits | Sonnet |
| `copywriter-he` | Native Hebrew user-facing copy; no em dashes | Sonnet |
| `marketing` | Growth/GTM/SEO campaigns — **dormant until a launch phase** | Sonnet |
| `seo` | Technical & on-page SEO: metadata, canonical, og/twitter, JSON-LD, sitemap/robots, indexability (token/admin routes noindex) | Sonnet |

## How they "talk"
Agents don't chat peer-to-peer on their own. Consultation is **relayed through
the PM** (spawn or `SendMessage`-resume the other agent, carry the answer back).

## Every agent shares (bottom of each file)
- **House rules** — English to founder; Hebrew/RTL deliverables; short 2-3
  sentence output; "done" ships the live link; verify before done; `CLAUDE.md`
  wins. Kept identical across agents on purpose.
- **"Learned on the job"** — a short, PM-maintained memory of distilled lessons.
  This is the learning loop: when an agent gets stuck or a mission reveals a
  gotcha, the PM escalates the model to unblock AND writes a 1-2 line lesson
  here, so the agent improves next run. Notes stay short (Token Economist
  polices bloat) — smarter agent, not heavier context. Project-wide lessons go
  in `MISTAKES.md` instead.

## Real limits (don't over-promise these)
- Subagents can't reliably spawn their own subagents — the orchestration loop
  lives in the **top-level session**, which embodies `pm-orchestrator`.
- MCP/connector installs needing OAuth can't happen in a background session —
  the scout surfaces them to the founder. Skills (files) it can add itself.
- An agent's tool list is fixed in its frontmatter; widening another agent's
  access = editing that file's `tools:`, applied by the orchestrator.
