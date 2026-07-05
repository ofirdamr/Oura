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
