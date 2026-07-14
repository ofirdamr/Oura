// Shared HTTP client to the self-hosted face-embedding service
// (packages/processing-pipeline). One code path talks to the embed service —
// used by both the photo-ingest queue consumer and the guest selfie route —
// so the request/response contract can't drift between the two callers.

export type EmbedFace = {
  bbox: [number, number, number, number];
  embedding: number[];
  detection_score: number;
};

export type EmbedEnv = {
  EMBED_SERVICE_URL: string;
  EMBED_SERVICE_TOKEN: string;
};

// Bounded so a stalled Cloud Run response (observed live: a request that
// never resolves, not even with an error) fails fast and lets the caller
// retry, instead of hanging for the queue consumer's entire execution
// budget — which is what happened before this existed.
const EMBED_TIMEOUT_MS = 25_000;

export async function embed(bytes: ArrayBuffer, env: EmbedEnv): Promise<EmbedFace[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${env.EMBED_SERVICE_URL}/embed`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.EMBED_SERVICE_TOKEN}`,
        'Content-Type': 'application/octet-stream',
      },
      body: bytes,
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) throw new Error('embed_service_timeout');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    throw new Error(`embed_service_error_${res.status}`);
  }
  const data = (await res.json()) as { faces: EmbedFace[] };
  return data.faces;
}

// Guest-facing wrapper: the embed service (Cloud Run) can scale to zero, and a
// cold start — spinning up the container and loading the InsightFace model —
// routinely exceeds EMBED_TIMEOUT_MS on the FIRST request. Without a retry that
// single timeout surfaces to the guest as "face not recognized," which then
// "fixes itself" on a later attempt once the container is warm. Retrying here
// absorbs the cold start so a returning guest doesn't see an intermittent miss.
// Transient only: a timeout or 5xx is retried; a real 4xx (e.g. bad auth) is not.
export async function embedWithRetry(
  bytes: ArrayBuffer,
  env: EmbedEnv,
  attempts = 3,
): Promise<EmbedFace[]> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await embed(bytes, env);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const transient =
        msg === 'embed_service_timeout' ||
        /^embed_service_error_5\d\d$/.test(msg) ||
        /^embed_service_error_429$/.test(msg);
      if (!transient || i === attempts - 1) throw err;
      // Short backoff to let a cold container finish warming before the retry.
      await new Promise((r) => setTimeout(r, 1_500 * (i + 1)));
    }
  }
  throw lastErr;
}
