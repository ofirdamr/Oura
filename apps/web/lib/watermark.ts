// Client-side branded-photo compositor (MVP sample branding — the founder gave
// explicit permission to freehand this). Given a photo URL and the event's
// branding, it draws the photo onto a canvas with:
//   • a sample photographer frame (border whose color follows the chosen frame
//     style),
//   • the "Photo Santos" studio logo + name watermark,
//   • the event title (e.g. "החתונה של דניאל ומיכל"),
// and returns a JPEG Blob. Used both for the guest-friendly per-photo download
// (a finished, framed image — never a raw ZIP) and for the Web Share payload,
// so what gets shared/saved carries the photographer's brand.
//
// Taint-safety: images are pulled via fetch()->blob()->createImageBitmap rather
// than <img crossOrigin>, so the canvas is never tainted by a CORS-less cached
// copy that next/image may have loaded first. The Worker's /media route sends
// Access-Control-Allow-Origin:* (hono cors()), so the fetch itself is allowed.

export type FrameStyle = "crystal" | "black" | "silver" | "none";

export type CompositeBranding = {
  studioName: string;
  eventTitle?: string | null;
  logoUrl?: string | null;
  frameStyle: FrameStyle;
  primaryColor: string;
};

const FRAME_BORDER: Record<Exclude<FrameStyle, "none">, string> = {
  crystal: "#ffffff",
  black: "#0a0a0a",
  silver: "#d4d4d8",
};

// Longest-edge cap for the output — keeps shared/downloaded files phone-friendly
// (fast to send over WhatsApp, small enough to save) without visible quality loss.
const MAX_EDGE = 1600;

async function loadBitmap(url: string): Promise<ImageBitmap> {
  const res = await fetch(url, { mode: "cors", cache: "force-cache" });
  if (!res.ok) throw new Error(`fetch_failed_${res.status}`);
  const blob = await res.blob();
  return createImageBitmap(blob);
}

export async function compositeBrandedPhoto(
  photoUrl: string,
  branding: CompositeBranding,
): Promise<Blob> {
  const img = await loadBitmap(photoUrl);

  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  // Frame thickness scales with the image so it reads the same on a tall
  // portrait and a wide landscape shot.
  const border = branding.frameStyle === "none" ? 0 : Math.round(Math.min(w, h) * 0.028);
  const canvas = document.createElement("canvas");
  canvas.width = w + border * 2;
  canvas.height = h + border * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no_2d_context");

  // Frame border (sample photographer frame).
  if (border > 0) {
    ctx.fillStyle = FRAME_BORDER[branding.frameStyle as Exclude<FrameStyle, "none">] ?? "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, border, border, w, h);
  img.close();

  // Bottom branding bar: a gradient scrim so the logo + titles stay legible on
  // any photo, drawn inside the frame over the image.
  const barH = Math.round(h * 0.22);
  const barTop = border + h - barH;
  const grad = ctx.createLinearGradient(0, barTop, 0, border + h);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.72)");
  ctx.fillStyle = grad;
  ctx.fillRect(border, barTop, w, barH);

  const pad = Math.round(Math.min(w, h) * 0.05);
  const baseFont = Math.max(14, Math.round(w * 0.032));

  // Accent hairline above the branding, in the studio's primary color.
  ctx.fillStyle = branding.primaryColor;
  ctx.fillRect(border + pad, border + h - Math.round(barH * 0.62), Math.round(w * 0.14), Math.max(2, Math.round(w * 0.005)));

  // Event title — Hebrew, RTL, flush to the right (start side).
  if (branding.eventTitle) {
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.font = `700 ${Math.round(baseFont * 1.25)}px Rubik, system-ui, sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = Math.round(baseFont * 0.4);
    ctx.fillText(branding.eventTitle, border + w - pad, border + h - Math.round(barH * 0.34), w - pad * 2);
    ctx.shadowBlur = 0;
  }

  // Studio credit (logo + "Photo Santos") — bottom-left (end side), LTR.
  const creditY = border + h - pad;
  let logoRight = border + pad;
  if (branding.logoUrl) {
    try {
      const logo = await loadBitmap(branding.logoUrl);
      const logoH = Math.round(baseFont * 1.4);
      const logoW = Math.round((logo.width / logo.height) * logoH) || logoH;
      ctx.drawImage(logo, border + pad, creditY - logoH, logoW, logoH);
      logo.close();
      logoRight = border + pad + logoW + Math.round(baseFont * 0.4);
    } catch {
      // Logo optional — a failed load just falls back to the text credit.
    }
  }
  ctx.direction = "ltr";
  ctx.textAlign = "left";
  ctx.font = `600 ${baseFont}px "Hanken Grotesk", Rubik, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = Math.round(baseFont * 0.4);
  ctx.fillText(branding.studioName, logoRight, creditY - Math.round(baseFont * 0.15));
  ctx.shadowBlur = 0;

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob_failed"))),
      "image/jpeg",
      0.92,
    );
  });
}

// Safe filename for a downloaded photo, e.g. "photo-santos-a1b2c3d4.jpg".
export function downloadFileName(photoId: string, studioName: string): string {
  const slug = studioName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "oura";
  return `${slug}-${photoId.slice(0, 8)}.jpg`;
}
