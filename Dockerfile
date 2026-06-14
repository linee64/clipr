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

# Cap ffmpeg threads so a render's encodes don't spike memory across every core and
# get the container OOM-killed mid-render (which would wipe the job -> "Job not found").
ENV FFMPEG_THREADS=2

# Render the video frame at 720x1280 instead of 1080x1920 — ~half the encode memory
# so the render fits a small instance. Captions are still authored at full res and
# scaled down by libass, so they look identical. Raise/remove on a roomier instance.
ENV RENDER_LONG_EDGE=1280

ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
