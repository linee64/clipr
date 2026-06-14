# Clipr backend — FastAPI video-render service (Railway / Docker).
FROM python:3.12-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# System deps:
#  - ffmpeg      : video/audio render + librosa's audioread fallback (must be on PATH;
#                  the app's _tool() falls back to bare "ffmpeg" when no bundled .exe).
#  - libsndfile1 : soundfile (librosa decoding).
#  - fontconfig + fonts-liberation : reliable Arial/Times/Courier aliases for libass.
#  - ttf-mscorefonts-installer : the EXACT Arial / Trebuchet MS / Georgia / Verdana /
#                  Impact / Arial Black the templates use (best-effort — needs the
#                  contrib repo + a SourceForge download; if it ever fails the build,
#                  Liberation still covers Arial). Bundled Playfair Display & Great
#                  Vibes ship in assets/fonts and load via the ass filter's fontsdir.
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

# Install Python deps first for better layer caching.
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# App code (assets/fonts, templates, routers, services, workers, …).
COPY . .

# Railway injects $PORT at runtime; default 8000 for plain `docker run`.
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
