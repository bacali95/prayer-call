"""Helpers shared by the route modules."""

from typing import Any

from flask import current_app, request
from werkzeug.exceptions import BadRequest

from backend.services import Services


def get_services() -> Services:
    return current_app.extensions["prayer_call"]


def upload_dir() -> str:
    return current_app.config["UPLOAD_DIR"]


def json_object() -> dict[str, Any]:
    """The JSON request body, which must be an object (else 400)."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise BadRequest("A JSON object body is required")
    return data


def int_arg(name: str, default: int) -> int:
    """An integer query parameter (400 when present but not an integer)."""
    raw = request.args.get(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        raise BadRequest(f"{name} must be an integer") from None
