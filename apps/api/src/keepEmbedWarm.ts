// Keep the self-hosted face-embed service (Cloud Run `oura-embed`) warm.
//
// WHY THIS EXISTS (see SUMMARY.md 2026-07-14 + MISTAKES.md): the embed service
// scales to zero when idle. The FIRST selfie after an idle period has to cold
// start the container AND load the InsightFace model (>25s), which blew past the
// selfie route's timeout and surfaced to the guest as an intermittent "face not
// recognized" — that later "fixed itself" once the container was warm. The
// durable cure is keeping at least one instance alive at all times.
//
// We do NOT need GCP access to achieve that: any request to the service resets
// Cloud Run's scale-to-zero idle timer (~15 min by default). A cheap,
// unauthenticated GET /health every few minutes (wired to a `*/5 * * * *` cron)
// keeps exactly one instance perpetually warm, so a real guest selfie always
// hits a hot container and matches on the first try. Setting Cloud Run
// min-instances=1 in the GCP console would do the same thing, but this keeps the
// fix entirely in code and self-deploying with the Worker.
import type { Env } from './index';

export async function keepEmbedWarm(env: Env): Promise<void> {
  if (!env.EMBED_SERVICE_URL) return;
  try {
    // Bounded so a hung request can't stall the scheduled invocation.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(`${env.EMBED_SERVICE_URL}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      // A 200 means the container is up and the model is loaded. A cold start
      // triggered by THIS ping still counts as success: it warms the instance
      // ahead of the next real guest selfie, which is the whole point.
      if (!res.ok) console.warn(`keep-warm ping non-ok: ${res.status}`);
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    // Never throw from keep-warm — a transient miss is harmless (the next tick
    // retries in 5 min, and the selfie route's own retry still covers a guest
    // who happens to arrive during a rare cold window).
    console.warn('keep-warm ping failed', err);
  }
}
