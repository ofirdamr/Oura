"use client";

// Full-screen photo viewer built the way people actually use a phone gallery
// (Instagram / Apple Photos), not a desktop lightbox:
//   • Horizontal PAGED carousel — photos slide in/out with momentum, not a hard
//     cut. Rubber-band resistance at the ends.
//   • Swipe DOWN or UP to dismiss — the photo follows your finger and the
//     backdrop fades; nobody hunts for an X. (The X is still there as a hint.)
//   • Pinch-zoom + double-tap zoom, with pan while zoomed.
//   • Each photo is the branded "magnet" (BrandedFrame): frame + logo + event
//     title baked onto the image bottom, so what you see == what you save.
//   • Save targets the phone's Photos library (share sheet), share carries a
//     friendly caption with no raw URL (lib/photoActions).
//
// One pointer-event handler drives every gesture; mode is locked on first move
// so a vertical dismiss can't fight a horizontal page-turn.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GuestPhoto } from "@/lib/api";
import { compositeBrandedPhoto, downloadFileName, type CompositeBranding } from "@/lib/watermark";
import { BrandedFrame } from "@/components/guest/BrandedFrame";
import { savePhotos, sharePhotos } from "@/lib/photoActions";
import { FormatPickerSheet } from "@/components/guest/FormatPickerSheet";

const MAX_ZOOM = 4;
const DISMISS_PX = 130;

function isVideo(p: GuestPhoto): boolean {
  return /\.(mp4|mov|webm|m4v)$/i.test(p.url) || p.status === "video";
}

type Zoom = { scale: number; x: number; y: number };
const NOZOOM: Zoom = { scale: 1, x: 0, y: 0 };

export function PhotoViewer({
  photos,
  startIndex,
  branding,
  shareCaption,
  onClose,
}: {
  photos: GuestPhoto[];
  startIndex: number;
  branding: CompositeBranding;
  shareCaption?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(startIndex);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [zoom, setZoom] = useState<Zoom>(NOZOOM);
  const [animating, setAnimating] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "share">(null);
  const [formatSheet, setFormatSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const g = useRef({
    mode: "none" as "none" | "swipe" | "dismiss" | "pan" | "pinch",
    sx: 0,
    sy: 0,
    startZoom: NOZOOM,
    startDist: 0,
    lastTap: 0,
  });

  const photo = photos[index];
  const zoomed = zoom.scale > 1.01;

  const go = useCallback(
    (dir: number) => {
      setIndex((i) => Math.max(0, Math.min(photos.length - 1, i + dir)));
      setZoom(NOZOOM);
    },
    [photos.length],
  );

  useEffect(() => {
    setZoom(NOZOOM);
    setDragX(0);
    setDragY(0);
  }, [index]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(1);
      else if (e.key === "ArrowRight") go(-1);
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [go, onClose]);

  const vw = () => rootRef.current?.getBoundingClientRect().width ?? window.innerWidth;
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

  function clampZoomPan(z: Zoom): Zoom {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return z;
    const maxX = ((z.scale - 1) * rect.width) / 2;
    const maxY = ((z.scale - 1) * rect.height) / 2;
    return { scale: z.scale, x: Math.max(-maxX, Math.min(maxX, z.x)), y: Math.max(-maxY, Math.min(maxY, z.y)) };
  }

  function dismissClose(dir: number) {
    setAnimating(true);
    setClosing(true);
    setDragY(dir * (rootRef.current?.getBoundingClientRect().height ?? window.innerHeight));
    setTimeout(onClose, 200);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (isVideo(photo)) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    setAnimating(false);
    if (pts.length === 2) {
      g.current.mode = "pinch";
      g.current.startDist = dist(pts[0], pts[1]);
      g.current.startZoom = zoom;
    } else {
      const now = Date.now();
      if (now - g.current.lastTap < 280) {
        // double tap → toggle zoom
        setZoom((z) => (z.scale > 1.01 ? NOZOOM : clampZoomPan({ scale: 2.5, x: 0, y: 0 })));
        setAnimating(true);
        g.current.mode = "none";
        g.current.lastTap = 0;
        return;
      }
      g.current.lastTap = now;
      g.current.mode = zoomed ? "pan" : "none"; // 'none' until first move decides axis
      g.current.sx = e.clientX;
      g.current.sy = e.clientY;
      g.current.startZoom = zoom;
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const gg = g.current;

    if (gg.mode === "pinch" && pts.length >= 2) {
      const scale = Math.max(1, Math.min(MAX_ZOOM, gg.startZoom.scale * (dist(pts[0], pts[1]) / (gg.startDist || 1))));
      setZoom(clampZoomPan({ scale, x: gg.startZoom.x, y: gg.startZoom.y }));
      return;
    }
    const dx = e.clientX - gg.sx;
    const dy = e.clientY - gg.sy;
    if (gg.mode === "pan") {
      setZoom(clampZoomPan({ scale: gg.startZoom.scale, x: gg.startZoom.x + dx, y: gg.startZoom.y + dy }));
      return;
    }
    if (gg.mode === "none") {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      gg.mode = Math.abs(dx) > Math.abs(dy) ? "swipe" : "dismiss";
    }
    if (gg.mode === "swipe") {
      let d = dx;
      // rubber-band at the ends
      if ((index === 0 && dx > 0) || (index === photos.length - 1 && dx < 0)) d = dx * 0.35;
      setDragX(d);
    } else if (gg.mode === "dismiss") {
      setDragY(dy);
    }
  }

  function endPointer(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    const gg = g.current;
    // Read the final delta straight off the pointerup event — never off dragX/
    // dragY state, which can be a render behind and silently swallow the swipe.
    const fdx = e.clientX - gg.sx;
    const fdy = e.clientY - gg.sy;
    if (gg.mode === "swipe") {
      setAnimating(true);
      const threshold = vw() * 0.22;
      if (fdx <= -threshold && index < photos.length - 1) setIndex(index + 1);
      else if (fdx >= threshold && index > 0) setIndex(index - 1);
      setDragX(0);
      setZoom(NOZOOM);
    } else if (gg.mode === "dismiss") {
      if (Math.abs(fdy) > DISMISS_PX) {
        dismissClose(fdy > 0 ? 1 : -1);
        return;
      }
      setAnimating(true);
      setDragY(0);
    }
    if (pointers.current.size === 0) gg.mode = "none";
    else if (pointers.current.size === 1) {
      const p = [...pointers.current.values()][0];
      gg.mode = zoom.scale > 1.01 ? "pan" : "none";
      gg.sx = p.x;
      gg.sy = p.y;
      gg.startZoom = zoom;
    }
  }

  function onWheel(e: React.WheelEvent) {
    if (isVideo(photo)) return;
    setAnimating(true);
    const scale = Math.max(1, Math.min(MAX_ZOOM, zoom.scale - e.deltaY * 0.002));
    setZoom(clampZoomPan({ scale, x: scale === 1 ? 0 : zoom.x, y: scale === 1 ? 0 : zoom.y }));
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  async function handleSave() {
    if (busy) return;
    setBusy("save");
    try {
      const blob = await compositeBrandedPhoto(photo.url, branding);
      const res = await savePhotos([{ blob, filename: downloadFileName(photo.id, branding.studioName) }]);
      if (res === "downloaded") flash("התמונה נשמרה");
    } catch {
      flash("השמירה נכשלה. נסו שוב.");
    } finally {
      setBusy(null);
    }
  }

  async function handleShare() {
    if (busy) return;
    setBusy("share");
    try {
      const blob = await compositeBrandedPhoto(photo.url, branding);
      const caption =
        shareCaption ?? (branding.eventTitle ? `${branding.eventTitle} · ${branding.studioName}` : branding.studioName);
      const res = await sharePhotos([{ blob, filename: downloadFileName(photo.id, branding.studioName) }], caption);
      if (res === "downloaded") flash("השיתוף לא נתמך במכשיר, התמונה נשמרה");
    } catch {
      flash("השיתוף נכשל. נסו שוב.");
    } finally {
      setBusy(null);
    }
  }

  if (!photo) return null;

  // Backdrop fades as the photo is dragged toward dismissal.
  const dismissProgress = Math.min(1, Math.abs(dragY) / (DISMISS_PX * 2.4));
  const backdropAlpha = closing ? 0 : 1 - dismissProgress * 0.85;

  const trackTransition = animating ? "transform 0.28s cubic-bezier(0.22,0.61,0.36,1)" : "none";

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[200] overflow-hidden"
      role="dialog"
      aria-modal="true"
      style={{ backgroundColor: `rgba(0,0,0,${backdropAlpha})`, transition: closing ? "background-color 0.2s" : undefined }}
    >
      {/* Top bar */}
      <div
        className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 bg-gradient-to-b from-black/60 to-transparent px-4 pb-8 pt-[calc(env(safe-area-inset-top)+0.75rem)] transition-opacity"
        style={{ opacity: zoomed || Math.abs(dragY) > 20 ? 0 : 1 }}
      >
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
          {!isVideo(photo) && (
            <button
              type="button"
              onClick={() => router.push(`/photo-editor?photo=${encodeURIComponent(photo.id)}`)}
              aria-label="עריכת התמונה"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20"
            >
              <span className="material-symbols-outlined">tune</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setFormatSheet(true)}
            disabled={busy !== null}
            aria-label="שיתוף התמונה"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 disabled:opacity-50"
          >
            <span className="material-symbols-outlined">ios_share</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy !== null}
            aria-label="שמירת התמונה"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined ${busy === "save" ? "animate-spin" : ""}`}>
              {busy === "save" ? "progress_activity" : "download"}
            </span>
          </button>
        </div>
      </div>

      {/* Carousel track — each slide is exactly one viewport wide (vw), so the
          transform is honest pixels, not nested percentages. dir="ltr" is
          REQUIRED: the app is dir="rtl", which would otherwise lay the flex
          slides right-to-left and push the current slide off-screen (and steal
          the pointer target). Slide order here is spatial, not textual. */}
      <div
        dir="ltr"
        className="flex h-full touch-none select-none"
        style={{
          transform: `translate3d(calc(${-index} * 100vw + ${dragX}px), 0, 0)`,
          transition: trackTransition,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={onWheel}
      >
        {photos.map((p, i) => {
          const near = Math.abs(i - index) <= 1;
          const isCurrent = i === index;
          return (
            <div
              key={p.id}
              className="flex h-full w-screen shrink-0 items-center justify-center"
            >
              {near ? (
                isVideo(p) ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video src={p.url} controls playsInline className="max-h-[86vh] max-w-[94vw]" />
                ) : (
                  <div
                    style={{
                      transform: isCurrent
                        ? `translate3d(${zoom.x}px, ${zoom.y + dragY}px, 0) scale(${zoom.scale})`
                        : undefined,
                      transition: animating ? "transform 0.24s ease-out" : "none",
                    }}
                  >
                    <BrandedFrame src={p.url} branding={branding} imgMaxHeight="82vh" imgMaxWidth="94vw" />
                  </div>
                )
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Desktop-only chevrons (mobile uses swipe). */}
      {!zoomed && index > 0 && (
        <button
          type="button"
          onClick={() => { setAnimating(true); go(-1); }}
          aria-label="הקודם"
          className="absolute end-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 sm:flex"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      )}
      {!zoomed && index < photos.length - 1 && (
        <button
          type="button"
          onClick={() => { setAnimating(true); go(1); }}
          aria-label="הבא"
          className="absolute start-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 sm:flex"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
      )}

      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-30 mx-auto w-fit rounded-full bg-white/15 px-4 py-2 text-sm text-white backdrop-blur-md">
          {toast}
        </div>
      )}

      {formatSheet && !isVideo(photo) && (
        <FormatPickerSheet
          photoId={photo.id}
          onClose={() => setFormatSheet(false)}
          onExported={async (objectUrl, _format) => {
            try {
              const res = await fetch(objectUrl);
              const blob = await res.blob();
              URL.revokeObjectURL(objectUrl);
              const caption =
                shareCaption ?? (branding.eventTitle ? `${branding.eventTitle} · ${branding.studioName}` : branding.studioName);
              const shareRes = await sharePhotos([{ blob, filename: downloadFileName(photo.id, branding.studioName) }], caption);
              if (shareRes === "downloaded") flash("התמונה נשמרה");
            } catch {
              flash("השיתוף נכשל. נסו שוב.");
            }
          }}
        />
      )}
    </div>
  );
}
