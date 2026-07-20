# ACCOUNT-MIGRATION.md — Move Oura to another Claude account

**Purpose:** if this Claude account hits its usage limit, you can open the *same
project, same rules, same memory, same method* from a different account and lose
**nothing**. This file is the complete checklist.

> **The single most important fact:** almost everything that *is* "how we work"
> lives inside THIS git repository, not inside your Claude account. Any account
> that opens `ofirdamr/Oura` inherits all of it automatically. The repo **is** the
> memory. Switching accounts does not touch the repo.

---

## 1. What travels automatically (already in the repo — do nothing)

When a new account opens this repository, it immediately gets:

| Thing | Where it lives |
|---|---|
| All the working rules & guardrails | `CLAUDE.md` |
| Product spec, personas, pricing, phases | `PRD.md` |
| Current build state (read first every session) | `SUMMARY.md` |
| Full session history log | `PROGRESS.md` |
| Every lesson learned / mistake to avoid | `MISTAKES.md` |
| Architecture, endpoints, DB schema, auth model | `docs/ARCHITECTURE.md` |
| The whole 42-screen design source of truth | `design/` |
| The specialist agent team (PM, token-economist, QA, etc.) | `.claude/agents/` |
| All custom skills (Hebrew-RTL, privacy, media-verify, supabase…) | `.claude/skills/` |
| The enforcement hooks (context-guard, visual-QA, session-start) | `.claude/hooks/` |
| The Supabase connector definition | `.mcp.json` |
| Hook + permission config | `.claude/settings.json` |

**None of this needs to be exported or re-created.** It's version-controlled and
account-independent. This is the answer to "nothing is lost."

---

## 2. What does NOT travel — the short list to set up once on the new account

Only three categories are tied to the account/environment rather than the repo:

### A. Repository access (2 minutes)
The new account needs to be able to open this repo.
- Sign in to the new account at **https://claude.ai/code**
- Connect GitHub and grant access to the **`ofirdamr/Oura`** repository
- Start a session on that repo → it now has all of Section 1 automatically.

### B. The Supabase connector (must be re-authorized once)
The connector *definition* is in `.mcp.json`, but each account must approve it once
(OAuth is per-account and cannot be copied).
- In the new session, open the connector/MCP settings and **authorize Supabase**
  when prompted.
- Supabase project is already pinned in `.mcp.json`
  (`project_ref=voxxhvywzaizyputjqkm`) — no ID to type, just approve the login.

### C. Environment secrets — THIS IS THE REAL GAP (does NOT travel with the repo)
Secrets are deliberately **never** stored in the repo and are **never** copied into
this file — putting a secret in a repo or a chat leaks it. So they will **not**
appear on the new account by themselves. You move them yourself, privately:

- Open the **current** environment's secrets page → copy each value.
- Open the **new** account's Claude Code environment secrets page → paste each one
  under the same name.
- Or re-fetch each value from its original dashboard (Supabase, Cloudflare, Brevo,
  Stripe) if you don't have the old page open.

Never route these through the repo, a PR, or a chat message. The names to add:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GUEST_TOKEN_SECRET
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
EMBED_SERVICE_URL
EMBED_SERVICE_TOKEN
BREVO_API_KEY
BREVO_SENDER_EMAIL
ADMIN_BACKFILL_TOKEN
```
(Tuning values — `GUEST_MATCH_THRESHOLD`, `GUEST_MATCH_TOPK`,
`CLUSTER_MATCH_THRESHOLD` — are optional overrides; defaults are fine to start.)

### D. Claude's personal "memory" does NOT transfer (and doesn't need to)
Claude's account-level memory is tied to the account and cannot be exported to
another one. **This is fine** — for Oura, none of the project's real state lives in
that personal memory. Every rule, decision, and lesson lives in the repo files
(`CLAUDE.md`, `SUMMARY.md`, `PROGRESS.md`, `MISTAKES.md`). The first-session message
in §3 makes the new account read those, so it starts fully caught up. If there was
any preference you'd only ever told Claude in chat and never wrote down, add it to
`CLAUDE.md` now so it becomes permanent, repo-backed memory instead of account memory.

> Anything else — GitHub connector, and any other connectors you added by hand — is
> re-connected the same way: sign in on the new account and approve each one once.
> There is no hidden state beyond this list.

---

## 3. First message to paste into the new account's first session

Copy this into the very first message on the new account so it picks up exactly
where we left off:

> Read `SUMMARY.md`, then `CLAUDE.md`, then this file (`ACCOUNT-MIGRATION.md`).
> We migrated to this account because the previous one hit its usage limit.
> Confirm the Supabase connector is authorized and the environment secrets from
> ACCOUNT-MIGRATION.md §2C are present, then continue from the open items in
> `SUMMARY.md`. Follow every rule in `CLAUDE.md` — especially the 22% context
> hand-off line — from the first turn.

---

## 4. Why you won't lose the "method"
The method isn't remembered by the account — it's *enforced by files in this repo*:
the hooks block finishing without verification, the session-start hook re-states the
rules every session, and `CLAUDE.md` + `MISTAKES.md` carry every decision and lesson.
A fresh account on this repo is bound by the exact same rules from turn one.
