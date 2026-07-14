#!/usr/bin/env python3
"""UserPromptSubmit hook: LOCAL-first tooling nudge (universal-framework §1).

History (2026-07-13): the previous version fired on essentially every
mission-shaped prompt (fix|wire|deploy|add|design|refactor|…) and *commanded* a
full network sweep every time — WebSearch across GitHub + the marketplace,
SearchMcpRegistry, discover_zapier_actions over 9,000 Zapier apps,
SuggestConnectors, etc. Each of those dumps a large result payload into context
that is then re-billed on every subsequent turn (Opus), and the model burned
turns running searches it almost never needed (you don't search 9,000 Zapier
apps to strip an "Oura" credit line from a photo export). That per-task network
sweep was the dominant, compounding token leak — the exact thing CLAUDE.md's
"Session Budget Discipline" already names as what killed a prior session.

New behavior:
  - Only fires when the prompt looks like NEW external-integration work — a
    service the repo doesn't already wire (payments, an OAuth connector, an
    email/SMS provider, a print vendor, a brand-new third-party API/webhook).
    Routine build/fix/wire/deploy/refactor/design of EXISTING code no longer
    triggers it at all.
  - Even then it nudges LOCAL-first (already-present skills) and only says to
    reach for the network if the local menu genuinely has no fit — it does not
    order a blanket 9,000-app / MCP-registry / GitHub sweep.

Fails open."""
import sys, json, os, glob, re

# Fire ONLY on genuinely new external-integration work, not routine code edits.
NEW_INTEGRATION_RE = re.compile(
    r"\b(stripe|paypal|payment|checkout|subscription|billing|oauth|connector|"
    r"webhook|zapier|twilio|sendgrid|resend|mailgun|email\s+provider|sms|"
    r"third[- ]party|external\s+(api|service)|print\s+(vendor|partner|lab)|"
    r"integrat\w*\s+with)\b",
    re.I,
)

def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)
    prompt = data.get("prompt") or ""
    if not NEW_INTEGRATION_RE.search(prompt):
        sys.exit(0)

    root = os.environ.get("CLAUDE_PROJECT_DIR", ".")
    skills = sorted(
        os.path.basename(os.path.dirname(p))
        for p in glob.glob(os.path.join(root, ".claude/skills/*/SKILL.md"))
    )
    menu = ", ".join(skills) if skills else "(none found locally)"
    print(
        "[tooling-scout] This looks like NEW external-integration work. Check LOCAL first "
        "(one quick look, no token-heavy sweep): SearchSkills / ListSkills / "
        "list_enabled_zapier_actions. Local skills present: "
        f"{menu}. Only if nothing local fits AND this needs a service the repo doesn't "
        "already wire should you reach for the network — and then a single targeted "
        "search, not a blanket 9,000-app / MCP-registry / GitHub sweep. For anything "
        "needing OAuth/install, surface it to the founder with the one-time connect step "
        "rather than searching broadly."
    )
    sys.exit(0)

main()
