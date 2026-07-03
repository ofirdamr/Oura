# SUMMARY — Oura

**Stage:** Planning complete and approved. Foundation/MD-files just created. No app code yet.

**Last decisions:**
- Stack: Next.js PWA + Cloudflare Workers/R2/Queues + Supabase (Auth/Realtime/pgvector) + self-hosted InsightFace face-rec.
- Pricing: hybrid pay-per-event + Starter/Pro/Platinum subscriptions; "Platinum" tier name/features taken from the Stitch design itself.
- Design source of truth: `/design` (42 Stitch screens + brand spec). Folder names are not fully trustworthy — verify against `screen.png` per screen.

**Next steps:**
1. Scaffold `/apps/web` (Next.js, Tailwind theme from brand spec, RTL layout, self-hosted fonts).
2. Port first MVP screen(s) from `/design` into real components.
3. Stand up Supabase project + R2 bucket (needs founder-provided credentials/account).

**Blocking questions (see `PRD.md` §8):** biometric consent/retention policy, final ILS pricing, print fulfillment partner choice.
