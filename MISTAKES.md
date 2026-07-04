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

### 2026-07-04 — Injected credential env vars carry a leading space
**What:** The provided `SUPABASE_URL` / `CLOUDFLARE_*` / R2 env vars each have a leading space in their value (`echo "[$SUPABASE_URL]"` prints `[ https://...]`). Used raw, this mangles curl URLs/headers and would push a malformed value into a Wrangler secret (a JWT/URL with a leading space breaks auth).
**Why:** The injection mechanism prepends a space; easy to miss because most output looks fine at a glance.
**Correct approach:** Trim before use, every time. In-shell (no external process, no added newline): `V="${VAR#"${VAR%%[![:space:]]*}"}"`, or `sed 's/^[[:space:]]*//'` for one-offs. Pipe secrets to `wrangler secret put` with `printf %s "$V"` (no trailing newline) and never echo the value. Applies to any future session using these creds.

---

### 2026-07-04 — Fresh Cloudflare account had no workers.dev subdomain (non-interactive deploy blocker)
**What:** `wrangler deploy` uploaded the Worker but then errored — the account had never opened Workers, so no `workers.dev` subdomain existed, and wrangler can't register one non-interactively (falls back to "no"). The Worker had no reachable URL.
**Why:** A workers.dev subdomain is normally auto-created on first dashboard visit; a pure-API/CLI account never triggers that.
**Correct approach:** Register it once via the CF API — `PUT /accounts/:id/workers/subdomain` with `{"subdomain":"<globally-unique>"}` (used `oura-events`) — then redeploy. Note: a brand-new subdomain's TLS cert takes a few minutes to provision, so the first HTTPS curl fails with a TLS handshake error (552) until ready — poll, don't assume the deploy failed.
