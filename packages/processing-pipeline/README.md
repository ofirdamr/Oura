# processing-pipeline — face-embedding service

Self-hosted InsightFace/ArcFace (`buffalo_l`), never a per-call managed API
(CLAUDE.md guardrail). Portable container, host (Fly.io vs Cloud Run) not yet
decided — build once, deploy wherever.

## API

- `GET /health` → `{ ok: true, model: "buffalo_l" }`
- `POST /embed` — body: raw image bytes (`image/jpeg` or `image/png`).
  `Authorization: Bearer <EMBED_SERVICE_TOKEN>` required once that env var is
  set (unset = open, local-dev only).
  Returns `{ faces: [{ bbox: [x1,y1,x2,y2], embedding: number[512], detection_score }] }`.
  `faces: []` (not an error) when no face is detected — a normal case, not
  exceptional (e.g. a photo of scenery/food).

Nothing here is ever persisted by this service itself — it's a pure function
of image bytes in, face data out. Storage decisions live entirely in the
caller (`apps/api`'s queue consumer and `POST /guests/:token/selfie` route).

## Local dev

```bash
docker build -t oura-embed .
docker run -p 8080:8080 oura-embed
curl -X POST localhost:8080/embed --data-binary @test.jpg -H "Content-Type: image/jpeg"
```

## Deploy (not yet done — no Fly.io/Cloud Run credentials in the dev sandbox)

Either target works unmodified against this `Dockerfile`:

```bash
# Fly.io
fly launch --now

# Cloud Run
gcloud run deploy oura-embed --source . --region <region> --no-allow-unauthenticated
```

Whichever host is picked, set `EMBED_SERVICE_TOKEN` on the host and point the
Worker's `EMBED_SERVICE_URL`/`EMBED_SERVICE_TOKEN` secrets at it.
