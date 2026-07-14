"use client";

// The photo presented as a finished "magnet": the image, a photographer frame
// hugging its edges, and the branding (studio logo + name + event title) baked
// onto the BOTTOM OF THE IMAGE — not floating at the bottom of the screen. What
// the guest sees here is exactly what lib/watermark.ts renders into the saved
// JPEG, so view / download / share are all WYSIWYG.
//
// The wrapper shrink-wraps the <img>, so the frame and footer align to the
// image's real rendered rectangle at any aspect ratio.

import type { CompositeBranding } from "@/lib/watermark";

const FRAME_BORDER: Record<string, string> = {
  crystal: "#ffffff",
  black: "#0a0a0a",
  silver: "#d4d4d8",
};

export function BrandedFrame({
  src,
  branding,
  className = "",
  style,
  draggable = false,
  imgMaxHeight = "80vh",
  imgMaxWidth = "92vw",
}: {
  src: string;
  branding: CompositeBranding;
  className?: string;
  style?: React.CSSProperties;
  draggable?: boolean;
  imgMaxHeight?: string;
  imgMaxWidth?: string;
}) {
  const borderColor = branding.frameStyle === "none" ? undefined : FRAME_BORDER[branding.frameStyle] ?? "#ffffff";

  return (
    <div
      className={`relative inline-block overflow-hidden ${className}`}
      style={{
        border: borderColor ? `clamp(4px, 2.6vmin, 14px) solid ${borderColor}` : undefined,
        boxShadow: "0 24px 60px -12px rgba(0,0,0,0.7)",
        ...style,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- gesture-transformed full-res source */}
      <img
        src={src}
        alt=""
        draggable={draggable}
        className="block h-auto w-auto select-none"
        style={{ maxHeight: imgMaxHeight, maxWidth: imgMaxWidth }}
      />

      {/* Branding footer — attached to the image's bottom edge. Hidden when the
          frame is off so an "unframed" export is a fully clean, unbranded photo. */}
      {branding.frameStyle !== "none" && (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 px-[4%] pb-[3.5%] pt-[14%]"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0))" }}
      >
        <div className="flex items-center gap-2">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded logo
            <img src={branding.logoUrl} alt="" className="w-auto object-contain" style={{ height: "clamp(28px, 6vmin, 48px)" }} />
          ) : null}
          <span
            className="font-display uppercase leading-none tracking-wide text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]"
            style={{ fontSize: "clamp(13px, 2.8vmin, 24px)" }}
          >
            {branding.studioName}
          </span>
        </div>
        {branding.eventTitle ? (
          <span
            dir="rtl"
            className="max-w-[62%] truncate text-end font-bold leading-none text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.65)]"
            style={{ fontSize: "clamp(12px, 2.5vmin, 20px)" }}
          >
            {branding.eventTitle}
          </span>
        ) : null}
      </div>
      )}
    </div>
  );
}
