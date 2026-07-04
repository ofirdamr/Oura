# Mistakes Log

Append-only. Log immediately on discovery, before moving on.

---

### 2026-07-03 — Skipped mandatory Token Economist gate
**What:** Jumped straight into spawning a Plan agent for architecture work (twice) without first stating the Token Economist consult (leanest path / model / scope guard / orchestration mode) required by `universal-framework` skill section 0, "before any task, no exceptions."
**Why:** Treated "start planning" as license to act immediately instead of treating the gate as a hard blocking step that must be visible before any tool use.
**Correct approach:** Every task now gets a visible Token Economist line before any tool use. Applied from the planning-redo pass onward.

---

### 2026-07-04 — Bidi space-collapse around an inline-styled number in Hebrew copy
**What:** On the Personal Gallery port, "מצאנו 12 תמונות" rendered as "מצאנו12תמונות" — both spaces around the `<span>`-wrapped `12` vanished — even though the JSX source had the spaces written correctly on both sides.
**Why:** Wrapping a number in its own inline element inside RTL text creates a bidi run boundary; the browser's bidi resolution collapsed the adjacent neutral space characters at that boundary. Plain numbers with no wrapping element (e.g. the "842" a few words later, not in a span) were unaffected.
**Correct approach:** Add `unicode-bidi: isolate` to any inline element that wraps a number/stat sitting inside Hebrew sentence text. Caught by visually verifying a cropped screenshot rather than trusting the JSX source diff — worth doing on every screen with inline counts.

---

### 2026-07-04 — Two other gotchas from the Minimal Gallery port (worktree hygiene + screenshot false-positive)
**What (1):** This session's worktree branch was created before the Festive Gallery commit landed on `main`, so the shared `components/guest/BottomNav` the task told me to reuse didn't exist yet in the branch. **Correct approach:** before starting a screen port in an isolated worktree, check `git log --oneline HEAD..main` — if the branch is behind, fast-forward merge `main` in first so shared components/utilities from screens ported since the branch point are actually available, instead of accidentally re-inventing them.
**What (2):** A Playwright `fullPage: true` screenshot renders `position: fixed` elements (the share/download FAB) frozen at their first-viewport pixel position, making them appear to overlap mid-page content in the flattened image — not a real rendering bug. The *original Stitch `screen.png` export has the exact same artifact* (its own single visible FAB circle is this same fixed-element flattening, not evidence of a different design). **Correct approach:** for pages with `position: fixed` elements, verify with regular (non-fullPage) viewport screenshots at a few scroll offsets instead, and don't over-index on a single full-page capture — either the tool's own or the source `screen.png` — when fixed elements are involved. Separately, also don't trust a quick visual read of which of two small same-shape icons is "highlighted" at low screenshot resolution — confirm interactive state via `page.$$eval` reading the actual class/attribute instead of eyeballing icon color, which led to a brief false alarm here before the DOM check confirmed the toggle was working correctly all along.
