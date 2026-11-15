"""Test routes"""

import os
from urllib.parse import quote

from flask import Blueprint, jsonify
from werkzeug.exceptions import BadRequest, NotFound

from backend import settings

from ._common import get_services, json_object, upload_dir

test_bp = Blueprint("test", __name__, url_prefix="/api/test")


@test_bp.route("/play", methods=["POST"])
def test_play():
    """Play an uploaded adhan file on a Chromecast."""
    data = json_object()
    name = data.get("chromecast_name")
    filename = data.get("filename")
    volume = data.get("volume")

    if not isinstance(name, str) or not name.strip() or len(name) > 200:
        raise BadRequest("chromecast_name is required")
    if not isinstance(filename, str) or not filename or os.path.basename(filename) != filename:
        raise BadRequest("filename is required")
    if volume is not None and (
        isinstance(volume, bool) or not isinstance(volume, (int, float)) or not 0 <= volume <= 1
    ):
        raise BadRequest("volume must be a number between 0 and 1")
    if not os.path.isfile(os.path.join(upload_dir(), filename)):
        raise NotFound(f"File '{filename}' not found")

    media_url = f"{settings.media_base_url()}/api/files/{quote(filename)}"
    if get_services().scanner.play_media(name, media_url, volume=volume):
        return jsonify({"message": "Playing adhan"})
    return jsonify({"error": "Failed to play adhan"}), 500
