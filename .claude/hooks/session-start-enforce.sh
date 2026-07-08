#!/usr/bin/env bash
# SessionStart hook — injects the non-negotiable Oura operating rules into every
# session's context so they don't depend on the model remembering to load them.
cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"MANDATORY OURA RULES (enforced by hooks): (1) Before the first task, invoke Skill(universal-framework) and load hebrew-rtl-best-practices before ANY UI edit. (2) State the Token Economist line (leanest path / model / scope / orchestration mode) before starting work. (3) Replies to the founder: MAX 3 sentences, no lists/tables/headers unless he asks. (4) NEVER say 'done'/'fixed' on a UI or visual change without an ACTUAL screenshot captured this session AND a live deep-link to the exact screen — a Stop hook blocks stopping otherwise. (5) When the founder must do something, give a direct link, not directions."}}
JSON
