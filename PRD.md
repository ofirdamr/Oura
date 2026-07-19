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

---

## 10. System Extensions (Phase 2+ Specs)

### 10.1 Two-Stage Hybrid Upload Pipeline (Low-Bandwidth Venue Architecture)

Decouples asset publishing from high-resolution archival to guarantee 100% uptime inside concrete halls, basements, or areas with unstable cellular.

**Stage 1 — Real-Time Event Publish (Venue Mode)**
- Client intercepts files and uploads only the locally generated Web-Optimized tier (Tier 3) and Thumbnail tier (Tier 5) directly to R2 — ~90% smaller payload.
- Backend commits metadata rows immediately. `storage_keys.original = null`, `is_original_uploaded = false`. Gallery goes live instantly for guests.

**Stage 2 — Asynchronous Original Sync (Studio Upload)**
- Platform tracks all photos where `is_original_uploaded = false`.
- Back at studio/home on broadband, photographer triggers "Sync High-Res Originals" from the dashboard.
- Client scan-matches local high-res source files (by filename, timestamp, or SHA hash) against pending DB records, uploads Tier 1 binaries in a background thread, toggles `is_original_uploaded = true`.

### 10.2 Photographer UX & Client-Side Extraction Engine

The photographer's only action: drag-and-drop loose JPEGs or a single Lightroom `.zip` into the dashboard — exactly like Dropbox.

- **Local ZIP decompression:** `.zip` files are extracted in the browser (e.g. JSZip / Web Streams). Raw ZIP files are never uploaded to the backend.
- **Silent client-side batch compression:** a background worker loop immediately downscales dropped/extracted images to Web-Optimized spec using a client-side library (e.g. browser-image-compression) — no user confirmation needed.
- **Resilient upload queue:** 3–5 parallel HTTP connections max. On dropped connections: exponential backoff retries, seamless resume without state loss.
- **Simplified UI:** all background processing is masked behind one unified progress indicator ("מייעל ומעלה נכסים בצורה בטוחה...").

### 10.3 Aspect Ratio, Smart Cropping & Social Framing Engine

Photographers shoot landscape (3:2 / 16:9); guests live on vertical mobile screens. This engine closes that gap automatically.

**A. Smart Focal-Point Cropping (Feed Presets)**
- For 1:1 square and 4:5 vertical templates, the pipeline never center-crops blindly.
- An edge microservice or client canvas analyzer (e.g. smartcrop.js) locates faces / primary subjects and anchors the crop box dynamically around those coordinates.

**B. Dynamic 9:16 "Magnet-Style" Canvas Wrapper (Story/Reels)**
1. Create a 9:16 canvas (1080×1920 or 2160×3840).
2. Duplicate the landscape photo, scale to cover canvas height, apply heavy Gaussian blur (30–50 px) and darken by 25–30% to form the ambient backdrop.
3. Overlay the sharp, original landscape photo centered vertically across the canvas.
4. Use the vacant top/bottom margin to stamp the photographer's translucent studio branding watermark + event text — keeping the photo itself completely unblemished.

**C. Social Export UI Options & Bandwidth Guardrails**
- "הורדה לסטורי/ריל" — fetches the 9:16 ambient canvas version with clean branding.
- "הורדה לפיד" — delivers the 1:1 or 4:5 smart-crop version.
- "מקור / הורדה ישירה" — delivers the un-cropped original format.
- All non-commercial guest saves default to Tier 3 (Web-Optimized) — egress cost protection while maintaining crisp mobile clarity.

*Note: the share button bottom sheet (מקורי / פיד 4:5 / סטורי 9:16) was implemented in PR #85 as the frontend trigger for this engine. The backend `/photos/:id/social-export` endpoint handles format generation.*

### 10.4 E-Commerce & Print Shop Ingestion with Hybrid Fulfillment Routing

Print purchases must never be blocked by a pending Stage 2 sync — guests at the venue buy on impulse.

**A. Order Ingestion Logic (No Guest Restrictions)**
- Guests purchase prints (magnets, blocks, photo books) seamlessly during Stage 1. No warnings, no holding badges.
- On order placement: payment collected instantly, order written to DB with status `Awaiting_High_Res_Asset`.
- Photographer dashboard surfaces a high-priority alert for pending print orders needing Stage 2 sync.
- Order remains locked until `is_original_uploaded = true` triggers an automatic state change.

**B. Split Fulfillment Execution Routing**

Controlled by a `fulfillment_type` parameter set at the gallery or photographer configuration level:

| Route | Type | Trigger |
|---|---|---|
| Cloud Fulfillment | `AUTOMATED_WHOLESALE` | On `is_original_uploaded → true`, system fires a webhook to the remote print house API for automated production and mailing. |
| Self-Fulfillment | `SELF_FULFILLMENT` | On sync complete, order shifts to `Ready_For_Photographer_Print`. Photographer's Print Queue dashboard shows tasks by dimension (Magnet / 10×15 / Block), allows batch Tier-1 download, and has a manual "Mark as Printed & Delivered" trigger. |

### 10.5 Database Schema Extensions

```sql
-- Media assets: deferred upload tracking + smart crop focal data + multi-tier storage keys
ALTER TABLE public.media_assets ADD COLUMN is_original_uploaded BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE public.media_assets ADD COLUMN focal_point_x INT DEFAULT 50;
ALTER TABLE public.media_assets ADD COLUMN focal_point_y INT DEFAULT 50;
ALTER TABLE public.media_assets ADD COLUMN storage_keys JSONB DEFAULT '{
  "thumbnail": null,
  "web_optimized": null,
  "social_story": null,
  "social_feed": null,
  "original": null
}'::jsonb NOT NULL;

-- Order management: hybrid fulfillment routing
CREATE TYPE fulfillment_route_type AS ENUM ('AUTOMATED_WHOLESALE', 'SELF_FULFILLMENT');
CREATE TYPE platform_order_status AS ENUM (
  'Awaiting_High_Res_Asset',
  'Ready_For_Photographer_Print',
  'Dispatched_To_Wholesaler',
  'Completed'
);
ALTER TABLE public.orders ADD COLUMN fulfillment_type fulfillment_route_type DEFAULT 'AUTOMATED_WHOLESALE' NOT NULL;
ALTER TABLE public.orders ADD COLUMN order_status platform_order_status DEFAULT 'Awaiting_High_Res_Asset' NOT NULL;

-- Performance indexes
CREATE INDEX idx_media_pending_sync ON public.media_assets (is_original_uploaded) WHERE is_original_uploaded = FALSE;
CREATE INDEX idx_orders_awaiting_assets ON public.orders (order_status) WHERE order_status = 'Awaiting_High_Res_Asset';
CREATE INDEX idx_media_gallery_lookup ON public.media_assets (gallery_id);

-- Auto-release trigger: flips order status when original sync completes
CREATE OR REPLACE FUNCTION release_held_orders_on_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_original_uploaded = TRUE THEN
    UPDATE public.orders
      SET order_status = 'Ready_For_Photographer_Print'
      WHERE photo_id = NEW.id AND fulfillment_type = 'SELF_FULFILLMENT' AND order_status = 'Awaiting_High_Res_Asset';

    UPDATE public.orders
      SET order_status = 'Dispatched_To_Wholesaler'
      WHERE photo_id = NEW.id AND fulfillment_type = 'AUTOMATED_WHOLESALE' AND order_status = 'Awaiting_High_Res_Asset';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_release_orders
  AFTER UPDATE OF is_original_uploaded ON public.media_assets
  FOR EACH ROW EXECUTE FUNCTION release_held_orders_on_sync();
```

*These schema changes are Phase 2 — they are specified here for planning purposes. Apply via a numbered Supabase migration when Phase 2 implementation begins.*
</content>
</invoke>
