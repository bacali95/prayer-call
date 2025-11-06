"""Test routes"""
from flask import Blueprint, request, jsonify
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from backend.services import ChromecastScanner

test_bp = Blueprint('test', __name__, url_prefix='/api/test')

# Initialize scanner (will be injected)
chromecast_scanner = None


def init_scanner(scanner: 'ChromecastScanner'):
    """Initialize scanner for this blueprint"""
    global chromecast_scanner
    chromecast_scanner = scanner


@test_bp.route("/play", methods=["POST"])
def test_play():
    """Test playing adhan on Chromecast"""
    data = request.json
    chromecast_name = data.get("chromecast_name")
    filename = data.get("filename")
    volume = data.get("volume")
    
    if not chromecast_name or not filename:
        return jsonify({"error": "chromecast_name and filename required"}), 400
    
    # Get full URL for the file
    base_url = request.host_url.rstrip("/")
    media_url = f"{base_url}/api/files/{filename}"
    
    success = chromecast_scanner.play_media(chromecast_name, media_url, volume=volume)
    
    if success:
        return jsonify({"message": "Playing adhan"})
    return jsonify({"error": "Failed to play adhan"}), 500

