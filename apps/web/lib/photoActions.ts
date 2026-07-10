// Client-side photo download/share for the guest personal gallery.
//
// Both actions work purely in the browser against the Worker's GET /media/*
// route, which returns Access-Control-Allow-Origin: * (see apps/api's global
// `app.use('*', cors())`), so cross-origin blob fetches succeed. No guest token
// is ever placed in a shareable URL - that stays a deliberately-open security
// concern (see SUMMARY.md "tokens traveling in the URL path"); we share the
// photo *files* themselves, not a token link.

import type { GuestPhoto } from "@/lib/api";

// Fetch every photo as a File, skipping any that fail rather than aborting the
// whole batch (one dead R2 key shouldn't sink a 15-photo download).
async function fetchPhotoFiles(photos: GuestPhoto[]): Promise<File[]> {
  const results = await Promise.all(
    photos.map(async (photo, i) => {
      try {
        const res = await fetch(photo.url);
        if (!res.ok) return null;
        const blob = await res.blob();
        const ext = blob.type === "image/png" ? "png" : "jpg";
        const name = `oura-${String(i + 1).padStart(2, "0")}.${ext}`;
        return new File([blob], name, { type: blob.type || "image/jpeg" });
      } catch {
        return null;
      }
    }),
  );
  return results.filter((f): f is File => f !== null);
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has grabbed the URL first.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Download all the given photos as a single ZIP - far better mobile UX than
// firing N separate "save" dialogs. jszip is dynamically imported so it never
// weighs down the initial gallery bundle.
export async function downloadPhotosAsZip(
  photos: GuestPhoto[],
): Promise<{ ok: boolean; count: number }> {
  const files = await fetchPhotoFiles(photos);
  if (files.length === 0) return { ok: false, count: 0 };

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.name, file);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  triggerBlobDownload(blob, "oura-gallery.zip");
  return { ok: true, count: files.length };
}

export type ShareOutcome = "shared" | "downloaded" | "unavailable";

// Share the guest's actual photos. On mobile this opens the native share sheet
// (WhatsApp, Photos, Mail...) with the image files attached - which is exactly
// what "share my gallery" means to a guest. Where file-sharing isn't supported
// (most desktops), fall back to downloading the ZIP so the action still yields
// the photos rather than doing nothing.
export async function sharePhotos(
  photos: GuestPhoto[],
): Promise<{ outcome: ShareOutcome; count: number }> {
  const files = await fetchPhotoFiles(photos);
  if (files.length === 0) return { outcome: "unavailable", count: 0 };

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };

  if (
    typeof nav.share === "function" &&
    typeof nav.canShare === "function" &&
    nav.canShare({ files })
  ) {
    try {
      await nav.share({
        files,
        title: "התמונות שלי מהאירוע",
        text: "התמונות שלי מהאירוע, דרך Oura",
      });
      return { outcome: "shared", count: files.length };
    } catch (err) {
      // AbortError = the user dismissed the share sheet on purpose; that's not
      // a failure and must not silently trigger a download behind their back.
      if (err instanceof DOMException && err.name === "AbortError") {
        return { outcome: "shared", count: files.length };
      }
      // Any other share failure: fall through to the download fallback below.
    }
  }

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.name, file);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  triggerBlobDownload(blob, "oura-gallery.zip");
  return { outcome: "downloaded", count: files.length };
}
