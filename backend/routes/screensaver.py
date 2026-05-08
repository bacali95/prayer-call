"""Screensaver routes"""
from typing import TYPE_CHECKING

from flask import Blueprint, jsonify

if TYPE_CHECKING:
    from backend.services import UnsplashClient

screensaver_bp = Blueprint("screensaver", __name__, url_prefix="/api/screensaver")

_unsplash: "UnsplashClient | None" = None


def init_client(client: "UnsplashClient") -> None:
    global _unsplash
    _unsplash = client


@screensaver_bp.route("/slides", methods=["GET"])
def get_slides():
    """Return shuffled landscape photo URLs from the Mekkah + Medina Unsplash collections."""
    if _unsplash is None:
        return jsonify({"error": "Unsplash client not initialised"}), 503

    urls, error = _unsplash.get_slides()
    if error:
        return jsonify({"error": error}), 503

    return jsonify({"urls": urls})
