"""Fetch new prayer times and reschedule the cron jobs (run daily at 02:00 by cron)."""

import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend import settings  # noqa: E402
from backend.services import build_services  # noqa: E402
from backend.services.prayer_schedule import refresh_prayer_times  # noqa: E402

logger = logging.getLogger("reschedule_prayers")


def main() -> int:
    settings.configure_logging()
    logger.info("Starting daily prayer reschedule")
    services = build_services()
    config = services.config.load()

    mosque_uuid = (config.get("mosque") or {}).get("uuid")
    if not mosque_uuid:
        logger.info("No mosque configured; skipping")
        return 0
    if not (config.get("chromecast") or {}).get("name"):
        logger.info("No chromecast configured; skipping")
        return 0

    try:
        times = refresh_prayer_times(services, mosque_uuid)
    except Exception:
        logger.exception("Reschedule failed")
        return 1
    logger.info("Rescheduled prayer times: %s", times)
    return 0


if __name__ == "__main__":
    sys.exit(main())
