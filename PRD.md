# PRD — Oura

> **This is a design-to-code PRD.** The design is king; code is a 1:1 wiring of
> the design. The **design-spec flow is the single source of truth for both the
> UI and the implementation (build) order** — see
> `design/oura_design_specifications_final.md` §6 "Functional Prototypes &
> Flows" for the canonical flows, `design/oura_final_production_index_42_screens.md`
> for the full screen inventory, and **`docs/ARCHITECTURE.md` §6b** for the
> master Design-to-Code index (every `design/screens/*/screen.png` → its code
> file path and wiring status). When this document and the design disagree, the
> design wins for UI; when this document and the code disagree on what's built,
> the code wins and this doc is stale — fix the doc.

## 1. Problem / Vision
Event photographers do the work but stay invisible — guests rarely see the photographer's brand, and post-event photo delivery is slow and manual. Oura turns every event into a live, personal, branded experience for guests while requiring near-zero extra effort from the photographer, and gives the photographer a new lead-gen channel (every shared photo carries their brand) plus a new revenue line (print/canvas commission).

## 2. Personas
- **Guest** — attends one event, scans a QR, wants their own photos fast, shares/prints a few, then is gone. Zero tolerance for friction (no login, no app install).
- **Photographer / studio** — wants a differentiator to sell to clients, near-zero day-to-day operational burden, predictable low-cost SaaS bill, and a print-commission upside.
- **Platform owner (founder)** — wants durable recurring revenue with minimal support/ops burden; must scale to many concurrent events without the cost structure scaling linearly (media egress is the main risk).

## 3. Core Flows — the leading build order

The design spec's two flows are the **build order**: screens ship in flow
order, each one a faithful 1:1 wiring of its `design/screens/*/screen.png`. A
screen's design source and current wiring status are in `docs/ARCHITECTURE.md`
§6b; only a live production bug preempts this order.

**Photographer flow** (design spec §6.1): Dashboard → Create Event → Configure
Branding (logo, frame, color, watermark) → Generate QR → upload media
during/after event → AI pipeline auto-processes (dedup, quality cull, optimize,
face-embed) → monitor via Dashboard/Notifications.
*Wiring today: Dashboard, Create Event, Branding, QR, Event List, and
upload/detail are all Real; Notification Center and AI-Optimization panels are
Phase-2/static (§6b).*

**Guest flow** (design spec §6.2): Scan QR → Landing Page → **AI Recognition
Explanation → biometric consent gate → selfie** → Personal Gallery
(face-matched) or full event Gallery → browse/select → 3D Gift Box Reveal →
Photo Editor (adjust + auto-optimize + branded frame) → Share (branded export)
or Order Print/Canvas → Checkout → Order Confirmation.
*Wiring today: Gallery Entry, Consent, Selfie, Gift Reveal, and Gallery are
Real; Photo Editor is local-state-only; Premium Prints → Checkout → Order
Confirmation are Phase 2 (§6b).*

The biometric-consent gate is the one screen with no design-export source — it
was added for the MVP and designed fresh with founder sign-off (see §6b and
CLAUDE.md's "never freehand new visuals" rule).

Full architecture reference: `docs/ARCHITECTURE.md` — endpoints, schema, auth
model, deployment topology, and the §6b Design-to-Code index. Kept current as a
hard rule (see that file's "Keeping this current" section and `CLAUDE.md`'s
Docs list).

## 4. Feature List by Phase (each screen = a 1:1 wiring of its design)

Phase boundaries follow the design-flow order above. Each named screen maps to
a `design/screens/*` source and a code path in `docs/ARCHITECTURE.md` §6b; the
job of "building a screen" is wiring its `screen.png` to real data, not
re-inventing its UI.

**MVP (built / in progress):** Guest Landing, Gallery Entry, Festive/Minimal/Personal
Gallery, AI Recognition + biometric-consent gate (fresh, not in the original
design export) + Selfie, 3D Gift Box Reveal, Photo Editor (adjust +
auto-optimize + frame); Photographer Dashboard, Event List, Create New Event,
Branding Settings, Barcode/QR Management, AI Optimization (auto-only). *Guest
path and photographer CRUD are Real; Photo Editor persistence and the
AI-Optimization panel are still UI-only (§6b, ARCHITECTURE §8).*

**Phase 2:** Stripe Billing + Checkout, Premium Prints → Checkout → Order
Confirmation, print-on-demand integration + commission ledger, Statistics &
Analytics, Reports Management, Messaging/support ticket queue, Notification
Center incl. misidentification-report moderation queue, Studio Profile,
realtime gallery (Supabase Realtime replacing polling). *All of these have
design sources under `design/screens/*` already (§6b) — Phase 2 is wiring them,
not designing them.*

**Phase 3:** Full Platinum-tier manual AI Optimization panel, Digital Brochure
(Oura's own marketing site, design source `digital_brochure`), Event Book
Designer (design source `event_book_designer_desktop`), multi-language, local
print-lab option, native-app/WhatsApp-notification evaluation.

**Backlog ideas (not scheduled, logged for later):**
- Auto-clean photographer-uploaded logos in Branding Settings: when a photographer uploads their own studio logo, automatically detect and fix files that lack real alpha transparency (e.g. a checkerboard-pattern-as-background baked into the pixels instead of a true alpha channel — the exact issue hit with Oura's own logo assets this session) before storing/using it. Depends on Branding Settings' logo upload actually being wired to a backend first (currently a static UI dropzone only). Belongs in `packages/processing-pipeline` (Fly.io/Cloud Run compute pool) per the R2-only-media / heavy-compute-off-Worker architecture, not the Cloudflare Worker. Needs to robustly detect the "already has real transparency, leave it alone" case too, not just the checkerboard case.

## 5. Non-Functional Requirements
- Fast globally (guests may be domestic or destination-wedding international).
- Cheap to operate at scale — media egress is the dominant cost risk; R2's zero-egress model is the core mitigation.
- Low support burden — self-serve billing, tiered support, automation-first AI pipeline.
- Hebrew/RTL-first UI (`hebrew-rtl-best-practices` skill), luxury dark-mode visual identity per `design/oura_design_specifications_final.md` (the brand/type/color source of truth — every screen inherits its palette, typography, and component specs from there).
- Biometric data handled conservatively: self-hosted embeddings, explicit consent, short retention, documented deletion.

## 6. Tech Architecture Summary
See `CLAUDE.md` for the stack table and guardrails; full structural detail (endpoints, DB schema, auth model, deployment topology, repo layout, the Design-to-Code index, known gaps) lives in `docs/ARCHITECTURE.md`, kept current as a hard rule — see that file's own "Keeping this current" section. Do not let this drift into "the plan we meant to write down but never did" the way the original architecture doc did before `docs/ARCHITECTURE.md` existed.

## 7. Pricing (draft, pending founder numbers)
Hybrid model — pay-per-event entry tier (matches competitor LOCA's model) plus Starter/Pro/Platinum subscriptions. "Platinum" name and its manual AI-control feature set come directly from the Stitch design, not invented. Final ILS price points, storage caps, and retention window still need founder input (see Open Questions).

## 8. Open Questions Log
1. Biometric consent/retention policy. **Status: resolved.** The founder confirmed the formal signed legal opinion has been received (previously an informal draft only, from a lawyer-friend), recommending a 30-day retention window, an active opt-in consent gesture, and guardian/age confirmation before camera access — all now implemented (migration 0003, `/consent` gate). See `docs/ARCHITECTURE.md` §4a/§8.
2. Final ILS pricing + retention window per tier. **Status: open.**
3. Print fulfillment: global POD (Gelato/Prodigi) vs local Israeli lab, and who owns shipping/returns. **Status: open.**
4. Is print commission revenue-share near-term (decides if Stripe Connect is needed in Phase 2)? **Status: open.**
5. Reconcile the two color palettes seen across design screens into one canonical system, keyed off `design/oura_design_specifications_final.md` §2 as the base. **Status: open, needed before Phase 1 visual polish pass.**

## 9. Success Criteria per Stage
- **MVP done:** one real pilot event run end-to-end (QR → live upload → face-find → branded share) with a real photographer and real guests, consent gate verified working.
- **Phase 2 done:** a photographer can self-serve sign up, pay, run an event, and a guest can complete a print order, with zero founder manual intervention.
</content>
</invoke>
