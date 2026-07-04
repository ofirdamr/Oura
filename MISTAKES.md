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

---

### 2026-07-04 — Two other gotchas from the Minimal Gallery port (worktree hygiene + screenshot false-positive)
**What (1):** This session's worktree branch was created before the Festive Gallery commit landed on `main`, so the shared `components/guest/BottomNav` the task told me to reuse didn't exist yet in the branch. **Correct approach:** before starting a screen port in an isolated worktree, check `git log --oneline HEAD..main` — if the branch is behind, fast-forward merge `main` in first so shared components/utilities from screens ported since the branch point are actually available, instead of accidentally re-inventing them.
**What (2):** A Playwright `fullPage: true` screenshot renders `position: fixed` elements (the share/download FAB) frozen at their first-viewport pixel position, making them appear to overlap mid-page content in the flattened image — not a real rendering bug. The *original Stitch `screen.png` export has the exact same artifact* (its own single visible FAB circle is this same fixed-element flattening, not evidence of a different design). **Correct approach:** for pages with `position: fixed` elements, verify with regular (non-fullPage) viewport screenshots at a few scroll offsets instead, and don't over-index on a single full-page capture — either the tool's own or the source `screen.png` — when fixed elements are involved. Separately, also don't trust a quick visual read of which of two small same-shape icons is "highlighted" at low screenshot resolution — confirm interactive state via `page.$$eval` reading the actual class/attribute instead of eyeballing icon color, which led to a brief false alarm here before the DOM check confirmed the toggle was working correctly all along.

---

### 2026-07-04 — Direct Postgres (port 5432) is unreachable from this sandbox; use the Management API instead
**What:** Tried to apply `0001_init.sql` with `psql` over a direct connection string (`db.<ref>.supabase.co:5432`). Failed immediately with an opaque `psql: error:` and, on a raw `/dev/tcp` probe, "Address family not supported by protocol."
**Why:** This environment's outbound network is HTTPS-only through a local agent proxy (see `/root/.ccr/README.md`) — arbitrary TCP (raw Postgres wire protocol) isn't reachable at all here, independent of whether the password/host/port are correct. Cost real back-and-forth getting a DB password from the founder before discovering this.
**Correct approach:** In this environment, don't reach for a direct DB connection for one-off SQL against Supabase. Use the Management API instead — `POST https://api.supabase.com/v1/projects/{ref}/database/query` with `{"query": "<sql>"}` and a personal access token (`sbp_...`, generated at supabase.com/dashboard/account/tokens) — it's plain HTTPS, so it goes through the proxy fine. Verify success afterward via PostgREST (service-role key should get 200 on the new tables; anon key should get an empty array, not an error, confirming RLS). Check "can this even reach the destination" before asking the user for a credential, not after.

---

### 2026-07-04 — `SUPABASE_URL` for supabase-js must be the base URL, not `.../rest/v1/`
**What:** The Worker's `GET /gallery/:token` (its first real DB call — it was a 501 stub before) returned `lookup_failed` (500) on every query. The `SUPABASE_URL` Wrangler secret had been set to a value ending in `/rest/v1/` (the injected container env var `SUPABASE_URL` here is `https://<ref>.supabase.co/rest/v1/`, not the bare project URL). supabase-js appends its own `/rest/v1/`, so requests hit `.../rest/v1//rest/v1/<table>` → PGRST125 "Invalid path" / 404.
**Why:** Two traps stacked: (1) the provided env var already has the PostgREST path baked in — surprising, and different from what `createClient` wants; (2) it stayed dormant because the earlier pass only tested PostgREST via direct `curl` (which correctly uses the `/rest/v1/` base) and never exercised the Worker's own Supabase client behind the stub. The health check only reports the secret is *present* (boolean), not that it *works*.
**Correct approach:** `createClient(url, key)` wants the PROJECT BASE URL (`https://<ref>.supabase.co`) — strip any trailing `/rest/v1/`. When wiring a Worker's DB client, exercise one real query end-to-end, not just a presence/health check; a "binding present" green light hides a malformed value. For direct `curl` to PostgREST the base is the opposite (`.../rest/v1/<table>`) — don't reuse the same string for both.

---

### 2026-07-04 — Signed numbers still bidi-reverse inside `unicode-bidi: isolate` in RTL context
**What:** On the Photo Editor's slider value readouts, a negative value rendered as `40-` instead of `-40`, even with `unicode-bidi: isolate` applied on the span (the fix documented in the earlier "bidi space-collapse" entry above).
**Why:** `unicode-bidi: isolate` creates a new bidi run, but that run's *base direction* still resolves from the element's own `direction` property (inherited `rtl` from the page here), not from the content. A plain positive number ("12") looks fine either way because pure digit runs (Unicode bidi type EN) aren't reordered relative to a base direction. But a leading minus sign is a weak/neutral character whose position relative to the digits *is* resolved according to the isolate's base direction - in an RTL-base isolate it gets placed on the trailing (right) side instead of the leading (left) side.
**Correct approach:** For any inline-isolated numeric value that can be negative (or otherwise signed/formatted, e.g. contains `-`, `+`, `%` in a specific order), set `direction: ltr` explicitly alongside `unicode-bidi: isolate` on that span - don't rely on isolate alone. Plain unsigned integers (the gallery photo-count case) don't need this, but anything with a sign does. Verify by actually driving the value negative in a screenshot, not just checking the default/positive case.

---

### 2026-07-04 — Toggle switch on/off direction inverted for RTL (Tailwind logical `start-*`/`end-*` positioning)
**What:** Built a custom toggle switch (auto-optimize, Photo Editor) using an absolutely-positioned thumb with Tailwind's logical `start-*` utility for the two states. Initially wired it backwards: off-state used `start-6` (thumb near the *end*/left in RTL) and on-state used `start-1` (thumb near the *start*/right) - the opposite of the Material-style convention (off rests at inline-start, on slides to inline-end), so it behaved like an un-mirrored LTR switch even on an RTL page.
**Why:** Easy to get the small/large inset value backwards when reasoning about `start-*`/`end-*` under time pressure - a *small* inset-inline-start value puts the thumb *near* the start edge (not the end), which is the opposite of the naive "start-6 sounds like state A, start-1 sounds like state B" guess without checking which numeric direction is smaller vs larger.
**Correct approach:** Don't eyeball a screenshot to confirm which side a small toggle thumb sits on at 390px width (same lesson as the Minimal Gallery FAB/icon false-alarm, generalized to any small binary-state control) - use Playwright to read `getComputedStyle(thumb).left/right` (or `insetInlineStart`) directly in both states and confirm the delta matches intent before trusting a screenshot crop. Applies to any future custom switch/slider-thumb/handle component, not just this one.

---

### 2026-07-04 — A launched Playwright browser doesn't route external requests through this sandbox's proxy the way curl/Node do
**What:** Verifying the guest-flow wiring, a real click-through against the live Worker hung indefinitely on the very first `fetch` from the browser (`POST /events/:id/guests`) - no error, no response, just a permanent pending state. `curl`/Node requests to the same host worked fine throughout the session.
**Why:** This environment's outbound network is proxied via `HTTPS_PROXY` (see `/root/.ccr/README.md`), which `curl` and Node's HTTP stack pick up automatically, but a Chromium instance launched via Playwright does not inherit `HTTPS_PROXY` from the environment - it needs the proxy passed explicitly via `chromium.launch({ proxy: { server, bypass } })`, and even then, TLS re-termination at the proxy needs `--ignore-certificate-errors` for a quick verification browser (not something to ship, just for this kind of one-off check).
**Correct approach:** For any future live-browser verification against an external host from this sandbox, either (a) explicitly configure `chromium.launch`'s `proxy` option (with `bypass` covering `localhost`/`127.0.0.1` so local dev-server requests aren't also routed through it), or (b) sidestep the whole issue by using Playwright's `page.route()` to mock the external API's responses - this verifies the frontend's own logic (data handling, redirects, error states) without depending on sandbox networking at all, and is often the more appropriate test boundary anyway. Prefer (b) for pure frontend-logic verification; only reach for (a) when the live round-trip itself is what needs proving (and that's usually better done with `curl`, which already works, rather than through a browser).

---

### 2026-07-04 — Background agents cut off by an account rate limit still leave usable work
**What:** Two parallel background agents (Create New Event/Branding Settings, and guest-flow wiring) both hit an account-level session limit mid-task and were reported as "failed." Assumed at first this meant discarding and retrying; instead checked each worktree directly and found `tsc --noEmit` clean and the code logically complete in both cases - they'd simply been cut off before their own final verification/commit/doc-update steps, not left in a broken state.
**Why:** A "failed" task-notification status describes how the agent's process ended, not the quality/completeness of the diff it produced up to that point - worth checking before assuming the work needs to be redone from scratch.
**Correct approach:** On an agent failure, `git status`/`git diff` the worktree before writing it off. If the code is coherent, finish the remaining steps (verification, docs, commit) yourself rather than re-spawning a subagent - especially right after a rate limit, since a fresh spawn will likely hit the same wall. Only re-spawn (or wait for the limit to clear) if the partial work is genuinely incomplete/broken.
