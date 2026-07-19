"use client";

import { useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import { loadGuestSession } from "@/lib/guestSession";

export type ExportFormat = "original" | "feed" | "story";

const FORMATS: { key: ExportFormat; label: string; ratio: string; w: number; h: number }[] = [
  { key: "original", label: "מקורי", ratio: "", w: 52, h: 38 },
  { key: "feed",     label: "פיד",   ratio: "4:5", w: 44, h: 52 },
  { key: "story",    label: "סטורי", ratio: "9:16", w: 32, h: 52 },
];

function FormatIcon({ w, h, active }: { w: number; h: number; active: boolean }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl"
      style={{
        width: 72,
        height: 72,
        background: active ? "rgba(255,180,166,0.12)" : "rgba(255,255,255,0.06)",
        border: active ? "2px solid #ff8a75" : "2px solid rgba(255,255,255,0.1)",
        transition: "all 0.18s ease",
      }}
    >
      <div
        style={{
          width: w,
          height: h,
          border: `2px solid ${active ? "#ff8a75" : "rgba(255,255,255,0.4)"}`,
          borderRadius: 4,
          background: "transparent",
          transition: "all 0.18s ease",
        }}
      />
    </div>
  );
}

export function FormatPickerSheet({
  photoId,
  onClose,
  onExported,
}: {
  photoId: string;
  onClose: () => void;
  onExported?: (url: string, format: ExportFormat) => void;
}) {
  const [selected, setSelected] = useState<ExportFormat>("feed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const session = loadGuestSession();
      if (!session) throw new Error("no-session");
      const url = `${API_BASE_URL}/photos/${encodeURIComponent(photoId)}/social-export?format=${selected}&token=${encodeURIComponent(session.token)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      if (onExported) {
        onExported(objectUrl, selected);
      } else {
        // Fallback: trigger native share
        if (navigator.share) {
          await navigator.share({ files: [new File([blob], `photo-${selected}.jpg`, { type: blob.type })] });
        } else {
          const a = document.createElement("a");
          a.href = objectUrl;
          a.download = `photo-${selected}.jpg`;
          a.click();
        }
        URL.revokeObjectURL(objectUrl);
      }
      onClose();
    } catch {
      setError("ייצוא נכשל. נסה שוב.");
    } finally {
      setBusy(false);
    }
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl bg-[#1a1c1c] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ border: "1px solid rgba(255,255,255,0.07)", borderBottom: "none" }}
      >
        {/* Drag handle */}
        <div className="mx-auto mb-5 mt-3 h-1 w-10 rounded-full bg-white/20" />

        {/* Title */}
        <h2 className="mb-6 text-center text-lg font-bold text-on-surface">בחר פורמט</h2>

        {/* Format options */}
        <div className="mb-7 flex items-start justify-center gap-6 px-6">
          {FORMATS.map(({ key, label, ratio, w, h }) => {
            const active = selected === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className="flex flex-col items-center gap-2 transition-opacity"
              >
                <div className="relative">
                  <FormatIcon w={w} h={h} active={active} />
                  {active && (
                    <div
                      className="absolute -end-1 -top-1 h-3 w-3 rounded-full bg-primary"
                      style={{ boxShadow: "0 0 6px rgba(255,180,166,0.7)" }}
                    />
                  )}
                </div>
                <span className={`text-xs font-semibold ${active ? "text-primary" : "text-on-surface-variant"}`}>
                  {ratio ? `${label} ${ratio}` : label}
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <p className="mx-6 mb-4 rounded-xl bg-error/10 px-4 py-2 text-center text-sm text-error">
            {error}
          </p>
        )}

        {/* Export / Cancel */}
        <div className="flex flex-col gap-3 px-6 pb-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-bold text-on-primary shadow-lg transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? (
              <>
                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                מכין...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">ios_share</span>
                ייצא ושתף
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-white/8 py-4 text-base font-medium text-on-surface transition-all active:bg-white/5"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
