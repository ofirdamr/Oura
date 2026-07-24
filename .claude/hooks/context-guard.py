#!/usr/bin/env python3
"""UserPromptSubmit hook — HARD STOPS at 45% context, warns at 22%.

Fails OPEN on any parsing problem so it can never wedge a session.
Tunable via env vars:
  OURA_CONTEXT_LIMIT   total context window in tokens  (default 200000)
  OURA_CONTEXT_WARN    warn threshold fraction          (default 0.22)
  OURA_CONTEXT_BLOCK   hard-stop threshold fraction     (default 0.45)
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
WARN_PCT = _env_float("OURA_CONTEXT_WARN", 0.22)
BLOCK_PCT = _env_float("OURA_CONTEXT_BLOCK", 0.45)


def context_tokens(transcript_path):
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
        best = raw_chars // 4
    return best


def _find_usage(obj):
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
        stop_msg = (
            f"HARD STOP — context is at {pct_str} ({tok_str}), past the "
            f"{BLOCK_PCT * 100:.0f}% limit. "
            "Do NOT answer the question. Instead: (1) commit an updated SUMMARY.md "
            "reflecting current state, (2) write the self-contained first message for "
            "the next conversation. Then stop."
        )
        print(json.dumps({"continue": False, "stopReason": stop_msg}))
        sys.exit(0)

    if pct >= WARN_PCT:
        warn = (
            f"CONTEXT GUARD - conversation is at {pct_str} ({tok_str}). "
            f"Approaching the {BLOCK_PCT * 100:.0f}% hard stop. Finish the current "
            "task, then hand off to a new conversation."
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
