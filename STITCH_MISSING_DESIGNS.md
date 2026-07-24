# Stitch — Missing (freehanded) screens & how to design them

**Why this doc exists:** the mission referenced `STITCH_PROMPTS_MISSING_DESIGNS.md`
and a "Design Audit — Freehanded pages found" section in `SUMMARY.md`. Neither
existed anywhere in git history or on any branch. This file reconstructs that
audit from first principles (app routes ✗ `design/screens/` source) so the work
is continuable.

## How Stitch is reached in this environment (IMPORTANT)

The Stitch MCP is **NOT** wired into the session tool registry (no
`mcp__stitch__*` tools). `claude mcp add stitch …` only takes effect in an
interactive local session; this remote/web session cannot hot-load it.

**But Stitch is reachable directly** — it is a stateless HTTP MCP server. Call it
with curl (works through the agent proxy):

```bash
curl -sS --max-time 180 -X POST "https://stitch.googleapis.com/mcp" \
  -H "X-Goog-Api-Key: <STITCH_API_KEY>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{
       "name":"generate_screen_from_text",
       "arguments":{"projectId":"14054752854771709694","deviceType":"MOBILE","prompt":"…"}}}'
```

The API key was supplied by the founder in-chat. **It should be moved into an
env secret** (`STITCH_API_KEY`) rather than pasted again — flag this to the founder.

> **Canonical baseline = `final_production`.** Every folder in `design/screens/`
> is `oura_final_production_*`; that is the approved design set. New screens must
> match that visual language (they do automatically — same project theme below).

### Stitch project (work INSIDE this one — never create a new one)
- **Title:** `Oura Photo Santos Project`
- **projectId:** `14054752854771709694`
- **Theme (already on-brand):** DARK, custom color `#ff8a75` (coral), Manrope
  headline, Inter body, ROUND_EIGHT. Matches the live app, so generated screens
  inherit the right look automatically.

### Useful Stitch tools (via `tools/call`)
- `generate_screen_from_text` — args: `projectId`, `prompt` (required),
  `deviceType` (MOBILE), optional `designSystem`. Returns
  `outputComponents[0].design.screens[0].screenshot.downloadUrl` (a PNG) and a
  `sessionId`.
- `list_screens` — args: `projectId`. Get the generated screen's id.
- `get_screen` — args: `name` = `projects/{project}/screens/{screenId}`.
  **This is how you fetch the generated HTML/code to wire 1:1.**
- `edit_screens`, `generate_variants` — iterate on a screen.

## The 10 missing screens (app route → status)

All 23 `design/screens/` stems map cleanly to existing routes. These routes have
**no design source** = the freehanded set to run through Stitch:

| # | Route | Notes |
|---|-------|-------|
| 1 | `/login` | ✅ **Stitch design generated 2026-07-24** (`qa/screenshots/login-stitch-design.png`). Confirmed freehand (page comment: "built fresh — no Stitch round-trip"). **Awaiting founder OK, then wire 1:1.** |
| 2 | `/signup` | photographer registration |
| 3 | `/forgot-password` | password reset request |
| 4 | `/reset-password` | password reset (gated behind Supabase PASSWORD_RECOVERY — do not touch auth logic) |
| 5 | `/consent` | guest biometric consent gate (privacy-critical copy) |
| 6 | `/selfie` | guest selfie capture |
| 7 | `/join` | guest entry |
| 8 | `/admin/events/[event_id]` | single-event detail/management |
| 9 | `/admin/print-queue` | photographer print fulfilment queue |
| 10 | `/` | root — likely a redirect, confirm before designing |

## Per-screen workflow (founder's instruction)
1. Read the current freehanded page to capture its real fields/copy/behavior.
2. `generate_screen_from_text` inside project `14054752854771709694`, MOBILE,
   with an RTL-Hebrew prompt describing that exact content + the dark/coral look.
3. Download the screenshot PNG → `qa/screenshots/<route>-stitch-design.png`,
   commit it, and **show the founder** before wiring.
4. On approval: `get_screen` to pull the HTML, then wire the React page 1:1
   (RTL logical props, Rubik for Hebrew, `--font-display` Latin-only) and
   **delete the freehanded version's bespoke styling**.
5. Verify live (`scripts/qa-shot.mjs` mobile + desktop) before "done".

## /login — generated artifact references
- screenshot PNG committed: `qa/screenshots/login-stitch-design.png`
- Stitch sessionId: `17955963185783730238`
- screenshot file resource: `projects/14054752854771709694/files/57040c1f9ddc42a7b2bf3baeeaa5b50c`
- prompt used: `scratchpad/login_prompt.txt` (see git-ignored scratchpad; also in PROGRESS)
