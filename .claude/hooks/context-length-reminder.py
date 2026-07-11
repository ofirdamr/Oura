#!/usr/bin/env python3
"""UserPromptSubmit hook: enforce the universal-framework §0.3 conversation-
length scope guard mechanically instead of trusting the assistant to remember.

Once the running transcript gets large, every further turn re-sends the whole
thing (real token cost). Past a size threshold this injects a reminder to run
the Token Economist length check and, if the MD files are current, proactively
offer the §6 Session Handover and a fresh session. Fails open so it can never
wedge a turn."""
import sys, json, os

# JSONL transcripts grow fast; ~400KB is a long, multi-workstream conversation.
THRESHOLD_BYTES = 400_000

def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)
    tpath = data.get("transcript_path")
    if not tpath or not os.path.exists(tpath):
        sys.exit(0)
    try:
        size = os.path.getsize(tpath)
    except Exception:
        sys.exit(0)
    if size >= THRESHOLD_BYTES:
        mb = size / 1_000_000
        print(
            f"[context-length] The transcript is ~{mb:.1f}MB and every further turn re-sends all of it. "
            "Run the universal-framework §0.3 conversation-length scope guard NOW: if the MD files are current "
            "(a real commit just landed, SUMMARY/PROGRESS/ARCHITECTURE reflect reality), proactively recommend "
            "starting a FRESH session and give the §6 Session Handover (state summary, next steps, model used/next) "
            "with a self-contained first message. Finish or clearly park the immediate thread first. Do not drop this."
        )
    sys.exit(0)

main()
