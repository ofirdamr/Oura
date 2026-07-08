"use client";

// Guest-facing Personal Gallery: face-matched results for one guest within one
// event. Wired to the real GET /gallery/:token (apps/api), rendering real
// photos served from the Worker's GET /media/:key R2 route.
//
// Consent enforcement lives here too, not just on /consent: a guest who lands
// on this URL directly (bookmarked link, back button, shared link, etc.)
// without ever accepting the biometric-consent gate must not see personal
// results - so if the API says personal_gallery.consent_required, we redirect
// to /consent instead of rendering anything personal. This mirrors the
// server-side guardrail (face_embeddings is never queried pre-consent) with a
// client-side one, per the task brief.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BottomNav } from "@/components/guest/BottomNav";
import { API_BASE_URL, getGallery, type GalleryResponse, type GuestPhoto } from "@/lib/api";
import { clearGuestSession, loadGuestSession } from "@/lib/guestSession";
import { OuraLogo } from "@/components/brand/OuraLogo";
import { PhotoViewer } from "@/components/guest/PhotoViewer";
import {
  compositeBrandedPhoto,
  downloadFileName,
  type CompositeBranding,
  type FrameStyle,
} from "@/lib/watermark";

const STUDIO_NAME = "Photo Santos";

const FILTERS = ["כל התמונות", "חופה", "ריקודים", "קבלת פנים"];

function PhotoTile({
  photo,
  aspect,
  matched,
  onOpen,
}: {
  photo: GuestPhoto;
  aspect: string;
  matched?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="פתיחת התמונה במסך מלא"
      className={`${aspect} group relative block w-full overflow-hidden rounded-2xl border border-white/5 bg-surface-container shadow-md transition-transform active:scale-[0.98]`}
    >
      <Image
        src={photo.url}
        alt=""
        fill
        sizes="(min-width: 512px) 240px, 50vw"
        className="object-cover transition-transform duration-300 group-hover:scale-105"
      />
      {matched && (
        <div className="absolute end-2 top-2 flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/70 px-2 py-1 backdrop-blur-md">
          <span
            className="material-symbols-outlined text-primary"
            style={{ fontSize: "14px", fontVariationSettings: "'FILL' 1" }}
          >
            verified
          </span>
        </div>
      )}
    </button>
  );
}

// Cheap deterministic aspect variety so the grid doesn't look like a flat
// list of identical squares - purely cosmetic, no data behind it.
function tileAspect(i: number): string {
  return i % 3 === 0 ? "aspect-[3/4]" : "aspect-square";
}

export default function GalleryPage() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState(FILTERS[0]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [data, setData] = useState<GalleryResponse | null>(null);
  // Which photo list + index the full-screen viewer is showing (null = closed).
  const [viewer, setViewer] = useState<{ list: GuestPhoto[]; index: number } | null>(null);
  const [bulk, setBulk] = useState<{ mode: "download" | "share"; done: number; total: number } | null>(null);

  const branding: CompositeBranding = useMemo(() => {
    const b = data?.event?.branding;
    return {
      studioName: STUDIO_NAME,
      eventTitle: data?.event?.branding.event_title || data?.event?.name || null,
      logoUrl: b?.logo_key ? `${API_BASE_URL}/media/${b.logo_key}` : null,
      frameStyle: (b?.frame as FrameStyle) ?? "crystal",
      primaryColor: b?.primary_color ?? "#FF8A75",
    };
  }, [data]);

  async function downloadAll(list: GuestPhoto[]) {
    if (bulk || list.length === 0) return;
    setBulk({ mode: "download", done: 0, total: list.length });
    for (let i = 0; i < list.length; i++) {
      try {
        const blob = await compositeBrandedPhoto(list[i].url, branding);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = downloadFileName(list[i].id, branding.studioName);
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch {
        // Skip a photo that fails to composite rather than aborting the batch.
      }
      setBulk({ mode: "download", done: i + 1, total: list.length });
      // Small gap so the browser doesn't drop rapid-fire download triggers.
      await new Promise((r) => setTimeout(r, 350));
    }
    setBulk(null);
  }

  async function shareGallery() {
    if (bulk) return;
    const nav = navigator as Navigator & { canShare?: (d?: ShareData) => boolean };
    const shareData: ShareData = {
      title: branding.eventTitle ?? "הגלריה שלי",
      text: branding.eventTitle ? `הגלריה שלי מ${branding.eventTitle}` : "הגלריה שלי",
      url: window.location.href,
    };
    try {
      if (nav.share) {
        await nav.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setBulk({ mode: "share", done: 1, total: 1 });
        setTimeout(() => setBulk(null), 2000);
      }
    } catch {
      /* user cancelled the share sheet */
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const session = loadGuestSession();
      if (!session) {
        router.replace("/gallery-entry");
        return;
      }

      setStatus("loading");
      const result = await getGallery(session.token);
      if (cancelled) return;

      if (!result.ok) {
        if (result.status === 401 || result.status === 404) {
          // Tampered/unknown/stale token - the session is unusable, not a
          // transient failure. Clear it and send the guest back to entry
          // instead of showing an error the guest can't act on.
          clearGuestSession();
          router.replace("/gallery-entry");
          return;
        }
        setErrorMessage("לא הצלחנו לטעון את הגלריה. בדקו את החיבור ונסו שוב.");
        setStatus("error");
        return;
      }

      if (result.data.personal_gallery.consent_required) {
        // Real enforcement point, not just the consent screen's job: never
        // render personal data for a guest who hasn't actually consented,
        // even if they navigated here directly.
        router.replace("/consent");
        return;
      }

      setData(result.data);
      setStatus("ready");
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-3xl text-primary">
          progress_activity
        </span>
      </div>
    );
  }

  if (status === "error" || !data || data.personal_gallery.consent_required) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          {errorMessage ?? "משהו השתבש. נסו שוב."}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl border border-outline-variant/40 px-6 py-3 font-medium text-on-surface transition-all hover:bg-white/5"
        >
          נסו שוב
        </button>
      </div>
    );
  }

  const personalPhotos: GuestPhoto[] = data.personal_gallery.consent_required
    ? []
    : data.personal_gallery.photos;
  const generalPhotos: GuestPhoto[] = data.photos;

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg flex-row-reverse items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled
              title="בקרוב"
              className="material-symbols-outlined cursor-not-allowed text-on-surface/30"
              aria-label="התראות (בקרוב)"
            >
              notifications
            </button>
            <button
              type="button"
              disabled
              title="בקרוב"
              className="material-symbols-outlined cursor-not-allowed text-on-surface/30"
              aria-label="פרופיל (בקרוב)"
            >
              account_circle
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-display text-2xl font-bold tracking-tight text-primary">
              Oura
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container-high">
              <OuraLogo variant="lockup" size={28} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            className="material-symbols-outlined text-on-surface transition-opacity hover:opacity-70"
            aria-label="חזרה"
          >
            arrow_forward
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-6 px-4 py-6">
        <section className="space-y-2">
          <h1 className="text-2xl font-bold text-on-surface md:text-3xl">
            הגלריה האישית שלך
          </h1>
          <p className="text-base leading-relaxed text-on-surface-variant">
            מצאנו{" "}
            <span
              className="font-bold text-primary"
              style={{ unicodeBidi: "isolate" }}
            >
              {personalPhotos.length}
            </span>{" "}
            תמונות שלך מתוך{" "}
            <span className="font-bold" style={{ unicodeBidi: "isolate" }}>
              {generalPhotos.length}
            </span>{" "}
            תמונות באירוע.
          </p>
        </section>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => downloadAll(personalPhotos.length > 0 ? personalPhotos : generalPhotos)}
            disabled={bulk !== null || (personalPhotos.length === 0 && generalPhotos.length === 0)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-lg font-bold text-on-primary shadow-lg transition-all active:scale-[0.98] disabled:opacity-60"
          >
            <span className={`material-symbols-outlined ${bulk?.mode === "download" ? "animate-spin" : ""}`}>
              {bulk?.mode === "download" ? "progress_activity" : "download"}
            </span>
            {bulk?.mode === "download" ? (
              <span style={{ unicodeBidi: "isolate" }}>{`מוריד ${bulk.done}/${bulk.total}...`}</span>
            ) : (
              "הורדת כל התמונות שלי"
            )}
          </button>
          <button
            type="button"
            onClick={shareGallery}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/40 py-3 font-medium text-on-surface transition-all active:bg-white/5"
          >
            <span className="material-symbols-outlined">share</span>
            {bulk?.mode === "share" ? "הקישור הועתק!" : "שיתוף הגלריה האישית"}
          </button>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="rounded-xl bg-primary p-2.5">
            <span
              className="material-symbols-outlined text-on-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-primary">
              {personalPhotos.length > 0
                ? "זיהוי פנים הושלם בהצלחה"
                : "עדיין מחפשים אותך בתמונות"}
            </h3>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              {personalPhotos.length > 0
                ? "כל התמונות סוננו עבורך באופן אוטומטי"
                : "נעדכן אותך ברגע שנמצא תמונות שאתה/את מופיע/ה בהן"}
            </p>
          </div>
        </div>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={`shrink-0 whitespace-nowrap rounded-full px-6 py-2.5 text-sm transition-all ${
                activeFilter === filter
                  ? "bg-primary font-bold text-on-primary shadow-md"
                  : "border border-white/5 bg-surface-container font-medium text-on-surface-variant hover:bg-white/10"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {personalPhotos.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-on-surface-variant">
              התמונות האישיות שלך
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {personalPhotos.map((photo, i) => (
                <PhotoTile
                  key={photo.id}
                  photo={photo}
                  aspect={tileAspect(i)}
                  matched
                  onOpen={() => setViewer({ list: personalPhotos, index: i })}
                />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3 pb-8">
          {generalPhotos.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {generalPhotos.map((photo, i) => (
                <PhotoTile
                  key={photo.id}
                  photo={photo}
                  aspect={tileAspect(i)}
                  onOpen={() => setViewer({ list: generalPhotos, index: i })}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-white/5 bg-surface-container/60 p-4 text-center text-sm text-on-surface-variant">
              טרם הועלו תמונות לאירוע הזה.
            </p>
          )}
        </section>
      </main>

      <BottomNav active="gallery" />

      {viewer && (
        <PhotoViewer
          photos={viewer.list}
          startIndex={viewer.index}
          branding={branding}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}
