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
import { savePhotos, sharePhotos } from "@/lib/photoActions";

const STUDIO_NAME = "Photo Santos";

// Uniform square tiles — a clean, premium, scannable grid (like Apple Photos /
// Instagram), NOT a random-height collage. The old deterministic aspect variety
// looked like a broken masonry layout and served no purpose.
function PhotoTile({
  photo,
  matched,
  onOpen,
}: {
  photo: GuestPhoto;
  matched?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="פתיחת התמונה במסך מלא"
      className="group relative block aspect-square w-full overflow-hidden rounded-xl bg-surface-container transition-transform active:scale-[0.97]"
    >
      <Image
        src={photo.url}
        alt=""
        fill
        sizes="(min-width: 512px) 170px, 33vw"
        className="object-cover transition-transform duration-300 group-hover:scale-105"
      />
      {matched && (
        <div className="absolute end-1.5 top-1.5 flex items-center justify-center rounded-full bg-black/60 p-1 backdrop-blur-md">
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

export default function GalleryPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "mine">("all");
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

  // Composite a whole set into branded JPEGs, then hand them to the phone in ONE
  // action: save-all lands in Photos (share sheet → "Save N Images"), share-all
  // opens the sheet with a friendly caption. Never a folder of Files, never a
  // raw URL.
  async function bulkAction(mode: "download" | "share", list: GuestPhoto[]) {
    if (bulk || list.length === 0) return;
    setBulk({ mode, done: 0, total: list.length });
    const items: { blob: Blob; filename: string }[] = [];
    for (let i = 0; i < list.length; i++) {
      try {
        const blob = await compositeBrandedPhoto(list[i].url, branding);
        items.push({ blob, filename: downloadFileName(list[i].id, branding.studioName) });
      } catch {
        // Skip a photo that fails to composite rather than aborting the batch.
      }
      setBulk({ mode, done: i + 1, total: list.length });
    }
    if (mode === "download") await savePhotos(items);
    else {
      const caption = branding.eventTitle ? `${branding.eventTitle} · ${branding.studioName}` : branding.studioName;
      await sharePhotos(items, caption);
    }
    setBulk(null);
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
  const matchedIds = new Set(personalPhotos.map((p) => p.id));
  // Guard against a stale "mine" filter when there are no matches.
  const activeFilter = filter === "mine" && personalPhotos.length > 0 ? "mine" : "all";
  const shownPhotos = activeFilter === "mine" ? personalPhotos : generalPhotos;

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
          {/* Transparent logo sits directly on the app background — no tinted
              box behind it (that box, not the PNG, was the visible "not
              transparent" square). */}
          <div className="flex items-center gap-2">
            <span className="font-display text-2xl font-bold tracking-tight text-primary">
              Oura
            </span>
            <OuraLogo variant="icon" size={30} />
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

        {(() => {
          const targetSet = personalPhotos.length > 0 ? personalPhotos : generalPhotos;
          const noPhotos = targetSet.length === 0;
          return (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => bulkAction("download", targetSet)}
                disabled={bulk !== null || noPhotos}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-lg font-bold text-on-primary shadow-lg transition-all active:scale-[0.98] disabled:opacity-60"
              >
                <span className={`material-symbols-outlined ${bulk?.mode === "download" ? "animate-spin" : ""}`}>
                  {bulk?.mode === "download" ? "progress_activity" : "download"}
                </span>
                {bulk?.mode === "download" ? (
                  <span style={{ unicodeBidi: "isolate" }}>{`מכין ${bulk.done}/${bulk.total}...`}</span>
                ) : (
                  "שמירת התמונות שלי"
                )}
              </button>
              <button
                type="button"
                onClick={() => bulkAction("share", targetSet)}
                disabled={bulk !== null || noPhotos}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/40 py-3 font-medium text-on-surface transition-all active:bg-white/5 disabled:opacity-60"
              >
                <span className={`material-symbols-outlined ${bulk?.mode === "share" ? "animate-spin" : ""}`}>
                  {bulk?.mode === "share" ? "progress_activity" : "ios_share"}
                </span>
                {bulk?.mode === "share" ? (
                  <span style={{ unicodeBidi: "isolate" }}>{`מכין ${bulk.done}/${bulk.total}...`}</span>
                ) : (
                  "שיתוף התמונות שלי"
                )}
              </button>
            </div>
          );
        })()}

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

        {/* Real, working filter — "all" vs "my photos" (face-matched), both
            backed by live data. Only shown when there's actually a personal set
            to switch to; no fake, dead category chips. */}
        {personalPhotos.length > 0 && (
          <div className="flex gap-2">
            {([
              { key: "all" as const, label: "כל התמונות", count: generalPhotos.length },
              { key: "mine" as const, label: "התמונות שלי", count: personalPhotos.length },
            ]).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm transition-all ${
                  filter === f.key
                    ? "bg-primary font-bold text-on-primary shadow-md"
                    : "border border-white/5 bg-surface-container font-medium text-on-surface-variant hover:bg-white/10"
                }`}
              >
                {f.label}
                <span
                  dir="ltr"
                  className={`rounded-full px-1.5 text-xs ${filter === f.key ? "bg-black/15" : "bg-white/5"}`}
                >
                  {f.count}
                </span>
              </button>
            ))}
          </div>
        )}

        <section className="space-y-3 pb-8">
          {shownPhotos.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5">
              {shownPhotos.map((photo, i) => (
                <PhotoTile
                  key={photo.id}
                  photo={photo}
                  matched={matchedIds.has(photo.id)}
                  onOpen={() => setViewer({ list: shownPhotos, index: i })}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-white/5 bg-surface-container/60 p-4 text-center text-sm text-on-surface-variant">
              {filter === "mine"
                ? "עדיין לא מצאנו תמונות שאתה/את מופיע/ה בהן."
                : "טרם הועלו תמונות לאירוע הזה."}
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
