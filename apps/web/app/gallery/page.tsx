"use client";

// Guest-facing Personal Gallery: face-matched results for one guest within one
// event. Now wired to the real GET /gallery/:token (apps/api). Tile rendering
// stays a placeholder icon-in-a-box (the API only returns a /media/<key> stub
// URL, no real image serving yet) - only the DATA underneath is real.
//
// Consent enforcement lives here too, not just on /consent: a guest who lands
// on this URL directly (bookmarked link, back button, shared link, etc.)
// without ever accepting the biometric-consent gate must not see personal
// results - so if the API says personal_gallery.consent_required, we redirect
// to /consent instead of rendering anything personal. This mirrors the
// server-side guardrail (face_embeddings is never queried pre-consent) with a
// client-side one, per the task brief.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/guest/BottomNav";
import { getGallery, type GalleryResponse, type GuestPhoto } from "@/lib/api";
import { clearGuestSession, loadGuestSession } from "@/lib/guestSession";

const FILTERS = ["כל התמונות", "חופה", "ריקודים", "קבלת פנים"];

function PhotoTile({ aspect, matched }: { aspect: string; matched?: boolean }) {
  return (
    <div
      className={`${aspect} relative overflow-hidden rounded-2xl border border-white/5 bg-surface-container shadow-md`}
    >
      <div className="flex h-full w-full items-center justify-center">
        <span className="material-symbols-outlined text-3xl text-on-surface-variant/30">
          image
        </span>
      </div>
      {matched && (
        <div className="absolute start-2 top-2 flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/70 px-2 py-1 backdrop-blur-md">
          <span
            className="material-symbols-outlined text-primary"
            style={{ fontSize: "14px", fontVariationSettings: "'FILL' 1" }}
          >
            verified
          </span>
        </div>
      )}
    </div>
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
              className="material-symbols-outlined text-on-surface transition-opacity hover:opacity-70"
              aria-label="התראות"
            >
              notifications
            </button>
            <button
              type="button"
              className="material-symbols-outlined text-on-surface transition-opacity hover:opacity-70"
              aria-label="פרופיל"
            >
              account_circle
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-display text-2xl font-bold tracking-tight text-primary">
              Oura
            </span>
          </div>
          <button
            type="button"
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
          <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-lg font-bold text-on-primary shadow-lg transition-all active:scale-[0.98]">
            <span className="material-symbols-outlined">download</span>
            הורדת כל התמונות שלי
          </button>
          <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/40 py-3 font-medium text-on-surface transition-all active:bg-white/5">
            <span className="material-symbols-outlined">share</span>
            שיתוף הגלריה האישית
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
                <PhotoTile key={photo.id} aspect={tileAspect(i)} matched />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3 pb-8">
          <h2 className="text-sm font-bold text-on-surface-variant">
            כל התמונות מהאירוע
          </h2>
          {generalPhotos.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {generalPhotos.map((photo, i) => (
                <PhotoTile key={photo.id} aspect={tileAspect(i)} />
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
    </div>
  );
}
