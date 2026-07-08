#!/usr/bin/env python3
"""Stop hook: block finishing a turn that edited UI files without any visual
verification (a screenshot / Playwright run) in the transcript. Fails open on
any parsing problem so it can never wedge a session."""
import sys, json, re

def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    # Avoid loops: if we already blocked once this stop-cycle, let it through.
    if data.get("stop_hook_active"):
        sys.exit(0)

    tpath = data.get("transcript_path")
    if not tpath:
        sys.exit(0)

    try:
        with open(tpath, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
    except Exception:
        sys.exit(0)

    # Screenshot / visual-verification evidence anywhere in the session (lenient
    # on purpose — err toward NOT blocking a turn that did verify).
    low = text.lower()
    verified = (".png" in low) or ("screenshot" in low) or ("playwright" in low)

    # Did an Edit/Write touch a front-end UI file under apps/web?
    ui_edited = False
    ui_re = re.compile(r'apps/web/[^"\\]*\.(?:tsx|jsx|css|html)')
    edit_re = re.compile(r'"name"\s*:\s*"(?:Edit|Write|MultiEdit|NotebookEdit)"')
    for line in text.splitlines():
        if edit_re.search(line) and ui_re.search(line):
            ui_edited = True
            break

    if ui_edited and not verified:
        print(json.dumps({
            "decision": "block",
            "reason": ("You edited front-end files under apps/web this session but there is no "
                       "screenshot or Playwright run in the transcript. Per CLAUDE.md, do NOT stop: "
                       "run the change in a browser (dev server + Playwright), capture a screenshot, "
                       "confirm it renders correctly, then report done with the live deep-link to the "
                       "exact screen.")
        }))
    sys.exit(0)

main()
