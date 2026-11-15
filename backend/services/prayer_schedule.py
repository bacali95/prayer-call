"""Fetch -> transform -> save -> schedule, in one place.

Used by the routes, the startup hook and the daily reschedule script.
"""

import logging
from typing import Any

from backend.services import MawaqitError, Services
from backend.utils import get_prayer_schedule_date, transform_prayer_times

logger = logging.getLogger(__name__)


def refresh_prayer_times(
    services: Services, mosque_uuid: str, schedule: bool = True
) -> dict[str, Any]:
    """Fetch today's times for ``mosque_uuid``, persist them and (re)schedule cron jobs.

    Cron jobs are only (re)scheduled when ``schedule`` is true and a chromecast
    is configured. Raises ``MawaqitError`` when nothing usable comes back.
    """
    payload = services.mawaqit.get_prayer_times(mosque_uuid)
    times = transform_prayer_times(payload)
    if not times:
        raise MawaqitError("No prayer times found for today in the Mawaqit response")

    config = services.config.update(
        {"prayer_times": times, "prayer_schedule_date": get_prayer_schedule_date()}
    )
    if schedule and (config.get("chromecast") or {}).get("name"):
        services.cron.schedule_prayers(times)
    return times
