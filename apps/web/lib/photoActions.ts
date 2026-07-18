// Guest-facing save/share for branded photos, written for how people actually
// use a phone at a wedding — not for how a desktop browser downloads a file.
//
// Key UX decisions (learned the hard way from founder feedback):
//  • "Save" must land in the phone's Photos/gallery, not a Files folder nobody
//    opens. On iOS the only route to the camera roll is the share sheet's
//    "Save Image", so on any device that can share files we open the sheet with
//    the image(s) and NO text — the prominent action becomes "Save N Images".
//    Desktop (no file-share) falls back to a real download.
//  • "Share" opens the sheet with the image(s) + a short friendly caption and
//    NEVER a raw URL — a bare https://… address in a WhatsApp message reads as
//    broken/unpolished. A shareable *link* (for the whole gallery) relies on
//    Open Graph tags so it renders as a card, handled separately.

export type ShareItem = { blob: Blob; filename: string };

function canShareFiles(files: File[]): boolean {
  const nav = navigator as Navigator & { canShare?: (d?: ShareData) => boolean };
  return typeof nav.share === "function" && typeof nav.canShare === "function" && nav.canShare({ files });
}

function toFiles(items: ShareItem[]): File[] {
  return items.map((it) => new File([it.blob], it.filename, { type: it.blob.type || "image/jpeg" }));
}

function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// On mobile without Web Share v2: open the image in a new tab so the user
// can long-press → "Save to Photos" / "Save to Gallery" — the universal
// mobile browser gesture for saving to the camera roll.
// On desktop: trigger an anchor download (the correct desktop behavior).
function anchorDownload(items: ShareItem[]) {
  if (isMobile() && items.length === 1) {
    const url = URL.createObjectURL(items[0].blob);
    window.open(url, "_blank");
    // Keep alive long enough for the user to save the image.
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return;
  }
  for (const it of items) {
    const url = URL.createObjectURL(it.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = it.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
}

export type ActionResult = "shared" | "downloaded" | "cancelled" | "failed";

// Save to the device's photo library where possible (share sheet → Save Image),
// otherwise download the file.
export async function savePhotos(items: ShareItem[]): Promise<ActionResult> {
  if (items.length === 0) return "failed";
  const files = toFiles(items);
  if (canShareFiles(files)) {
    try {
      await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({ files });
      return "shared";
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return "cancelled";
      // fall through to download on a real share failure
    }
  }
  anchorDownload(items);
  return "downloaded";
}

// Send via the share sheet with a friendly caption and no raw URL.
export async function sharePhotos(items: ShareItem[], caption: string): Promise<ActionResult> {
  if (items.length === 0) return "failed";
  const files = toFiles(items);
  if (canShareFiles(files)) {
    try {
      await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({ files, text: caption });
      return "shared";
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return "cancelled";
    }
  }
  anchorDownload(items);
  return "downloaded";
}
