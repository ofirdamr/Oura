#!/usr/bin/env python3
"""UserPromptSubmit hook — fires on EVERY message the founder sends.

Reads the real context size from the transcript's per-turn `usage` data
(input + cache-read + cache-creation tokens = the full prompt sent to the
model, i.e. what maps to the 200k window and the "N% usage" figure), and:

  - injects a soft warning once context passes WARN_PCT of the window, and
  - injects a STRONGER warning once it passes BLOCK_PCT, urging the founder to
    hand off to a fresh conversation before the context runs away.

  - HARD-BLOCKS the message once context passes HARDSTOP_PCT of the window,
    forcing a handoff to a fresh conversation (founder rule, reinstated
    2026-07-23 after a session was allowed to climb to 72%).

The hard stop is REAL: it exits code 2 so the prompt is rejected and the
founder is told to start a fresh session. Escape hatch: if the message begins
with (or contains) the token `FORCE` it is let through, so the guard can never
permanently wedge a session — e.g. to finish parking a thread or write a
handoff. Below the hard stop, escalating warnings still fire.

Goal: never again let a single long conversation eat most of the usage limit.
Stop early, hand off to a new conversation, keep each mission small.

Fails OPEN on any parsing problem so it can never wedge a session.
Tunable via env vars:
  OURA_CONTEXT_LIMIT     total context window in tokens        (default 200000)
  OURA_CONTEXT_WARN      warn threshold, fraction of window     (default 0.12)
  OURA_CONTEXT_BLOCK     escalated-warning threshold            (default 0.22)
  OURA_CONTEXT_HARDSTOP  hard-block threshold, fraction         (default 0.45)
"""
import sys, os, json


def _env_float(name, default):
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def _env_int(name, default):
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


LIMIT = _env_int("OURA_CONTEXT_LIMIT", 200000)
# Lowered 2026-07-13 after a session ran to 109% of the window: every turn past
# that re-sends the whole context on Opus, which was the dominant usage burn.
# Warn early, push the handoff well before context runs away. Advisory only.
WARN_PCT = _env_float("OURA_CONTEXT_WARN", 0.12)
BLOCK_PCT = _env_float("OURA_CONTEXT_BLOCK", 0.22)
HARDSTOP_PCT = _env_float("OURA_CONTEXT_HARDSTOP", 0.45)


def context_tokens(transcript_path):
    """Return the largest real context size (tokens) seen in the transcript.

    Prefers the API `usage` fields (accurate). Falls back to a char/4 estimate
    of the raw transcript if no usage data is present (e.g. very first turn).
    """
    best = 0
    raw_chars = 0
    try:
        with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                raw_chars += len(line)
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except Exception:
                    continue
                usage = _find_usage(obj)
                if usage:
                    total = (
                        int(usage.get("input_tokens", 0) or 0)
                        + int(usage.get("cache_read_input_tokens", 0) or 0)
                        + int(usage.get("cache_creation_input_tokens", 0) or 0)
                    )
                    if total > best:
                        best = total
    except Exception:
        return 0
    if best == 0:
        # No usage data yet — rough estimate so we still catch runaway growth.
        best = raw_chars // 4
    return best


def _find_usage(obj):
    """Locate a `usage` dict anywhere in a transcript record."""
    if not isinstance(obj, dict):
        return None
    if isinstance(obj.get("usage"), dict):
        return obj["usage"]
    msg = obj.get("message")
    if isinstance(msg, dict) and isinstance(msg.get("usage"), dict):
        return msg["usage"]
    return None


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    tpath = data.get("transcript_path")
    if not tpath:
        sys.exit(0)

    tokens = context_tokens(tpath)
    if tokens <= 0 or LIMIT <= 0:
        sys.exit(0)

    pct = tokens / LIMIT
    pct_str = f"{pct * 100:.0f}%"
    tok_str = f"{tokens:,}/{LIMIT:,} tokens"

    if pct >= HARDSTOP_PCT:
        prompt = (data.get("prompt") or "")
        if "FORCE" not in prompt.upper():
            # REAL hard stop — reject the prompt and force a fresh session.
            sys.stderr.write(
                f"⛔ CONTEXT HARD STOP — this conversation is at {pct_str} "
                f"({tok_str}), past the {HARDSTOP_PCT * 100:.0f}% limit. This "
                "session is CLOSED to new work. Everything is committed and the "
                "MD files are current. Start a FRESH conversation and continue "
                "there. (To override for parking/handoff only, resend your "
                "message with the word FORCE in it.)\n"
            )
            sys.exit(2)
        # FORCE present — fall through to escalated warning, do not block.

    if pct >= BLOCK_PCT:
        # Escalated warning (no hard block — cancelled by founder request).
        warn = (
            f"CONTEXT GUARD - this conversation is at {pct_str} of the context "
            f"window ({tok_str}), past the {BLOCK_PCT * 100:.0f}% hand-off mark. "
            "Strongly consider stopping here: (1) briefly note where things stand "
            "and what the next single small mission is, (2) hand off to a NEW "
            "conversation for that next mission. Keep each conversation to one "
            "small mission so context never runs away."
        )
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "UserPromptSubmit",
                "additionalContext": warn,
            }
        }))
        sys.exit(0)

    if pct >= WARN_PCT:
        warn = (
            f"CONTEXT GUARD - this conversation is at {pct_str} ({tok_str}). "
            f"Approaching the {BLOCK_PCT * 100:.0f}% hard stop. Wrap up the current "
            "small mission now and prepare to hand off to a new conversation; do "
            "not start anything large here."
        )
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "UserPromptSubmit",
                "additionalContext": warn,
            }
        }))
        sys.exit(0)

    sys.exit(0)


main()
