# insightface (and its transitive deps like stringzilla) compile C/C++
# extensions during `pip install` - needs a real compiler, which the slim
# runtime image deliberately doesn't ship. Build in a separate stage with
# build-essential, then copy only the installed packages into the slim
# runtime image (keeps the final image free of gcc/g++/build headers).
FROM python:3.11-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt \
    --extra-index-url https://download.pytorch.org/whl/cpu

FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

WORKDIR /app

# Bake model weights into the image at build time so cold starts don't hit the
# network, and the image is portable to whichever host (Fly.io/Cloud Run) gets
# picked later without re-downloading anything.
RUN python -c "from insightface.app import FaceAnalysis; FaceAnalysis(name='buffalo_l').prepare(ctx_id=-1)"
# Bake CLIP ViT-B/32 weights — used by /classify-category (zero per-call cost).
RUN python -c "import open_clip; open_clip.create_model_and_transforms('ViT-B-32', pretrained='openai')"

COPY app/ ./app

ENV PORT=8080
EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
