#!/usr/bin/env python3
"""Token-audit: show what the Oura repo costs in context tokens, per file group.

Run:  python3 scripts/token-audit.py
Purpose: make session token usage *visible* on demand (the founder keeps asking
"how much does everything take?"). Uses tiktoken (o200k_base) as a close proxy
for Claude's tokenizer, ±~10%; falls back to a chars/4 estimate if tiktoken and
the network are both unavailable. No app code, no secrets — pure measurement.
"""
import os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def make_counter():
    try:
        import tiktoken
    except ImportError:
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "tiktoken"],
                           check=True)
            import tiktoken
        except Exception:
            print("(tiktoken unavailable — using chars/4 estimate, less precise)\n")
            return lambda s: len(s) // 4
    enc = tiktoken.get_encoding("o200k_base")
    return lambda s: len(enc.encode(s))

def toks(counter, rel):
    p = os.path.join(ROOT, rel)
    try:
        with open(p, encoding="utf-8") as f:
            return counter(f.read())
    except FileNotFoundError:
        return None

# (label, path, loads-every-session?)
EVERY = [
    ("universal-framework skill (hook-forced)", ".claude/skills/universal-framework/SKILL.md"),
    ("SUMMARY.md (read first)",                 "SUMMARY.md"),
    ("CLAUDE.md (injected)",                    "CLAUDE.md"),
    ("SessionStart hook rules",                 ".claude/hooks/session-start-enforce.sh"),
]
ON_DEMAND = [
    ("universal-framework-orchestration (team mode only)", ".claude/skills/universal-framework-orchestration/SKILL.md"),
    ("hebrew-rtl-best-practices (any UI edit)",  ".claude/skills/hebrew-rtl-best-practices/SKILL.md"),
    ("israeli-privacy-shield (biometric work)",  ".claude/skills/israeli-privacy-shield/SKILL.md"),
    ("PROGRESS.md (when consulted)",             "PROGRESS.md"),
    ("MISTAKES.md (when consulted)",             "MISTAKES.md"),
    ("docs/ARCHITECTURE.md (when consulted)",    "docs/ARCHITECTURE.md"),
    ("PRD.md (when consulted)",                  "PRD.md"),
]

def section(counter, title, rows):
    print(f"\n## {title}")
    total = 0
    for label, path in rows:
        n = toks(counter, path)
        if n is None:
            print(f"  {label:<52} (missing)")
            continue
        total += n
        print(f"  {label:<52} {n:>8,}")
    print(f"  {'-'*52} {'-'*8}")
    print(f"  {'subtotal':<52} {total:>8,}")
    return total

def main():
    counter = make_counter()
    print("OURA TOKEN AUDIT — project-controlled context (not the fixed platform floor)")
    base = section(counter, "Loaded EVERY session (the baseline)", EVERY)
    section(counter, "Loaded on demand (per task)", ON_DEMAND)
    print(f"\n>> Every-session baseline: {base:,} tokens. "
          f"Keep it lean — trim SUMMARY.md and archive PROGRESS/MISTAKES when they grow.")

if __name__ == "__main__":
    main()
