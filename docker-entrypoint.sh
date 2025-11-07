#!/bin/bash
set -e

echo "Starting cron daemon..."

# Ensure timezone is set (default to UTC if not provided)
export TZ=${TZ:-UTC}

# Configure system timezone to match TZ environment variable
# This ensures cron uses the correct timezone
ln -snf /usr/share/zoneinfo/$TZ /etc/localtime
echo $TZ > /etc/timezone

echo "Timezone set to: $TZ"
echo "Current time: $(date)"

# Ensure cron log directory exists
mkdir -p /var/log

# Start cron in the background
# Note: cron runs as a daemon and will continue in the background
# System timezone is now configured, so cron will use the correct timezone
cron

# Wait a moment for cron to start
sleep 1

echo "Cron daemon started"
echo "Listing current crontab:"
crontab -l || echo "No crontab entries yet"

echo "Starting Flask application..."
# Run Flask app in foreground (so container stays alive)
exec python -m backend.app

