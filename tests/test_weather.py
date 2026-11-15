import pytest
import requests

from backend.services import weather_client
from backend.services.weather_client import (
    WeatherClient,
    _owm_condition,
    _weatherapi_condition,
    _wmo_condition,
)

LOCATION = {"name": "Alphen", "latitude": 52.13, "longitude": 4.66}


class FakeResponse:
    def __init__(self, body, status=200):
        self.body, self.status_code = body, status
        self.ok = 200 <= status < 300

    def json(self):
        if isinstance(self.body, Exception):
            raise self.body
        return self.body


@pytest.fixture
def http(monkeypatch):
    """Record requests.get calls and answer with ``http.response``."""

    class Http:
        response: FakeResponse | Exception = FakeResponse({})
        calls: list[tuple[str, dict]] = []

    h = Http()
    h.calls = []

    def fake_get(url, params=None, timeout=None):
        h.calls.append((url, params))
        if isinstance(h.response, Exception):
            raise h.response
        return h.response

    monkeypatch.setattr(weather_client.requests, "get", fake_get)
    return h


def enable(services, **weather):
    services.config.update({"weather": {"enabled": True, "location": LOCATION, **weather}})


# ------------------------------------------------------------ condition maps


@pytest.mark.parametrize(
    ("code", "expected"),
    [
        (0, "clear"),
        (2, "partly-cloudy"),
        (3, "cloudy"),
        (45, "fog"),
        (53, "drizzle"),
        (63, "rain"),
        (81, "rain"),
        (73, "snow"),
        (86, "snow"),
        (95, "thunderstorm"),
    ],
)
def test_wmo_condition(code, expected):
    assert _wmo_condition(code) == expected


@pytest.mark.parametrize(
    ("code", "expected"),
    [
        (211, "thunderstorm"),
        (301, "drizzle"),
        (500, "rain"),
        (511, "snow"),
        (601, "snow"),
        (741, "fog"),
        (800, "clear"),
        (802, "partly-cloudy"),
        (804, "cloudy"),
    ],
)
def test_owm_condition(code, expected):
    assert _owm_condition(code) == expected


@pytest.mark.parametrize(
    ("code", "expected"),
    [
        (1000, "clear"),
        (1003, "partly-cloudy"),
        (1009, "cloudy"),
        (1135, "fog"),
        (1153, "drizzle"),
        (1189, "rain"),
        (1063, "rain"),
        (1225, "snow"),
        (1276, "thunderstorm"),
    ],
)
def test_weatherapi_condition(code, expected):
    assert _weatherapi_condition(code) == expected


# ------------------------------------------------------------------ providers


def test_disabled_or_without_location_is_none(services, http):
    assert services.weather.current() is None
    services.config.update({"weather": {"enabled": True}})
    assert services.weather.current() is None
    assert http.calls == []


def test_open_meteo(services, http):
    enable(services, units="imperial")
    http.response = FakeResponse(
        {"current": {"temperature_2m": 51.4, "weather_code": 61, "is_day": 0}}
    )
    w = services.weather.current()
    assert w["temperature"] == 51.4 and w["condition"] == "rain" and w["is_day"] is False
    assert w["provider"] == "open-meteo" and w["units"] == "imperial"
    assert w["location"] == "Alphen" and w["description"] == "Rain"
    url, params = http.calls[0]
    assert "open-meteo" in url and params["temperature_unit"] == "fahrenheit"
    assert params["latitude"] == 52.13


def test_openweathermap(services, http):
    enable(services, provider="openweathermap")
    services.config.update({"weather_api_keys": {"openweathermap": "owm-key"}})
    http.response = FakeResponse(
        {
            "main": {"temp": 9.5},
            "weather": [{"id": 802, "description": "scattered clouds", "icon": "03n"}],
        }
    )
    w = services.weather.current()
    assert w["temperature"] == 9.5 and w["condition"] == "partly-cloudy"
    assert w["is_day"] is False and w["description"] == "Scattered clouds"
    assert http.calls[0][1]["appid"] == "owm-key" and http.calls[0][1]["units"] == "metric"


def test_weatherapi(services, http):
    enable(services, provider="weatherapi", units="imperial")
    services.config.update({"weather_api_keys": {"weatherapi": "wa-key"}})
    http.response = FakeResponse(
        {
            "current": {
                "temp_c": 10,
                "temp_f": 50,
                "is_day": 1,
                "condition": {"code": 1000, "text": "Sunny"},
            }
        }
    )
    w = services.weather.current()
    assert w["temperature"] == 50 and w["condition"] == "clear" and w["description"] == "Sunny"
    assert http.calls[0][1] == {"key": "wa-key", "q": "52.13,4.66", "aqi": "no"}


def test_missing_key_is_an_error(services, http):
    enable(services, provider="weatherapi")
    with pytest.raises(weather_client.WeatherError, match="API key not configured"):
        services.weather.current()
    assert http.calls == []


@pytest.mark.parametrize(
    ("response", "message"),
    [
        (FakeResponse({}, 401), "rejected the API key"),
        (FakeResponse({}, 500), "HTTP 500"),
        (FakeResponse(ValueError("bad")), "invalid JSON"),
        (FakeResponse({"current": {}}), "unexpected answer"),
        (requests.ConnectionError("down"), "unreachable"),
    ],
)
def test_provider_failures(services, http, response, message):
    enable(services)
    http.response = response
    with pytest.raises(weather_client.WeatherError, match=message):
        services.weather.current()


def test_answers_are_cached(services, http):
    enable(services)
    http.response = FakeResponse({"current": {"temperature_2m": 5, "weather_code": 0}})
    services.weather.current()
    services.weather.current()
    assert len(http.calls) == 1
    services.config.update({"weather": {"units": "imperial"}})  # new cache key
    services.weather.current()
    assert len(http.calls) == 2


def test_cache_expires(services, http):
    services.weather = WeatherClient(services.config, ttl=0)
    enable(services)
    http.response = FakeResponse({"current": {"temperature_2m": 5, "weather_code": 0}})
    services.weather.current()
    services.weather.current()
    assert len(http.calls) == 2


# --------------------------------------------------------------------- routes


def test_current_route(client, services, http):
    assert client.get("/api/weather/current").get_json() == {"weather": None}
    enable(services)
    http.response = FakeResponse({"current": {"temperature_2m": 21.2, "weather_code": 1}})
    body = client.get("/api/weather/current").get_json()
    assert body["weather"]["temperature"] == 21.2
    assert body["weather"]["condition"] == "partly-cloudy"


def test_current_route_error_is_503(client, services, http):
    enable(services, provider="openweathermap")
    resp = client.get("/api/weather/current")
    assert resp.status_code == 503 and "API key" in resp.get_json()["error"]


def test_providers_route(client):
    providers = client.get("/api/weather/providers").get_json()["providers"]
    assert [p["id"] for p in providers] == ["open-meteo", "openweathermap", "weatherapi"]
    assert providers[0]["needs_key"] is False and providers[1]["needs_key"] is True


def test_geocode_route(client, http):
    http.response = FakeResponse(
        {
            "results": [
                {
                    "name": "Alphen aan den Rijn",
                    "admin1": "South Holland",
                    "country": "Netherlands",
                    "latitude": 52.13,
                    "longitude": 4.66,
                },
                {"name": "broken"},
            ]
        }
    )
    body = client.get("/api/weather/geocode?q=alphen").get_json()
    assert body == {
        "places": [
            {
                "name": "Alphen aan den Rijn",
                "region": "South Holland, Netherlands",
                "latitude": 52.13,
                "longitude": 4.66,
            }
        ]
    }
    assert http.calls[0][1]["name"] == "alphen"


def test_geocode_route_validation_and_errors(client, http):
    assert client.get("/api/weather/geocode?q=a").status_code == 400
    assert client.get(f"/api/weather/geocode?q={'x' * 101}").status_code == 400
    http.response = FakeResponse({}, 500)
    assert client.get("/api/weather/geocode?q=alphen").status_code == 502
    http.response = FakeResponse({})
    assert client.get("/api/weather/geocode?q=nowhere").get_json() == {"places": []}


# --------------------------------------------------------------------- config


def test_config_weather_settings_and_redacted_keys(client, services):
    resp = client.post(
        "/api/config",
        json={
            "weather": {
                "enabled": True,
                "provider": "weatherapi",
                "units": "imperial",
                "location": LOCATION,
            },
            "weather_api_keys": {"weatherapi": "  sekrit  "},
        },
    )
    body = resp.get_json()
    assert resp.status_code == 200
    assert body["weather"] == {
        "enabled": True,
        "provider": "weatherapi",
        "units": "imperial",
        "location": LOCATION,
    }
    assert "weather_api_keys" not in body and body["weather_keys_configured"] == ["weatherapi"]
    assert services.config.load()["weather_api_keys"] == {"weatherapi": "sekrit"}

    # Partial update keeps the other settings; "" clears a key.
    body = client.post(
        "/api/config", json={"weather": {"enabled": False}, "weather_api_keys": {"weatherapi": ""}}
    ).get_json()
    assert body["weather"]["provider"] == "weatherapi" and body["weather"]["enabled"] is False
    assert body["weather_keys_configured"] == []


def test_config_weather_defaults(client):
    body = client.get("/api/config").get_json()
    assert body["weather"] == {
        "enabled": False,
        "provider": "open-meteo",
        "units": "metric",
        "location": None,
    }
    assert body["weather_keys_configured"] == []


@pytest.mark.parametrize(
    "body",
    [
        {"weather": "on"},
        {"weather": {"enabled": "yes"}},
        {"weather": {"provider": "nope"}},
        {"weather": {"units": "kelvin"}},
        {"weather": {"colour": "blue"}},
        {"weather": {"location": "Alphen"}},
        {"weather": {"location": {"latitude": 91, "longitude": 0}}},
        {"weather": {"location": {"latitude": 0, "longitude": "4"}}},
        {"weather": {"location": {"latitude": True, "longitude": 0}}},
        {"weather_api_keys": "k"},
        {"weather_api_keys": {"open-meteo": "k"}},
        {"weather_api_keys": {"weatherapi": 5}},
    ],
)
def test_config_weather_validation(client, body):
    assert client.post("/api/config", json=body).status_code == 400
