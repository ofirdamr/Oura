# PRD — Oura

## 1. Problem / Vision
Event photographers do the work but stay invisible — guests rarely see the photographer's brand, and post-event photo delivery is slow and manual. Oura turns every event into a live, personal, branded experience for guests while requiring near-zero extra effort from the photographer, and gives the photographer a new lead-gen channel (every shared photo carries their brand) plus a new revenue line (print/canvas commission).

## 2. Personas
- **Guest** — attends one event, scans a QR, wants their own photos fast, shares/prints a few, then is gone. Zero tolerance for friction (no login, no app install).
- **Photographer / studio** — wants a differentiator to sell to clients, near-zero day-to-day operational burden, predictable low-cost SaaS bill, and a print-commission upside.
- **Platform owner (founder)** — wants durable recurring revenue with minimal support/ops burden; must scale to many concurrent events without the cost structure scaling linearly (media egress is the main risk).

## 3. Core Flows
**Photographer flow:** Sign up → Create Event → Configure Branding (logo, frame, color, watermark) → Generate QR → Upload media during/after event → AI pipeline auto-processes (dedup, quality cull, optimize, face-embed) → monitor via Dashboard/Notifications.

**Guest flow:** Scan QR → Landing Page → (biometric consent gate) → Personal Gallery (face-matched) or full event Gallery → browse/select → Photo Editor (adjust + auto-optimize + branded frame) → Share (branded export) or Order Print/Canvas → Checkout → Order Confirmation.

Full architecture reference: `docs/ARCHITECTURE.md` — endpoints, schema, auth model, deployment topology. Kept current as a hard rule (see that file's own "Keeping this current" section and `CLAUDE.md`'s Docs list); if it and the code ever disagree, the code is right and the doc is stale, fix the doc.

## 4. Feature List by Phase

**MVP:** Guest Landing, Gallery Entry, Festive/Minimal/Personal Gallery, Photo Editor (adjust + auto-optimize + frame), 3D Gift Box Reveal, biometric-consent gate (new, not in original design export); Photographer Dashboard, Event List, Create New Event, Branding Settings, Barcode/QR Management, AI Optimization (auto-only).

**Phase 2:** Stripe Billing + Checkout, Premium Prints → Checkout → Order Confirmation, print-on-demand integration + commission ledger, Statistics & Analytics, Reports Management, Messaging/support ticket queue, Notification Center incl. misidentification-report moderation queue, Studio Profile, realtime gallery (Supabase Realtime replacing polling).

**Phase 3:** Full Platinum-tier manual AI Optimization panel, Digital Brochure (Oura's own marketing site), multi-language, local print-lab option, native-app/WhatsApp-notification evaluation.

**Backlog ideas (not scheduled, logged for later):**
- Auto-clean photographer-uploaded logos in Branding Settings: when a photographer uploads their own studio logo, automatically detect and fix files that lack real alpha transparency (e.g. a checkerboard-pattern-as-background baked into the pixels instead of a true alpha channel — the exact issue hit with Oura's own logo assets this session) before storing/using it. Depends on Branding Settings' logo upload actually being wired to a backend first (currently a static UI dropzone only). Belongs in `packages/processing-pipeline` (Fly.io/Cloud Run compute pool) per the R2-only-media / heavy-compute-off-Worker architecture, not the Cloudflare Worker. Needs to robustly detect the "already has real transparency, leave it alone" case too, not just the checkerboard case.

## 5. Non-Functional Requirements
- Fast globally (guests may be domestic or destination-wedding international).
- Cheap to operate at scale — media egress is the dominant cost risk; R2's zero-egress model is the core mitigation.
- Low support burden — self-serve billing, tiered support, automation-first AI pipeline.
- Hebrew/RTL-first UI (`hebrew-rtl-best-practices` skill), luxury dark-mode visual identity per `design/oura_design_specifications_final.md`.
- Biometric data handled conservatively: self-hosted embeddings, explicit consent, short retention, documented deletion.

## 6. Tech Architecture Summary
See `CLAUDE.md` for the stack table and guardrails; full structural detail (endpoints, DB schema, auth model, deployment topology, repo layout, known gaps) lives in `docs/ARCHITECTURE.md`, kept current as a hard rule — see that file's own "Keeping this current" section. Do not let this drift into "the plan we meant to write down but never did" the way the original architecture doc did before `docs/ARCHITECTURE.md` existed.

## 7. Pricing (draft, pending founder numbers)
Hybrid model — pay-per-event entry tier (matches competitor LOCA's model) plus Starter/Pro/Platinum subscriptions. "Platinum" name and its manual AI-control feature set come directly from the Stitch design, not invented. Final ILS price points, storage caps, and retention window still need founder input (see Open Questions).

## 8. Open Questions Log
1. Biometric consent/retention policy — needs legal review before any pilot with real guests (minors routinely present at weddings). **Status: in progress, risk accepted.** The founder received an informal draft legal opinion (from a lawyer-friend, formal signed version still to follow) recommending a 30-day retention window, an active opt-in consent gesture, and guardian/age confirmation before camera access, and explicitly decided to proceed building Stage 2 on that basis ahead of the formal signature. Not fully resolved — see `docs/ARCHITECTURE.md` §8.
2. Final ILS pricing + retention window per tier. **Status: open.**
3. Print fulfillment: global POD (Gelato/Prodigi) vs local Israeli lab, and who owns shipping/returns. **Status: open.**
4. Is print commission revenue-share near-term (decides if Stripe Connect is needed in Phase 2)? **Status: open.**
5. Reconcile the two color palettes seen across design screens into one canonical system. **Status: open, needed before Phase 1 visual polish pass.**

## 9. Success Criteria per Stage
- **MVP done:** one real pilot event run end-to-end (QR → live upload → face-find → branded share) with a real photographer and real guests, consent gate verified working.
- **Phase 2 done:** a photographer can self-serve sign up, pay, run an event, and a guest can complete a print order, with zero founder manual intervention.
