import json
from pathlib import Path

import pytest

from backend.app import create_app
from backend.config import ConfigManager
from backend.services import (
    CronManager,
    MawaqitError,
    Services,
    UnsplashClient,
    WeatherClient,
)

MP3_BYTES = b"ID3\x04\x00\x00\x00\x00\x00\x00" + b"\x00" * 64

CALENDAR_PAYLOAD = {
    "calendar": [
        {str(d): ["05:00", "06:30", "13:00", "16:00", "19:00", "21:00"] for d in range(1, 32)}
        for _ in range(12)
    ]
}


class FakeMawaqit:
    def __init__(self):
        self.mosques = [{"uuid": "u-1", "name": "Mosque One", "localisation": "Street 1"}]
        self.payload = CALENDAR_PAYLOAD
        self.error: str | None = None
        self.calls: list[tuple] = []

    def search_mosques(self, query):
        self.calls.append(("search", query))
        if self.error:
            raise MawaqitError(self.error)
        return self.mosques

    def get_prayer_times(self, mosque_id):
        self.calls.append(("times", mosque_id))
        if self.error:
            raise MawaqitError(self.error)
        return self.payload


class FakeScanner:
    def __init__(self):
        self.devices = [
            {
                "name": "Kitchen",
                "uuid": "abc",
                "model_name": "Nest",
                "cast_type": "audio",
                "host": "1.2.3.4",
            }
        ]
        self.scan_error: Exception | None = None
        self.play_ok = True
        self.scan_timeouts: list[int] = []
        self.played: list[tuple] = []

    def scan(self, timeout=10):
        self.scan_timeouts.append(timeout)
        if self.scan_error:
            raise self.scan_error
        return self.devices

    def play_media(self, name, url, volume=None):
        self.played.append((name, url, volume))
        return self.play_ok


@pytest.fixture
def dirs(tmp_path: Path):
    config_dir, upload_dir, log_dir = (tmp_path / n for n in ("config", "uploads", "logs"))
    for d in (config_dir, upload_dir, log_dir):
        d.mkdir()
    return config_dir, upload_dir, log_dir


@pytest.fixture
def services(dirs, tmp_path):
    config_dir, upload_dir, log_dir = dirs
    config = ConfigManager(str(config_dir))
    return Services(
        config=config,
        cron=CronManager(
            log_dir=str(log_dir),
            config_dir=str(config_dir),
            upload_dir=str(upload_dir),
            tabfile=str(tmp_path / "crontab"),
            python="/usr/bin/python3",
            project_root=tmp_path / "root",
        ),
        mawaqit=FakeMawaqit(),
        scanner=FakeScanner(),
        unsplash=UnsplashClient(config),
        weather=WeatherClient(config),
    )


@pytest.fixture
def static_dir(tmp_path):
    d = tmp_path / "static"
    (d / "assets").mkdir(parents=True)
    (d / "index.html").write_text("<html>spa</html>")
    (d / "assets" / "app.js").write_text("console.log(1)")
    return d


@pytest.fixture
def app(dirs, services, static_dir):
    _, upload_dir, _ = dirs
    return create_app(upload_dir=str(upload_dir), services=services, static_dir=str(static_dir))


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def write_config(dirs):
    def _write(data):
        (dirs[0] / "config.json").write_text(json.dumps(data))

    return _write
