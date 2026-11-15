"""Production startup scheduling (never runs under tests or at import time of the app factory)."""

import logging
import threading

from backend.services import Services
from backend.services.prayer_schedule import refresh_prayer_times

logger = logging.getLogger(__name__)


def schedule_on_startup(services: Services) -> None:
    """Ensure the reschedule job exists and today's adhan jobs are scheduled.

    Falls back to the stored prayer times when Mawaqit is unreachable so that
    jobs written by an older version are always replaced.
    """
    try:
        services.cron.schedule_reschedule_job()
    except Exception:
        logger.exception("Could not install the reschedule cron job")

    config = services.config.load()
    mosque_uuid = (config.get("mosque") or {}).get("uuid")
    chromecast = (config.get("chromecast") or {}).get("name")
    stored = config.get("prayer_times") or {}
    if not chromecast:
        logger.info("No chromecast configured; skipping startup scheduling")
        return

    if mosque_uuid:
        try:
            refresh_prayer_times(services, mosque_uuid)
            logger.info("Prayers scheduled for today")
            return
        except Exception:
            logger.exception("Could not refresh prayer times on startup")
    else:
        logger.info("No mosque configured; skipping Mawaqit refresh")

    if stored:
        try:
            services.cron.schedule_prayers(stored)
            logger.info("Scheduled prayers from stored times")
        except Exception:
            logger.exception("Could not schedule stored prayer times")


def start_background(services: Services) -> threading.Thread:
    """Run ``schedule_on_startup`` in a daemon thread so probes are not blocked."""
    thread = threading.Thread(
        target=schedule_on_startup, args=(services,), name="startup-schedule", daemon=True
    )
    thread.start()
    return thread
