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
        "[tooling-scout] MISSION DETECTED — run the Tooling Scout (universal-framework §1) BEFORE building from "
        "scratch, and actually SEARCH THE NETWORK, not just what's installed:\n"
        "  1. Installed/local first: SearchSkills, ListSkills, ListPlugins, ListConnectors, list_enabled_zapier_actions.\n"
        "  2. NOT-yet-installed (this is the point — search everything, adopt/surface the best fit): SearchPlugins and "
        "SearchMcpRegistry for published plugins/MCP servers; SuggestConnectors/SuggestPluginInstall; discover_zapier_actions "
        "for the 9,000+ Zapier apps; and WebSearch across GitHub + the Anthropic/Claude marketplace + connector directory "
        "for a skill/plugin/connector that fits THIS mission.\n"
        "  3. Adopt a safe published skill directly (skills are just files); for anything needing OAuth/install, surface it "
        "to the founder with the concrete value + the one-time connect step.\n"
        f"Local skills already present: {menu}. Judge relevance by description; one strong find is enough — don't over-search."
    )
    sys.exit(0)

main()
