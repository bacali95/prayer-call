# Frontend build
FROM oven/bun:1.4.4-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/ ./
RUN bun install --frozen-lockfile && bun run build

# Python backend
FROM python:3.15-slim

# cron needs root (it writes the user crontab and /etc/localtime), so the
# container intentionally runs as root. The pod is the isolation boundary.
RUN apt-get update \
    && apt-get install -y --no-install-recommends cron tzdata \
    && rm -rf /var/lib/apt/lists/*

ENV TZ=UTC \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=3001 \
    CONFIG_DIR=/app/config \
    LOG_DIR=/app/logs
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY VERSION ./VERSION
COPY backend/ ./backend/
COPY --from=frontend-builder /app/frontend/build ./static

RUN mkdir -p /app/uploads /app/config /app/logs

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["python", "-c", "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/healthz' % os.environ.get('PORT', '3001'), timeout=4)"]

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
