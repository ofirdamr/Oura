#!/usr/bin/env python3
"""UserPromptSubmit hook — fires on EVERY message the founder sends.

Reads the real context size from the transcript's per-turn `usage` data
(input + cache-read + cache-creation tokens = the full prompt sent to the
model, i.e. what maps to the 200k window and the "N% usage" figure), and:

  - injects a soft warning once context passes WARN_PCT of the window, and
  - BLOCKS the message once it passes BLOCK_PCT, forcing the founder to open a
    fresh conversation before the context runs away.

Goal: never again let a single long conversation eat most of the usage limit.
Stop early, hand off to a new conversation, keep each mission small.

Fails OPEN on any parsing problem so it can never wedge a session.
Tunable via env vars:
  OURA_CONTEXT_LIMIT   total context window in tokens        (default 200000)
  OURA_CONTEXT_WARN    warn threshold, fraction of window     (default 0.20)
  OURA_CONTEXT_BLOCK   block threshold, fraction of window    (default 0.35)
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
WARN_PCT = _env_float("OURA_CONTEXT_WARN", 0.15)
BLOCK_PCT = _env_float("OURA_CONTEXT_BLOCK", 0.30)


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

    if pct >= BLOCK_PCT:
        # Hard stop: block this message and force a fresh conversation.
        reason = (
            f"CONTEXT GUARD - STOP. This conversation is at {pct_str} of the "
            f"context window ({tok_str}), over the {BLOCK_PCT * 100:.0f}% hard limit. "
            "Per the founder's token-saving rule, do NOT continue here. "
            "Finish nothing new in this thread. Instead: (1) briefly note where "
            "things stand and what the next single small mission is, (2) tell the "
            "founder to open a NEW conversation and paste that next mission. "
            "Keep each conversation to one small mission so context never runs away."
        )
        print(json.dumps({"decision": "block", "reason": reason}))
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
