"""Weather routes (screensaver weather and location search)"""

from flask import Blueprint, jsonify, request
from werkzeug.exceptions import BadRequest

from backend.services.weather_client import PROVIDERS, WeatherError

from ._common import get_services

weather_bp = Blueprint("weather", __name__, url_prefix="/api/weather")


@weather_bp.route("/current", methods=["GET"])
def current_weather():
    """Current weather; ``{"weather": null}`` when it is off or has no location."""
    try:
        return jsonify({"weather": get_services().weather.current()})
    except WeatherError as exc:
        return jsonify({"error": str(exc)}), 503


@weather_bp.route("/providers", methods=["GET"])
def providers():
    return jsonify(
        {
            "providers": [
                {"id": p.id, "name": p.name, "needs_key": p.needs_key, "url": p.url}
                for p in PROVIDERS.values()
            ]
        }
    )


@weather_bp.route("/geocode", methods=["GET"])
def geocode():
    query = (request.args.get("q") or "").strip()
    if len(query) < 2:
        raise BadRequest("Query parameter 'q' needs at least 2 characters")
    if len(query) > 100:
        raise BadRequest("Query parameter 'q' is too long")
    try:
        return jsonify({"places": get_services().weather.geocode(query)})
    except WeatherError as exc:
        return jsonify({"error": str(exc)}), 502
