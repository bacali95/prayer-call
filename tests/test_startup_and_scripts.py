import asyncio
from pathlib import Path

import pytest

from backend import startup
from backend.app import create_app
from backend.scripts import play_adhan, reschedule_prayers
from backend.services import MawaqitClient, MawaqitError
from backend.services import mawaqit_client as mc
from backend.services.prayer_schedule import refresh_prayer_times
from tests.conftest import MP3_BYTES


def configure(services, **extra):
    services.config.update({"mosque": {"uuid": "u-1"}, "chromecast": {"name": "Kitchen"}, **extra})


def test_create_app_has_no_side_effects(dirs, services, tmp_path):
    create_app(upload_dir=str(dirs[1]), services=services, static_dir=str(tmp_path))
    assert not Path(services.cron.tabfile).exists()
    assert services.mawaqit.calls == []


def test_refresh_prayer_times_flow(services):
    configure(services)
    times = refresh_prayer_times(services, "u-1")
    assert times["shuruq"] == "06:30"
    assert services.config.load()["prayer_times"] == times
    assert "reschedule" in {j["prayer"] for j in services.cron.get_scheduled_jobs()}


def test_refresh_without_scheduling(services):
    configure(services)
    refresh_prayer_times(services, "u-1", schedule=False)
    assert services.cron.get_scheduled_jobs() == []


def test_startup_schedules_today(services):
    configure(services)
    startup.schedule_on_startup(services)
    assert {j["prayer"] for j in services.cron.get_scheduled_jobs()} >= {"fajr", "reschedule"}


def test_startup_unconfigured_only_installs_reschedule_job(services):
    startup.schedule_on_startup(services)
    assert [j["prayer"] for j in services.cron.get_scheduled_jobs()] == ["reschedule"]
    assert services.mawaqit.calls == []


def test_startup_falls_back_to_stored_times_when_mawaqit_down(services):
    configure(services, prayer_times={"fajr": "05:05"})
    services.mawaqit.error = "down"
    startup.schedule_on_startup(services)
    jobs = {j["prayer"]: j for j in services.cron.get_scheduled_jobs()}
    assert jobs["fajr"]["planned_time"] == "05:05"


def test_start_background_runs_in_thread(services):
    thread = startup.start_background(services)
    thread.join(5)
    assert not thread.is_alive() and thread.daemon


# ------------------------------------------------------------ scripts


def test_play_adhan_plays_configured_file(services, dirs, monkeypatch):
    configure(services, adhan_files={"fajr": "a.mp3"}, adhan_volumes={"fajr": 0.4})
    (dirs[1] / "a.mp3").write_bytes(MP3_BYTES)
    monkeypatch.setenv("CONFIG_DIR", str(dirs[0]))
    monkeypatch.setenv("UPLOAD_DIR", str(dirs[1]))
    monkeypatch.setenv("PUBLIC_URL", "http://h:1")
    calls = []

    class Scanner:
        def play_media(self, name, url, volume=None):
            calls.append((name, url, volume))
            return True

    monkeypatch.setattr(play_adhan, "ChromecastScanner", Scanner)
    assert play_adhan.main(["fajr"]) == 0
    assert play_adhan.main(["Legacy Name", "fajr"]) == 0  # legacy two-arg form
    assert calls[0] == ("Kitchen", "http://h:1/api/files/a.mp3", 0.4)
    assert calls[1] == calls[0]  # chromecast comes from config, not argv


@pytest.mark.parametrize(
    ("argv", "code"), [([], 2), (["shuruq"], 2), (["a", "b", "c"], 2), (["fajr"], 1)]
)
def test_play_adhan_error_exit_codes(services, dirs, monkeypatch, argv, code):
    monkeypatch.setenv("CONFIG_DIR", str(dirs[0]))
    monkeypatch.setenv("UPLOAD_DIR", str(dirs[1]))
    assert play_adhan.main(argv) == code  # no chromecast configured -> 1


def test_play_adhan_missing_file_and_failed_playback(services, dirs, monkeypatch):
    configure(services, adhan_files={"fajr": "gone.mp3"})
    monkeypatch.setenv("CONFIG_DIR", str(dirs[0]))
    monkeypatch.setenv("UPLOAD_DIR", str(dirs[1]))
    assert play_adhan.main(["fajr"]) == 1
    (dirs[1] / "gone.mp3").write_bytes(MP3_BYTES)

    class FailingScanner:
        def play_media(self, *args, **kwargs):
            return False

    monkeypatch.setattr(play_adhan, "ChromecastScanner", FailingScanner)
    assert play_adhan.main(["fajr"]) == 1


def test_reschedule_script(services, dirs, monkeypatch):
    monkeypatch.setattr(reschedule_prayers, "build_services", lambda: services)
    assert reschedule_prayers.main() == 0  # nothing configured
    configure(services)
    assert reschedule_prayers.main() == 0
    assert services.config.load()["prayer_times"]["fajr"] == "05:00"
    services.mawaqit.error = "down"
    assert reschedule_prayers.main() == 1


# ------------------------------------------------------- mawaqit client


def test_mawaqit_client_requires_credentials(services):
    with pytest.raises(MawaqitError, match="credentials"):
        MawaqitClient(services.config).search_mosques("x")


def test_mawaqit_client_wraps_errors(services, monkeypatch):
    services.config.update({"mawaqit": {"username": "u", "password": "p"}})
    closed = []

    class Fake:
        def __init__(self, **kw):
            self.kw = kw

            self.session = object()

        async def get_api_token(self):
            return "t"

        async def fetch_prayer_times(self):
            raise RuntimeError("network")

        async def close(self):
            closed.append(1)

    async def fake_search(session, token, q):
        assert token == "t"
        return {"mosques": [{"uuid": q}]}

    monkeypatch.setattr(mc, "AsyncMawaqitClient", Fake)
    monkeypatch.setattr(mc, "_search_request", fake_search)
    client = MawaqitClient(services.config)
    assert client.search_mosques("abc") == [{"uuid": "abc"}]
    with pytest.raises(MawaqitError, match="network"):
        client.get_prayer_times("m")
    assert len(closed) == 2


class _FakeResponse:
    def __init__(self, status, payload):
        self.status, self._payload = status, payload

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def json(self):
        return self._payload


class _FakeSession:
    def __init__(self, status, payload):
        self.status, self.payload, self.calls = status, payload, []

    def get(self, url, params=None, headers=None):
        self.calls.append((url, params, headers))
        return _FakeResponse(self.status, self.payload)


def test_search_request_uses_api_access_token_header():
    # Mawaqit's search endpoint rejects ``Authorization`` (401) since late 2026.
    session = _FakeSession(200, [{"uuid": "x"}])
    assert asyncio.run(mc._search_request(session, "tok", "etihad")) == [{"uuid": "x"}]
    url, params, headers = session.calls[0]
    assert url == mc.SEARCH_MOSQUES_URL
    assert params == {"word": "etihad"}
    assert headers["Api-Access-Token"] == "tok"
    assert "Authorization" not in headers


def test_search_request_empty_result_is_not_an_error():
    assert asyncio.run(mc._search_request(_FakeSession(200, []), "tok", "zzz")) == []


def test_search_request_non_200_raises():
    with pytest.raises(MawaqitError, match="401"):
        asyncio.run(mc._search_request(_FakeSession(401, None), "tok", "x"))


def test_mawaqit_client_bad_credentials(services, monkeypatch):
    services.config.update({"mawaqit": {"username": "u", "password": "p"}})

    class Fake:
        def __init__(self, **kw):
            pass

        async def get_api_token(self):
            raise mc.BadCredentialsException("nope")

        async def close(self):
            pass

    monkeypatch.setattr(mc, "AsyncMawaqitClient", Fake)
    with pytest.raises(MawaqitError, match="rejected"):
        MawaqitClient(services.config).get_prayer_times("m")


def test_startup_fallback_skips_only_the_bad_prayer(services):
    configure(services, prayer_times={"fajr": "05:05", "asr": "bogus", "isha": "21:00"})
    services.mawaqit.error = "down"
    startup.schedule_on_startup(services)
    assert {j["prayer"] for j in services.cron.get_scheduled_jobs()} == {
        "fajr",
        "isha",
        "reschedule",
    }


def test_refresh_with_one_bad_time_schedules_the_rest(services):
    configure(services)
    payload = {
        "calendar": [
            {str(d): ["05:00", "06:30", "13:00", "bad", "19:00", "21:00"] for d in range(1, 32)}
        ]
        * 12
    }
    services.mawaqit.payload = payload
    refresh_prayer_times(services, "u-1")
    assert {j["prayer"] for j in services.cron.get_scheduled_jobs()} == {
        "fajr",
        "dhuhr",
        "maghrib",
        "isha",
        "reschedule",
    }


def test_startup_without_mosque_uses_stored_times(services):
    services.config.update({"chromecast": {"name": "K"}, "prayer_times": {"fajr": "05:05"}})
    startup.schedule_on_startup(services)
    assert services.mawaqit.calls == []
    assert {j["prayer"] for j in services.cron.get_scheduled_jobs()} == {"fajr", "reschedule"}
