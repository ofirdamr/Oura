# Admin event photo-management screen — Stitch design

- **Route wired 1:1 next session:** `/admin/events/[event_id]`
  (`apps/web/app/admin/events/[event_id]/page.tsx`)
- **Stitch project:** Oura Photo Santos Project — `14054752854771709694`
- **Generated screen id:** `64470c652eb048cda9b89a5eefecda86`
- **sessionId:** `8224595468760875064`
- **Screenshot for founder review:** `qa/screenshots/admin-event-photo-management-stitch-design.png`
- **Prompt:** `design/stitch-prompts/admin-event-photo-management.txt`

## To wire (next session, after founder OK)
1. `get_screen` name=`projects/14054752854771709694/screens/64470c652eb048cda9b89a5eefecda86`
   via the curl workflow in `STITCH_MISSING_DESIGNS.md` (STITCH_API_KEY is in env).
2. Wire the React page 1:1 — RTL logical props, Rubik for Hebrew, `--font-display` Latin-only.
3. **Key change vs current freehand code:** replace the Stage-2 "סנכרון תמונות ברזולוציה גבוהה"
   per-photo one-at-a-time rows (no thumbnails) with the BULK/ZIP drop zone + thumbnail strip
   + "N מתוך M סונכרנו" counter shown in the design. This is the fix PR #142 asked for.
4. Ignore Stitch mockup artifacts: the stray "obile" watermark text and the English
   Settings/Clients/Uploads/Gallery bottom tab bar are not part of the real app.
5. Live QA mobile + desktop via `scripts/qa-shot.mjs` before "done".

## Still open (2026-07-24, from founder review)
- **Mobile design: done** — `qa/screenshots/admin-event-photo-management-stitch-design.png`.
- **Desktop: NOT done.** A `deviceType:DESKTOP` generate call returned a phone-width
  frame for this screen (Stitch didn't produce a true wide desktop layout), so it was
  discarded. Desktop needs a dedicated pass (wider multi-column grid, 5–6 thumbs/row).
- **Modals:** category-picker (`שיוך קטגוריה לתמונה`) is designed inside the mobile
  frame. The photo delete-confirmation is still a native `window.confirm` — design a
  styled confirm dialog for both mobile + desktop when doing the desktop pass.

## NEXT SESSION — generate the refreshed design (prompts are READY, not yet run)
Both prompt files already encode ALL founder requirements below + the new
category-picker large-preview. The generate step has NOT run yet (context ran out).
Run it first thing:
```
NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scratchpad/stitch-gen.mjs \
  design/stitch-prompts/admin-event-photo-management.txt MOBILE \
  qa/screenshots/admin-event-photo-management-stitch-design.png
NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scratchpad/stitch-gen.mjs \
  design/stitch-prompts/admin-event-photo-management-desktop.txt DESKTOP \
  qa/screenshots/admin-event-photo-management-stitch-design-desktop.png
```
- `scratchpad/stitch-gen.mjs` is git-ignored — recreate it from the curl workflow in
  `STITCH_MISSING_DESIGNS.md` (on branch `claude/stitch-mcp-integration-tj1vdc`) if missing.
  It POSTs `generate_screen_from_text` to `https://stitch.googleapis.com/mcp` with
  `X-Goog-Api-Key: $STITCH_API_KEY`, projectId `14054752854771709694`, and writes the PNG.
- Commit both PNGs to `qa/screenshots/`, update this meta with the NEW screen ids/sessionIds,
  then show the founder BOTH mockups. Wire 1:1 only after his OK.
- If DESKTOP again returns a phone-width frame, note it and iterate the desktop prompt
  (it already stresses "1440px wide, landscape, two-column, 6 thumbs/row, not a phone").

## Founder Q&A resolved this session (2026-07-24)
- English bottom menu + the redrawn "מיתוג ולוגו" button in the mockup = Stitch auto-added
  artifacts, dropped when wiring the real page. (Already noted in "Ignore Stitch artifacts".)
- Category editing: every photo has ONE category pill on its thumbnail; tap it → picker with
  7 chips + "הסרת קטגוריה" → full add/change/remove. Founder approved adding a LARGE preview
  of the selected photo at the top of the category picker — now in both prompts.

## Founder requirements added 2026-07-24 (must be in the next design pass)
1. **Stage 2 needs BOTH modes, not just bulk:**
   - (a) "grab all originals at once" — the studio case (bulk/ZIP). Already designed.
   - (b) **selective upload of just the 2–3 photos that already have print
     reservations (orders), usable LIVE while the event is still happening**, so
     those prints can be fulfilled fast. Design needs a way to see/filter which
     photos have pending print orders and sync originals for only those.
2. **Videos, not only images.** The upload drop zones currently say "JPEG, PNG".
   The product must accept **video** too (per stack: video via Cloudflare Stream,
   R2 only for storage — never Supabase). Update the Stage-1 and Stage-2 drop-zone
   copy + accepted-types to include video, and the design should reflect it.
