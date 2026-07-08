"use client";

// Full-screen, social-app-style photo/video viewer for the guest gallery.
// Opened by tapping a thumbnail on /gallery. Supports:
//   • left/right swipe (and arrow keys / on-screen chevrons) between photos,
//   • pinch-zoom + double-tap zoom + wheel zoom, with pan while zoomed,
//   • per-photo download and share, each carrying the composited photographer
//     branding (frame + Photo Santos logo + event title) via lib/watermark.
// Videos (status/url ending in a video type) render in a <video> element with
// native controls instead of the zoom surface.
//
// Gesture math is pointer-event based (one code path for touch + mouse). RTL:
// the on-screen prev/next chevrons are mirrored, swipe stays index-based
// (drag-left = next), which reads naturally to guests regardless of direction.

import { useCallback, useEffect, useRef, useState } from "react";
import type { GuestPhoto } from "@/lib/api";
import {
  compositeBrandedPhoto,
  downloadFileName,
  type CompositeBranding,
} from "@/lib/watermark";

const MAX_ZOOM = 4;

function isVideo(photo: GuestPhoto): boolean {
  return /\.(mp4|mov|webm|m4v)$/i.test(photo.url) || photo.status === "video";
}

type Transform = { scale: number; x: number; y: number };
const RESET: Transform = { scale: 1, x: 0, y: 0 };

export function PhotoViewer({
  photos,
  startIndex,
  branding,
  onClose,
}: {
  photos: GuestPhoto[];
  startIndex: number;
  branding: CompositeBranding;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [t, setT] = useState<Transform>(RESET);
  const [busy, setBusy] = useState<null | "download" | "share">(null);
  const [toast, setToast] = useState<string | null>(null);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    mode: "none" | "pan" | "swipe" | "pinch";
    startDist: number;
    startScale: number;
    startT: Transform;
    startX: number;
    startY: number;
    lastTap: number;
  }>({ mode: "none", startDist: 0, startScale: 1, startT: RESET, startX: 0, startY: 0, lastTap: 0 });
  const [dragX, setDragX] = useState(0);

  const photo = photos[index];
  const zoomed = t.scale > 1.01;

  const go = useCallback(
    (dir: number) => {
      setIndex((i) => {
        const next = i + dir;
        if (next < 0 || next >= photos.length) return i;
        return next;
      });
      setT(RESET);
      setDragX(0);
    },
    [photos.length],
  );

  // Reset zoom whenever the photo changes.
  useEffect(() => setT(RESET), [index]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(1);
      else if (e.key === "ArrowRight") go(-1);
    }
    window.addEventListener("keydown", onKey);
    // Lock body scroll while the viewer is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [go, onClose]);

  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  function clampPan(next: Transform): Transform {
    const el = surfaceRef.current;
    if (!el) return next;
    const rect = el.getBoundingClientRect();
    const maxX = ((next.scale - 1) * rect.width) / 2;
    const maxY = ((next.scale - 1) * rect.height) / 2;
    return {
      scale: next.scale,
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (isVideo(photo)) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const g = gesture.current;
    if (pts.length === 2) {
      g.mode = "pinch";
      g.startDist = dist(pts[0], pts[1]);
      g.startScale = t.scale;
      g.startT = t;
    } else {
      // Double-tap to toggle zoom.
      const now = Date.now();
      if (now - g.lastTap < 280 && !zoomed) {
        setT(clampPan({ scale: 2.5, x: 0, y: 0 }));
        g.mode = "none";
        g.lastTap = 0;
        return;
      }
      g.lastTap = now;
      g.mode = zoomed ? "pan" : "swipe";
      g.startT = t;
      g.startX = e.clientX;
      g.startY = e.clientY;
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const g = gesture.current;

    if (g.mode === "pinch" && pts.length >= 2) {
      const ratio = dist(pts[0], pts[1]) / (g.startDist || 1);
      const scale = Math.max(1, Math.min(MAX_ZOOM, g.startScale * ratio));
      setT(clampPan({ scale, x: g.startT.x, y: g.startT.y }));
    } else if (g.mode === "pan") {
      setT(clampPan({ scale: g.startT.scale, x: g.startT.x + (e.clientX - g.startX), y: g.startT.y + (e.clientY - g.startY) }));
    } else if (g.mode === "swipe") {
      setDragX(e.clientX - g.startX);
    }
  }

  function endPointer(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g.mode === "swipe") {
      const el = surfaceRef.current;
      const threshold = el ? el.getBoundingClientRect().width * 0.18 : 60;
      if (dragX <= -threshold) go(1);
      else if (dragX >= threshold) go(-1);
      else setDragX(0);
    }
    if (pointers.current.size === 0) g.mode = "none";
    else if (pointers.current.size === 1) {
      // Second finger lifted mid-pinch — settle into pan from the current state.
      g.mode = zoomed ? "pan" : "none";
      const p = [...pointers.current.values()][0];
      g.startT = t;
      g.startX = p.x;
      g.startY = p.y;
    }
  }

  function onWheel(e: React.WheelEvent) {
    if (isVideo(photo)) return;
    const scale = Math.max(1, Math.min(MAX_ZOOM, t.scale - e.deltaY * 0.002));
    setT(clampPan({ scale, x: scale === 1 ? 0 : t.x, y: scale === 1 ? 0 : t.y }));
  }

  function flashToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  function triggerDownload(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function handleDownload() {
    if (busy) return;
    setBusy("download");
    try {
      const blob = await compositeBrandedPhoto(photo.url, branding);
      triggerDownload(blob, downloadFileName(photo.id, branding.studioName));
    } catch {
      flashToast("ההורדה נכשלה. נסו שוב.");
    } finally {
      setBusy(null);
    }
  }

  async function handleShare() {
    if (busy) return;
    setBusy("share");
    try {
      const blob = await compositeBrandedPhoto(photo.url, branding);
      const file = new File([blob], downloadFileName(photo.id, branding.studioName), { type: "image/jpeg" });
      const nav = navigator as Navigator & { canShare?: (d?: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: branding.eventTitle ?? branding.studioName,
          text: branding.eventTitle ? `${branding.eventTitle} · ${branding.studioName}` : branding.studioName,
        });
      } else {
        // Desktop / unsupported: fall back to saving the branded image.
        triggerDownload(blob, downloadFileName(photo.id, branding.studioName));
        flashToast("השיתוף לא נתמך במכשיר הזה, התמונה נשמרה במקום.");
      }
    } catch (err) {
      // AbortError = user cancelled the share sheet; not an error worth showing.
      if ((err as Error)?.name !== "AbortError") flashToast("השיתוף נכשל. נסו שוב.");
    } finally {
      setBusy(null);
    }
  }

  if (!photo) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black" role="dialog" aria-modal="true">
      {/* Top bar: close + counter + share/download */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="סגירה"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
        <span dir="ltr" className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white backdrop-blur-md">
          {index + 1} / {photos.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            disabled={busy !== null}
            aria-label="שיתוף התמונה"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined ${busy === "share" ? "animate-spin" : ""}`}>
              {busy === "share" ? "progress_activity" : "share"}
            </span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={busy !== null}
            aria-label="הורדת התמונה"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined ${busy === "download" ? "animate-spin" : ""}`}>
              {busy === "download" ? "progress_activity" : "download"}
            </span>
          </button>
        </div>
      </div>

      {/* Media surface */}
      <div
        ref={surfaceRef}
        className="relative flex flex-1 touch-none select-none items-center justify-center overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={onWheel}
      >
        {isVideo(photo) ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={photo.url} controls playsInline className="max-h-full max-w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- full-res source, gesture-transformed; next/image would fight the transform
          <img
            src={photo.url}
            alt=""
            draggable={false}
            className="max-h-full max-w-full object-contain"
            style={{
              transform: `translate3d(${t.x + dragX}px, ${t.y}px, 0) scale(${t.scale})`,
              transition: gesture.current.mode === "none" ? "transform 0.2s ease-out" : "none",
              cursor: zoomed ? "grab" : "auto",
            }}
          />
        )}
      </div>

      {/* Prev / next chevrons (mirrored for RTL via :dir on the icon glyph).
          Hidden while zoomed so they don't fight the pan gesture. */}
      {!zoomed && index > 0 && (
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="הקודם"
          className="absolute end-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 sm:flex"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      )}
      {!zoomed && index < photos.length - 1 && (
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="הבא"
          className="absolute start-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 sm:flex"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
      )}

      {/* Bottom hint bar: event title + studio credit, mirroring what the
          composited download/share will carry. */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 bg-gradient-to-t from-black/70 to-transparent px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-10">
        {branding.eventTitle && (
          <p className="text-start text-sm font-bold text-white/90">{branding.eventTitle}</p>
        )}
        <p className="font-display text-xs uppercase tracking-wide text-white/70">{branding.studioName}</p>
      </div>

      {toast && (
        <div className="absolute inset-x-0 bottom-24 z-30 mx-auto w-fit rounded-full bg-white/15 px-4 py-2 text-sm text-white backdrop-blur-md">
          {toast}
        </div>
      )}
    </div>
  );
}
