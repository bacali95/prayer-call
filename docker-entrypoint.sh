#!/bin/bash
set -euo pipefail

export TZ="${TZ:-UTC}"
export PORT="${PORT:-3001}"

# Cron reads the system timezone, so point /etc/localtime at $TZ.
if [ -e "/usr/share/zoneinfo/$TZ" ]; then
    ln -snf "/usr/share/zoneinfo/$TZ" /etc/localtime
    echo "$TZ" > /etc/timezone
else
    echo "Unknown TZ '$TZ', falling back to UTC" >&2
    export TZ=UTC
fi
echo "Timezone: $TZ ($(date))"

mkdir -p "${CONFIG_DIR:-/app/config}" "${LOG_DIR:-/app/logs}" "${UPLOAD_DIR:-/app/uploads}"

# Cron daemon backgrounds itself; the app (re)writes the crontab at startup.
cron
echo "Cron daemon started"

# One worker: scheduling state and the crontab are process-wide. Threads handle
# concurrency. The timeout is generous because Chromecast scan / test-play can
# take ~40s.
exec gunicorn \
    --bind "0.0.0.0:${PORT}" \
    --worker-class gthread \
    --workers 1 \
    --threads 8 \
    --timeout 180 \
    --graceful-timeout 30 \
    --access-logfile - \
    --error-logfile - \
    backend.wsgi:app
