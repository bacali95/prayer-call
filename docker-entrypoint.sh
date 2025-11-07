#!/bin/bash
set -e

echo "Starting cron daemon..."

# Ensure cron log directory exists
mkdir -p /var/log

# Start cron in the background
# Note: cron runs as a daemon and will continue in the background
cron

# Wait a moment for cron to start
sleep 1

echo "Cron daemon started"
echo "Listing current crontab:"
crontab -l || echo "No crontab entries yet"

echo "Starting Flask application..."
# Run Flask app in foreground (so container stays alive)
exec python -m backend.app

