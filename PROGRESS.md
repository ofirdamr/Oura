# Progress Log

### 2026-07-03
- Gathered requirements (founder brain-dump), competitor brochure (LOCA) + live pricing page, and full Stitch design export (42/42 screens confirmed present across 5 zips).
- Read brand spec + 6 representative screens to ground architecture decisions in real design (gift-box = real Three.js/GSAP scene, Platinum tier already named in design, personal gallery tags photos by event moment, notification center includes a misidentification-report moderation queue).
- Found and flagged a design-export naming mismatch (a "checkout" folder contained Notification Center markup) — `screen.png` is the source of truth per screen going forward.
- Wrote and got approval on the architecture/roadmap/PRD plan.
- Created MD operating files: `CLAUDE.md`, `PRD.md`, `SUMMARY.md`, `PROGRESS.md`, `MISTAKES.md` (incl. owed entry for skipping the Token Economist gate twice during planning).
- Copied full Stitch export into `design/screens` (63 folders, all 42 concepts covered, code.html + screen.png each).
- Scaffolded `/apps/web` (Next.js App Router, Tailwind v4, TypeScript). RTL (`dir="rtl" lang="he"`) root layout, self-hosted Rubik/Hanken Grotesk via `next/font`, brand color tokens from the design spec. Build + dev server verified with a Playwright screenshot (dark theme, RTL, Hebrew copy all correct). Committed and pushed to `main`.
- Added the `universal-framework` skill (pulled from `ofirdamr/claude-skills-`) to `.claude/skills/`, alongside the existing `hebrew-rtl-best-practices` skill. This was referenced in `MISTAKES.md` but had never actually been committed to the repo.
- Ported Gallery Entry screen (`/gallery-entry`) from Stitch design. Found `gallery_entry_desktop/screen.png` is mislabeled (actually a Branding Settings screen) — ignored, ported `gallery_entry_mobile` only. Includes the "how it works" face-match explainer modal from the source design (informational only, no consent capture). Verified with Playwright screenshots (base + modal state) against `screen.png`, `tsc --noEmit` clean. Committed and pushed to `main`.
- Ported Personal Gallery screen (`/gallery`) from `personal_gallery_mobile`, using placeholder photo tiles with match-percentage badges (no real event media yet). Added shared `.glass-panel`/`.no-scrollbar` utilities to `globals.css`. Hit and fixed a bidi space-collapse bug around an inline-styled number in Hebrew copy (`unicode-bidi: isolate`). Verified with Playwright screenshots (base + filter-chip interaction) against `screen.png`, `tsc --noEmit` clean, no console errors. Committed and pushed to `main`.
