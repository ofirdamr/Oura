"""Oura face-embedding service — self-hosted InsightFace/ArcFace, never a per-call managed API.

POST /embed accepts raw image bytes and returns per-detected-face bounding boxes,
L2-normalized 512-dim ArcFace embeddings, and detection scores. It never persists
anything itself — callers (the Cloudflare Worker's queue consumer and guest
selfie route) decide what to store, and per the Stage 2 zero-retention design a
guest's own selfie embedding is never written anywhere, only used transiently.
"""
import os

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, Request
from insightface.app import FaceAnalysis

EMBED_SERVICE_TOKEN = os.environ.get("EMBED_SERVICE_TOKEN")

app = FastAPI()
_face_app: FaceAnalysis | None = None


@app.on_event("startup")
def load_model() -> None:
    global _face_app
    _face_app = FaceAnalysis(name="buffalo_l")
    _face_app.prepare(ctx_id=-1)  # CPU; pilot scale doesn't need GPU


def _check_auth(request: Request) -> None:
    if not EMBED_SERVICE_TOKEN:
        return  # local dev without a configured token
    header = request.headers.get("authorization", "")
    if header != f"Bearer {EMBED_SERVICE_TOKEN}":
        raise HTTPException(status_code=401, detail="unauthorized")


@app.get("/health")
def health() -> dict:
    return {"ok": True, "model": "buffalo_l"}


@app.post("/embed")
async def embed(request: Request) -> dict:
    _check_auth(request)
    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="empty_body")

    arr = np.frombuffer(body, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="decode_failed")

    assert _face_app is not None
    faces = _face_app.get(img)
    return {
        "faces": [
            {
                "bbox": face.bbox.tolist(),
                "embedding": face.normed_embedding.tolist(),
                "detection_score": float(face.det_score),
            }
            for face in faces
        ]
    }
