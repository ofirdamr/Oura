/**
 * ResilientUploadManager — parallel upload queue with exponential-backoff retries.
 *
 * Runs up to `concurrency` uploads simultaneously (default 4).
 * Each file gets up to `maxRetries` attempts (default 3) with jittered
 * exponential backoff starting at `baseDelayMs` (default 1 000 ms).
 *
 * Usage:
 *   const mgr = new ResilientUploadManager({ uploadFn, onItemStateChange });
 *   mgr.enqueue(files);   // can be called multiple times before drain
 *   await mgr.drain();    // resolves when all items have settled (done | failed)
 */

export type UploadItemState = {
  id: string;
  file: File;
  status: "queued" | "uploading" | "done" | "failed";
  attempt: number;
  errorMessage?: string;
};

export type UploadFn = (
  file: File,
  signal: AbortSignal,
) => Promise<{ ok: boolean; errorMessage?: string }>;

export type ResilientUploadManagerOptions = {
  uploadFn: UploadFn;
  onItemStateChange: (item: UploadItemState) => void;
  concurrency?: number;
  maxRetries?: number;
  baseDelayMs?: number;
};

export class ResilientUploadManager {
  private queue: UploadItemState[] = [];
  private active = 0;
  private readonly concurrency: number;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly uploadFn: UploadFn;
  private readonly onItemStateChange: (item: UploadItemState) => void;
  private drainResolvers: Array<() => void> = [];

  constructor(opts: ResilientUploadManagerOptions) {
    this.uploadFn = opts.uploadFn;
    this.onItemStateChange = opts.onItemStateChange;
    this.concurrency = opts.concurrency ?? 4;
    this.maxRetries = opts.maxRetries ?? 3;
    this.baseDelayMs = opts.baseDelayMs ?? 1_000;
  }

  enqueue(files: File[]): void {
    for (const file of files) {
      const item: UploadItemState = {
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        status: "queued",
        attempt: 0,
      };
      this.queue.push(item);
      this.onItemStateChange({ ...item });
    }
    this.tick();
  }

  drain(): Promise<void> {
    if (this.isDone()) return Promise.resolve();
    return new Promise((resolve) => {
      this.drainResolvers.push(resolve);
    });
  }

  private isDone(): boolean {
    return this.queue.every((i) => i.status === "done" || i.status === "failed") && this.active === 0;
  }

  private tick(): void {
    while (this.active < this.concurrency) {
      const next = this.queue.find((i) => i.status === "queued");
      if (!next) break;
      next.status = "uploading";
      this.active++;
      this.onItemStateChange({ ...next });
      void this.process(next);
    }
  }

  private async process(item: UploadItemState): Promise<void> {
    const controller = new AbortController();

    while (item.attempt < this.maxRetries) {
      item.attempt++;
      try {
        const result = await this.uploadFn(item.file, controller.signal);
        if (result.ok) {
          item.status = "done";
          this.onItemStateChange({ ...item });
          this.active--;
          this.tick();
          this.checkDrain();
          return;
        }
        item.errorMessage = result.errorMessage ?? "ההעלאה נכשלה";
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          item.status = "failed";
          item.errorMessage = "בוטל";
          this.onItemStateChange({ ...item });
          this.active--;
          this.tick();
          this.checkDrain();
          return;
        }
        item.errorMessage = "שגיאת רשת";
      }

      if (item.attempt < this.maxRetries) {
        const delay = this.jitter(this.baseDelayMs * Math.pow(2, item.attempt - 1));
        await sleep(delay);
        // Re-signal uploading so the UI can show attempt count if desired
        this.onItemStateChange({ ...item });
      }
    }

    item.status = "failed";
    this.onItemStateChange({ ...item });
    this.active--;
    this.tick();
    this.checkDrain();
  }

  private checkDrain(): void {
    if (!this.isDone()) return;
    for (const resolve of this.drainResolvers) resolve();
    this.drainResolvers = [];
  }

  private jitter(ms: number): number {
    return ms * (0.75 + Math.random() * 0.5);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
