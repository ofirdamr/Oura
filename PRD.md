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

- **Local ZIP decompression:** `.zip` files are extracted in the browser using JSZip / Web Streams. Raw ZIP files are never uploaded to the backend.
- **Silent client-side batch compression:** a background worker loop immediately downscales dropped/extracted images to Web-Optimized spec using browser-image-compression — no user confirmation needed.
- **Resilient upload queue:** 3–5 parallel HTTP connections max. On dropped connections: exponential backoff retries, seamless resume without state loss.
- **Simplified UI:** all background processing is masked behind one unified progress indicator ("מייעל ומעלה נכסים בצורה בטוחה...").

#### `extractZipLocally` — Client-Side ZIP Extraction (JSZip)

Runs entirely in the browser; no ZIP bytes ever reach the backend.

```typescript
// packages/shared/src/upload/extractZipLocally.ts
import JSZip from 'jszip';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'tiff', 'tif', 'heic']);

export async function extractZipLocally(
  file: File,
  onProgress?: (extracted: number, total: number) => void
): Promise<File[]> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const imageEntries = Object.entries(zip.files).filter(([name, entry]) => {
    if (entry.dir) return false;
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    return IMAGE_EXTENSIONS.has(ext);
  });

  const total = imageEntries.length;
  const extractedFiles: File[] = [];

  for (let i = 0; i < imageEntries.length; i++) {
    const [path, entry] = imageEntries[i];
    const blob = await entry.async('blob');
    const filename = path.split('/').pop() ?? path;
    const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpeg';
    const mimeType = ext === 'png' ? 'image/png'
      : ext === 'webp' ? 'image/webp'
      : 'image/jpeg';

    extractedFiles.push(new File([blob], filename, { type: mimeType }));
    onProgress?.(i + 1, total);
  }

  return extractedFiles;
}
```

#### `ResilientUploadManager` — Parallel Queue with Exponential Backoff

Manages all upload concurrency, retries, and progress events. Instantiated once per upload session in the photographer dashboard.

```typescript
// packages/shared/src/upload/ResilientUploadManager.ts

export type UploadTaskStatus = 'queued' | 'uploading' | 'done' | 'failed';

export interface UploadTask {
  id: string;
  file: File;
  galleryId: string;
  retries: number;
  status: UploadTaskStatus;
  percentComplete: number;
}

export interface UploadManagerOptions {
  /** Maximum simultaneous in-flight uploads. Default: 4 */
  maxConcurrent?: number;
  /** Maximum retry attempts per file before marking failed. Default: 5 */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (doubles each retry). Default: 500 */
  baseBackoffMs?: number;
  /** Upload endpoint path. Default: '/api/upload' */
  uploadEndpoint?: string;
  onProgress?: (taskId: string, percent: number) => void;
  onComplete?: (taskId: string, assetId: string) => void;
  onError?: (taskId: string, error: Error, finalFailure: boolean) => void;
  onQueueDrained?: () => void;
}

export class ResilientUploadManager {
  private readonly tasks = new Map<string, UploadTask>();
  private readonly queue: string[] = []; // ordered list of task IDs awaiting processing
  private active = 0;

  private readonly maxConcurrent: number;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly uploadEndpoint: string;
  private readonly onProgress?: UploadManagerOptions['onProgress'];
  private readonly onComplete?: UploadManagerOptions['onComplete'];
  private readonly onError?: UploadManagerOptions['onError'];
  private readonly onQueueDrained?: UploadManagerOptions['onQueueDrained'];

  constructor(options: UploadManagerOptions = {}) {
    this.maxConcurrent  = options.maxConcurrent  ?? 4;
    this.maxRetries     = options.maxRetries     ?? 5;
    this.baseBackoffMs  = options.baseBackoffMs  ?? 500;
    this.uploadEndpoint = options.uploadEndpoint ?? '/api/upload';
    this.onProgress     = options.onProgress;
    this.onComplete     = options.onComplete;
    this.onError        = options.onError;
    this.onQueueDrained = options.onQueueDrained;
  }

  /** Add a file to the upload queue. Returns a stable task ID for progress tracking. */
  enqueue(file: File, galleryId: string): string {
    const id = crypto.randomUUID();
    const task: UploadTask = { id, file, galleryId, retries: 0, status: 'queued', percentComplete: 0 };
    this.tasks.set(id, task);
    this.queue.push(id);
    this.drain();
    return id;
  }

  /** Enqueue multiple files atomically. */
  enqueueAll(files: File[], galleryId: string): string[] {
    return files.map(f => this.enqueue(f, galleryId));
  }

  /** Snapshot of aggregate queue statistics for UI binding. */
  get stats() {
    const all = [...this.tasks.values()];
    return {
      queued:    all.filter(t => t.status === 'queued').length,
      uploading: all.filter(t => t.status === 'uploading').length,
      done:      all.filter(t => t.status === 'done').length,
      failed:    all.filter(t => t.status === 'failed').length,
      total:     all.length,
      overallPercent: all.length === 0 ? 0 : Math.round(
        all.reduce((sum, t) => sum + (t.status === 'done' ? 100 : t.percentComplete), 0) / all.length
      ),
    };
  }

  getTask(id: string): UploadTask | undefined {
    return this.tasks.get(id);
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private drain(): void {
    while (this.active < this.maxConcurrent && this.queue.length > 0) {
      const id = this.queue.shift();
      if (!id) break;
      const task = this.tasks.get(id);
      if (!task || task.status !== 'queued') continue;

      task.status = 'uploading';
      this.active++;

      this.runTask(task).finally(() => {
        this.active--;
        if (this.queue.length === 0 && this.active === 0) {
          this.onQueueDrained?.();
        }
        this.drain();
      });
    }
  }

  private async runTask(task: UploadTask): Promise<void> {
    try {
      const assetId = await this.uploadWithXHR(task);
      task.status = 'done';
      task.percentComplete = 100;
      this.onComplete?.(task.id, assetId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      if (task.retries < this.maxRetries) {
        task.retries++;
        task.status = 'queued';
        task.percentComplete = 0;
        this.onError?.(task.id, error, false);

        // Exponential backoff: 500ms, 1s, 2s, 4s, 8s
        const delay = this.baseBackoffMs * Math.pow(2, task.retries - 1);
        await sleep(delay);

        this.queue.unshift(task.id); // re-insert at front for priority retry
      } else {
        task.status = 'failed';
        this.onError?.(task.id, error, true);
      }
    }
  }

  private uploadWithXHR(task: UploadTask): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', task.file);
      formData.append('galleryId', task.galleryId);

      xhr.open('POST', this.uploadEndpoint);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          task.percentComplete = percent;
          this.onProgress?.(task.id, percent);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const body = JSON.parse(xhr.responseText) as { assetId: string };
            resolve(body.assetId);
          } catch {
            reject(new Error('Malformed JSON response from upload endpoint'));
          }
        } else {
          reject(new Error(`Upload failed — HTTP ${xhr.status}: ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error',  () => reject(new Error('Network error during upload')));
      xhr.addEventListener('abort',  () => reject(new Error('Upload was aborted')));
      xhr.addEventListener('timeout',() => reject(new Error('Upload timed out')));

      xhr.timeout = 120_000; // 2-minute per-file hard timeout
      xhr.send(formData);
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### 10.3 Aspect Ratio, Smart Cropping & Social Framing Engine

Photographers shoot landscape (3:2 / 16:9); guests live on vertical mobile screens. This engine closes that gap automatically.

**A. Smart Focal-Point Cropping (Feed Presets)**
- For 1:1 square and 4:5 vertical templates, the pipeline never center-crops blindly.
- An edge microservice or client canvas analyzer (e.g. smartcrop.js) locates faces / primary subjects and anchors the crop box dynamically around those coordinates.
- Focal-point coordinates (`focal_point_x`, `focal_point_y`) are persisted to `media_assets` at ingest time (see §10.5 schema) and reused for all subsequent crop variants — the subject-detection compute runs once, not on every download.

**B. Dynamic 9:16 "Magnet-Style" Canvas Wrapper (Story/Reels)**
1. Create a 9:16 canvas (1080×1920 or 2160×3840).
2. Duplicate the landscape photo, scale to cover canvas height, apply heavy Gaussian blur (30–50 px) and darken by 25–30% to form the ambient backdrop.
3. Overlay the sharp, original landscape photo centered vertically across the canvas.
4. Use the vacant top/bottom margin to stamp the photographer's translucent studio branding watermark + event text — keeping the photo itself completely unblemished.

`buildStoryCanvas` — Sharp pipeline (runs in `packages/processing-pipeline` on Fly.io / Cloud Run):

```typescript
// packages/processing-pipeline/src/transforms/buildStoryCanvas.ts
import sharp, { OverlayOptions } from 'sharp';

export interface StoryCanvasOptions {
  /** Canvas dimensions. Defaults to 1080×1920 (standard Reels/Story). */
  canvasWidth?:   number;
  canvasHeight?:  number;
  /** Gaussian blur radius for ambient backdrop. Default: 40. */
  blurSigma?:     number;
  /** Fractional brightness reduction for backdrop (0–1). Default: 0.28 (28% darker). */
  darkenAmount?:  number;
  /** Pre-loaded PNG buffer of the studio logo/watermark (RGBA). Optional. */
  watermarkBuffer?: Buffer;
  /** Event name or tagline rendered below the watermark in the bottom margin. Optional. */
  eventText?:     string;
  /** JPEG output quality (0–100). Default: 92. */
  outputQuality?: number;
}

/**
 * Produces a 9:16 ambient-canvas export from a landscape source image.
 * The source photo is never modified — it is composited centered and sharp
 * over a blurred/darkened copy of itself that fills the full canvas.
 */
export async function buildStoryCanvas(
  sourceBuffer: Buffer,
  options: StoryCanvasOptions = {}
): Promise<Buffer> {
  const {
    canvasWidth   = 1080,
    canvasHeight  = 1920,
    blurSigma     = 40,
    darkenAmount  = 0.28,
    watermarkBuffer,
    outputQuality = 92,
  } = options;

  // ── Step 1: Blurred, darkened ambient backdrop ──────────────────────────
  const backdrop = await sharp(sourceBuffer)
    .resize(canvasWidth, canvasHeight, { fit: 'cover', position: 'centre' })
    .blur(blurSigma)
    .modulate({ brightness: 1 - darkenAmount })
    .toBuffer();

  // ── Step 2: Scale the original photo to fill canvas width, preserve AR ──
  const { width: srcW = 3, height: srcH = 2 } = await sharp(sourceBuffer).metadata();
  const sourceAspect  = srcW / srcH;
  const overlayWidth  = canvasWidth;
  const overlayHeight = Math.round(overlayWidth / sourceAspect);
  const overlayTop    = Math.round((canvasHeight - overlayHeight) / 2); // vertically centred

  const overlayPhoto = await sharp(sourceBuffer)
    .resize(overlayWidth, overlayHeight, { fit: 'fill' })
    .toBuffer();

  const composites: OverlayOptions[] = [
    { input: overlayPhoto, top: overlayTop, left: 0 },
  ];

  // ── Step 3: Optional translucent watermark in the bottom margin ─────────
  if (watermarkBuffer) {
    const wmTargetWidth = Math.round(canvasWidth * 0.42); // 42% canvas width

    // Resize watermark and apply 70% opacity via alpha channel modulation
    const watermark = await sharp(watermarkBuffer)
      .resize(wmTargetWidth, undefined, { fit: 'inside' })
      .ensureAlpha()
      .modulate({ alpha: 0.70 })
      .toBuffer();

    const { width: wmW = wmTargetWidth, height: wmH = 60 } =
      await sharp(watermark).metadata();

    // Centre the watermark in the available bottom margin
    const bottomMarginTop  = overlayTop + overlayHeight;
    const bottomMarginSize = canvasHeight - bottomMarginTop;
    const wmTop  = bottomMarginTop + Math.round((bottomMarginSize - wmH) / 2);
    const wmLeft = Math.round((canvasWidth - wmW) / 2);

    composites.push({ input: watermark, top: wmTop, left: wmLeft });
  }

  // ── Step 4: Composite and encode ────────────────────────────────────────
  return sharp(backdrop)
    .composite(composites)
    .jpeg({ quality: outputQuality, mozjpeg: true })
    .toBuffer();
}
```

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

**C. Print Queue Dashboard Workspace (Self-Fulfillment Route)**

The Print Queue is a dedicated workspace surface within the photographer dashboard — not a modal, not a sidebar panel. It is only visible to photographers whose `fulfillment_type = 'SELF_FULFILLMENT'`. It has three structural zones:

---

**Zone 1 — Header Bar & Live Status Strip**

```
[ Print Queue — Smart Gallery "Vered & Omer" ]          [ Sync High-Res (3 pending) 🔴 ]

 Awaiting Asset  ●3    Ready to Print  ●12    Printed  ●27    Dispatched  ●8
```

- The event name and a primary CTA ("Sync High-Res") are always pinned at the top.
- The status strip shows a live count of orders in each state — updates in real time via Supabase Realtime channel on the `orders` table (filtered to this gallery ID).
- The red badge on "Sync High-Res" pulses while any `Awaiting_High_Res_Asset` orders exist. Once all originals are synced it turns grey and disappears.

---

**Zone 2 — Filter Bar**

```
[ All Formats ▾ ]  [ All Statuses ▾ ]  [ Newest first ▾ ]  [ 🔍 Search by guest name ]
```

- **Format filter** (multi-select chips): `מגנט`, `10×15`, `15×20`, `20×30`, `קנבס`, `ספר אירוע` — maps directly to `product_sku` values in the `orders` table.
- **Status filter** (radio): All / Ready to Print / Printed / Dispatched.
- **Sort**: Newest first / Oldest first / By format (groups all magnets together, then 10×15, etc.).
- **Search**: client-side fuzzy filter on `guest_name` — no server round-trip for this since the full ready-list is already fetched on workspace mount.

---

**Zone 3 — Dimension-Grouped Task Lists**

Orders in `Ready_For_Photographer_Print` are automatically grouped by print dimension. Each group is a collapsible section:

```
▼ מגנט  (7 orders)                              [ הורדת כל המגנטים — Tier 1 ZIP ↓ ]
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │  📷  IMG_4821.jpg   |  ליאת כהן        |  ×2 magnets  |  [ הורד ] [ סומן ✓ ] │
  │  📷  IMG_4903.jpg   |  נועה לוי        |  ×1 magnet   |  [ הורד ] [ סומן ✓ ] │
  │  ...                                                                         │
  └──────────────────────────────────────────────────────────────────────────────┘

▼ 10×15  (5 orders)                             [ הורדת כל ה-10×15 — Tier 1 ZIP ↓ ]
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │  📷  IMG_5102.jpg   |  תמר אברהם       |  ×1 print    |  [ הורד ] [ סומן ✓ ] │
  │  ...                                                                         │
  └──────────────────────────────────────────────────────────────────────────────┘

▼ קנבס / בלוק  (2 orders)                       [ הורדת כל הקנבסים — Tier 1 ZIP ↓ ]
  ...
```

Per-row controls:
- **[ הורד ]** — downloads the single Tier-1 original for this order directly from R2 (signed URL, short-lived).
- **[ סומן ✓ ]** — marks the order `Printed`. On click: optimistic UI flip, `PATCH /api/orders/:id { order_status: 'Completed' }` fires in the background. If the API call fails, the row snaps back and shows an inline error chip.

Per-group batch controls:
- **"הורדת כל [dimension] — Tier 1 ZIP ↓"** — triggers a signed batch-download URL that streams all originals for that dimension as a ZIP archive. The archive is assembled on-demand in the Cloudflare Worker using R2's `createMultipartUpload` + streaming zip (no intermediate large object stored). The photographer's browser begins downloading immediately — no polling, no "your file is ready" email.

Marking a whole group done:
- Long-pressing (mobile) or right-clicking (desktop) a group header reveals "סמן את כולם כמודפסים" — bulk-status-updates all rows in the group to `Completed` in a single `PATCH /api/orders/bulk { ids: [...], order_status: 'Completed' }` call.

---

**Zone 4 — Notification System**

Three notification layers run in parallel for the Self-Fulfillment route:

| Trigger | Notification channel | Message |
|---|---|---|
| New order placed (Stage 1) | In-app toast + dashboard badge | "הזמנת [format] חדשה — ממתינה לסנכרון" |
| `is_original_uploaded` flips true | Supabase Realtime push → dashboard updates silently; if print orders now unlocked, additional toast fires | "סנכרון הושלם — [N] הזמנות מוכנות להדפסה" |
| Order in `Awaiting_High_Res_Asset` > 48 hrs | Scheduled background job (Cloudflare Queue cron) sends email + dashboard banner | "הזמנה ממתינה לסנכרון יותר מ-48 שעות" |
| Bulk "Mark all printed" action | Confirmation snackbar | "סומנו [N] הזמנות כמודפסות" |

All in-app toasts use the Radix UI `Toast` primitive (already in the design system) with RTL direction and the existing dark-luxury token palette. No new UI components needed for the notification layer.

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

### 10.6 Agile Development Milestones

Three sprints deliver the full §10 feature set. Each sprint has a hard Definition of Done — no sprint closes without every line item checked. Sprint order is fixed; a later sprint may not begin until the prior one's DoD is satisfied.

---

#### Sprint 1 — Client-Side Upload Engine (Weeks 1–2)

**Goal:** A photographer can drag a folder of JPEGs or a Lightroom ZIP into the dashboard and have all files upload reliably without any manual steps, even on a bad venue connection.

**Deliverables:**

- `extractZipLocally` (§10.2) shipped and unit-tested with a real 500-image ZIP. Test asserts: correct file count, correct MIME types, no ZIP bytes sent to backend.
- `ResilientUploadManager` (§10.2) shipped. Integration test covers: concurrent uploads up to `maxConcurrent`, retry on HTTP 5xx (mocked), exponential backoff timing (mocked clock), `onQueueDrained` fires exactly once after last upload, `stats` object reflects accurate counts at every transition.
- Dashboard upload dropzone wired to `ResilientUploadManager`. Accepts both loose files and `.zip`. Shows the "מייעל ומעלה נכסים בצורה בטוחה..." unified progress bar (single percentage, no per-file list).
- Two-Stage upload flag: `is_original_uploaded = false` written at Stage 1 row creation. DB migration applied (§10.5 `is_original_uploaded` column only — other columns deferred to Sprint 3).
- "Sync High-Res Originals" button appears in dashboard for galleries with pending originals. Triggers Stage 2 scan-and-upload flow.

**Definition of Done:**
- E2E Playwright test: drop a 50-image ZIP → all 50 appear in the gallery → `is_original_uploaded = false` for all → trigger Stage 2 → all flip to `true`.
- Simulated 60%-packet-loss run: all files eventually upload with no user intervention (retries absorb the loss).
- No ZIP bytes appear in backend request logs (verified via Cloudflare Worker log tail).

---

#### Sprint 2 — Social Framing Engine (Weeks 3–4)

**Goal:** Every photo in the gallery can be exported as a properly framed Story/Reel or feed crop, with studio branding, without the photographer doing anything manually.

**Deliverables:**

- `buildStoryCanvas` (§10.3B) shipped in `packages/processing-pipeline`. Unit-tested with a 3:2 landscape input; assert output dimensions are exactly 1080×1920 (or configured values), backdrop is blurred (pixel-sample check), overlay photo is centred (position assert), watermark is composited in bottom margin.
- Focal-point detection integrated at ingest: `smartcrop.js` (or equivalent) runs on Web-Optimized tier and writes `focal_point_x` / `focal_point_y` to `media_assets`. DB migration applied (§10.5 `focal_point_x`, `focal_point_y`, `storage_keys` columns).
- Backend endpoint `POST /photos/:id/social-export?format=story|feed|original` — returns a signed R2 URL for the requested tier. Story and feed variants are generated lazily on first request and cached in R2 under `storage_keys.social_story` / `storage_keys.social_feed`. Second request returns the cached URL immediately.
- Guest share bottom sheet (PR #85 frontend) wired to the real endpoint. Three buttons produce real downloads, not placeholder alerts.
- Bandwidth guardrail: guest-initiated Story/Feed downloads serve Tier 3 (web-optimized) by default; Tier 1 original only served when `format=original` AND the requesting token has `allow_original_download: true` scope.

**Definition of Done:**
- Visual QA: Playwright screenshot of a 3:2 source photo exported as 9:16 Story. Human review: photo is sharp, centred, backdrop is visibly blurred and darkened, watermark is in the bottom margin and not overlapping the photo.
- Performance: `buildStoryCanvas` completes in < 800 ms on a 24 MP JPEG on the Fly.io worker tier (measured via `console.time`).
- Cache hit test: second `/social-export?format=story` request for the same photo returns HTTP 200 with a pre-signed R2 URL in < 50 ms (no Sharp pipeline re-run).

---

#### Sprint 3 — Print Queue & Fulfillment Routing (Weeks 5–6)

**Goal:** A photographer running self-fulfillment can see every pending print order grouped by size, batch-download the originals, and mark orders done — all from a single dashboard workspace. Cloud-fulfillment orders route automatically to the wholesale API on sync.

**Deliverables:**

- `fulfillment_type` and `order_status` columns shipped (§10.5 full schema — ENUMs, indexes, trigger).
- Print Queue workspace (§10.4C) fully implemented:
  - Header bar with live Supabase Realtime status counts.
  - Filter bar: format multi-select, status radio, sort, guest-name search.
  - Dimension-grouped task list with per-row download + "Mark Printed" controls.
  - Per-group batch ZIP download endpoint (`GET /api/orders/batch-download?galleryId=&sku=`). Streams a ZIP of signed R2 URLs assembled in the Worker — no large intermediate object. Tested with 30 originals in a single batch.
  - Bulk "Mark all printed" for a dimension group (`PATCH /api/orders/bulk`).
- Notification system (§10.4C Zone 4): all four triggers implemented and manually verified (new order toast, sync-complete toast, 48-hr overdue email via Cloudflare Queue cron, bulk-mark snackbar).
- Automated wholesale route: on `trigger_release_orders` firing for `AUTOMATED_WHOLESALE` orders, a Cloudflare Queue message is enqueued; a Worker consumer calls the print-house webhook with the Tier-1 R2 URL and the order metadata. Webhook call is idempotent (order ID used as idempotency key).

**Definition of Done:**
- E2E test (Self-Fulfillment path): place 3 orders across 2 dimensions → Stage 1 → Print Queue shows "Awaiting Asset" → trigger Stage 2 → orders move to "Ready to Print" → batch-download ZIP for one dimension → verify ZIP contains correct files → mark all as printed → orders show "Completed" in DB.
- E2E test (Cloud Fulfillment path): place 1 order → Stage 2 → verify Queue consumer fires webhook → verify `order_status = 'Dispatched_To_Wholesaler'` in DB within 5 s.
- Notification test: advance the DB clock 49 hours (test helper) → verify the Cloudflare Queue cron job enqueues the overdue-alert message → verify the email send is called (mocked SendGrid/Resend).
- RTL visual QA: Playwright screenshot of the Print Queue workspace in Hebrew. Human review: all text is RTL, group headers are right-aligned, action buttons on the inline-start side, no LTR layout leaks.
</content>
</invoke>
