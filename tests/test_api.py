import io
import json
from pathlib import Path

import pytest

from tests.conftest import MP3_BYTES


def post(client, url, body):
    return client.post(url, json=body)


def upload(client, name="adhan.mp3", data=MP3_BYTES, field="file"):
    return client.post(
        "/api/files",
        data={field: (io.BytesIO(data), name)},
        content_type="multipart/form-data",
    )


@pytest.fixture
def mp3(dirs):
    path = dirs[1] / "a.mp3"
    path.write_bytes(MP3_BYTES)
    return path


# ---------------------------------------------------------------- meta


def test_healthz_and_version(client):
    version = Path("VERSION").read_text().strip()
    assert client.get("/healthz").get_json() == {"status": "ok", "version": version}
    assert client.get("/api/version").get_json() == {"version": version}


def test_unknown_api_is_json_404(client):
    for method in ("get", "post", "delete"):
        resp = getattr(client, method)("/api/nope/at/all")
        assert resp.status_code == 404
        assert resp.is_json and "error" in resp.get_json()


def test_method_not_allowed_is_json(client):
    resp = client.put("/api/config", json={})
    assert resp.status_code in (404, 405) and resp.is_json


def test_spa_fallback_and_assets(client):
    assert b"spa" in client.get("/").data
    assert b"spa" in client.get("/some/client/route").data
    assert client.get("/assets/app.js").data == b"console.log(1)"
    assert client.get("/../../etc/passwd").status_code in (200, 404)
    assert b"spa" in client.get("/..%2f..%2fetc/passwd").data


def test_no_spa_without_static_dir(dirs, services, tmp_path):
    from backend.app import create_app

    app = create_app(upload_dir=str(dirs[1]), services=services, static_dir=str(tmp_path / "x"))
    assert app.test_client().get("/").status_code == 404


def test_unhandled_error_is_json_500(app, client):
    @app.get("/api/boom")
    def boom():
        raise RuntimeError("secret detail")

    resp = client.get("/api/boom")
    assert resp.status_code == 500
    assert resp.get_json() == {"error": "Internal server error"}


# -------------------------------------------------------------- config


def test_get_config_redacts_secrets(client, write_config):
    write_config(
        {
            "mawaqit": {"username": "u", "password": "hunter2"},
            "unsplash_access_key": "sekrit",
            "mosque": {"uuid": "m"},
        }
    )
    body = client.get("/api/config").get_json()
    assert "mawaqit" not in body and "unsplash_access_key" not in body
    assert body["unsplash_configured"] is True
    assert body["mosque"] == {"uuid": "m"}
    assert "hunter2" not in client.get("/api/config").get_data(as_text=True)


def test_get_config_defaults(client, monkeypatch):
    monkeypatch.delenv("UNSPLASH_ACCESS_KEY", raising=False)
    body = client.get("/api/config").get_json()
    assert body["unsplash_configured"] is False and body["prayer_times"] == {}


def test_post_config_happy_path_and_secret_handling(client, services, mp3, write_config):
    write_config({"mawaqit": {"username": "u", "password": "p"}})
    resp = post(
        client,
        "/api/config",
        {
            "mosque": {"uuid": "m1", "name": "M", "address": "A", "id": "m1"},
            "chromecast": {"name": "Kitchen", "host": "1.2.3.4"},
            "adhan_files": {"fajr": "a.mp3"},
            "adhan_volumes": {"fajr": 0.5, "isha": 1},
            "unsplash_access_key": "  key  ",
        },
    )
    assert resp.status_code == 200
    body = resp.get_json()
    assert "unsplash_access_key" not in body and body["unsplash_configured"] is True
    stored = services.config.load()
    assert stored["unsplash_access_key"] == "key"
    assert stored["mawaqit"] == {"username": "u", "password": "p"}
    assert stored["adhan_volumes"]["fajr"] == 0.5

    # partial merge: only changed keys are sent
    post(client, "/api/config", {"adhan_volumes": {"asr": 0.2}})
    assert services.config.load()["adhan_volumes"] == {
        "fajr": 0.5,
        "dhuhr": None,
        "asr": 0.2,
        "maghrib": None,
        "isha": 1,
    }
    # "" clears the key
    post(client, "/api/config", {"unsplash_access_key": ""})
    assert services.config.load()["unsplash_access_key"] is None
    # null clears a file assignment
    post(client, "/api/config", {"adhan_files": {"fajr": None}})
    assert services.config.load()["adhan_files"]["fajr"] is None


@pytest.mark.parametrize(
    "body",
    [
        [],
        "str",
        {"mosque": "x"},
        {"mosque": {"name": "no uuid"}},
        {"mosque": {"uuid": 5}},
        {"chromecast": {"host": "x"}},
        {"chromecast": ["a"]},
        {"adhan_files": {"shuruq": "a.mp3"}},
        {"adhan_files": {"fajr": "missing.mp3"}},
        {"adhan_files": {"fajr": "../a.mp3"}},
        {"adhan_files": {"fajr": 5}},
        {"adhan_files": []},
        {"adhan_volumes": {"fajr": 1.5}},
        {"adhan_volumes": {"fajr": -0.1}},
        {"adhan_volumes": {"fajr": "loud"}},
        {"adhan_volumes": {"fajr": True}},
        {"adhan_volumes": {"bogus": 0.5}},
        {"unsplash_access_key": 5},
        {"prayer_times": {"fajr": "25:00"}},
        {"prayer_times": {"zuhr": "13:00"}},
        {"prayer_times": []},
    ],
)
def test_post_config_validation(client, services, mp3, body):
    before = services.config.load()
    resp = post(client, "/api/config", body)
    assert resp.status_code == 400
    assert "error" in resp.get_json()
    assert services.config.load() == before


def test_post_config_requires_json(client):
    assert client.post("/api/config", data="x", content_type="text/plain").status_code == 400
    assert client.post("/api/config").status_code == 400


def test_post_prayer_times_schedules_cron(client, services):
    post(client, "/api/config", {"chromecast": {"name": "K"}})
    resp = post(
        client,
        "/api/config",
        {"prayer_times": {"fajr": "05:00", "shuruq": "06:30", "isha": "21:00"}},
    )
    assert resp.status_code == 200
    scheduled = {j["prayer"] for j in services.cron.get_scheduled_jobs()}
    assert scheduled == {"fajr", "isha", "reschedule"}
    assert services.config.load()["prayer_times"]["shuruq"] == "06:30"


def test_post_prayer_times_without_chromecast_does_not_schedule(client, services):
    post(client, "/api/config", {"prayer_times": {"fajr": "05:00"}})
    assert services.cron.get_scheduled_jobs() == []


def test_scheduling_failure_is_reported_not_fatal(client, services, monkeypatch):
    def boom(_):
        raise OSError("no crontab")

    monkeypatch.setattr(services.cron, "schedule_prayers", boom)
    resp = post(
        client, "/api/config", {"chromecast": {"name": "K"}, "prayer_times": {"fajr": "05:00"}}
    )
    assert resp.status_code == 200 and resp.get_json()["scheduling_error"] == "no crontab"


# --------------------------------------------------------------- files


def test_upload_list_serve_delete(client, dirs):
    assert client.get("/api/files").get_json() == {"files": []}
    resp = upload(client, "My Adhan!.mp3")
    assert resp.status_code == 200 and resp.get_json()["filename"] == "My_Adhan.mp3"
    assert client.get("/api/files").get_json() == {
        "files": [{"name": "My_Adhan.mp3", "size": len(MP3_BYTES)}]
    }
    served = client.get("/api/files/My_Adhan.mp3")
    assert served.status_code == 200 and served.data == MP3_BYTES
    assert served.mimetype == "audio/mpeg"
    assert client.delete("/api/files/My_Adhan.mp3").status_code == 200
    assert client.delete("/api/files/My_Adhan.mp3").status_code == 404
    assert client.get("/api/files/My_Adhan.mp3").status_code == 404
    assert list(dirs[1].iterdir()) == []  # no temp files left


def test_upload_accepts_frame_sync_without_id3(client):
    assert upload(client, "raw.mp3", b"\xff\xfb\x90\x00" + b"\0" * 32).status_code == 200


def test_upload_conflict_does_not_overwrite(client, dirs):
    assert upload(client, "dup.mp3").status_code == 200
    resp = upload(client, "dup.mp3", MP3_BYTES + b"different")
    assert resp.status_code == 409 and "already exists" in resp.get_json()["error"]
    assert (dirs[1] / "dup.mp3").read_bytes() == MP3_BYTES


@pytest.mark.parametrize(
    "kwargs",
    [
        {"name": ""},
        {"name": "....mp3.exe"},
        {"name": "///"},
        {"name": "notes.txt"},
        {"name": "evil.mp3", "data": b"MZ\x90\x00 not audio"},
        {"name": "empty.mp3", "data": b""},
        {"name": "x.mp3", "field": "wrong"},
    ],
)
def test_upload_rejections(client, dirs, kwargs):
    resp = upload(client, **kwargs)
    assert resp.status_code == 400 and "error" in resp.get_json()
    assert list(dirs[1].iterdir()) == []


def test_upload_no_file_field(client):
    assert client.post("/api/files", data={}, content_type="multipart/form-data").status_code == 400


def test_upload_too_large(app, client):
    app.config["MAX_CONTENT_LENGTH"] = 1024
    resp = upload(client, "big.mp3", MP3_BYTES + b"0" * 4096)
    assert resp.status_code == 413 and resp.is_json


def test_path_traversal_on_files(client, dirs):
    (dirs[0] / "secret.mp3").write_bytes(MP3_BYTES)
    assert client.get("/api/files/..%2Fconfig%2Fsecret.mp3").status_code == 404
    assert client.delete("/api/files/..%2Fconfig%2Fsecret.mp3").status_code == 404
    assert (dirs[0] / "secret.mp3").exists()


def test_serve_non_mp3_refused(client, dirs):
    (dirs[1] / "note.txt").write_text("hi")
    assert client.get("/api/files/note.txt").status_code == 404


# ---------------------------------------------------------------- cron


def test_cron_jobs_lifecycle(client, services, dirs):
    assert client.get("/api/cron/jobs").get_json() == {"jobs": []}
    services.cron.schedule_prayers({"fajr": "05:00", "asr": "16:00"})
    jobs = client.get("/api/cron/jobs").get_json()["jobs"]
    assert {j["prayer"] for j in jobs} == {"fajr", "asr", "reschedule"}
    assert set(jobs[0]) == {
        "prayer",
        "schedule",
        "planned_time",
        "command",
        "last_run",
        "executed_today",
    }

    assert client.delete("/api/cron/jobs/fajr").status_code == 200
    assert client.delete("/api/cron/jobs/fajr").status_code == 404
    bad = client.delete("/api/cron/jobs/reschedule")
    assert bad.status_code == 400 and bad.is_json
    assert client.delete("/api/cron/jobs/%24%28id%29").status_code == 400

    (dirs[2] / "prayer-call-asr.log").write_text("a\nb\nc\n")
    ok = client.get("/api/cron/jobs/asr/logs?max_lines=2").get_json()
    assert ok == {"logs": "b\nc\n", "prayer": "asr"}
    assert client.get("/api/cron/jobs/isha/logs").status_code == 404
    assert client.get("/api/cron/jobs/nope/logs").status_code == 400
    for bad_lines in ("0", "-5", "abc", "100000"):
        assert client.get(f"/api/cron/jobs/asr/logs?max_lines={bad_lines}").status_code == 400


# -------------------------------------------------------------- mosques


def test_mosque_search(client, services):
    body = client.get("/api/mosques/search?q=paris").get_json()
    assert body == {
        "mosques": [{"uuid": "u-1", "id": "u-1", "name": "Mosque One", "address": "Street 1"}]
    }
    assert services.mawaqit.calls == [("search", "paris")]
    assert client.get("/api/mosques/search").status_code == 400
    assert client.get("/api/mosques/search?q=" + "a" * 200).status_code == 400


def test_mosque_search_mawaqit_error_is_502(client, services):
    services.mawaqit.error = "Mawaqit is down"
    resp = client.get("/api/mosques/search?q=x")
    assert resp.status_code == 502 and resp.get_json() == {"error": "Mawaqit is down"}


def test_prayer_times_saves_and_schedules(client, services):
    services.config.update({"chromecast": {"name": "K"}})
    resp = client.get("/api/mosques/u-1/prayer-times")
    assert resp.status_code == 200
    assert resp.get_json() == {
        "fajr": "05:00",
        "shuruq": "06:30",
        "dhuhr": "13:00",
        "asr": "16:00",
        "maghrib": "19:00",
        "isha": "21:00",
    }
    stored = services.config.load()
    assert stored["prayer_times"]["shuruq"] == "06:30"
    assert set(stored["prayer_schedule_date"]) == {"gregorian", "hijri"}
    assert {j["prayer"] for j in services.cron.get_scheduled_jobs()} == {
        "fajr",
        "dhuhr",
        "asr",
        "maghrib",
        "isha",
        "reschedule",
    }


def test_prayer_times_without_chromecast_only_saves(client, services):
    assert client.get("/api/mosques/u-1/prayer-times").status_code == 200
    assert services.cron.get_scheduled_jobs() == []
    assert services.config.load()["prayer_times"]["fajr"] == "05:00"


def test_prayer_times_errors(client, services):
    services.mawaqit.error = "boom"
    resp = client.get("/api/mosques/u-1/prayer-times")
    assert resp.status_code == 502 and resp.get_json()["error"] == "boom"
    services.mawaqit.error = None
    services.mawaqit.payload = {"calendar": [{} for _ in range(12)]}
    assert client.get("/api/mosques/u-1/prayer-times").status_code == 502
    assert client.get("/api/mosques/bad%20id/prayer-times").status_code == 400


def test_calendar_explore_route_removed(client):
    assert client.get("/api/mosques/u-1/calendar/explore").status_code == 404


def test_prayer_times_year(client, services):
    resp = client.get("/api/mosques/u-1/prayer-times/year")
    body = resp.get_json()
    assert resp.status_code == 200
    assert body["year"] >= 2026 and len(body["data"]) in (365, 366)
    first = body["data"][0]
    assert first["dayOfYear"] == 1 and first["fajr"] == "05:00" and first["hijri"]
    assert len(body["dstTransitions"]) == 2


def test_prayer_times_year_errors(client, services):
    services.mawaqit.payload = {"calendar": []}
    assert client.get("/api/mosques/u-1/prayer-times/year").status_code == 502
    services.mawaqit.error = "down"
    assert client.get("/api/mosques/u-1/prayer-times/year").status_code == 502


# ---------------------------------------------------------- chromecasts


def test_chromecast_scan(client, services):
    assert client.get("/api/chromecasts/scan").get_json()["devices"][0]["name"] == "Kitchen"
    client.get("/api/chromecasts/scan?timeout=1")
    client.get("/api/chromecasts/scan?timeout=9999")
    assert services.scanner.scan_timeouts == [20, 10, 60]
    assert client.get("/api/chromecasts/scan?timeout=abc").status_code == 400


def test_chromecast_scan_error_is_reported(client, services):
    services.scanner.scan_error = RuntimeError("mdns failed")
    resp = client.get("/api/chromecasts/scan")
    assert resp.status_code == 500
    assert "mdns failed" in resp.get_json()["error"] and resp.get_json()["devices"] == []


# ------------------------------------------------------------ test/play


def test_play_builds_media_url(client, services, mp3, monkeypatch):
    monkeypatch.setenv("PUBLIC_URL", "http://cast.example:9000/")
    resp = post(
        client, "/api/test/play", {"chromecast_name": "Kitchen", "filename": "a.mp3", "volume": 0.3}
    )
    assert resp.status_code == 200
    assert services.scanner.played == [("Kitchen", "http://cast.example:9000/api/files/a.mp3", 0.3)]


def test_play_default_url_uses_local_ip_and_port(client, services, mp3, monkeypatch):
    monkeypatch.delenv("PUBLIC_URL", raising=False)
    monkeypatch.setenv("PORT", "4555")
    monkeypatch.setattr("backend.utils.network_utils.get_local_ip", lambda: "10.1.2.3")
    post(client, "/api/test/play", {"chromecast_name": "K", "filename": "a.mp3"})
    assert services.scanner.played[0][1] == "http://10.1.2.3:4555/api/files/a.mp3"


def test_play_failure(client, services, mp3):
    services.scanner.play_ok = False
    resp = post(client, "/api/test/play", {"chromecast_name": "K", "filename": "a.mp3"})
    assert resp.status_code == 500 and resp.get_json()["error"]


@pytest.mark.parametrize(
    ("body", "status"),
    [
        ({}, 400),
        ({"filename": "a.mp3"}, 400),
        ({"chromecast_name": "K"}, 400),
        ({"chromecast_name": "", "filename": "a.mp3"}, 400),
        ({"chromecast_name": 5, "filename": "a.mp3"}, 400),
        ({"chromecast_name": "K", "filename": "../a.mp3"}, 400),
        ({"chromecast_name": "K", "filename": "a.mp3", "volume": 2}, 400),
        ({"chromecast_name": "K", "filename": "a.mp3", "volume": "x"}, 400),
        ({"chromecast_name": "K", "filename": "gone.mp3"}, 404),
    ],
)
def test_play_validation(client, services, mp3, body, status):
    assert post(client, "/api/test/play", body).status_code == status
    assert services.scanner.played == []


def test_play_requires_json_body(client):
    assert client.post("/api/test/play").status_code == 400


# ---------------------------------------------------------- screensaver


def test_screensaver_without_key_is_503(client, monkeypatch):
    monkeypatch.delenv("UNSPLASH_ACCESS_KEY", raising=False)
    resp = client.get("/api/screensaver/slides")
    assert resp.status_code == 503 and "error" in resp.get_json()


def test_screensaver_with_key(client, services, monkeypatch):
    services.config.update({"unsplash_access_key": "k"})
    monkeypatch.setattr(services.unsplash, "get_slides", lambda: (["u1", "u2"], None))
    assert client.get("/api/screensaver/slides").get_json() == {"urls": ["u1", "u2"]}


# ----------------------------------------------------------- misc safety


def test_cors_not_open_to_arbitrary_origins(client):
    resp = client.get("/api/config", headers={"Origin": "http://evil.example"})
    assert "Access-Control-Allow-Origin" not in resp.headers
    ok = client.get("/api/config", headers={"Origin": "http://localhost:3000"})
    assert ok.headers["Access-Control-Allow-Origin"] == "http://localhost:3000"


def test_config_file_never_leaked_via_static(client, dirs):
    (dirs[0] / "config.json").write_text(json.dumps({"mawaqit": {"password": "p"}}))
    assert b"password" not in client.get("/config.json").data


def test_delete_file_unassigns_references(client, services, dirs):
    upload(client, "x.mp3")
    upload(client, "y.mp3")
    services.config.update({"adhan_files": {"fajr": "x.mp3", "isha": "x.mp3", "asr": "y.mp3"}})
    body = client.delete("/api/files/x.mp3").get_json()
    assert body["deleted"] == "x.mp3" and sorted(body["unassigned"]) == ["fajr", "isha"]
    files = services.config.load()["adhan_files"]
    assert files["fajr"] is None and files["isha"] is None and files["asr"] == "y.mp3"
    assert not (dirs[1] / "x.mp3").exists()
    assert client.delete("/api/files/y.mp3").get_json()["unassigned"] == ["asr"]
    upload(client, "z.mp3")
    assert client.delete("/api/files/z.mp3").get_json()["unassigned"] == []


def test_post_config_on_corrupt_file_is_json_500(client, dirs):
    (dirs[0] / "config.json").write_text("{nope")
    resp = post(client, "/api/config", {"mosque": None})
    assert resp.status_code == 500 and "unreadable" in resp.get_json()["error"]
    assert (dirs[0] / "config.json").read_text() == "{nope"
    assert client.get("/api/config").status_code == 200
