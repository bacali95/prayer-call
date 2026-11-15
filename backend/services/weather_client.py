"""Current weather from one of several providers, normalised to one shape.

Every provider answers with the same dict::

    {"temperature": 12.3, "units": "metric", "condition": "rain",
     "description": "Light rain", "is_day": True, "provider": "open-meteo",
     "location": "Alphen aan den Rijn", "updated_at": "2026-11-15T13:30:00+00:00"}

``condition`` is one of ``CONDITIONS``; the frontend picks the icon from it.
Answers are cached in memory for ``CACHE_TTL`` seconds per provider/location/units
so many open screensavers never hammer a provider (or burn an API quota).
"""

import logging
import threading
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

import requests

if TYPE_CHECKING:
    from backend.config import ConfigManager

logger = logging.getLogger(__name__)

TIMEOUT = 10
CACHE_TTL = 10 * 60
GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"

CONDITIONS = (
    "clear",
    "partly-cloudy",
    "cloudy",
    "fog",
    "drizzle",
    "rain",
    "snow",
    "thunderstorm",
)
UNITS = ("metric", "imperial")


class WeatherError(Exception):
    """The provider could not be reached, rejected the request, or is not configured."""


@dataclass(frozen=True)
class Provider:
    id: str
    name: str
    needs_key: bool
    url: str  # where to get a key / read about the service


# ---------------------------------------------------------------- open-meteo
def _wmo_condition(code: int) -> str:
    if code == 0:
        return "clear"
    if code in (1, 2):
        return "partly-cloudy"
    if code == 3:
        return "cloudy"
    if code in (45, 48):
        return "fog"
    if 51 <= code <= 57:
        return "drizzle"
    if 61 <= code <= 67 or 80 <= code <= 82:
        return "rain"
    if 71 <= code <= 77 or code in (85, 86):
        return "snow"
    if 95 <= code <= 99:
        return "thunderstorm"
    return "cloudy"


WMO_TEXT = {
    "clear": "Clear sky",
    "partly-cloudy": "Partly cloudy",
    "cloudy": "Overcast",
    "fog": "Fog",
    "drizzle": "Drizzle",
    "rain": "Rain",
    "snow": "Snow",
    "thunderstorm": "Thunderstorm",
}


def _open_meteo(lat: float, lon: float, units: str, _key: str | None) -> dict[str, Any]:
    params: dict[str, Any] = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,weather_code,is_day",
    }
    if units == "imperial":
        params["temperature_unit"] = "fahrenheit"
    body = _get_json("https://api.open-meteo.com/v1/forecast", params)
    cur = body.get("current") or {}
    condition = _wmo_condition(int(cur.get("weather_code", 3)))
    return {
        "temperature": float(cur["temperature_2m"]),
        "condition": condition,
        "description": WMO_TEXT[condition],
        "is_day": bool(cur.get("is_day", 1)),
    }


# ------------------------------------------------------------ openweathermap
def _owm_condition(code: int) -> str:
    if 200 <= code < 300:
        return "thunderstorm"
    if 300 <= code < 400:
        return "drizzle"
    if code == 511 or 600 <= code < 700:
        return "snow"
    if 500 <= code < 600:
        return "rain"
    if 700 <= code < 800:
        return "fog"
    if code == 800:
        return "clear"
    if code in (801, 802):
        return "partly-cloudy"
    return "cloudy"


def _openweathermap(lat: float, lon: float, units: str, key: str | None) -> dict[str, Any]:
    body = _get_json(
        "https://api.openweathermap.org/data/2.5/weather",
        {"lat": lat, "lon": lon, "appid": key, "units": units},
    )
    weather = (body.get("weather") or [{}])[0]
    return {
        "temperature": float(body["main"]["temp"]),
        "condition": _owm_condition(int(weather.get("id", 804))),
        "description": str(weather.get("description", "")).capitalize(),
        "is_day": not str(weather.get("icon", "d")).endswith("n"),
    }


# ---------------------------------------------------------------- weatherapi
_WA_PARTLY = {1003}
_WA_CLOUDY = {1006, 1009}
_WA_FOG = {1030, 1135, 1147}
_WA_THUNDER = {1087, 1273, 1276, 1279, 1282}
_WA_DRIZZLE = {1072, 1150, 1153, 1168, 1171}
_WA_SNOW = {1066, 1069, 1114, 1117, *range(1204, 1238), *range(1249, 1265)}


def _weatherapi_condition(code: int) -> str:
    if code == 1000:
        return "clear"
    for codes, condition in (
        (_WA_PARTLY, "partly-cloudy"),
        (_WA_CLOUDY, "cloudy"),
        (_WA_FOG, "fog"),
        (_WA_THUNDER, "thunderstorm"),
        (_WA_DRIZZLE, "drizzle"),
        (_WA_SNOW, "snow"),
    ):
        if code in codes:
            return condition
    return "rain"  # 1063, 1180-1201, 1240-1246


def _weatherapi(lat: float, lon: float, units: str, key: str | None) -> dict[str, Any]:
    body = _get_json(
        "https://api.weatherapi.com/v1/current.json",
        {"key": key, "q": f"{lat},{lon}", "aqi": "no"},
    )
    cur = body["current"]
    cond = cur.get("condition") or {}
    return {
        "temperature": float(cur["temp_f" if units == "imperial" else "temp_c"]),
        "condition": _weatherapi_condition(int(cond.get("code", 1009))),
        "description": str(cond.get("text", "")),
        "is_day": bool(cur.get("is_day", 1)),
    }


PROVIDERS: dict[str, Provider] = {
    p.id: p
    for p in (
        Provider("open-meteo", "Open-Meteo", False, "https://open-meteo.com"),
        Provider("openweathermap", "OpenWeatherMap", True, "https://openweathermap.org/api"),
        Provider("weatherapi", "WeatherAPI.com", True, "https://www.weatherapi.com"),
    )
}
_FETCHERS = {
    "open-meteo": _open_meteo,
    "openweathermap": _openweathermap,
    "weatherapi": _weatherapi,
}


def _get_json(url: str, params: dict[str, Any]) -> dict[str, Any]:
    try:
        res = requests.get(url, params=params, timeout=TIMEOUT)
    except requests.RequestException as exc:
        raise WeatherError(f"Weather provider unreachable: {exc.__class__.__name__}") from exc
    if res.status_code in (401, 403):
        raise WeatherError("The weather provider rejected the API key")
    if not res.ok:
        raise WeatherError(f"Weather provider returned HTTP {res.status_code}")
    try:
        body = res.json()
    except ValueError as exc:
        raise WeatherError("Weather provider returned invalid JSON") from exc
    if not isinstance(body, dict):
        raise WeatherError("Weather provider returned an unexpected answer")
    return body


class WeatherClient:
    def __init__(self, config_manager: "ConfigManager", ttl: float = CACHE_TTL):
        self.config_manager = config_manager
        self.ttl = ttl
        self._cache: dict[tuple, tuple[float, dict[str, Any]]] = {}
        self._lock = threading.Lock()

    def current(self) -> dict[str, Any] | None:
        """Current weather, or None when weather is off or has no location yet.

        Raises ``WeatherError`` when the provider fails or lacks its API key.
        """
        config = self.config_manager.load()
        settings = config.get("weather") or {}
        location = settings.get("location") or {}
        if not settings.get("enabled") or location.get("latitude") is None:
            return None

        provider = settings.get("provider") or "open-meteo"
        if provider not in PROVIDERS:
            raise WeatherError(f"Unknown weather provider: {provider}")
        key = (config.get("weather_api_keys") or {}).get(provider)
        if PROVIDERS[provider].needs_key and not key:
            raise WeatherError(f"{PROVIDERS[provider].name} API key not configured")

        units = settings.get("units") if settings.get("units") in UNITS else "metric"
        lat, lon = float(location["latitude"]), float(location["longitude"])
        cache_key = (provider, round(lat, 3), round(lon, 3), units, key)

        with self._lock:
            hit = self._cache.get(cache_key)
            if hit and time.monotonic() - hit[0] < self.ttl:
                return dict(hit[1])

        try:
            data = _FETCHERS[provider](lat, lon, units, key)
        except WeatherError:
            raise
        except (KeyError, TypeError, ValueError) as exc:
            logger.warning("Unexpected %s answer: %r", provider, exc)
            raise WeatherError("Weather provider returned an unexpected answer") from exc

        data.update(
            units=units,
            provider=provider,
            location=location.get("name"),
            updated_at=datetime.now(UTC).isoformat(timespec="seconds"),
        )
        with self._lock:
            self._cache = {cache_key: (time.monotonic(), data)}  # one location at a time
        return dict(data)

    @staticmethod
    def geocode(query: str) -> list[dict[str, Any]]:
        """Places matching ``query`` (Open-Meteo geocoding; free, no key)."""
        body = _get_json(GEOCODE_URL, {"name": query, "count": 8, "format": "json"})
        places = []
        for r in body.get("results") or []:
            try:
                places.append(
                    {
                        "name": r["name"],
                        "region": ", ".join(
                            str(p) for p in (r.get("admin1"), r.get("country")) if p
                        ),
                        "latitude": float(r["latitude"]),
                        "longitude": float(r["longitude"]),
                    }
                )
            except (KeyError, TypeError, ValueError):
                continue
        return places
