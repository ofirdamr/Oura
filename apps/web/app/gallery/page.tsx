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

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BottomNav } from "@/components/guest/BottomNav";
import { getGallery, type GalleryResponse, type GuestPhoto } from "@/lib/api";
import { clearGuestSession, loadGuestSession } from "@/lib/guestSession";
import { OuraLogo } from "@/components/brand/OuraLogo";

const FILTERS = ["כל התמונות", "חופה", "ריקודים", "קבלת פנים"];

// Fetch each photo's bytes from the API Worker's /media route (CORS is open on
// the API, so a cross-origin blob fetch is allowed) and name them sequentially.
async function fetchPhotoFiles(
  photos: GuestPhoto[],
): Promise<{ name: string; blob: Blob }[]> {
  const out: { name: string; blob: Blob }[] = [];
  for (let i = 0; i < photos.length; i++) {
    const res = await fetch(photos[i].url);
    if (!res.ok) throw new Error(`media_fetch_${res.status}`);
    const blob = await res.blob();
    const ext = blob.type.split("/")[1]?.split("+")[0] || "jpg";
    out.push({ name: `oura-${String(i + 1).padStart(2, "0")}.${ext}`, blob });
  }
  return out;
}

function PhotoTile({
  photo,
  aspect,
  matched,
}: {
  photo: GuestPhoto;
  aspect: string;
  matched?: boolean;
}) {
  return (
    <div
      className={`${aspect} relative overflow-hidden rounded-2xl border border-white/5 bg-surface-container shadow-md`}
    >
      <Image
        src={photo.url}
        alt=""
        fill
        sizes="(min-width: 512px) 240px, 50vw"
        className="object-cover"
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
  const [action, setAction] = useState<"idle" | "downloading" | "sharing">("idle");
  const [actionNote, setActionNote] = useState<string | null>(null);

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
  // Personal photos when the guest has matches; otherwise fall back to the full
  // event gallery so download/share are never dead buttons (empty personal
  // gallery = no successful selfie match yet, not "nothing to download").
  const hasPersonal = personalPhotos.length > 0;
  const downloadable = hasPersonal ? personalPhotos : generalPhotos;

  async function handleDownloadAll() {
    if (action !== "idle" || downloadable.length === 0) return;
    setAction("downloading");
    setActionNote(null);
    try {
      const { default: JSZip } = await import("jszip");
      const files = await fetchPhotoFiles(downloadable);
      const zip = new JSZip();
      for (const f of files) zip.file(f.name, f.blob);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "oura-gallery.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setActionNote("ההורדה נכשלה. בדקו את החיבור ונסו שוב.");
    } finally {
      setAction("idle");
    }
  }

  async function handleShare() {
    if (action !== "idle" || downloadable.length === 0) return;
    setAction("sharing");
    setActionNote(null);
    try {
      // Best action for a guest: send the actual photos through the native
      // share sheet (WhatsApp, etc.). Fall back to sharing/copying a link when
      // the browser can't share files.
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      const files = (await fetchPhotoFiles(downloadable)).map(
        (f) => new File([f.blob], f.name, { type: f.blob.type }),
      );
      if (nav.canShare && nav.canShare({ files })) {
        await navigator.share({ files, title: "הגלריה שלי מהאירוע" });
      } else if (navigator.share) {
        await navigator.share({
          title: "הגלריה שלי מהאירוע",
          text: "צפו בתמונות שלי מהאירוע ב-Oura",
          url: window.location.origin,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.origin);
        setActionNote("הקישור הועתק");
      } else {
        setActionNote("שיתוף אינו נתמך בדפדפן הזה.");
      }
    } catch (err) {
      // A cancelled share sheet throws AbortError - that's a user choice, not
      // a failure worth surfacing.
      if ((err as Error)?.name !== "AbortError") {
        setActionNote("השיתוף נכשל. נסו שוב.");
      }
    } finally {
      setAction("idle");
    }
  }

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
            onClick={handleDownloadAll}
            disabled={action !== "idle" || downloadable.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-lg font-bold text-on-primary shadow-lg transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
          >
            <span
              className={`material-symbols-outlined ${action === "downloading" ? "animate-spin" : ""}`}
            >
              {action === "downloading" ? "progress_activity" : "download"}
            </span>
            {action === "downloading"
              ? "מכינים את ההורדה..."
              : hasPersonal
                ? "הורדת כל התמונות שלי"
                : "הורדת כל תמונות האירוע"}
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={action !== "idle" || downloadable.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/40 py-3 font-medium text-on-surface transition-all active:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span
              className={`material-symbols-outlined ${action === "sharing" ? "animate-spin" : ""}`}
            >
              {action === "sharing" ? "progress_activity" : "share"}
            </span>
            {action === "sharing"
              ? "פותחים שיתוף..."
              : hasPersonal
                ? "שיתוף הגלריה האישית"
                : "שיתוף תמונות האירוע"}
          </button>
          {actionNote && (
            <p className="text-center text-xs text-on-surface-variant">{actionNote}</p>
          )}
        </div>

        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-4">
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
                {hasPersonal ? "זיהוי פנים הושלם בהצלחה" : "עדיין לא מצאנו אותך בתמונות"}
              </h3>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                {hasPersonal
                  ? "כל התמונות סוננו עבורך באופן אוטומטי"
                  : "צלמו סלפי מהיר וברור כדי שנמצא את התמונות שאתם מופיעים בהן"}
              </p>
            </div>
          </div>
          {!hasPersonal && (
            <button
              type="button"
              onClick={() => router.push("/selfie")}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-on-primary shadow-md transition-all active:scale-[0.98]"
            >
              <span className="material-symbols-outlined">photo_camera</span>
              מצאו את התמונות שלי
            </button>
          )}
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
                <PhotoTile key={photo.id} photo={photo} aspect={tileAspect(i)} matched />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3 pb-8">
          {generalPhotos.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {generalPhotos.map((photo, i) => (
                <PhotoTile key={photo.id} photo={photo} aspect={tileAspect(i)} />
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
