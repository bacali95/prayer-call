import json
import os
import threading

import pytest

from backend.config import ConfigCorruptError, ConfigManager, default_config, redact


def test_missing_file_gives_defaults(dirs):
    cm = ConfigManager(str(dirs[0]))
    assert cm.load() == default_config()
    assert not os.path.exists(cm.config_file)  # loading never writes


def test_defaults_are_not_shared(dirs):
    cm = ConfigManager(str(dirs[0]))
    cm.load()["adhan_files"]["fajr"] = "x.mp3"
    assert cm.load()["adhan_files"]["fajr"] is None


def test_old_file_missing_keys_is_tolerated(dirs, write_config):
    write_config({"mosque": {"uuid": "u"}, "adhan_files": {"fajr": "a.mp3"}, "custom": 1})
    cfg = ConfigManager(str(dirs[0])).load()
    assert cfg["mosque"] == {"uuid": "u"}
    assert cfg["adhan_files"] == {
        "fajr": "a.mp3",
        "dhuhr": None,
        "asr": None,
        "maghrib": None,
        "isha": None,
    }
    assert cfg["adhan_volumes"]["isha"] is None
    assert cfg["mawaqit"] == {} and cfg["custom"] == 1


def test_null_and_wrong_typed_sections_fall_back(dirs, write_config):
    write_config({"mawaqit": None, "adhan_files": "oops"})
    cfg = ConfigManager(str(dirs[0])).load()
    assert cfg["mawaqit"] == {} and cfg["adhan_files"]["fajr"] is None


def test_corrupt_file_backed_up_and_not_overwritten_by_load(dirs):
    path = dirs[0] / "config.json"
    path.write_text("{not json")
    cm = ConfigManager(str(dirs[0]))
    assert cm.load() == default_config()
    cm.load()
    assert path.read_text() == "{not json"
    backups = list(dirs[0].glob("config.json.*.bak"))
    assert len(backups) == 1 and backups[0].read_text() == "{not json"


def test_non_object_json_is_treated_as_corrupt(dirs):
    (dirs[0] / "config.json").write_text("[1, 2]")
    cm = ConfigManager(str(dirs[0]))
    assert cm.load() == default_config()
    assert list(dirs[0].glob("*.bak"))


def test_update_partial_merge_and_persist(dirs, write_config):
    write_config({"mawaqit": {"username": "u", "password": "p"}})
    cm = ConfigManager(str(dirs[0]))
    cm.update({"adhan_files": {"fajr": "a.mp3"}})
    result = cm.update({"adhan_files": {"asr": "b.mp3"}, "mosque": {"uuid": "x"}})
    assert result["adhan_files"]["fajr"] == "a.mp3" and result["adhan_files"]["asr"] == "b.mp3"
    on_disk = json.loads((dirs[0] / "config.json").read_text())
    assert on_disk["mawaqit"] == {"username": "u", "password": "p"}  # credentials preserved
    assert on_disk["mosque"] == {"uuid": "x"}
    cm.update({"prayer_times": {"fajr": "05:00"}})
    cm.update({"prayer_times": {"isha": "21:00"}})
    assert cm.load()["prayer_times"] == {"isha": "21:00"}  # replaced, not merged


def test_atomic_write_leaves_no_temp_and_survives_failure(dirs, monkeypatch):
    cm = ConfigManager(str(dirs[0]))
    cm.update({"mosque": {"uuid": "keep"}})

    def boom(*_a, **_k):
        raise OSError("disk full")

    monkeypatch.setattr(os, "replace", boom)
    with pytest.raises(OSError):
        cm.update({"mosque": {"uuid": "lost"}})
    monkeypatch.undo()

    assert json.loads((dirs[0] / "config.json").read_text())["mosque"] == {"uuid": "keep"}
    assert not list(dirs[0].glob(".config-*"))
    assert cm.load()["mosque"] == {"uuid": "keep"}


def test_new_file_is_private(dirs):
    cm = ConfigManager(str(dirs[0]))
    cm.update({"mosque": None})
    assert os.stat(cm.config_file).st_mode & 0o777 == 0o600


def test_concurrent_updates_do_not_lose_writes(dirs):
    cm = ConfigManager(str(dirs[0]))
    prayers = ["fajr", "dhuhr", "asr", "maghrib", "isha"]
    threads = [
        threading.Thread(target=cm.update, args=({"adhan_files": {p: f"{p}.mp3"}},))
        for p in prayers
        for _ in range(5)
    ]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert cm.load()["adhan_files"] == {p: f"{p}.mp3" for p in prayers}


def test_cache_invalidated_on_external_change(dirs):
    cm = ConfigManager(str(dirs[0]))
    cm.update({"mosque": {"uuid": "a"}})
    (dirs[0] / "config.json").write_text(json.dumps({"mosque": {"uuid": "bbbbbb"}}))
    assert cm.load()["mosque"] == {"uuid": "bbbbbb"}


def test_redact_hides_secrets(monkeypatch):
    monkeypatch.delenv("UNSPLASH_ACCESS_KEY", raising=False)
    cfg = default_config()
    cfg["mawaqit"] = {"username": "u", "password": "p"}
    out = redact(cfg)
    assert "mawaqit" not in out and "unsplash_access_key" not in out
    assert out["unsplash_configured"] is False
    cfg["unsplash_access_key"] = "secret"
    assert redact(cfg)["unsplash_configured"] is True
    assert cfg["mawaqit"]  # input untouched
    monkeypatch.setenv("UNSPLASH_ACCESS_KEY", "env")
    assert redact(default_config())["unsplash_configured"] is True


def test_update_on_corrupt_file_raises_and_keeps_file(dirs):
    path = dirs[0] / "config.json"
    path.write_text("{broken")
    cm = ConfigManager(str(dirs[0]))
    with pytest.raises(ConfigCorruptError):
        cm.update({"mosque": {"uuid": "x"}})
    assert path.read_text() == "{broken"
    assert cm.load() == default_config()  # reads still work


def test_same_size_external_change_is_seen(dirs):
    cm = ConfigManager(str(dirs[0]))
    cm.update({"mosque": {"uuid": "aaaa"}})
    path = dirs[0] / "config.json"
    text = path.read_text()
    assert cm.load()["mosque"] == {"uuid": "aaaa"}
    other = dirs[0] / "other.json"
    other.write_text(text.replace("aaaa", "bbbb"))  # same size, replaced atomically
    os.utime(other, ns=(os.stat(path).st_atime_ns, os.stat(path).st_mtime_ns))  # same mtime too
    os.replace(other, path)
    assert cm.load()["mosque"] == {"uuid": "bbbb"}


def _worker(config_dir, prayer, n):
    cm = ConfigManager(config_dir)
    for i in range(n):
        cm.update({"adhan_files": {prayer: f"{prayer}{i}.mp3"}})


def test_cross_process_updates_do_not_lose_writes(dirs):
    import multiprocessing

    prayers = ["fajr", "dhuhr", "asr", "maghrib", "isha"]
    ctx = multiprocessing.get_context("spawn")
    procs = [ctx.Process(target=_worker, args=(str(dirs[0]), p, 15)) for p in prayers]
    [p.start() for p in procs]
    [p.join(60) for p in procs]
    assert all(p.exitcode == 0 for p in procs)
    assert ConfigManager(str(dirs[0])).load()["adhan_files"] == {p: f"{p}14.mp3" for p in prayers}
