#!/usr/bin/env python3
"""UserPromptSubmit hook: enforce the Tooling Scout first-look (universal-
framework §1) mechanically. On a prompt that looks like a new build/mission,
inject a reminder to check for an existing skill / installed MCP-connector /
network-published skill or plugin that fits THIS mission before solving from
scratch — and lists the project's local skills so the menu is in view.

Kept quiet on short/chatty prompts so it only fires on real missions. Fails
open."""
import sys, json, os, glob, re

MISSION_RE = re.compile(
    r"build|implement|add\b|create|feature|wire|integrat|payment|stripe|upload|"
    r"comment|print|gift|checkout|migrat|deploy|refactor|design",
    re.I,
)

def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)
    prompt = data.get("prompt") or ""
    # Only nudge when it reads like a real mission, not a one-line reply.
    if len(prompt) < 180 and not MISSION_RE.search(prompt):
        sys.exit(0)

    root = os.environ.get("CLAUDE_PROJECT_DIR", ".")
    skills = sorted(
        os.path.basename(os.path.dirname(p))
        for p in glob.glob(os.path.join(root, ".claude/skills/*/SKILL.md"))
    )
    menu = ", ".join(skills) if skills else "(none found locally)"
    print(
        "[tooling-scout] Before building from scratch, consult the Tooling Scout (universal-framework §1): is there "
        "an existing skill, an installed MCP/connector, or a skill/plugin published on the network (GitHub/marketplace) "
        f"that fits THIS mission better? Local skills: {menu}. Adopt a safe skill directly; surface any OAuth-needing "
        "connector to the founder with the one-time connect step. One good find is enough — don't over-search."
    )
    sys.exit(0)

main()
