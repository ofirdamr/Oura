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

from .refine import refine_event

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
# At load time all prompts are encoded and averaged per category → [n, 512] matrix.
#
# Design note (2026-07-23): the DOMINANT signal for ceremony is the white draped
# chuppah canopy / white fabric backdrop in the frame — a group hug, a toast, or
# a close family moment that happens UNDER the canopy is still ceremony, not
# family, even though it looks like a family shot. Earlier attempts over-tightened
# ceremony toward only wide ritual shots, which pushed canopy close-ups into
# family. Family/couple prompts now explicitly demand a NON-canopy backdrop
# (stone wall, staircase, garden, plain wall) so the canopy stays the tie-breaker.
_CATEGORY_PROMPTS: list[list[str]] = [
    [  # couple — just the two of them, scenic/plain backdrop, NO canopy, NO crowd
        "Bride and groom posing together for a photographer against a stone wall, garden, or plain backdrop — just the two of them, no white draped canopy, no crowd, no officiant.",
        "A formal posed wedding portrait of only the bride and groom, embracing or looking at the lens, with a scenic non-canopy background — no chuppah, no altar, no guests.",
        "The bride and groom alone in a romantic portrait, holding each other close at a scenic spot — no white ceremony canopy overhead, no rabbi, just the couple in wedding attire.",
        "The bride alone in her wedding dress in an intimate solo portrait against a stone wall, staircase, or hallway — no crowd, no canopy, no ceremony setting behind her.",
        "The bride getting her hair and makeup done before the wedding, or a solo bridal portrait, in a getting-ready suite — no canopy, no crowd.",
    ],
    [  # ceremony — DOMINANT cue: white draped chuppah canopy / white fabric backdrop present
        "People gathered close together beneath a white draped chuppah canopy at a Jewish wedding, the white fabric of the canopy clearly visible behind and above them — this is the ceremony, even if it looks like a group of family or friends hugging.",
        "A close-up of the bride, groom, or family members embracing and emotional under the white chuppah canopy during the ceremony, white draped fabric filling the background.",
        "A man holding a wine glass and reading or speaking into a microphone during the wedding ceremony blessing, near the white canopy — the kiddush or a ceremony toast in progress.",
        "The groom placing a ring on the bride's finger, or a rabbi reading the ketubah, beneath the white chuppah canopy — an active Jewish wedding ritual with the canopy overhead.",
        "Guests and family crowded around the couple under the white draped chuppah, everyone facing the canopy, white fabric and ceremony lighting visible — the ceremony moment.",
        "A small child or flower girl standing on the white fabric beneath the chuppah canopy during the ceremony, surrounded by the white draped ceremony backdrop.",
    ],
    [  # dances — open dance floor, no chuppah, chairs pushed aside, motion and energy
        "Wedding guests dancing the hora in a jubilant circle on the open parquet dance floor, the chuppah nowhere in sight, chairs along the walls.",
        "The bride and groom lifted on chairs by dancing guests on the dance floor — the ballroom background visible, no ceremony altar or canopy.",
        "A crowded dance floor with many guests moving energetically to music, arms raised in joy, in the main hall separate from the ceremony area.",
        "People dancing at a wedding with hands raised and bodies in motion — the background shows the lit banquet hall, not a chuppah or altar.",
        "High-energy wedding dancing with motion blur, the dance floor space clearly distinct from the ceremony setting — no canopy, open floor area.",
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
    [  # family — posed group portrait against a NON-canopy backdrop (wall, stairs, garden)
        "A formal posed family portrait at a wedding, multiple generations standing close together and smiling at the camera, against a stone wall, staircase, or garden — NOT under a white chuppah canopy.",
        "Parents, siblings, grandparents and the couple posed together in a deliberate group photo at a scenic wedding spot, everyone looking at the lens, no white ceremony canopy overhead.",
        "A large family group photograph, adults and children arranged in rows and posing for the camera, at a decorative backdrop that is clearly not the ceremony canopy.",
        "The bride and groom flanked by immediate family in a posed portrait against a plain or scenic wall, everyone facing the photographer — a staged family photo, no canopy.",
        "A posed extended-family lineup — grandparents, parents, children, cousins — standing shoulder to shoulder and smiling, photographed away from the chuppah at a scenic location.",
    ],
    [  # venue / אולם — hall decor, tables, empty space, table settings, design details
        "An elegant wedding banquet hall decorated with floral centerpieces, draped fabric, and soft lighting, few or no people — the room and its design are the subject.",
        "A wide interior shot of a wedding venue showing rows of decorated round dining tables, tall candelabras, and chandeliers before or between guests.",
        "Close-up detail photography of the wedding table setting: place cards, candles, plates, crystal glasses, napkins, and flower arrangements — the decor is the subject, no people.",
        "The design and styling of the wedding hall: the decorated stage, lounge furniture, lighting, and floral installations, photographed as an interior/decor shot.",
        "A photo focused on the tables, chairs, and room design of the wedding venue rather than on any person — capturing how the אולם is set up and decorated.",
    ],
]
# CLIP confidence floor — scores below this yield null (photo genuinely ambiguous).
_CLIP_MIN_SCORE = 0.20


def _load_models_sync() -> None:
    global _face_app, _clip_model, _clip_preprocess, _clip_text_features

    _face_app = FaceAnalysis(name="buffalo_l")
    _face_app.prepare(ctx_id=-1)  # CPU; pilot scale doesn't need GPU

    # Load CLIP ViT-L/14 (weights baked into image at build time). Upgraded from
    # ViT-B/32 (2026-07-23): the smaller model could not separate semantically
    # close wedding scenes (family group under the canopy vs. family portrait on
    # the stairs). ViT-L/14 has markedly stronger fine-grained scene discrimination.
    model, _, preprocess = open_clip.create_model_and_transforms("ViT-L-14", pretrained="openai")
    model.eval()
    tokenizer = open_clip.get_tokenizer("ViT-L-14")
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
    return {"ok": ready, "models": ["buffalo_l", "clip-ViT-L-14"] if ready else []}


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
    # The L2-normalized image embedding is returned so callers can persist it and
    # later run the event-level burst/visual-clustering refine (/refine-categories)
    # without re-downloading the image. Rounded to keep the stored JSON compact.
    embedding = [round(float(v), 5) for v in image_feats.squeeze(0).tolist()]
    return {"category": category, "scores": scores, "embedding": embedding}


@app.post("/refine-categories")
async def refine_categories(request: Request) -> dict:
    """Holistic event-level category refine (burst + visual clustering).

    Body JSON: {
      "photos": [{"id": str, "embedding": [float], "scores": {cat: float}, "seq": int}],
      "category_keys": [str, ...]   # optional; defaults to the service's 7 keys
      "min_score": float            # optional; defaults to _CLIP_MIN_SCORE
    }
    Returns {"photos": [{"id", "category": str|null, "source": "ai"|"cluster"}]}.
    """
    _check_auth(request)
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="invalid_json")

    photos = payload.get("photos")
    if not isinstance(photos, list):
        raise HTTPException(status_code=400, detail="photos_required")

    category_keys = payload.get("category_keys") or _CATEGORY_KEYS
    if not isinstance(category_keys, list) or not category_keys:
        raise HTTPException(status_code=400, detail="invalid_category_keys")
    min_score = float(payload.get("min_score", _CLIP_MIN_SCORE))

    result = refine_event(photos, category_keys, min_score)
    return {"photos": result}


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
