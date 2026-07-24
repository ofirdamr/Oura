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
