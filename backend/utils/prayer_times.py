"""Prayer time transformation utilities"""

import re
from datetime import datetime
from typing import Any

from backend.constants import PRAYER_KEYS

TIME_RE = re.compile(r"^([01]?\d|2[0-3]):([0-5]\d)$")


def parse_hhmm(value: str) -> tuple[int, int]:
    """Parse ``HH:MM`` into ``(hour, minute)``; raises ValueError when invalid."""
    match = TIME_RE.match(value.strip()) if isinstance(value, str) else None
    if not match:
        raise ValueError(f"Invalid time {value!r}, expected HH:MM")
    return int(match.group(1)), int(match.group(2))


def extract_prayer_times_from_calendar(
    calendar: list[dict], date: datetime | None = None
) -> dict[str, str]:
    """Extract one day's prayer times from a Mawaqit calendar.

    The calendar is a list of 12 month dicts (Jan=0); each maps the day number
    (as a string) to ``[Fajr, Shuruq, Dhuhr, Asr, Maghrib, Isha]``.
    Returns ``{}`` when the day cannot be found.
    """
    if not calendar or not isinstance(calendar, list):
        return {}

    date = date or datetime.now()
    month_index = date.month - 1
    day = str(date.day)

    if month_index >= len(calendar):
        return {}

    month_data = calendar[month_index]
    if not isinstance(month_data, dict) or day not in month_data:
        return {}

    day_times = month_data[day]
    if not isinstance(day_times, list) or len(day_times) < 6:
        return {}

    return {
        "fajr": day_times[0],
        "shuruq": day_times[1],
        "dhuhr": day_times[2],
        "asr": day_times[3],
        "maghrib": day_times[4],
        "isha": day_times[5],
    }


def transform_prayer_times(
    prayer_times: dict[str, Any], today: datetime | None = None
) -> dict[str, str]:
    """Transform a Mawaqit payload into ``{prayer: "HH:MM"}`` for today.

    Calendar payloads are preferred (shuruq is kept, it is display-only);
    otherwise legacy shapes (per-day dicts, plain strings, lists) are handled.
    """
    if not prayer_times:
        return {}

    today = today or datetime.now()

    if prayer_times.get("calendar"):
        calendar_times = extract_prayer_times_from_calendar(prayer_times["calendar"], today)
        if calendar_times:
            return calendar_times

    transformed: dict[str, Any] = {}
    for prayer, value in prayer_times.items():
        if prayer == "calendar":
            continue
        if isinstance(value, dict):
            day_key = str(today.day)
            if day_key in value:
                transformed[prayer] = value[day_key]
            elif today.day in value:
                transformed[prayer] = value[today.day]
            elif value:
                transformed[prayer] = next(iter(value.values()), None)
            else:
                transformed[prayer] = None
        elif isinstance(value, str):
            transformed[prayer] = value
        elif isinstance(value, list) and value:
            # Five-time list: [Fajr, Dhuhr, Asr, Maghrib, Isha]
            for name, item in zip(("fajr", "dhuhr", "asr", "maghrib", "isha"), value, strict=False):
                transformed[name] = item
        else:
            transformed[prayer] = None

    return transformed


def validate_prayer_times(value: Any) -> dict[str, str | None]:
    """Validate a user supplied ``prayer_times`` dict; raises ValueError."""
    if not isinstance(value, dict):
        raise ValueError("prayer_times must be an object")
    clean: dict[str, str | None] = {}
    for key, time_value in value.items():
        if key not in PRAYER_KEYS:
            raise ValueError(f"Unknown prayer '{key}' in prayer_times")
        if time_value in (None, ""):
            clean[key] = None
            continue
        parse_hhmm(time_value)
        clean[key] = time_value.strip()
    return clean
