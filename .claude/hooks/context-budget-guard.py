#!/usr/bin/env python3
"""UserPromptSubmit hook: hard-blocks the next prompt once the conversation's
transcript-size estimate reaches BUDGET_PCT of CONTEXT_WINDOW_TOKENS.

ASSUMPTION (adjust below if wrong): Claude Code exposes NO field for real
context-window usage/percentage to hooks (verified against the hooks docs,
2026-07-10) — there is no way to read the true number. This estimates from
the transcript file's own size instead, so it is an approximation, not an
exact measurement. CONTEXT_WINDOW_TOKENS below is a stated assumption
(standard Claude window); correct it here if the account's real window
differs, rather than trusting the number blindly.

Fails OPEN on any error (missing file, bad JSON, no tiktoken installed) — a
bug or edge case here must never permanently brick every future prompt in
the session. Silence (no stdout) = allow.
"""
import json
import os
import sys

CONTEXT_WINDOW_TOKENS = 200_000  # stated assumption — adjust if wrong
BUDGET_PCT = 0.30
BUDGET_TOKENS = int(CONTEXT_WINDOW_TOKENS * BUDGET_PCT)


def estimate_tokens(text: str) -> int:
    try:
        import tiktoken

        enc = tiktoken.get_encoding("o200k_base")
        return len(enc.encode(text))
    except Exception:
        return len(text) // 4  # fallback heuristic, no dependency required


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return  # fail open: unreadable input, allow silently

    transcript_path = payload.get("transcript_path")
    if not transcript_path or not os.path.isfile(transcript_path):
        return  # fail open: nothing to measure yet (e.g. brand-new session)

    try:
        with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
    except Exception:
        return  # fail open

    used = estimate_tokens(text)
    if used >= BUDGET_TOKENS:
        pct = round(used / CONTEXT_WINDOW_TOKENS * 100, 1)
        print(
            json.dumps(
                {
                    "decision": "block",
                    "reason": (
                        f"Context budget hard-stop: this conversation's transcript "
                        f"is ~{used:,} tokens (~{pct}% of the assumed "
                        f"{CONTEXT_WINDOW_TOKENS:,}-token window), past the "
                        f"{int(BUDGET_PCT * 100)}% cap you set. Start a fresh "
                        f"session now — SUMMARY.md/PROGRESS.md carry the state "
                        f"forward. (This is an estimate from transcript size, not "
                        f"an exact measurement — see this script's header for why.)"
                    ),
                }
            )
        )
    # else: no stdout output = allow, per the UserPromptSubmit hook contract.


if __name__ == "__main__":
    main()
