"use client";

// Guest selfie-capture screen (Stage 2 face-matching). Built from the founder's
// Stitch export (oura_ai_desktop.html / oura_ai_mobile.html) - translated onto
// the app's actual established theme tokens (globals.css), NOT the export's
// ad-hoc local Tailwind config, since several of its token names collide with
// different meanings in the real system (e.g. the export's `text-primary` is
// white; the app's `--color-primary` is the copper accent - a literal class
// copy would have silently recolored this text orange). Also fixed a real bug
// in the desktop export: the capture button's Hebrew text was set to
// font-headline-md (Hanken Grotesk), which has no Hebrew glyphs (CLAUDE.md
// guardrail) - moved to font-sans (Rubik) like every other Hebrew element here.
// Dropped the export's CDN Tailwind/Google-Fonts <script>/<link> tags entirely
// (CLAUDE.md: no CDN tags in production builds) in favor of the app's already-
// bundled fonts/Tailwind build.
//
// Sits between /consent and /gift-reveal in the guest sequence. The
// self-hosted embedding service (packages/processing-pipeline) is now
// deployed to Cloud Run, so /consent's redirect target was flipped from
// /gallery to /selfie in the same pass as the embedding-service deploy - this
// screen is now part of the real, live guest flow, not just direct-URL-only.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getGallery, postSelfie } from "@/lib/api";
import { loadGuestSession } from "@/lib/guestSession";
import { OuraLogo } from "@/components/brand/OuraLogo";

type Phase = "loading" | "camera" | "review" | "submitting" | "camera_error";

export default function SelfiePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Consent + session gate - reuses the same pattern as /gallery: a guest
  // reaching this URL directly (bookmark, back button, shared link) without
  // ever accepting biometric consent must not get a camera prompt.
  useEffect(() => {
    let cancelled = false;

    async function verifyAndStartCamera() {
      const session = loadGuestSession();
      if (!session) {
        router.replace("/gallery-entry");
        return;
      }

      const result = await getGallery(session.token);
      if (cancelled) return;

      if (!result.ok) {
        router.replace("/gallery-entry");
        return;
      }
      if (result.data.personal_gallery.consent_required) {
        router.replace("/consent");
        return;
      }

      setToken(session.token);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setPhase("camera");
      } catch {
        setErrorMessage(
          "לא הצלחנו לקבל גישה למצלמה. אפשר לאשר גישה בהגדרות הדפדפן, או לדלג לגלריה הכללית.",
        );
        setPhase("camera_error");
      }
    }

    verifyAndStartCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function handleCapture() {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedBlob(blob);
        setCapturedUrl(URL.createObjectURL(blob));
        stopCamera();
        setPhase("review");
      },
      "image/jpeg",
      0.9,
    );
  }

  async function handleRetake() {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedBlob(null);
    setCapturedUrl(null);
    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setPhase("camera");
    } catch {
      setErrorMessage("לא הצלחנו לקבל גישה למצלמה. אפשר לדלג לגלריה הכללית.");
      setPhase("camera_error");
    }
  }

  async function handleConfirmSubmit() {
    if (!token || !capturedBlob) return;
    setPhase("submitting");
    setErrorMessage(null);

    const result = await postSelfie(token, capturedBlob);

    if (!result.ok) {
      if (result.status === 422) {
        setErrorMessage("לא זיהינו פנים בבירור בתמונה. אפשר לצלם שוב.");
        setPhase("review");
        return;
      }
      if (result.status === 403) {
        router.replace("/consent");
        return;
      }
      // embed_service_unavailable (502) or network_error - matching genuinely
      // isn't available right now, not the guest's fault. Move them on rather
      // than stall them on a broken step.
      router.push("/gift-reveal");
      return;
    }

    // 200 but no cluster passed the match threshold: the guest was NOT found in
    // the event photos. Silently sending them to an empty personal gallery is
    // exactly what read as "face recognition is broken" - tell them and let
    // them retake a clearer selfie instead.
    if (!result.data.matched) {
      setErrorMessage(
        "לא הצלחנו למצוא אתכם בתמונות האירוע. נסו סלפי ברור יותר - מול המצלמה, בתאורה טובה ובלי משקפי שמש.",
      );
      setPhase("review");
      return;
    }

    router.push("/gift-reveal");
  }

  function handleSkip() {
    stopCamera();
    router.push("/gallery");
  }

  return (
    <main className="relative mx-auto flex min-h-screen max-w-sm flex-col items-center overflow-x-hidden p-6 md:p-10">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(255,138,117,0.15)_0%,_transparent_50%)]" />

      <header className="relative z-10 mb-6 mt-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-container-high">
          <OuraLogo size={56} />
        </div>
      </header>

      <section className="relative z-10 mb-6 w-full text-center">
        <h1 className="mb-2 text-2xl font-semibold leading-tight text-on-surface md:text-3xl">
          בואו נסרוק סלפי מהיר
        </h1>
        <p className="px-2 leading-relaxed text-on-surface-variant">
          התמונה שלך משמשת רק להשוואה מול תמונות האירוע ונמחקת מיד לאחר
          ההתאמה - היא לעולם לא נשמרת.
        </p>
      </section>

      <div className="relative z-10 w-full overflow-hidden rounded-2xl border border-white/5 bg-surface shadow-xl">
        <div className="relative aspect-square w-full">
          {phase === "loading" && (
            <div className="flex h-full w-full items-center justify-center">
              <span className="material-symbols-outlined animate-spin text-3xl text-primary">
                progress_activity
              </span>
            </div>
          )}

          {phase === "camera_error" && (
            <div className="flex h-full w-full items-center justify-center p-6 text-center">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant">
                no_photography
              </span>
            </div>
          )}

          {/* Live camera preview - mirrored (scale-x-[-1]) to match how a
              selfie camera is expected to behave (not flipped in the actual
              captured/submitted frame, only in what the guest sees). */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`h-full w-full -scale-x-100 object-cover ${
              phase === "camera" ? "block" : "hidden"
            }`}
          />

          {capturedUrl && (phase === "review" || phase === "submitting") && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={capturedUrl}
              alt=""
              className="h-full w-full -scale-x-100 object-cover"
            />
          )}

          {(phase === "camera" || phase === "review") && (
            <>
              <div className="pointer-events-none absolute start-6 top-6 h-6 w-6 rounded-tl-md border-s-2 border-t-2 border-primary" />
              <div className="pointer-events-none absolute end-6 top-6 h-6 w-6 rounded-tr-md border-e-2 border-t-2 border-primary" />
              <div className="pointer-events-none absolute bottom-6 start-6 h-6 w-6 rounded-bl-md border-b-2 border-s-2 border-primary" />
              <div className="pointer-events-none absolute bottom-6 end-6 h-6 w-6 rounded-br-md border-b-2 border-e-2 border-primary" />
            </>
          )}
        </div>
      </div>

      <div className="relative z-10 mt-8 w-full space-y-3">
        {errorMessage && (
          <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-center text-sm text-error">
            {errorMessage}
          </p>
        )}

        {phase === "camera" && (
          <button
            type="button"
            onClick={handleCapture}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-on-primary shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              photo_camera
            </span>
            צילום תמונה
          </button>
        )}

        {(phase === "review" || phase === "submitting") && (
          <>
            <button
              type="button"
              onClick={handleConfirmSubmit}
              disabled={phase === "submitting"}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-on-primary shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-70"
            >
              {phase === "submitting" ? (
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined">check_circle</span>
              )}
              אישור ושליחה
            </button>
            <button
              type="button"
              onClick={handleRetake}
              disabled={phase === "submitting"}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/40 py-4 font-medium text-on-surface transition-all active:bg-white/5 disabled:opacity-70"
            >
              צילום מחדש
            </button>
          </>
        )}

        <button
          type="button"
          onClick={handleSkip}
          disabled={phase === "submitting"}
          className="w-full py-2 text-center text-sm text-on-surface-variant underline underline-offset-4 transition-colors hover:text-primary disabled:opacity-70"
        >
          לא תודה, אני אעבור לגלריה הכללית
        </button>
      </div>
    </main>
  );
}
