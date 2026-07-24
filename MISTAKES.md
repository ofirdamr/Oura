# Mistakes Log

Append-only. Log immediately on discovery, before moving on. _Older entries in `MISTAKES-archive.md`._

---

### 2026-07-21 — Freehanded design files in PR #96 (Admin Print Queue)
**What:** Previous session added its own screen.png + reference HTML + implementation_guide.md for the admin print queue, then built the screen from those self-made files.
**Correct approach:** Design is king. Never create design files. Use Stitch MCP directly, or write a prompt and give it to the founder. No exceptions for "just an admin screen."

---

### 2026-07-21 — False design-violation accusation (same session, same day)
**What:** Flagged PR #96's screen.png files as "freehanded by Claude" — they were real Stitch exports.
**Correct approach:** Before flagging a guardrail violation involving the founder's own work, ASK first. Never write a violation into permanent docs based on an assumption.

---

### 2026-07-21 — Playwright "can't reach live pages" was solvable, not a real blind spot
**Fix committed:** `scripts/qa-shot.mjs` — intercepts every request via `ctx.route`, fetches bytes with `curl` (trusts the CA), fulfills into real browser. Usage: `NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/qa-shot.mjs <url> <out.png> [mobile|desktop]`. Never report a screenshot blind spot again.

---

### 2026-07-24 — Guessed which screens are "freehanded" instead of trusting the design source
**What:** Asserted a list of "10 freehanded screens" from code comments + folder-name matching, then screenshotted token/login-gated routes (`/consent`, `/selfie`) that redirect to the real gallery-entry Stitch page — and mislabeled that finished Stitch design as a "freehand duplicate." Founder had to correct twice: "That is stitch design!!! Do not guess!!!"
**Correct approach:** Never decide freehand-vs-Stitch by guessing. The founder names the exact screen that needs a redesign; design leads. Do not assert a freehand list, do not screenshot a gated route without the token/session it needs (it just bounces to another screen and looks like a duplicate).

---

### 2026-07-22 — Assumed Cloud Run was unreachable after first `{"ok":false,"models":[]}` response
**What:** Cloud Run returned `models:[]` on first health check (cold start, models loading in background thread). Session almost stopped without trying again.
**Correct approach:** Cold starts take 30–90s for InsightFace+CLIP. Always poll with `until <health> | grep ok:true; do sleep 5; done` before concluding the service is down. Never give up after one failed attempt on any service, token, or tool.
