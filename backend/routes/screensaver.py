"""Screensaver routes"""

from flask import Blueprint, jsonify

from ._common import get_services

screensaver_bp = Blueprint("screensaver", __name__, url_prefix="/api/screensaver")


@screensaver_bp.route("/slides", methods=["GET"])
def get_slides():
    """Shuffled landscape photo URLs from the Mekkah + Medina Unsplash collections."""
    urls, error = get_services().unsplash.get_slides()
    if error:
        return jsonify({"error": error}), 503
    return jsonify({"urls": urls})
