#!/usr/bin/env bash
# Test for context-guard.py — proves it fires per message and blocks early.
# Builds fake transcripts with real `usage` token counts, runs the hook against
# each, and asserts pass / warn / block. Run: bash context-guard.test.sh
set -u
HOOK="$(dirname "$0")/context-guard.py"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PASS=0; FAIL=0

# make_transcript <file> <input_tokens>  (LIMIT default 200000)
make_transcript() {
  printf '{"type":"user","message":{"role":"user","content":"hi"}}\n' > "$1"
  printf '{"type":"assistant","message":{"role":"assistant","usage":{"input_tokens":%s,"cache_read_input_tokens":0,"cache_creation_input_tokens":0}}}\n' "$2" >> "$1"
}

run_hook() { # <transcript>  -> prints hook stdout
  printf '{"transcript_path":"%s","prompt":"next"}' "$1" | python3 "$HOOK"
}

check() { # <name> <haystack> <needle-or-empty> <should_contain:1|0>
  local name="$1" out="$2" needle="$3" want="$4"
  if [ -z "$needle" ]; then
    if [ -z "$out" ]; then echo "PASS: $name"; PASS=$((PASS+1)); else echo "FAIL: $name (expected empty, got: $out)"; FAIL=$((FAIL+1)); fi
    return
  fi
  if echo "$out" | grep -q "$needle"; then
    [ "$want" = "1" ] && { echo "PASS: $name"; PASS=$((PASS+1)); } || { echo "FAIL: $name (unexpectedly found '$needle')"; FAIL=$((FAIL+1)); }
  else
    [ "$want" = "0" ] && { echo "PASS: $name"; PASS=$((PASS+1)); } || { echo "FAIL: $name (missing '$needle' in: $out)"; FAIL=$((FAIL+1)); }
  fi
}

echo "== defaults: WARN=15% (30k), BLOCK=30% (60k) of 200k =="

# 1) Small context (10k = 5%) -> silent pass
make_transcript "$TMP/small.jsonl" 10000
OUT="$(run_hook "$TMP/small.jsonl")"
check "5% -> silent (no output)" "$OUT" "" 1

# 2) Warn band (50k = 25%) -> additionalContext, NOT a block
make_transcript "$TMP/warn.jsonl" 50000
OUT="$(run_hook "$TMP/warn.jsonl")"
check "25% -> warns"          "$OUT" "additionalContext" 1
check "25% -> does NOT block" "$OUT" '"decision"' 0

# 3) Block band (150k = 75%) -> hard block
make_transcript "$TMP/block.jsonl" 150000
OUT="$(run_hook "$TMP/block.jsonl")"
check "75% -> blocks"            "$OUT" '"decision": "block"' 1
check "75% -> tells to open new" "$OUT" "NEW conversation" 1

# 4) The founder's real complaint: 69% must have blocked
make_transcript "$TMP/sixtynine.jsonl" 138000
OUT="$(run_hook "$TMP/sixtynine.jsonl")"
check "69% -> would have BLOCKED" "$OUT" '"decision": "block"' 1

# 5) cache_read tokens counted too (the bulk of real context)
printf '{"type":"assistant","message":{"role":"assistant","usage":{"input_tokens":2000,"cache_read_input_tokens":120000,"cache_creation_input_tokens":5000}}}\n' > "$TMP/cache.jsonl"
OUT="$(run_hook "$TMP/cache.jsonl")"
check "cache-read counted -> blocks at ~63%" "$OUT" '"decision": "block"' 1

# 6) Custom env thresholds honoured (block at 10%)
make_transcript "$TMP/env.jsonl" 30000
OUT="$(OURA_CONTEXT_BLOCK=0.10 run_hook "$TMP/env.jsonl")"
check "env override BLOCK=10% -> blocks at 15%" "$OUT" '"decision": "block"' 1

# 7) Fails open on garbage transcript path
OUT="$(printf '{"transcript_path":"/no/such/file","prompt":"x"}' | python3 "$HOOK")"
check "missing transcript -> silent (fail-open)" "$OUT" "" 1

echo "======================="
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
