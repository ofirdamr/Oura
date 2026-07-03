# SUMMARY — Oura

**Stage:** Foundation built and verified. `/apps/web` (Next.js PWA) scaffolded with RTL/Hebrew layout, brand theme tokens (from `design/oura_design_specifications_final.md`), self-hosted Rubik/Hanken Grotesk fonts. Build passes, dev server verified visually (dark theme, RTL, Hebrew copy render correctly). Pushed to `main`. No product screens implemented yet beyond a placeholder home page.

**Last decisions:**
- Stack: Next.js PWA + Cloudflare Workers/R2/Queues + Supabase (Auth/Realtime/pgvector) + self-hosted InsightFace face-rec.
- Pricing: hybrid pay-per-event + Starter/Pro/Platinum subscriptions; "Platinum" tier name/features taken from the Stitch design itself.
- Design source of truth: `/design/screens` (63 screen-variant folders covering all 42 concepts + brand spec). Folder names are not fully trustworthy — verify against `screen.png` per screen.

**Next steps:**
1. Port first MVP screen(s) from `/design/screens` into real Next.js components (start with Guest Landing → Gallery Entry, or Photographer Create-Event, to unblock an end-to-end demo path).
2. Reconcile the two color palettes seen across design screens into one canonical theme (open question, see `PRD.md` §8.5).
3. Stand up Supabase project + R2 bucket (needs founder-provided credentials/account — not yet available in this environment).

**Blocking questions (see `PRD.md` §8):** biometric consent/retention policy, final ILS pricing, print fulfillment partner choice.
