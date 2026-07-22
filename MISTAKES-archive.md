# Mistakes Log — Archive

_Entries moved here from MISTAKES.md when it grew past 1 screen. See MISTAKES.md for current entries._

---

### 2026-07-14 — Sessions kept randomizing the founder's real account password during auth testing
**What:** The founder's `ofirdamr@gmail.com` password was changed multiple times across sessions (to `TempPass2026!Oura`, etc.) because sessions called the Supabase Admin API or `auth.admin.updateUserById()` directly against the real production account while doing auth testing or debugging. Not a code path in the product — ad-hoc curl/API calls from within sessions.
**Why:** No guardrail existed prohibiting auth mutations against the real account. Sessions treated "I need to test auth" as license to use the service-role key or Management API to change the live founder account, not a throwaway one.
**Correct approach:** Auth testing always uses a throwaway account (different email, delete after test). The only legitimate `auth.updateUser` in the codebase is `apps/web/app/reset-password/page.tsx` — gated behind a `PASSWORD_RECOVERY` session, which is correct. Added a hard CLAUDE.md guardrail prohibiting any auth credential mutation against real accounts. Password is now `OuraStudio2026!` — use `/forgot-password` if lost again, never the admin API.

---

### 2026-07-11 — Repeatedly claimed a screen "has no design" and freehanded/rebuilt it — the design index was unusable, mapping screen names to dead Stitch IDs, not to disk paths
**What:** Multiple sessions told the founder "there is no design for this screen" and either freehanded it or rebuilt work already covered by an existing Stitch export. Every such episode burned a whole conversation's tokens on unnecessary design + re-wiring.
**Correct approach:** Always run `ls design/screens/` first, then open the `screen.png` and trust its content over the folder name. Never conclude a design is missing from the index alone.

---

### 2026-07-11 — "Nothing is live" — `CLOUDFLARE_API_TOKEN` also has a leading space
**What:** Both `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` have leading spaces. Also `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` carry the same.
**Correct approach:** Trim ALL env creds before any wrangler/build step. Deploy BOTH workers. Fingerprint-verify: live `/BUILD_ID` == local BUILD_ID.

---

### 2026-07-09 — Face-matching kept "disappearing" — the retention cron DELETED the shared photo-face index
**What:** Daily cron `.delete()` on `face_embeddings` where `guest_id` was in expired consents — deleting the shared, searchable photo index, not just the guest's link.
**Correct approach:** Changed to `.update({ guest_id: null })` — un-links the guest, leaves the photo embedding intact. The ONLY legitimate deletes of `face_embeddings` are via `on delete cascade` from deleting a photo/event — never a per-guest expiry delete.

---

### 2026-07-05 — Photos ingested before Stage 2 never got embedded; `embed()` had no timeout
**What (1):** Pre-pipeline photos stuck at `embed_status:'pending'` — added `POST /admin/backfill-embeddings`.
**What (2):** No `AbortController` timeout on embed fetch → one stalled response hung the whole queue for 15+ min. Added 25s timeout.

---

### 2026-07-04 — Various dev environment gotchas (consolidated)
- **Bidi:** wrap unsigned numbers in `unicode-bidi:isolate`; for signed/negative numbers also add `direction:ltr`.
- **Injected env vars have a leading space** — trim before every use.
- **workers.dev subdomain** may not exist on a fresh CF account — register via `PUT /accounts/:id/workers/subdomain`.
- **`SUPABASE_URL` for supabase-js** must be the base URL, not `.../rest/v1/`.
- **Direct Postgres (5432) unreachable** in this sandbox — use the Management API instead.
- **Background agents cut off by usage limit** — check the diff before discarding; code may be complete.
- **RTL centering:** use `inset-x-0 mx-auto`, not `start-1/2 -translate-x-1/2`.
- **Three.js r185:** SSR → `ssr:false`; lighting → `decay:0`; timer → `performance.now()`; always teardown (`renderer.dispose()` + `forceContextLoss()`).
- **Next.js dev server doesn't hydrate** in this sandbox (HMR WS fails through proxy) — use prod build for Playwright tests.

---

### 2026-07-05 — `text-end` means the opposite for RTL body text
**What:** 34 occurrences of `text-end` across 11 files rendered Hebrew paragraphs flush-left (wrong direction).
**Correct approach:** For normal Hebrew body text, use `text-start`. Reserve `text-end` for content deliberately at the far edge.

---

### 2026-07-05 — A fixed per-event logo key + a "cache forever" media route silently broke logo re-uploads
**Correct approach:** Before applying `immutable` cache to a route, audit every writer for whether the key is truly content-addressed. Made logo key include a UUID per upload so re-uploads get fresh URLs.

---

### 2026-07-06 — Recommended a session handoff without closing it out first (PR unmerged, open question dropped)
**Correct approach:** Merge any already-deployed PR, write every open question into SUMMARY.md, hand over a self-contained first message. Protocol is codified in `universal-framework` §0.

---

### 2026-07-06 — ~20 real design fixes committed, never deployed; shown founder a LOCAL build as "proof"
**Correct approach:** A code fix is "done" at commit → deploy → verify live. A local build proves NOTHING about the live site. For client-rendered routes, diff the actual served JS chunk md5 against local build, not the SSR HTML.

---

### 2026-07-07 — Skipped mandatory Token Economist gate for a whole session
**Correct approach:** First action of every session = load `universal-framework`, state Token Economist line, pick orchestration mode. Non-negotiable.

---

### 2026-07-07 — `npm uninstall qrcode` removed a real dependency
**Correct approach:** Before uninstalling anything, grep codebase for imports + check `git show HEAD:package.json`.

---

### 2026-07-08 — "Done" reported without the live link
**Correct approach:** "Done" always ships the exact live URL, deep-linked to the specific screen.

---

### 2026-07-08 — Built the gallery viewer to spec, not to what a guest actually wants
**Correct approach:** Mandatory 1-minute UX self-proof before any UI is called done — act as the real user.

---

### 2026-07-08 — Claimed "automatic hooks" that were never actually hooks
**Correct approach:** A prompt rule is not a hook. If it must run automatically, it must be an actual hook in settings.json.

---

### 2026-07-10 — A complete deployed feature (PR #10) sat unmerged and got rebuilt from scratch twice
**Correct approach:** Merge and deploy are not ask-first gates — once verified, merge it. Before starting any named feature task, check `list_pull_requests`/`list_branches`.

---

### 2026-07-10 — Deployed a build with no Supabase env vars mapped, broke `/admin/*` live for ~5 min
**Correct approach:** Always export `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` from `SUPABASE_URL/ANON_KEY` before `npm run build`. Mechanical pre-deploy step.

---

### 2026-07-11 — Almost shipped an EXIF-orientation fix for a selfie that already matched
**Correct approach:** Empirically test the specific input on the real pipeline BEFORE writing a fix.

---

### 2026-07-13 — One conversation ate ~60% of the 5-hour usage cap in ~1 hour
**Root cause:** `tooling-scout-reminder.py` fired on every prompt + per-task sub-agent fan-out + context ran to 109%.
**Correct approach:** Solo + inline consults + targeted reads. No per-task network sweep. Hand off at ~22% context guard.

---

### 2026-07-16 — Selfie→0-match bug misdiagnosed twice before real cause found
**Root cause:** Single-owner `face_embeddings.guest_id` (many-to-many relationship stored as one column). First guest claims the cluster; every later session links 0 rows silently.
**Fix:** Migration 0008 — `guest_photo_matches` join table.

---

### 2026-07-16 — Declared MVP "completed" when it was never walked end-to-end as a real product
**Correct approach:** "Complete" at milestone level is earned only by a continuous real-user walk of the entire critical flow on the LIVE site, exercising EVERY interactive control.

---

### 2026-07-18 — Moved gallery save/share buttons without design approval
**Correct approach:** Describing a UX problem is not permission to redesign. Show a before/after, wait for explicit yes.
