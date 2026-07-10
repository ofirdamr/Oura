---
name: universal-framework-orchestration
description: >-
  Detailed multi-agent orchestration mechanics for the Oura universal-framework:
  the predefined agent roster and each role, the Orchestrator autonomous loop,
  per-mission model assignment, how subagents stay small-context, the learning
  loop, how agents relay through the PM, real spawn limits, and the hard-rule
  protocols for usage-limit resume, PM escalation when a subagent/self is stuck,
  stop-and-re-consult, and the full session-handoff sequence. Load this ONLY
  when actually running Hybrid or Orchestrator mode (spawning real subagents),
  when a subagent fails or the session is repeating mistakes, or when executing a
  session handoff. Solo/Team tasks do NOT need it — the always-loaded
  universal-framework core covers them.
license: MIT
compatibility: Works with Claude Code, Claude.ai, Cursor. No network required.
---

# Universal Framework — Orchestration Detail

Lazy-loaded companion to `universal-framework`. The core skill keeps the
always-on gates (session start, Token Economist path/model/mode, MD system,
language, quality gate, token conservation, handover template). This file holds
the heavier mechanics that only matter when a real team runs or a handoff
happens — kept out of the core so Solo/Team tasks don't pay for them every
session. Everything below is verbatim from the original single-file framework.

**Resuming after a usage-limit interruption (hard rule):** if a subagent spawn
fails or gets cut off because of an account/session usage limit, that is not a
signal to silently downgrade the orchestration mode. Once the limit clears,
resume the SAME mode the Economist originally picked for that mission — if it
was Hybrid/Parallel, go back to independent subagents for the remaining/retry
work, don't quietly absorb it into solo Classic work just because the first
attempt got interrupted. If the limit is still blocking and there's real
pressure to keep moving, say so explicitly and ask before falling back to
solo — don't decide unilaterally that "solo for now" is fine and never revisit
it. The interruption is a temporary infrastructure fact, not a re-consult.

**PM escalation when a subagent fails or gets stuck (hard rule):** default
execution stays on the leanest model that can do the work — most subagent
work runs on Haiku/Sonnet, not the top tier, because that's the economical
default. But the PM (the senior architect/engineer role, ultimately the
orchestrating session itself) is responsible for watching subagents, not just
firing them off and waiting silently. If a subagent fails, comes back
confused, produces something wrong, or the problem turns out to be harder or
more tangled than the task looked when it was handed out, that is the PM's
cue to step in personally, on the highest available model (Opus, or Fable
when that's the top tier available) — the PM does not just retry the same
cheap-model subagent again and hope, and does not silently downgrade the fix
to a quick patch on the same tier that just failed. Escalating to the top
model is an exception path for when things get complicated, not the default
posture — most of the work still belongs on the economical subagent tier.
After the PM resolves the hard part, routine/mechanical follow-on work can
drop back down to a cheaper model rather than staying pinned to the top tier.
This also means the PM must actually check subagent output quality (read the
diff, rerun verification) rather than trusting a "done" self-report at face
value — the watching obligation is what triggers the escalation in the first
place.

**Stop-and-re-consult when the orchestrating session itself is the one
struggling (hard rule):** the escalation trigger above isn't only for
subagents — it applies just as much when the main session doing the work
solo is the one repeating mistakes, second-guessing its own fixes, or
needing several corrected attempts at the same class of bug. That is a
signal to stop mid-task and go back to the Token Economist/PM decision
point, out loud, before continuing — not to grind forward on the same
approach hoping the next attempt lands. The re-consult explicitly
reconsiders all of: should the PM (this session) keep doing it solo, should
the work fan out to independent subagents (Parallel/Hybrid instead of
Classic — e.g. an audit-many-screens task is exactly this shape), should a
specific role take it with fresh eyes, or should the model change via the
Token Economist. State the re-consult and its outcome in one visible line,
then proceed under whatever it decides — don't silently keep pushing the
same failing approach because stopping feels like it wastes the effort
already spent.

**Session handoff protocol (hard rule):** recommending "start a fresh
session" is not the end of the job — a handoff done sloppily wastes exactly
the tokens/time it was supposed to save, because the next session either
repeats work, stalls on a decision that evaporated with the old chat, or
sits on code that never went live. This happened for real on this project:
a session recommended a fresh start, the user had *already* opened the next
one, and only then did it surface that a PR was still unmerged and an open
question had never been written down anywhere the new session could see.
Do it right, every time, in this order:

1. **Recognize the trigger yourself, before being asked.** Signals: this
   conversation has already been through a context compaction, it has
   covered 3+ unrelated workstreams, or a natural milestone/PR boundary was
   just reached. Say so out loud the moment you notice — don't wait for the
   user to notice the conversation has become unwieldy.
2. **Merge before you recommend, don't leave it as a future question.** If
   an open PR's code is already deployed/live, "should this be merged" is
   not a decision to defer to later — merging it IS part of closing out the
   session cleanly. Do it now, then tell the user it's done, rather than
   asking them to remember to ask you.
3. **Every open question gets resolved or written down — never just
   dropped.** Before recommending a handoff, check: is there any question
   asked this session that never got a final answer? Either get the answer
   now, or if the user genuinely isn't ready to decide, write the open
   question into `SUMMARY.md` explicitly (what's being asked, why, what the
   options were) so it survives the handoff as a real artifact, not as
   something only visible in this chat's history.
4. **Hand over a self-contained first message** that references only
   committed state (file paths, branch name, PR number) — never "as we
   discussed" or anything that assumes the next session can see this one's
   history.
5. **State plainly that this protocol just ran** ("recognizing this is a
   good handoff point, checked: PR merged, docs current, no dangling
   questions — here's the first message for the next session") so the user
   sees the check happened, not just its output.

---

## 1. The Team (internal roles — synthesize, never narrate)

The PM decides per task which specialists are needed. **Small single-discipline
task → just do it.** Multi-discipline or high-risk → convene briefly, then act.
Do not print separate intros or dialogues; compile their insight into one answer.

Each role below has a **predefined real-subagent counterpart** in
`.claude/agents/` (see §1a). In Solo/Team mode these are *internal roles* you
synthesize in one context; in Hybrid/Orchestrator mode they are *real agents*
the PM spawns by name. Same roles, two ways to run them.

- **Token Economist** (`token-economist`) — owns the first-consult gate above.
  Every mission starts here.
- **Tooling Scout** (`tooling-scout`) — actively looks for a better way to do the
  work, not just the default one: a connector, an MCP server, a plugin, or a
  skill that fits *this specific project's* domain better than solving from
  scratch. Looks **beyond what's already installed** — skills/plugins published
  on GitHub and the marketplace count too (`SearchSkills`/`SearchPlugins`/
  `SearchMcpRegistry`/web search). Reads the description, judges relevance, and:
  a published **skill** that clearly fits (and is safe on inspection) it may add
  under `.claude/skills/` and use directly — one good find is enough; an
  **MCP/connector needing OAuth** it CANNOT install from a background session, so
  it surfaces that to the PM/founder with the concrete value and the one-time
  connect step. It never widens another agent's tools at runtime — that's fixed
  in frontmatter, so it proposes the `tools:` edit and the PM applies it, only
  for agents the tool is actually relevant to. Runs whenever a new phase or a
  recurring pain point shows up, not as a one-off at project start.
- **Product Manager / Tech Lead** (`pm-orchestrator`) — scope, business logic,
  priorities, mode choice, mission decomposition, final call. Owns the GOAL.
- **Planner** (`planner`) — up-front edge-case interrogation *before* code:
  concurrency/races (two guests buy the last slot at once), double-submit &
  idempotency, network loss mid-action, ordering/consistency, token/consent
  expiry, empty/limit/abuse states. Solves the hard cases from the basics so
  they never become production bugs; asks the founder only the questions whose
  answers change the design.
- **Front-End / UX-UI** (`frontend-rtl`) — clean modern UI, responsiveness, RTL
  correctness, a11y, faithful Stitch screens.
- **Back-End / Architecture** (`backend-architect`) — data flow, APIs,
  idempotent concurrency-safe writes, performance, clean structure.
- **Web Security** (`security-auditor`) — no secrets in code, input/XSS safety,
  authz/RLS, consent-gate integrity, deps, Amendment 13 privacy. Security scan =
  code scan: grep for key/token/password/JWT/PEM patterns, not just a 404 check.
  Before deleting any file/folder: grep all workflows/scripts for references first.
- **Copywriter (locale-aware)** (`copywriter-he`) — owns all user-visible text in
  Hebrew. Never use an em dash (`—`) in generated copy, titles, meta, or any AI
  output, in any language — it reads as AI-written. Use a comma, period, or a
  regular hyphen instead.
- **Marketing / Growth / SEO** (`marketing`) — positioning, launch messaging,
  marketing site, SEO (titles/meta, canonical, og/twitter, JSON-LD,
  sitemap/robots). **Dormant until a launch phase** — the PM activates it then.
- **QA** (`qa-verifier`) — automated/visual + functional checks; guarantees the
  result before delivery, live via Playwright. To inspect a video file, install
  ffmpeg, extract frames, and Read the PNGs (still images and PDFs are readable
  directly).
- **Context / Session-Handover Steward** (`context-steward`) — watches how heavy
  the running conversation has gotten and, once it's paying for context we no
  longer need, calls the stop: parks the thread cleanly, updates the MD files,
  resolves or records every open question, flags any live PR to merge, and
  writes the self-contained first message for the next conversation. This is the
  §0.3 conversation-length scope guard + the §0 handoff protocol + §6 handover,
  owned by one role. Runs top-level (only the top level sees the live
  conversation); spawned to execute the handover once the trigger is recognized.

---

## 1a. Predefined team & how Orchestrator mode actually runs

The roles above are backed by real agent files in `.claude/agents/` (roster in
that folder's `README.md`). The orchestrator picks them **by name** — their
role, model tier, tool scope, and project guardrails are baked in, so it doesn't
re-brief them each time. This is the "give the order once, then it's pickable"
setup: the files exist, so Orchestrator mode has a real team to draw from.

**The autonomous loop (Orchestrator mode).** The PM runs missions toward the
GOAL without stopping between them:
1. Token Economist gates the mission (path, model, scope, mode).
2. PM assigns the mission to the right agent(s) — parallel where slices are
   independent.
3. PM watches: reads their diffs, reruns their verification — never trusts a
   "done" self-report.
4. On success, PM decides the next mission itself and continues. On failure or
   confusion, PM escalates (steps in on Opus) rather than re-running the same
   cheap-tier agent and hoping.
5. Repeat until the GOAL is met, then run the Quality Gate (§4) and report.

**Per-mission model assignment (real mechanism, use it).** Every agent file
carries a sensible **default** model in its frontmatter (`model:` — e.g.
`security-auditor` defaults to Opus, `copywriter-he` to Sonnet). But when the
Token Economist splits a big mission into sub-missions, it recommends a model
**per sub-mission**, and the PM applies that at spawn time: the `Agent` tool's
`model` parameter **overrides the file default for that one spawn**. So the same
run really can have one agent on Opus and another on Sonnet simultaneously —
size each sub-mission by its own hardest slice, spend Opus only where the work
needs it, and drop cheaper agents to Sonnet/Haiku. The default in the file is
the fallback; the Economist's per-mission call is what actually gets set.

**Each real subagent runs in its OWN separate context window** — that's inherent
to the `Agent` tool, and it's the whole point: a specialist reads only what its
slice needs, so the main conversation stays lean and each agent's context stays
small. (The leadership roles — PM, Token Economist, Context Steward — run at the
top level instead, because they must see the live conversation to do their job;
they are not small-context leaf workers.)

**When the PM DOES stop and ask the founder** (only these):
- a genuinely ambiguous decision where the wrong guess is expensive,
- an irreversible or outward-facing action (deploy, delete, send, publish,
  charge),
- anything touching a rule `CLAUDE.md` marks locked / ask-first.
Everything else: proceed autonomously.

**How each agent stays small-context (the method).** An agent file is NOT a copy
of this whole skill. It carries only: (a) its role's distilled rules, (b) the
shared **house rules** every agent obeys (English to founder; Hebrew/RTL
deliverables; short 2-3 sentence output; "done" ships the live link; verify
before done; `CLAUDE.md` wins), and (c) pointers to the specific skills it should
**lazy-load on demand** (`hebrew-rtl-best-practices`, `israeli-privacy-shield`,
etc.) rather than inlining that knowledge. This is why generic web knowledge is
NOT dumped into agent files — inlining bloats context; referencing a skill keeps
it lean. The Token Economist polices this (agent files stay small; agents read
only their slice).

**The learning loop (agents get better, permanently).** When an agent gets
stuck/confused or fails the same thing ~2-3 times, the PM (1) STOPS, (2)
escalates the model for the hard part (temporary), and (3) writes a distilled
1-2 line lesson into that agent's **"Learned on the job"** section in its file
(permanent) — so next run it already knows. Reusable patterns/gotchas a mission
reveals go there too. Notes stay short and get compressed if they grow: the
agent gets smarter without its context getting heavier. Project-wide lessons go
in `MISTAKES.md` instead of a single agent's file.

**How the agents "talk."** They do not chat peer-to-peer on their own. When one
needs another (planner → backend on a concurrency question, QA → frontend on a
broken control), the consultation is **relayed through the PM**: the PM carries
the question to the other agent — spawning it fresh, or resuming it with
`SendMessage` so it keeps its context — and carries the answer back. The PM is
the switchboard.

**Real limits — encode them, don't over-promise:**
- Subagents can't reliably spawn their own subagents. The orchestration loop
  therefore lives in the **top-level session, which embodies `pm-orchestrator`**
  — the PM/Economist are leadership run at the top, not leaf workers.
- MCP/connector installs that need OAuth can't happen in a background session
  (`tooling-scout` surfaces them to the founder; it can add skills itself).
- An agent's tools are fixed in its frontmatter; widening another agent's access
  means editing that file's `tools:`, applied by the PM.

---

