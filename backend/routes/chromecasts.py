"""Chromecast-related routes"""

import logging

from flask import Blueprint, jsonify

from ._common import get_services, int_arg

logger = logging.getLogger(__name__)

chromecasts_bp = Blueprint("chromecasts", __name__, url_prefix="/api/chromecasts")

MIN_TIMEOUT, MAX_TIMEOUT = 10, 60


@chromecasts_bp.route("/scan", methods=["GET"])
def scan_chromecasts():
    """Scan the network for Chromecasts (can take up to ``timeout`` seconds)."""
    timeout = max(MIN_TIMEOUT, min(int_arg("timeout", 20), MAX_TIMEOUT))
    try:
        devices = get_services().scanner.scan(timeout)
    except Exception as exc:
        logger.exception("Chromecast scan failed")
        return jsonify({"error": f"Chromecast scan failed: {exc}", "devices": []}), 500
    return jsonify({"devices": devices})
