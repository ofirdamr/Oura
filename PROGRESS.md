# Progress Log

### 2026-07-03
- Gathered requirements (founder brain-dump), competitor brochure (LOCA) + live pricing page, and full Stitch design export (42/42 screens confirmed present across 5 zips).
- Read brand spec + 6 representative screens to ground architecture decisions in real design (gift-box = real Three.js/GSAP scene, Platinum tier already named in design, personal gallery tags photos by event moment, notification center includes a misidentification-report moderation queue).
- Found and flagged a design-export naming mismatch (a "checkout" folder contained Notification Center markup) — `screen.png` is the source of truth per screen going forward.
- Wrote and got approval on the architecture/roadmap/PRD plan.
- Created MD operating files: `CLAUDE.md`, `PRD.md`, `SUMMARY.md`, `PROGRESS.md`, `MISTAKES.md` (incl. owed entry for skipping the Token Economist gate twice during planning).
- Copied full Stitch export into `design/screens` (63 folders, all 42 concepts covered, code.html + screen.png each).
- Scaffolded `/apps/web` (Next.js App Router, Tailwind v4, TypeScript). RTL (`dir="rtl" lang="he"`) root layout, self-hosted Rubik/Hanken Grotesk via `next/font`, brand color tokens from the design spec. Build + dev server verified with a Playwright screenshot (dark theme, RTL, Hebrew copy all correct). Committed and pushed to `main`.
