"""Oura face-embedding service — self-hosted InsightFace/ArcFace, never a per-call managed API.

POST /embed accepts raw image bytes and returns per-detected-face bounding boxes,
L2-normalized 512-dim ArcFace embeddings, and detection scores. It never persists
anything itself — callers (the Cloudflare Worker's queue consumer and guest
selfie route) decide what to store, and per the Stage 2 zero-retention design a
guest's own selfie embedding is never written anywhere, only used transiently.

POST /social-frame accepts raw image bytes and query params to produce a social-
ready variant: focal-point 4:5 crop (feed) or 9:16 blurred-backdrop canvas (story).
"""
import io
import os
from typing import Optional

import cv2
import numpy as np
import open_clip
import torch
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import Response
from insightface.app import FaceAnalysis
from PIL import Image, ImageFilter

EMBED_SERVICE_TOKEN = os.environ.get("EMBED_SERVICE_TOKEN")

app = FastAPI()
_face_app: FaceAnalysis | None = None
_clip_model: Optional[torch.nn.Module] = None
_clip_preprocess = None
_clip_text_features: Optional[torch.Tensor] = None

# Fixed wedding category labels — order matches _clip_text_features rows.
_CATEGORY_KEYS = ["couple", "ceremony", "dances", "reception", "main_course"]
_CATEGORY_PROMPTS = [
    "bride and groom couple portrait, romantic and intimate, just the two of them",
    "Jewish wedding ceremony under a chuppah canopy with rabbi and guests watching",
    "hora circle dancing on a wedding dance floor, people dancing together",
    "cocktail reception with people mingling and waiters serving appetizers",
    "guests seated at dinner tables eating a wedding banquet meal with speeches",
]
# CLIP confidence floor — scores below this yield null (photo genuinely ambiguous).
_CLIP_MIN_SCORE = 0.20


@app.on_event("startup")
def load_models() -> None:
    global _face_app, _clip_model, _clip_preprocess, _clip_text_features

    _face_app = FaceAnalysis(name="buffalo_l")
    _face_app.prepare(ctx_id=-1)  # CPU; pilot scale doesn't need GPU

    # Load CLIP ViT-B/32 (weights baked into image at build time).
    model, _, preprocess = open_clip.create_model_and_transforms("ViT-B-32", pretrained="openai")
    model.eval()
    tokenizer = open_clip.get_tokenizer("ViT-B-32")
    texts = tokenizer(_CATEGORY_PROMPTS)
    with torch.no_grad():
        text_feats = model.encode_text(texts)
        text_feats = text_feats / text_feats.norm(dim=-1, keepdim=True)
    _clip_model = model
    _clip_preprocess = preprocess
    _clip_text_features = text_feats


def _check_auth(request: Request) -> None:
    if not EMBED_SERVICE_TOKEN:
        return  # local dev without a configured token
    header = request.headers.get("authorization", "")
    if header != f"Bearer {EMBED_SERVICE_TOKEN}":
        raise HTTPException(status_code=401, detail="unauthorized")


@app.get("/health")
def health() -> dict:
    return {"ok": True, "models": ["buffalo_l", "clip-ViT-B-32"]}


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


@app.post("/classify-category")
async def classify_category(request: Request) -> dict:
    """Zero-cost CLIP-based wedding photo category classification.

    Returns {"category": "<key>"|null, "scores": {<key>: float, ...}}.
    Null when top similarity score is below _CLIP_MIN_SCORE (ambiguous photo).
    """
    _check_auth(request)
    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="empty_body")

    try:
        img = Image.open(io.BytesIO(body)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="decode_failed")

    assert _clip_model is not None and _clip_preprocess is not None and _clip_text_features is not None

    image_input = _clip_preprocess(img).unsqueeze(0)
    with torch.no_grad():
        image_feats = _clip_model.encode_image(image_input)
        image_feats = image_feats / image_feats.norm(dim=-1, keepdim=True)

    sims = (image_feats @ _clip_text_features.T).squeeze(0)
    scores = {k: round(float(sims[i]), 3) for i, k in enumerate(_CATEGORY_KEYS)}
    best_idx = int(sims.argmax())
    best_score = float(sims[best_idx])

    category = _CATEGORY_KEYS[best_idx] if best_score >= _CLIP_MIN_SCORE else None
    return {"category": category, "scores": scores}


def _focal_crop(img: Image.Image, target_w: int, target_h: int, focal_x: float, focal_y: float) -> Image.Image:
    """Crop img to target_w×target_h anchored around (focal_x, focal_y) as 0–1 fractions."""
    src_w, src_h = img.size
    # Scale so the shorter side fills the target dimension
    scale = max(target_w / src_w, target_h / src_h)
    scaled_w = round(src_w * scale)
    scaled_h = round(src_h * scale)
    scaled = img.resize((scaled_w, scaled_h), Image.LANCZOS)

    # Anchor crop box around the focal point, clamping to image bounds
    cx = round(focal_x * scaled_w)
    cy = round(focal_y * scaled_h)
    left = max(0, min(cx - target_w // 2, scaled_w - target_w))
    top = max(0, min(cy - target_h // 2, scaled_h - target_h))
    return scaled.crop((left, top, left + target_w, top + target_h))


def _story_canvas(
    img: Image.Image,
    canvas_w: int,
    canvas_h: int,
    watermark_top: str,
    watermark_bottom: str,
) -> Image.Image:
    """9:16 canvas: blurred+darkened backdrop + centered sharp photo + text watermarks in margins."""
    src_w, src_h = img.size

    # --- backdrop: scale to cover canvas, blur, darken ---
    scale = max(canvas_w / src_w, canvas_h / src_h)
    bg_w, bg_h = round(src_w * scale), round(src_h * scale)
    backdrop = img.resize((bg_w, bg_h), Image.LANCZOS)
    # Crop centered
    bx = (bg_w - canvas_w) // 2
    by = (bg_h - canvas_h) // 2
    backdrop = backdrop.crop((bx, by, bx + canvas_w, by + canvas_h))
    backdrop = backdrop.filter(ImageFilter.GaussianBlur(radius=40))
    # Darken 28%
    darken = Image.new("RGB", (canvas_w, canvas_h), (0, 0, 0))
    backdrop = Image.blend(backdrop, darken, 0.28)

    # --- sharp photo: scale to fit canvas width, center vertically ---
    photo_w = canvas_w
    photo_h = round(src_h * (canvas_w / src_w))
    if photo_h > canvas_h:
        photo_h = canvas_h
        photo_w = round(src_w * (canvas_h / src_h))
    photo = img.resize((photo_w, photo_h), Image.LANCZOS)
    photo_x = (canvas_w - photo_w) // 2
    photo_y = (canvas_h - photo_h) // 2

    canvas = backdrop.copy()
    canvas.paste(photo, (photo_x, photo_y))

    # --- text watermarks in top/bottom margin zones only ---
    try:
        from PIL import ImageDraw
        draw = ImageDraw.Draw(canvas)
        margin_color = (255, 255, 255, 160)  # translucent white

        top_margin = photo_y  # pixels above the photo
        bottom_margin_start = photo_y + photo_h

        if watermark_top and top_margin > 20:
            draw.text((canvas_w // 2, top_margin // 2), watermark_top,
                      fill=margin_color, anchor="mm")

        if watermark_bottom and canvas_h - bottom_margin_start > 20:
            draw.text((canvas_w // 2, bottom_margin_start + (canvas_h - bottom_margin_start) // 2),
                      watermark_bottom, fill=margin_color, anchor="mm")
    except Exception:
        pass  # watermark failure is non-fatal

    return canvas


@app.post("/social-frame")
async def social_frame(
    request: Request,
    format: str = Query("feed", pattern="^(original|feed|story)$"),
    focal_x: float = Query(0.5, ge=0.0, le=1.0),
    focal_y: float = Query(0.5, ge=0.0, le=1.0),
    watermark_top: str = Query("", max_length=120),
    watermark_bottom: str = Query("", max_length=120),
) -> Response:
    """Return a social-formatted variant of the submitted image.

    format=original: pass-through (re-encoded as JPEG for consistency).
    format=feed:     smart focal-point 4:5 crop (1080×1350).
    format=story:    9:16 blurred-backdrop canvas (1080×1920).
    """
    _check_auth(request)
    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="empty_body")

    try:
        img = Image.open(io.BytesIO(body)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="decode_failed")

    if format == "original":
        result = img
    elif format == "feed":
        result = _focal_crop(img, 1080, 1350, focal_x, focal_y)
    else:  # story
        result = _story_canvas(img, 1080, 1920, watermark_top, watermark_bottom)

    buf = io.BytesIO()
    result.save(buf, format="JPEG", quality=88, optimize=True)
    return Response(content=buf.getvalue(), media_type="image/jpeg")
