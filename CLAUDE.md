# CLAUDE.md — Oura

Event-photography SaaS. Guests scan a QR at an event → live, face-matched, branded gallery on their phone. See `PRD.md` for full product detail, `SUMMARY.md` for current state.

## Stack
- Frontend: Next.js (App Router), PWA, RTL/Hebrew-first (`hebrew-rtl-best-practices` skill applies to all UI work). Three.js + GSAP for the gift-box reveal. Self-hosted Rubik/Hanken Grotesk fonts.
- Backend/API: Cloudflare Workers + Hono.
- DB: Postgres via Supabase (Auth + Realtime + `pgvector`).
- Media: Cloudflare R2 (zero egress) + Cloudflare CDN. Video via Cloudflare Stream.
- Background processing: Cloudflare Queues (light) + Fly.io/Cloud Run compute pool (face-embed, transcode, culling — heavy CPU).
- Face recognition: self-hosted InsightFace/ArcFace → `pgvector`, never a per-call managed API.
- Payments: Stripe Billing (subscriptions) + Stripe Checkout (pay-per-event); Stripe Connect only once print commissions are live.

## Guardrails (do not violate)
- Media binaries never touch Supabase storage — R2 only.
- Guests never require login/signup — signed opaque event-scoped token only.
- No CDN `<script>` tags in production builds (Tailwind/fonts/Three.js/GSAP must be bundled npm deps) — the Stitch export used CDN tags, that was fine for a mockup only.
- Face-matching may not run before the guest accepts the biometric-consent gate. No exceptions, no "just for the pilot."
- Per-screen implementation must match `design/*/screen.png`, not the folder name — a naming/content mismatch was already found once in the export.
- `--font-display` (Hanken Grotesk) has no Hebrew glyphs — never apply it to elements that render Hebrew text (already caused one fallback-font bug). Use it only for pure-Latin branding bits (e.g. "OURA", "PLATINUM" badges). Rubik (`--font-sans`) is the default for everything else.
- Use CSS logical properties (`ms-*`/`me-*`/`ps-*`/`pe-*`/`text-start`/`text-end`), never physical `ml-*`/`mr-*`/`text-left`/`text-right`, per `hebrew-rtl-best-practices`.
- Every task starts with a visible Token Economist consult (leanest path / model / scope guard / orchestration mode) — see `MISTAKES.md` for why this is non-negotiable here.

## Repo layout
```
/apps/web                      Next.js app (guest gallery + photographer dashboard)
/apps/api                      Cloudflare Worker (Hono), wrangler.toml
/packages/processing-pipeline  face-embed, culling, transcode, overlay compositing workers
/packages/shared               shared TS types/schemas
/design                        Stitch export, 42 reference screens + brand spec (source of truth for UI)
```

## Docs
- `PRD.md` — product spec, personas, feature phases, pricing, open questions (living doc).
- `SUMMARY.md` — current build state snapshot, read first each session.
- `PROGRESS.md` — append-only session log.
- `MISTAKES.md` — append-only lessons log.
