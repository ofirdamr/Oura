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
