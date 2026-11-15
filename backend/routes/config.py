"""Configuration routes"""

import logging
import os
from typing import Any

from flask import Blueprint, jsonify
from werkzeug.exceptions import BadRequest

from backend.config import redact
from backend.constants import ADHAN_PRAYERS
from backend.utils import validate_prayer_times

from ._common import get_services, json_object, upload_dir

logger = logging.getLogger(__name__)

config_bp = Blueprint("config", __name__, url_prefix="/api/config")

MAX_TEXT = 300
MOSQUE_KEYS = ("uuid", "id", "name", "address")
CHROMECAST_KEYS = ("name", "uuid", "model_name", "cast_type", "host")


def _opt_str(value: Any, field: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str) or len(value) > MAX_TEXT:
        raise BadRequest(f"{field} must be a string of at most {MAX_TEXT} characters")
    return value


def _clean_object(value: Any, field: str, keys: tuple[str, ...], required: str) -> dict | None:
    if value is None:
        return None
    if not isinstance(value, dict):
        raise BadRequest(f"{field} must be an object or null")
    clean = {k: _opt_str(value.get(k), f"{field}.{k}") for k in keys if k in value}
    if not clean.get(required):
        raise BadRequest(f"{field}.{required} is required")
    return clean


def _prayer_map(value: Any, field: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise BadRequest(f"{field} must be an object")
    unknown = set(value) - set(ADHAN_PRAYERS)
    if unknown:
        raise BadRequest(f"Unknown prayer(s) in {field}: {', '.join(sorted(map(str, unknown)))}")
    return value


def _validate(data: dict[str, Any]) -> dict[str, Any]:
    updates: dict[str, Any] = {}

    if "mosque" in data:
        updates["mosque"] = _clean_object(data["mosque"], "mosque", MOSQUE_KEYS, "uuid")

    if "chromecast" in data:
        updates["chromecast"] = _clean_object(
            data["chromecast"], "chromecast", CHROMECAST_KEYS, "name"
        )

    if "adhan_files" in data:
        files = _prayer_map(data["adhan_files"], "adhan_files")
        for prayer, name in files.items():
            if name is None:
                continue
            if (
                not isinstance(name, str)
                or not name
                or os.path.basename(name) != name
                or not os.path.isfile(os.path.join(upload_dir(), name))
            ):
                raise BadRequest(f"adhan_files.{prayer}: file does not exist")
        updates["adhan_files"] = files

    if "adhan_volumes" in data:
        volumes = _prayer_map(data["adhan_volumes"], "adhan_volumes")
        for prayer, volume in volumes.items():
            if volume is None:
                continue
            if isinstance(volume, bool) or not isinstance(volume, (int, float)):
                raise BadRequest(f"adhan_volumes.{prayer} must be a number between 0 and 1")
            if not 0 <= volume <= 1:
                raise BadRequest(f"adhan_volumes.{prayer} must be between 0 and 1")
        updates["adhan_volumes"] = volumes

    if "unsplash_access_key" in data:
        key = data["unsplash_access_key"]
        if key is not None and (not isinstance(key, str) or len(key) > 200):
            raise BadRequest("unsplash_access_key must be a string")
        updates["unsplash_access_key"] = (key or "").strip() or None

    if "prayer_times" in data:
        try:
            updates["prayer_times"] = validate_prayer_times(data["prayer_times"])
        except ValueError as exc:
            raise BadRequest(str(exc)) from exc

    return updates


@config_bp.route("", methods=["GET"])
def get_config():
    """Current configuration (secrets redacted). Fast: no network calls."""
    return jsonify(redact(get_services().config.load()))


@config_bp.route("", methods=["POST"])
def update_config():
    """Validate and partially update the configuration."""
    services = get_services()
    updates = _validate(json_object())
    config = services.config.update(updates)

    response = redact(config)
    reschedule = "prayer_times" in updates or (
        "chromecast" in updates and config.get("prayer_times")
    )
    if reschedule and (config.get("chromecast") or {}).get("name") and config.get("prayer_times"):
        try:
            services.cron.schedule_prayers(config["prayer_times"])
        except Exception as exc:
            logger.exception("Config saved but cron scheduling failed")
            response["scheduling_error"] = str(exc)
    return jsonify(response)
