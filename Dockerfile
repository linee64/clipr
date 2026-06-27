# Clipr backend on Railway — built from the REPO ROOT so no "Root Directory"
# setting is needed. This forces a Docker build (Python/FastAPI) and stops Railway
# from auto-detecting the root package.json and running the frontend's `next build`.
# (The frontend deploys separately on Vercel with Root Directory = frontend.)
FROM python:3.12-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# ffmpeg (render + librosa audioread), libsndfile1 (soundfile), and fonts for libass
# captions: Liberation gives a reliable Arial alias; msttcorefonts (best-effort) adds
# the exact Arial/Trebuchet MS/Georgia/Verdana/Impact the templates use. Bundled
# Playfair Display & Great Vibes ship in backend/assets/fonts and load via fontsdir.
RUN printf 'deb http://deb.debian.org/debian bookworm contrib non-free non-free-firmware\n' \
      > /etc/apt/sources.list.d/contrib.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
      ffmpeg libsndfile1 fontconfig fonts-liberation cabextract \
 && echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" \
      | debconf-set-selections \
 && (apt-get install -y --no-install-recommends ttf-mscorefonts-installer || true) \
 && fc-cache -f \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first for layer caching.
COPY backend/requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Backend code (assets/fonts, templates, routers, services, workers, …).
COPY backend/ .

# FFmpeg thread count for encode parallelism (each thread holds frame buffers).
ENV FFMPEG_THREADS=4

# Long edge of the render frame (1920 = full 1080x1920 vertical).
ENV RENDER_LONG_EDGE=1920

ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
