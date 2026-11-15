"""Mosque-related routes"""

import calendar as cal_module
import logging
import re
from datetime import date, datetime, timedelta

from flask import Blueprint, jsonify, request
from werkzeug.exceptions import BadGateway, BadRequest

from backend.services import MawaqitError
from backend.services.prayer_schedule import refresh_prayer_times
from backend.utils.date_utils import (
    format_date_both_calendars,
    get_dst_periods,
    get_dst_transitions,
)

from ._common import get_services

logger = logging.getLogger(__name__)

mosques_bp = Blueprint("mosques", __name__, url_prefix="/api/mosques")

MOSQUE_ID_RE = re.compile(r"^[\w.-]{1,100}$")


@mosques_bp.errorhandler(MawaqitError)
def _mawaqit_error(exc: MawaqitError):
    return jsonify({"error": str(exc)}), 502


def _check_id(mosque_id: str) -> str:
    if not MOSQUE_ID_RE.match(mosque_id):
        raise BadRequest("Invalid mosque id")
    return mosque_id


@mosques_bp.route("/search", methods=["GET"])
def search_mosques():
    query = request.args.get("q", "").strip()
    if not query:
        raise BadRequest("Query parameter 'q' is required")
    if len(query) > 100:
        raise BadRequest("Query parameter 'q' is too long")

    mosques = get_services().mawaqit.search_mosques(query)
    return jsonify(
        {
            "mosques": [
                {
                    "uuid": m.get("uuid"),
                    "id": m.get("uuid"),
                    "name": m.get("name") or m.get("label", ""),
                    "address": m.get("localisation") or m.get("address"),
                }
                for m in mosques
            ]
        }
    )


@mosques_bp.route("/<mosque_id>/prayer-times", methods=["GET"])
def get_prayer_times(mosque_id):
    """Fetch today's times, store them and (re)schedule the cron jobs."""
    return jsonify(refresh_prayer_times(get_services(), _check_id(mosque_id)))


@mosques_bp.route("/<mosque_id>/prayer-times/year", methods=["GET"])
def get_prayer_times_year(mosque_id):
    """Prayer times for the whole current year (display only)."""
    payload = get_services().mawaqit.get_prayer_times(_check_id(mosque_id))
    calendar_data = payload.get("calendar") if isinstance(payload, dict) else None
    if not isinstance(calendar_data, list) or len(calendar_data) != 12:
        raise BadGateway("Mawaqit returned an invalid calendar")

    year = datetime.now().year
    year_start = date(year, 1, 1)

    date_to_dst: dict[date, bool] = {}
    for start, end, is_dst in get_dst_periods(year):
        current = start
        while current <= end and current.year == year:
            date_to_dst[current] = is_dst
            current += timedelta(days=1)

    year_data = []
    for month_idx, month_data in enumerate(calendar_data):
        if not isinstance(month_data, dict):
            continue
        month = month_idx + 1
        for day in range(1, cal_module.monthrange(year, month)[1] + 1):
            times = month_data.get(str(day))
            if not isinstance(times, list) or len(times) < 6:
                continue
            current_date = date(year, month, day)
            formats = format_date_both_calendars(current_date)
            year_data.append(
                {
                    "dayOfYear": len(year_data) + 1,
                    "date": current_date.strftime("%Y-%m-%d"),
                    "fajr": times[0],
                    "dhuhr": times[2],
                    "asr": times[3],
                    "maghrib": times[4],
                    "isha": times[5],
                    "isDST": date_to_dst.get(current_date, False),
                    "gregorian": formats["gregorian"],
                    "hijri": formats["hijri"],
                }
            )

    transitions = [
        {"dayOfYear": (d - year_start).days + 1, "date": d.strftime("%Y-%m-%d")}
        for d in get_dst_transitions(year)
    ]
    return jsonify({"year": year, "data": year_data, "dstTransitions": transitions})
