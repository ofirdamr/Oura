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

import threading

EMBED_SERVICE_TOKEN = os.environ.get("EMBED_SERVICE_TOKEN")

app = FastAPI()
_face_app: FaceAnalysis | None = None
_clip_model: Optional[torch.nn.Module] = None
_clip_preprocess = None
_clip_text_features: Optional[torch.Tensor] = None
_models_ready = threading.Event()

# Fixed wedding category labels — order matches _clip_text_features rows.
_CATEGORY_KEYS = ["couple", "ceremony", "dances", "reception", "main_course", "family", "venue"]
# Each inner list is an ensemble of prompts for one category.
# At load time all prompts are encoded and averaged per category → [5, 512] matrix.
_CATEGORY_PROMPTS: list[list[str]] = [
    [  # couple — intimate portrait, just the two of them
        "A romantic wedding portrait of the bride and groom alone together, facing each other closely.",
        "An intimate close-up of two newlyweds, the bride in a white dress and groom in a suit, embracing and smiling.",
        "The bride and groom sharing a quiet moment together, gazing into each other's eyes at their wedding.",
        "A couple's portrait with only the two of them in frame, the bride's bouquet visible, warm emotional connection.",
        "Two newlyweds kissing, their faces and wedding attire filling the frame, no other people present.",
    ],
    [  # ceremony — ritual moment, chuppah, officiant, formal positioning
        "A Jewish wedding ceremony under a white chuppah canopy, the couple standing beneath it as a rabbi officiates.",
        "The groom placing a gold ring on the bride's outstretched finger during the exchange of vows, guests watching from rows of seats.",
        "A wide-angle view of the wedding ceremony hall with all guests seated in rows facing the couple at the altar.",
        "The bride walking down the aisle escorted by her parents, guests standing and turning to watch her approach.",
        "The ceremonial moment when the groom breaks a glass under his foot at the conclusion of a Jewish wedding, guests cheering.",
    ],
    [  # dances — energetic group motion, hora, lifted chairs
        "Wedding guests dancing the hora in a large jubilant circle on the dance floor, everyone holding hands.",
        "The bride and groom being lifted on chairs by dancing guests during a lively traditional hora celebration.",
        "A crowded wedding dance floor with many guests dancing energetically together to upbeat music, arms raised.",
        "A circle of wedding guests performing traditional folk dancing, moving together in a joyful group.",
        "High-energy wedding reception dancing with motion blur, guests laughing and celebrating together on the dance floor.",
    ],
    [  # reception — cocktail hour, standing, mingling, drinks in hand
        "Wedding guests standing in small groups during the cocktail hour, drinks in hand, chatting and socializing.",
        "A cocktail reception with elegantly dressed people mingling, waiters carrying trays of appetizers through the crowd.",
        "Guests gathered around a cocktail station or open bar, glasses of wine in hand, talking in a decorated venue.",
        "An outdoor garden cocktail hour at a wedding, standing guests socializing with drinks before the dinner.",
        "People at a wedding reception cocktail hour, holding hors d'oeuvres and cocktails, no one seated at tables.",
    ],
    [  # main_course — seated banquet dinner, food on tables, formal dining
        "Wedding guests seated at round banquet tables covered in white linen, eating a formal multi-course dinner.",
        "A wedding reception dinner scene with all guests in their chairs, plates of food on the table and wine glasses filled.",
        "A wide shot of a wedding banquet hall with hundreds of guests seated at dinner tables during the main course.",
        "Guests at a wedding reception seated and eating their meal, with tall floral centerpieces and candles on the table.",
        "A formal wedding dinner with people seated around large tables, servers bringing plates, a warm candlelit atmosphere.",
    ],
    [  # family — posed group portrait, multiple generations, no dancing or eating
        "A formal family portrait at a wedding, multiple generations standing close together and smiling at the camera.",
        "Parents, siblings, grandparents, and extended family members posed together in a group photo at a wedding.",
        "A large family group photograph with adults and children arranged in rows, all dressed formally for the wedding.",
        "The bride and groom surrounded by their immediate family members in a posed portrait on the wedding day.",
        "A wide group photo of the entire wedding family — grandparents, parents, children, and cousins — lined up together.",
    ],
    [  # venue — hall decor, empty or near-empty space, architecture, table settings
        "An elegant empty wedding banquet hall decorated with floral centerpieces, draped fabric, and soft ambient lighting.",
        "A wide interior shot of a wedding venue showing decorated round tables, tall candelabras, and chandeliers before guests arrive.",
        "Architectural detail photography inside a wedding hall: chandeliers, flower arrangements, and formally set tables with no people.",
        "Close-up detail shots of wedding table decorations: place cards, candles, crystal glasses, and flower arrangements.",
        "The grand interior of a wedding venue from above or distance, showing the decorated stage, altar area, and ambient lighting design.",
    ],
]
# CLIP confidence floor — scores below this yield null (photo genuinely ambiguous).
_CLIP_MIN_SCORE = 0.20


def _load_models_sync() -> None:
    global _face_app, _clip_model, _clip_preprocess, _clip_text_features

    _face_app = FaceAnalysis(name="buffalo_l")
    _face_app.prepare(ctx_id=-1)  # CPU; pilot scale doesn't need GPU

    # Load CLIP ViT-B/32 (weights baked into image at build time).
    model, _, preprocess = open_clip.create_model_and_transforms("ViT-B-32", pretrained="openai")
    model.eval()
    tokenizer = open_clip.get_tokenizer("ViT-B-32")
    flat_prompts = [p for group in _CATEGORY_PROMPTS for p in group]
    group_sizes = [len(g) for g in _CATEGORY_PROMPTS]
    texts = tokenizer(flat_prompts)
    with torch.no_grad():
        text_feats = model.encode_text(texts)
        text_feats = text_feats / text_feats.norm(dim=-1, keepdim=True)
        # Average the ensemble prompts per category, then re-normalise.
        averaged, offset = [], 0
        for size in group_sizes:
            avg = text_feats[offset : offset + size].mean(dim=0)
            averaged.append(avg / avg.norm())
            offset += size
        text_feats = torch.stack(averaged)  # [n_categories, dim]
    _clip_model = model
    _clip_preprocess = preprocess
    _clip_text_features = text_feats
    _models_ready.set()


@app.on_event("startup")
def load_models() -> None:
    # Load in background so uvicorn listens on port 8080 immediately.
    # Cloud Run health check sees the port up; inference endpoints return 503
    # until _models_ready is set (typically 30-90 s on cold start).
    threading.Thread(target=_load_models_sync, daemon=True).start()


def _check_auth(request: Request) -> None:
    if not EMBED_SERVICE_TOKEN:
        return  # local dev without a configured token
    header = request.headers.get("authorization", "")
    if header != f"Bearer {EMBED_SERVICE_TOKEN}":
        raise HTTPException(status_code=401, detail="unauthorized")


@app.get("/health")
def health() -> dict:
    ready = _models_ready.is_set()
    return {"ok": ready, "models": ["buffalo_l", "clip-ViT-B-32"] if ready else []}


@app.post("/embed")
async def embed(request: Request) -> dict:
    _check_auth(request)
    if not _models_ready.is_set():
        raise HTTPException(status_code=503, detail="models_loading")
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
    if not _models_ready.is_set():
        raise HTTPException(status_code=503, detail="models_loading")
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
    if not _models_ready.is_set():
        raise HTTPException(status_code=503, detail="models_loading")
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
