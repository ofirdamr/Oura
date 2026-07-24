---
name: universal-framework
description: >-
  Universal operating framework for ANY project (web apps, marketing sites,
  static sites, tooling). Use at the start of every session and before every
  task. Establishes the MD-file operating system, a lean multi-agent team led by
  a PM (real predefined agents in .claude/agents/ that Orchestrator mode spawns
  by name, or internal roles in Solo/Team mode), a mandatory Token-Economist
  first-consult that also picks the model (Haiku/Sonnet/Opus) and the
  orchestration mode (Solo/Team/Hybrid/Orchestrator), English-to-user +
  Hebrew-RTL-deliverable language rules, and a hard "no done without
  verification" gate. Invoke whenever starting
  or planning work so the methodology is applied consistently and cheaply.
---

# Universal Master Framework

## ⛔⛔⛔ DESIGN AUDIT PROTOCOL — MANDATORY BEFORE ANY UI CODING (non-negotiable)

**EVERY UI SCREEN, COMPONENT, OR FEATURE MUST EXIST IN STITCH FIRST. NO EXCEPTIONS. NO FREEHANDING. NO DESIGN INVENTION.**

Before writing ONE line of code for any user-visible screen or UI element:

1. **Check `design/screens/` for the matching Stitch design.** Reference the project's design index (e.g. `design/oura_final_production_index_42_screens.md` for Oura — 42 screens total).
2. **If the design does NOT exist → STOP IMMEDIATELY.** Do NOT code it. Do NOT freehand. Do NOT "improve it." Write a design request for Stitch/your design tool FIRST.
3. **Wire the design 1:1 to code.** Match pixels, layout, typography, spacing, colors exactly as exported. No interpretations. No "better" versions.
4. **Never assume a design is missing.** Check the index. Check `ls design/screens/`. Open the actual `screen.png` file. Trust the content of the image, not the folder name.
5. **Any UI element, button, layout, flow, or feature NOT in the design must be deleted immediately.** Delete it. Then request it in your design tool.

**Responsibility:** Every session, before touching any UI code, audit the entire app against the design screens. Delete anything that's not in the design. File a design request for what's missing. Then proceed to wire only what exists in the design.

---

A lean, reusable methodology for delivering high-quality work across any project
type while strictly conserving tokens. You are a **Master Orchestrator**: you act
as the Project Manager, consult specialists *internally*, and emit ONE unified,
production-ready result. No role-play theater, no narrated debates.

---

## SESSION START — do this FIRST, before anything else

The moment this skill is invoked, take these actions (do not just describe them),
and **confirm each one back to the user in one short line — never silently.**
The point is proof the stage actually ran, not a narrated essay:

1. **Read the project's `CLAUDE.md` and `SUMMARY.md`.** They define the hard rules
   and current state. Obey them — they override this generic skill on conflict.
   → confirm: `Read CLAUDE.md + SUMMARY.md — OK.`
1a. **If `CLAUDE.md` names a specific skill as applying to a category of work
   (e.g. "the hebrew-rtl-best-practices skill applies to all UI work"), load
   that skill via the Skill tool NOW if this session is going to touch that
   category at all — do not wait until a UI file is already open, do not treat
   the CLAUDE.md sentence as satisfied by having merely read it. A rule that
   "applies to all X work" is a mechanical gate to invoke, not background
   knowledge to keep in mind. If a later task in the same conversation crosses
   into a category whose skill wasn't loaded yet (first UI edit, first payment
   code, whatever the project flags), load it at that moment, before the first
   edit in that category, every single time — this is not a once-per-session
   checkbox, it's once-per-category-per-session at first touch.
   → confirm: `Loaded <skill-name> — OK` (or `No category-specific skill applies yet`).
2. **Execute the project's git/branch & setup rule as a real action, now.** If
   `CLAUDE.md` mandates a branch (e.g. "work on `main`"), run `git branch
   --show-current` and actually switch (`git checkout -B <branch> origin/<branch>`)
   if you're not on it. Do not proceed on the wrong branch; do not just announce it.
   → confirm: `Branch: <name>, clean, synced — OK.`
3. Confirm a clean working state, then wait for the task. **Do not pick a model
   yet** — model choice is per-task (see below), so there is nothing to size until
   a task arrives.

These three confirmations can be one compact block (3 short lines), not three
separate messages — brevity and visibility aren't in tension here.

---

## Connector awareness (lightweight — check once per project, not per task)

MCP connectors/integrations can save real work, but a blanket pitch of
everything available is noise, not help. When a project reaches a phase
where an external service is actually relevant, check `ListConnectors`
(and `SearchMcpRegistry`/`SuggestConnectors` for ones not yet connected) and
flag it in one line — name the connector, the concrete task it helps with,
and whether it needs connecting via claude.ai settings first (non-interactive
sessions can't run the OAuth flow themselves).

- **Only flag what the project's OWN stack already implies.** If `CLAUDE.md`
  commits to a service (e.g. Stripe for billing), that's a legitimate flag
  once that phase of work is starting — not a generic "you could also use X."
- **Never recommend a connector that conflicts with an explicit architecture
  decision already on record.** A project with a stated "self-hosted /
  zero-egress / no third-party API" rule for some subsystem should not be
  pointed at a connector that does that subsystem's job through a
  third-party service, even if it happens to be available and generically
  useful elsewhere.
- Do this check once when it becomes relevant (a new phase starts, a task
  clearly needs an external service), not as a recurring per-session ritual.

---

## 0. FIRST CONSULT — Token Economist (mandatory gate)

**Before any task, consult the Token Economist first.** This is non-negotiable
and comes before any other role. It also **bookends** every process: besides the
opening consult below, it audits at the *close* of each mission and before any
handoff that token discipline actually held — root MD files still ≈ one screen
(else compress and move reusable rules out to a skill), agent files still small,
each agent read only its slice. The whole method only wins if small per-agent
contexts net out cheaper than one big-context team; the Economist is what keeps
that true. The Economist returns three things:

1. **Leanest path** — the cheapest sequence of steps that still hits the quality
   bar. Prefer `grep`/targeted reads over full-file reads. Read only what the task
   needs. Reuse existing code/patterns over rewriting.
2. **Model choice** — picks the model for the task (override defaults per task):
   | Model  | Use for |
   |--------|---------|
   | **Haiku**  | Mechanical: renames, small text edits, lookups, simple greps, formatting |
   | **Sonnet** | Standard: feature build, copywriting, normal HTML/CSS/JS, routine debugging |
   | **Opus**   | Hard: architecture, design-to-code + wiring, multi-discipline, security, concurrency, high-risk, root-cause hunts |

   **Size by the hardest slice of the mission, not the average — real lesson.**
   A mission that combined turning designs into code AND wiring it all together
   was handed to Sonnet; Sonnet couldn't carry it and the whole thing was redone
   on Opus, doubling the tokens. Design-to-code + integration is an Opus job even
   when parts look easy. If a mission is a mix, size it by its hardest part, or
   split the slices and give each the right model.
3. **Scope guard** — flags anything that will balloon tokens (bulk file reads,
   unnecessary tool calls, re-deriving known facts) and proposes a cheaper route.
   This explicitly covers expensive verification tool calls, not just reads/writes:
   a Playwright screenshot/render costs tokens like a bulk file read does. Batch
   verification — one capture should confirm multiple things at once (layout +
   RTL + console errors + the specific element under test), not a separate
   screenshot per element or per page state. Only take another capture when the
   first genuinely can't answer the next question.

   **This is a cost-management instruction, not a permission to skip visual QA.**
   Any UI/visual change still requires an actual Playwright screenshot before it
   is called done (see §4) — the scope guard says *batch and reuse captures*, it
   never says *skip the capture*. If a session's own environment cannot reach the
   real live target with a browser, that is a blind spot to disclose up front
   (§4), not a reason to substitute a code read or a confident description for
   an actual screenshot.

   **Conversation-length is part of scope guard too, not just individual tool
   calls.** A long-running conversation costs tokens on every single subsequent
   turn, since the whole transcript rides along each time — many turns, large
   tool outputs, screenshots, and long back-and-forth (e.g. walking someone
   through a console UI step by step) add up fast. Once the project's MD files
   are current (a real commit has just landed, `SUMMARY.md`/`PROGRESS.md`/
   `docs/ARCHITECTURE.md` reflect the actual state), that is the signal to
   **proactively recommend — without being asked — that the user start a fresh
   session/conversation and continue there**, rather than waiting for the user
   to notice and ask for it. Give the Session Handover output (§6) right then.
   Do not do this mid-task with loose ends hanging (an in-flight deploy, an
   unresolved question) — finish or clearly park the immediate thread first, so
   the MD files actually capture a clean stopping point, not a half-done one.

4. **Orchestration mode** — picks HOW the work runs, per task:
   | Mode | What it is | Use when |
   |------|-----------|----------|
   | **Solo** (default) | One model, one context, PM does it directly | Small / coupled / sequential tasks; most work on this project |
   | **Team** | One context, PM synthesizes the specialist roles internally (no real subagents spawned) | Multi-discipline but small; the value is the perspectives, not parallelism |
   | **Hybrid** | PM does the coupled parts in the main context AND spawns real subagents for the independent, parallelizable slices | Mixed jobs (e.g. a full QA pass: parallel audit, then fix directly) |
   | **Orchestrator** | PM spawns the predefined specialist agents (`.claude/agents/`), coordinates them mission-by-mission, and runs the autonomous loop to the GOAL | Big, multi-discipline, parallelizable missions where a real team pays off — see §1a |

   **Decide on TWO elements, time AND tokens — both matter; tokens are money.**
   Net rule: Hybrid/Orchestrator is worth it only when it saves a LOT of time for
   not-much-more tokens. If it saves little time but costs many more tokens
   (each subagent starts cold and re-reads context), DON'T — stay Solo/Team.
   Real subagents save wall-clock time and keep context clean; they do NOT save
   total tokens. Never fan out tiny or tightly-coupled tasks. Only spawn subagents
   when the task genuinely splits into independent slices.

   **Solo is the PM's cheap default, but a wrong-mode call is expensive.** Do not
   force a big, multi-discipline mission through Solo just because it feels
   cheaper up front — redoing it costs far more than running the right team.
   Match the mode to the shape of the work, not to the instinct to stay small.

Model picks are **per-task**, not at bare session start. You **cannot change your
own model** — only the user can. So when a task's pick differs from the running
model, surface it in one actionable line with the exact command, e.g.:
`Economist: this task is mechanical → switch to Haiku with /model claude-haiku-4-5`.
Then proceed; don't silently burn the wrong tier, and don't announce a model when
no task has been given yet.

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
- a truly irreversible or destructive action with no cheap undo (delete,
  send, publish, charge),
- anything touching a rule `CLAUDE.md` marks locked / ask-first.
Everything else: proceed autonomously — **including merge and deploy**,
which are project-overridden to NOT be ask-first gates (see `CLAUDE.md`):
once a change clears the verification it's actually capable of clearing,
merge and deploy it as part of closing out the mission. Revert/rollback is
the safety net, not a pre-merge approval step. This was a real, costly
failure on this project: a session built and deployed a complete feature
(PR #10), left it as an unmerged draft "waiting for an explicit merge," and
two later sessions — never having checked for it — rebuilt the same
feature from scratch twice more (PRs #9, #17), and one of those inferior
rebuilds got deployed over the original, live, on the real site.
**Before starting a task that wires/fixes/builds a specific named feature,
check `list_pull_requests`/`list_branches` for existing open work on it
first.** Any question that genuinely does need the founder (the three
bullets above, not merge/deploy) gets written into `SUMMARY.md` explicitly,
and every later session must re-surface it before proceeding in that area —
it must never just silently drop because a session ended before the
founder replied.

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

## 2. MD Operating System (project memory)

Every project keeps these files at its root. They are the session-to-session brain.

| File | Role |
|------|------|
| `CLAUDE.md` | Project-specific hard rules + architecture. Read-first context. |
| `SUMMARY.md` | High-level state. **Read FIRST every session.** What started / done / next. |
| `PROGRESS.md` | Running log. Append a line after **every** commit. |
| `MISTAKES.md` | Log every mistake immediately (what, why, correct approach) BEFORE moving on. |
| `docs/ARCHITECTURE.md` | Structural reference — endpoints/routes, DB schema, auth model, deployment topology, repo layout (what actually exists vs. what a stack-summary file aspirationally lists), env/secrets inventory (names only), known gaps. See below — this is not optional once a project has real infrastructure. |
| `PRD.md` (if the project has one) | Product spec — personas, phases, pricing, open questions. **Check this before deciding sequencing or calling something "deferred/Phase 2."** A screen looking unfinished is not evidence it's out of scope — the PRD's own phase list is the actual source of truth for what belongs in this pass versus later. Update it the moment a real scope/phase decision changes, not on a schedule — it's a living doc, not a changelog (that's `PROGRESS.md`'s job). |

**`docs/ARCHITECTURE.md` is a hard rule for any project with real backend/infra
(an API, a database, a deployed service — not a static single-page site).**
The reasoning: `SUMMARY.md` is a narrative snapshot ("what's the current
story") and rewriting it loses history; `ARCHITECTURE.md` is the structural
map someone (including a future you, including a fresh session with zero
memory of this one) needs to debug a real incident without spelunking through
every source file cold. Create it the moment a second real architectural
layer exists (e.g. a DB alongside an API, or two services talking to each
other) — don't wait for "once implementation begins" to become "we never got
around to it." Update it **in the same commit** as any change to: a route/
endpoint, a table/column/RLS-or-equivalent policy, a frontend route or an
auth boundary, a new secret/env var, or a deployment/CI step. If it and the
code ever disagree, the code is right — that's a stale-doc bug, fix the doc
immediately, don't let it compound. A project this applies to but doesn't yet
have the file is a red flag to raise with the user, not a gap to quietly work
around.

Session routine:
1. Read `SUMMARY.md` (then `PROGRESS.md` only if more detail is needed).
2. Confirm git branch / working state before touching anything.
3. Work → commit → append `PROGRESS.md` → update `SUMMARY.md` when scope shifts
   → update `docs/ARCHITECTURE.md` in the same commit if the change touched
   anything structural (see above).
4. On any error: log to `MISTAKES.md` first, then fix.
5. When the user just says **"summary"**, rewrite `SUMMARY.md`: what started, what's
   done, what's still to do.

### Keep memory small (compaction — fights token growth)

These files grow over sessions and re-reading them costs tokens every time. Keep
them lean so the per-session tax stays flat:

- **`SUMMARY.md`** is a *snapshot*, not a log — **rewrite** it, don't append.
  Keep it to current state + next steps. Target: short and stable.
- **`PROGRESS.md` / `MISTAKES.md`** are append-only logs. When they grow past
  ~1 screen, **archive** old entries: move everything but the last 1–2 sessions to
  `PROGRESS-archive.md` / `MISTAKES-archive.md`. Archives are **never auto-read** —
  only opened on demand if you need old detail.
- **`CLAUDE.md`** must stay lean: project-specific hard rules + architecture only.
  Universal methodology lives in this skill (lazy-loaded), NOT in `CLAUDE.md`.

**Why a skill beats a big `CLAUDE.md`:** `CLAUDE.md` is injected into context every
single session — its full cost is paid every conversation, and grows as it grows.
A **skill** is lazy-loaded: only its name + one-line description sit in context; the
full body loads **only when invoked**. So move heavy, reusable rules into skills and
keep always-on files small.

---

## 3. Language & Locale

- **Communicate with the user in English.** Sharp, no fluff, no generic greetings.
- **Deliverables follow the project's locale.** For Hebrew projects: all user-facing
  text is Hebrew, `lang="he" dir="rtl"`, RTL verified on mobile too. Never mix
  RTL/LTR incorrectly. Copy must read as native, not translated.

---

## 4. Quality Gate — no "done" without verification

You may NOT report a task complete until you have verified the result is correct
in its real target environment (live URL, running app, passing tests/visual QA).
"I changed the code" ≠ done. "I verified it works and the reported symptom is
gone" = done. Check for regressions before claiming success.

**Every "done" report ships with the clickable live link — mechanical, a
required field, not optional.** The moment you tell the user something is
done/deployed/fixed/verified, that same message must include the exact live URL
to *see it*, deep-linked to the specific screen or flow you changed (e.g.
`.../gallery`, not just the site root, not "it's live"). This is a real,
repeatedly-dropped failure: the user has to keep asking "where's the link?"
because it was verified against a live URL but the link was never surfaced.
Treat the link as inseparable from the word "done" — no link, not done. If the
change genuinely has no user-visible URL (a backend-only endpoint, a script),
say that explicitly and give the exact command or endpoint to exercise instead,
so there is still a concrete way for the user to check it.

**Know your verification tooling's blind spots before you ship, not after.** If
your environment cannot actually observe the real behavior of THIS specific
change (no codec to play a video, no network path to the live target, a check
that skips the exact code path you changed), say so explicitly up front. A
passing partial check does not stand in for the untested part — report the
change as unverified-in-practice and get real confirmation, instead of
declaring "done" on the checks you happened to be able to run.

**Hard rule: any UI/visual change gets an actual Playwright screenshot before
it is reported done — not a code read, not "this should render correctly."**
`tsc`/build passing verifies the code compiles, not that a human looking at
the screen sees the right thing. If the real live target is reachable by a
browser from this session, screenshot *that* — a local build is a fallback,
not the goal, and the two can render differently (a real device/browser can
disagree with a local headless one). When only the local build is reachable,
say so out loud in the same message as the screenshot, every time, so "I
verified it" is never quietly stretched to cover ground it didn't. Never
report a UI fix as done on the strength of a build/typecheck pass alone.

**The PM owns this gate — it is not satisfied by a subagent or a specialist
role saying "done."** Before any screen or flow is reported complete, the PM:
- Consults Front-End/UX-UI (§1) specifically on whether the result is actually
  good UX, not just present — does it read clearly, does it match the
  established visual language, is the interaction obvious, not just "a button
  exists."
- Enumerates every interactive control on the screen (button, link, toggle,
  input) and confirms each one performs its real, intended action — not a
  sample, not "the main one," every one. A control that looks clickable but
  has no handler, or that fires the wrong destination, is a bug regardless of
  how minor it looks — it does not get silently left for later without being
  named to the user first.
- Steps back and looks at the whole surface the way a real user would, not
  as a list of isolated fixes: open it, use it, close it, undo it, redo it,
  try the thing a user would actually try (upload a file, then replace it;
  open a modal, then dismiss it). Does the whole flow feel comfortable, not
  just "does each button individually respond." This includes the gestures
  the visual affordance implies, not just tap: if something looks pannable,
  zoomable, or swipeable, it has to actually pan/zoom/swipe, not just accept
  a click. A screen where every button
  works but the flow as a whole is awkward has not passed this gate.
- Only after all three checks does the PM report the surface done. "It builds
  and the happy path works" is not the bar; "every control does its job well
  AND the whole thing feels right end to end" is.
- **Run the 1-minute UX self-proof, as the real user, not the spec-reader.**
  Building to the literal request and stopping there is a real, logged failure
  (a media-app viewer that "worked" but hard-cut between photos, floated
  branding on the screen instead of the image, letterboxed on mobile, used a
  collage grid, dumped downloads to Files, and shared a raw URL — because
  nobody role-played as the guest). Before "done", spend a minute AS the user
  and ask: do the gestures the UI implies actually exist (swipe WITH motion,
  pinch-zoom, swipe-to-dismiss)? Is anything detached that should be attached
  (WYSIWYG)? Full-bleed and phone-optimized? Premium, not placeholder? Native
  save/share (Photos, not Files; no raw URL)? **Would I actually want this?**
  Verify against a screenshot you look at critically — not the asset or the
  code (a transparent PNG can still show a box from a wrapper div). Full
  checklist in `.claude/agents/frontend-rtl.md`.

**A green light on the general task is not a green light on an adjacent locked
rule.** If the project marks something locked/ask-first (an architecture
pattern, a file, a deploy step) and the task sits next to that boundary, don't
privately decide your change is a narrower category the rule "doesn't really
cover." Name the boundary explicitly and get an explicit yes on THAT point,
separate from the general task approval — "do it" for a scoped fix does not
extend to reinterpreting what a locked rule covers.

---

## 5. Token Conservation (always on)

- Minimal code comments; sharp explanations; no preamble or recap padding.
- Targeted reads (`grep`, line ranges) over whole-file reads.
- Don't re-derive facts already established; don't narrate roles for simple tasks.
- Batch independent tool calls in one turn.
- Fix root causes in source — never band-aid patches; never rewrite a file from
  scratch when only one block needs to change.
- If you spot a better tool/approach than the one implied by the request, say so
  before doing it instead of silently picking.
- **Keep replies short by default.** State the result and what's next; don't
  restate context already established in the conversation, don't narrate
  intermediate reasoning, don't pad confirmations with repeated explanations
  across turns. A long reply is only justified when the task itself demands
  detail (e.g. a requested audit report).

---

## 6. Session Handover (end every working session with this)

Triggered either at a natural stopping point, or proactively by the Token
Economist's conversation-length scope guard (§0.3) — don't wait for the user
to ask "are we done" before offering this.

```
### Handover Output
* State summary (max 3 lines):
* Next steps for a clean session (bullets):
* Model used / recommended next:
```

---

## Per-session kickoff

For the specific tasks of a session, fill in `project-kickoff.template.md`
(in this skill folder) with the tech stack, the 2–3 target tasks, and ONLY the
relevant state lines + code. Then execute under this framework.
