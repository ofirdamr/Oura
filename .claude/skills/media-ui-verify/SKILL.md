---
name: media-ui-verify
description: Deterministic pre-"done" verification for Oura media-pipeline and UI changes. Use after any edit touching /packages/processing-pipeline (face-embed, culling, transcode, overlay compositing) or /apps/web (guest gallery, photographer dashboard). Checks lint/typecheck, RTL logical-property usage, Hanken Grotesk/Hebrew-glyph misuse, R2-vs-Supabase-storage boundary, biometric-consent-gate ordering, and design/*/screen.png fidelity. Do NOT use for backend-only API/DB work with no media or UI surface — see docs/ARCHITECTURE.md conventions for that instead.
license: MIT
compatibility: Works with Claude Code. Requires this repo's lint/typecheck scripts and Playwright for the screenshot step.
---

# Media/UI Verification Skill

Turn-based self-check: run this before reporting any media-pipeline or UI change
as done. All 7 checks must pass — a failing check means fix and re-run, not a
caveat in the final report.

## When to run
After any change touching `/packages/processing-pipeline` or `/apps/web`.

## Checks (all must pass)

1. **Static checks** — `pnpm lint && pnpm typecheck` — zero errors.
2. **RTL guardrail** — no physical `ml-*`/`mr-*`/`text-left`/`text-right` in
   touched files; logical properties only (`ms-*`/`me-*`/`ps-*`/`pe-*`/
   `text-start`/`text-end`). See `hebrew-rtl-best-practices` for the full rules.
3. **Font guardrail** — `--font-display` (Hanken Grotesk) never applied to an
   element that renders Hebrew text; it has no Hebrew glyphs. Rubik
   (`--font-sans`) is the default for everything else.
4. **Media-storage guardrail** — no binary write path targets Supabase storage;
   media binaries go to R2 only.
5. **Consent guardrail** — any face-matching call is only reachable after the
   guest has passed the biometric-consent gate; no code path skips it.
6. **Design fidelity** — if a `design/*/screen.png` exists for the screen
   touched, diff the implementation against that PNG (not against the folder
   name — content/naming mismatches have happened before). No matching source
   → do not freehand the visual; flag it for a Stitch prompt instead.
7. **Live screenshot** — capture the real running result via Playwright. No
   "done" claim on a UI/visual change without one, per the project's Stop-hook
   verification rule.

## Exit condition
All 7 pass → report done with the live deep-link to the exact screen/flow.
Any check fails → fix in source and re-run this skill; never report partial
completion with a known-failing check as a footnote.
