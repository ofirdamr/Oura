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

**R2 Storage Tier Map**

| Tier | Key suffix | Spec | When written |
|---|---|---|---|
| Tier 1 | `original` | Full-res JPEG/RAW as-shot | Stage 2 studio sync |
| Tier 2 | `social_feed` | 1080px long-edge, 85% quality | Processing pipeline |
| Tier 3 | `web_optimized` | 1200px long-edge, 75% quality | Stage 1 (venue) |
| Tier 4 | `social_story` | 9:16 ambient canvas (see §10.3) | On-demand export |
| Tier 5 | `thumbnail` | 400px square, 70% quality | Stage 1 (venue) |

### 10.2 Photographer UX & Client-Side Extraction Engine

The photographer's only action: drag-and-drop loose JPEGs or a single Lightroom `.zip` into the dashboard — exactly like Dropbox. All complexity is hidden.

**ZIP Extraction (browser-side, never uploaded raw)**

```typescript
import JSZip from 'jszip';

async function extractZipLocally(file: File): Promise<File[]> {
  const zip = await JSZip.loadAsync(file);
  const imageFiles: File[] = [];

  for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    const ext = relativePath.split('.').pop()?.toLowerCase();
    if (!ext || !['jpg', 'jpeg', 'png', 'webp'].includes(ext)) continue;

    const blob = await zipEntry.async('blob');
    const imageFile = new File([blob], relativePath.split('/').pop()!, {
      type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      lastModified: zipEntry.date?.getTime() ?? Date.now(),
    });
    imageFiles.push(imageFile);
  }

  return imageFiles;
}
```

**Core `ResilientUploadManager` — concurrent queue with exponential backoff**

```typescript
import imageCompression from 'browser-image-compression';

interface UploadTask {
  id: string;
  file: File;
  eventId: string;
  tier: 'stage1' | 'stage2';
  retries: number;
  status: 'pending' | 'compressing' | 'uploading' | 'done' | 'failed';
}

class ResilientUploadManager {
  private queue: UploadTask[] = [];
  private active = 0;
  private readonly MAX_CONCURRENT = 4; // 3–5 parallel connections
  private readonly MAX_RETRIES = 5;

  enqueue(files: File[], eventId: string, tier: UploadTask['tier']) {
    for (const file of files) {
      this.queue.push({
        id: crypto.randomUUID(),
        file,
        eventId,
        tier,
        retries: 0,
        status: 'pending',
      });
    }
    this.drain();
  }

  private async drain() {
    while (this.active < this.MAX_CONCURRENT && this.queue.length > 0) {
      const task = this.queue.shift()!;
      this.active++;
      this.processTask(task).finally(() => {
        this.active--;
        this.drain();
      });
    }
  }

  private async processTask(task: UploadTask) {
    try {
      // Silent client-side compression for Stage 1 (web-optimized tier only)
      let uploadFile = task.file;
      if (task.tier === 'stage1') {
        task.status = 'compressing';
        uploadFile = await imageCompression(task.file, {
          maxSizeMB: 1.5,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
          fileType: 'image/jpeg',
        });
      }

      task.status = 'uploading';
      await this.uploadWithBackoff(uploadFile, task);
      task.status = 'done';
    } catch {
      task.status = 'failed';
    }
  }

  private async uploadWithBackoff(file: File, task: UploadTask) {
    const baseDelay = 1000; // ms

    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('event_id', task.eventId);
        formData.append('tier', task.tier);
        formData.append('original_name', task.file.name);

        const res = await fetch('/api/photos/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return; // success

      } catch (err) {
        if (attempt === this.MAX_RETRIES) throw err;
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt)));
      }
    }
  }

  get progress(): { total: number; done: number; failed: number } {
    // Caller-visible progress for the unified UI indicator
    const all = [...this.queue]; // snapshot — active tasks removed from queue
    return {
      total: all.length + this.active,
      done: all.filter(t => t.status === 'done').length,
      failed: all.filter(t => t.status === 'failed').length,
    };
  }
}

export const uploadManager = new ResilientUploadManager();
```

**UI contract:** all background work (ZIP extraction, compression, upload, retry) is masked behind one progress indicator: `"מייעל ומעלה נכסים בצורה בטוחה... (N/M)"`. No confirmation dialogs, no per-file status rows — just the unified bar plus a subtle pause/resume toggle.

### 10.3 Aspect Ratio, Smart Cropping & Social Framing Engine

Photographers shoot landscape (3:2 / 16:9); guests live on vertical mobile screens. This engine closes that gap automatically without any photographer action.

**A. Smart Focal-Point Cropping (Feed Presets — 1:1 and 4:5)**

The pipeline never center-crops blindly. On ingest, a smartcrop.js pass runs on the Fly.io/Cloud Run compute pool:

```typescript
import smartcrop from 'smartcrop';

async function computeFocalPoint(
  imageBuffer: Buffer,
  targetW: number,
  targetH: number,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const result = await smartcrop.crop(imageBuffer, {
    width: targetW,
    height: targetH,
  });
  return result.topCrop; // { x, y, width, height } anchored around faces/subjects
}
```

The `focal_point_x` and `focal_point_y` percentages are stored in the DB (see §10.5). On export, the crop box is positioned using these coordinates rather than the center of the frame, so heads are never sliced.

**B. Dynamic 9:16 "Magnet-Style" Canvas Wrapper (Story / Reels)**

Precise pipeline — runs on Cloud Run, outputs Tier 4 (`social_story`):

1. **Canvas setup:** create a 1080×1920 px canvas (or 2160×3840 for @2x retina export).
2. **Ambient backdrop layer:**
   - Duplicate the source landscape photo.
   - Scale it to cover the full canvas height (`object-fit: cover` equivalent — width may overflow, cropped from center).
   - Apply a Gaussian blur of **30–50 px radius** (exact value tuned per event — 40 px is the default).
   - Reduce exposure by **25–30%**: multiply each RGB channel by `0.70–0.75` (or apply `brightness(0.72)` via Canvas 2D API / Sharp `.modulate({ brightness: 0.72 })`).
3. **Sharp foreground layer:**
   - Overlay the original unmodified landscape photo, centered vertically on the canvas.
   - Scale to fit within the canvas width at 100% (`width: 1080px`); the top and bottom margins remain vacant.
   - The photo is **never cropped, never stretched** — native composition preserved.
4. **Branding margin layer (vacant top + bottom zones):**
   - Top margin: photographer's studio logo at 40% opacity, centered, max-height ~10% of canvas.
   - Bottom margin: event name text + date in Rubik, white at 70% opacity, centered. Optionally a secondary tagline in smaller type.
   - Both elements rendered into the ambient backdrop area only — zero overlap with the photo rectangle.
5. **Export:** JPEG quality 88%, written to R2 under `storage_keys.social_story`.

```typescript
import sharp from 'sharp';

async function buildStoryCanvas(
  sourceBuffer: Buffer,
  sourceMeta: { width: number; height: number },
  branding: { logoBuffer: Buffer | null; studioName: string; eventName: string },
): Promise<Buffer> {
  const CANVAS_W = 1080;
  const CANVAS_H = 1920;
  const BLUR_RADIUS = 40;
  const EXPOSURE_FACTOR = 0.72; // 28% darkening

  // Backdrop: scale to cover canvas height, blur + darken
  const backdropScale = CANVAS_H / sourceMeta.height;
  const backdropW = Math.ceil(sourceMeta.width * backdropScale);
  const backdrop = await sharp(sourceBuffer)
    .resize(backdropW, CANVAS_H, { fit: 'cover' })
    .blur(BLUR_RADIUS)
    .modulate({ brightness: EXPOSURE_FACTOR })
    .toBuffer();

  // Foreground: fit within canvas width, preserve aspect ratio
  const fgScale = CANVAS_W / sourceMeta.width;
  const fgH = Math.round(sourceMeta.height * fgScale);
  const fgTop = Math.round((CANVAS_H - fgH) / 2);
  const foreground = await sharp(sourceBuffer)
    .resize(CANVAS_W, fgH, { fit: 'fill' })
    .toBuffer();

  // Composite: backdrop + foreground (branding overlay added separately via Canvas API)
  return sharp({
    create: { width: CANVAS_W, height: CANVAS_H, channels: 3, background: '#000' },
  })
    .composite([
      { input: backdrop, left: Math.round((backdropW - CANVAS_W) / -2), top: 0 },
      { input: foreground, left: 0, top: fgTop },
    ])
    .jpeg({ quality: 88 })
    .toBuffer();
}
```

**C. Social Export UI Options & Bandwidth Guardrails**
- "הורדה לסטורי/ריל" — fetches `storage_keys.social_story` (9:16 ambient canvas, pre-branded).
- "הורדה לפיד" — fetches `storage_keys.social_feed` (1:1 or 4:5 smart-crop).
- "מקור / הורדה ישירה" — fetches `storage_keys.web_optimized` (Tier 3, original crop, ~1200px).
- All non-commercial guest saves default to Tier 3 — egress cost protection while maintaining crisp mobile clarity. Tier 1 originals are only downloadable by the photographer after Stage 2 sync.

*Note: the share button bottom sheet (מקורי / פיד 4:5 / סטורי 9:16) was implemented in PR #85 as the frontend trigger for this engine. The backend `/photos/:id/social-export` endpoint handles format generation and returns the correct R2 signed URL per format.*

### 10.4 E-Commerce & Print Shop Ingestion with Hybrid Fulfillment Routing

Print purchases must never be blocked by a pending Stage 2 sync — guests at the venue buy on impulse.

**A. Order Ingestion Logic (No Guest Restrictions)**
- Guests purchase prints (magnets, blocks, photo books) seamlessly during Stage 1. No warnings, no holding badges.
- On order placement: payment collected instantly (Stripe), order row written with `order_status = 'Awaiting_High_Res_Asset'`.
- Photographer dashboard surfaces a high-priority alert banner listing pending print orders that are waiting for Stage 2 sync.
- Order remains in `Awaiting_High_Res_Asset` until the DB trigger fires on `is_original_uploaded = true` (see §10.5).

**B. Split Fulfillment Execution Routing**

Controlled by `fulfillment_type` set at photographer account level (configurable in Studio Profile settings):

| Route | Enum value | Automatic trigger on sync complete |
|---|---|---|
| Cloud Fulfillment | `AUTOMATED_WHOLESALE` | System fires a signed webhook to the print house API (Gelato / Prodigi / local lab) with the Tier-1 R2 signed URL, order dimensions, and delivery address. Status advances to `Dispatched_To_Wholesaler`. |
| Self-Fulfillment | `SELF_FULFILLMENT` | Status advances to `Ready_For_Photographer_Print`. Print Queue workspace activates for the photographer. |

**C. Print Queue Dashboard Workspace (Self-Fulfillment)**

This is a **dedicated dashboard view** (`/admin/print-queue`), not a summary table. It gives the photographer a production worklist:

- **Dimension-grouped task list:** orders are grouped and sortable by physical print format — Magnet (9×6 cm), 10×15 cm, 15×20 cm, Block (20×20 cm), etc. Each group shows the count of pending units and estimated production time.
- **Per-order row:** thumbnail preview, guest first name (anonymized), format, quantity, delivery address, time since order placed.
- **Batch Tier-1 download:** a "הורד קבצים להדפסה" button per dimension group downloads all pending Tier-1 originals for that format as a `.zip`, correctly named `ORDER_ID_FORMAT.jpg` for lab software import.
- **Manual status toggle:** each row has a "סומן כהודפס ונמסר" (Mark as Printed & Delivered) button. On click:
  1. `order_status` advances to `Completed`.
  2. Guest receives an automated success notification (push / WhatsApp, per notification settings).
  3. Row moves to the "הושלם" (Completed) archive tab.
- **Filter bar:** filter by format, by date range, by "pending sync" (orders still in `Awaiting_High_Res_Asset`) vs "ready to print" vs "completed".
- **Alert badge:** sidebar nav item "תור הדפסה" shows a red badge count of orders in `Ready_For_Photographer_Print` state.

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

*These schema changes are Phase 2 — apply via a numbered Supabase migration when Phase 2 implementation begins.*

### 10.6 Agile Development Milestones

**Milestone 1 — Resilient Client-Side Upload Engine (Sprint 1–2)**

Goal: photographer can drop a `.zip` or loose JPEGs into the dashboard and the system silently handles everything.

Deliverables:
- `ResilientUploadManager` class wired into the upload dropzone component (`apps/web/components/admin/UploadDropzone.tsx`).
- `extractZipLocally` using JSZip — raw ZIP never hits the network.
- `browser-image-compression` worker loop generating the Tier 3 Web-Optimized payload client-side before upload.
- Concurrent queue: max 4 parallel HTTP connections, `MAX_RETRIES = 5`, exponential backoff (1s → 2s → 4s → 8s → 16s).
- Pause/resume toggle in the upload UI — queue drains or halts on demand.
- Stage 1 API: `POST /photos/upload` accepts `tier: 'stage1'` flag, writes metadata row with `is_original_uploaded = false`, stores Tier 3 + Tier 5 to R2.
- Unified progress indicator: `"מייעל ומעלה נכסים בצורה בטוחה... (N/M)"` — no per-file rows.

**Milestone 2 — Automated Framing & Cropping Pipeline (Sprint 3)**

Goal: every uploaded photo automatically gets all export tiers generated without photographer action.

Deliverables:
- smartcrop.js integration in the Fly.io/Cloud Run processing worker — runs after ingest, writes `focal_point_x` / `focal_point_y` to DB.
- 9:16 story canvas builder (`buildStoryCanvas`) deployed to Cloud Run, consuming smartcrop coordinates and branding config, writing Tier 4 to R2 under `storage_keys.social_story`.
- 4:5 and 1:1 smart-crop variants (Tier 2 `social_feed`) generated using stored focal point — no center-crop fallback.
- Blurred ambient backdrop spec: 40 px Gaussian blur, 28% exposure reduction (`brightness: 0.72`), landscape photo centered in frame with branded margins.
- Export UI in guest gallery: "סטורי 9:16 / פיד 4:5 / מקור" buttons (PR #85 frontend) wired to the `/photos/:id/social-export?format=story|feed|original` endpoint that returns signed R2 URLs per tier.

**Milestone 3 — Order Management & Fulfillment Ingestion (Sprint 4)**

Goal: a guest can buy a print at the venue and the photographer (or print house) fulfills it once the high-res original syncs.

Deliverables:
- Migration applying §10.5 schema: `is_original_uploaded`, `focal_point_x/y`, `storage_keys`, `fulfillment_route_type` enum, `platform_order_status` enum, `fulfillment_type` + `order_status` columns on `orders`, all indexes, and the `release_held_orders_on_sync` trigger.
- `POST /orders` endpoint: accepts payment confirmation from Stripe webhook, writes order row with `Awaiting_High_Res_Asset`.
- DB trigger verified: `UPDATE media_assets SET is_original_uploaded = true` fires `release_held_orders_on_sync` correctly advancing order status.
- `AUTOMATED_WHOLESALE` path: webhook to print house API fires on trigger, order advances to `Dispatched_To_Wholesaler`.
- `SELF_FULFILLMENT` path: `/admin/print-queue` dashboard workspace (§10.4C) — dimension-grouped task list, batch Tier-1 `.zip` download per format, "סומן כהודפס ונמסר" manual toggle advancing to `Completed` and firing guest success notification.
- Photographer dashboard alert banner: count of orders in `Awaiting_High_Res_Asset` with a deep-link to the Stage 2 sync trigger.
- "Stage 2 Sync" button in dashboard: scans local files against pending DB records by filename/SHA, uploads Tier-1 originals via `ResilientUploadManager` in `tier: 'stage2'` mode.
</content>
</invoke>
