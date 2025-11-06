"""Chromecast-related routes"""
from flask import Blueprint, request, jsonify
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from backend.services import ChromecastScanner

chromecasts_bp = Blueprint('chromecasts', __name__, url_prefix='/api/chromecasts')

# Initialize scanner (will be injected)
chromecast_scanner = None


def init_scanner(scanner: 'ChromecastScanner'):
    """Initialize scanner for this blueprint"""
    global chromecast_scanner
    chromecast_scanner = scanner


@chromecasts_bp.route("/scan", methods=["GET"])
def scan_chromecasts():
    """Scan for Chromecast devices"""
    try:
        timeout = int(request.args.get("timeout", 20))
        # Ensure minimum timeout of 10 seconds
        timeout = max(timeout, 10)
        devices = chromecast_scanner.scan(timeout)
        return jsonify({"devices": devices})
    except Exception as e:
        return jsonify({"error": str(e), "devices": []}), 500

