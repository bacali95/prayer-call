"""Configuration file management.

``config.json`` lives in ``CONFIG_DIR`` (a PVC directory in Kubernetes). Writes
are atomic (temp file in the same directory + ``os.replace``), serialised with
a lock, and a file that fails to parse is never silently replaced by defaults:
it is copied to a ``.bak`` file first and reads fall back to defaults only.
"""

import contextlib
import copy
import fcntl
import json
import logging
import os
import shutil
import tempfile
import threading
import time
from typing import Any

from backend.constants import ADHAN_PRAYERS

logger = logging.getLogger(__name__)

# Keys whose dict values are merged key by key instead of being replaced.
MERGE_KEYS = frozenset({"adhan_files", "adhan_volumes", "mawaqit", "weather", "weather_api_keys"})


class ConfigCorruptError(Exception):
    """config.json exists but cannot be parsed; refusing to overwrite it."""


Stamp = tuple[int, int, int]  # (inode, mtime_ns, size)


def default_config() -> dict[str, Any]:
    return {
        "mawaqit": {},
        "mosque": None,
        "chromecast": None,
        "adhan_files": dict.fromkeys(ADHAN_PRAYERS),
        "adhan_volumes": dict.fromkeys(ADHAN_PRAYERS),
        "prayer_times": {},
        "prayer_schedule_date": None,
        "unsplash_access_key": None,
        "weather": {
            "enabled": False,
            "provider": "open-meteo",
            "units": "metric",
            "location": None,
        },
        "weather_api_keys": {},
    }


def _merge_defaults(defaults: Any, loaded: Any) -> Any:
    """Overlay ``loaded`` onto ``defaults``; unknown keys in ``loaded`` survive."""
    if isinstance(defaults, dict) and isinstance(loaded, dict):
        merged = copy.deepcopy(defaults)
        for key, value in loaded.items():
            merged[key] = _merge_defaults(defaults[key], value) if key in defaults else value
        return merged
    if isinstance(defaults, dict) and loaded is None:
        return copy.deepcopy(defaults)  # e.g. "mawaqit": null in an old file
    if isinstance(defaults, dict):
        return copy.deepcopy(defaults)  # wrong type: fall back to defaults
    return loaded


def redact(config: dict[str, Any]) -> dict[str, Any]:
    """Public view of a config: no secrets, plus which keys are configured."""
    public = copy.deepcopy(config)
    public.pop("mawaqit", None)
    key = public.pop("unsplash_access_key", None)
    public["unsplash_configured"] = bool(key or os.environ.get("UNSPLASH_ACCESS_KEY"))
    weather_keys = public.pop("weather_api_keys", None) or {}
    public["weather_keys_configured"] = sorted(k for k, v in weather_keys.items() if v)
    return public


class ConfigManager:
    """Thread-safe loading and saving of the application configuration."""

    def __init__(self, config_dir: str | None = None, config_file: str = "config.json"):
        if config_dir is None:
            from backend import settings

            config_dir = settings.config_dir()
        self.config_dir = config_dir
        self.config_file = os.path.join(config_dir, config_file)
        self._lock = threading.RLock()
        self._cache: dict[str, Any] | None = None
        self._cache_stamp: Stamp | None = None
        self._backed_up_stamp: Stamp | None = None
        self._lock_file = self.config_file + ".lock"

    # ------------------------------------------------------------------ read
    @staticmethod
    def _stamp_of(st: os.stat_result) -> Stamp:
        return (st.st_ino, st.st_mtime_ns, st.st_size)

    def _backup_corrupt(self, stamp: Stamp) -> None:
        if self._backed_up_stamp == stamp:
            return
        self._backed_up_stamp = stamp
        backup = f"{self.config_file}.{time.strftime('%Y%m%d%H%M%S')}.bak"
        try:
            shutil.copy2(self.config_file, backup)
            logger.error("Config file is unreadable; copied to %s", backup)
        except OSError:
            logger.exception("Config file is unreadable and the backup copy failed")

    def _read(self) -> tuple[dict[str, Any], bool]:
        """Return ``(config, corrupt)``; ``corrupt`` means defaults stand in for a bad file."""
        with self._lock:
            try:
                st = os.stat(self.config_file)
            except FileNotFoundError:
                return default_config(), False
            except OSError:
                logger.exception("Cannot stat config file")
                return default_config(), True

            stamp = self._stamp_of(st)
            if self._cache is not None and stamp == self._cache_stamp:
                return copy.deepcopy(self._cache), False

            try:
                with open(self.config_file, encoding="utf-8") as f:
                    raw = json.load(f)
                if not isinstance(raw, dict):
                    raise ValueError("top-level JSON value is not an object")
            except (ValueError, OSError) as exc:
                logger.error("Error loading config: %s", exc)
                self._backup_corrupt(stamp)
                return default_config(), True

            config = _merge_defaults(default_config(), raw)
            self._cache, self._cache_stamp = config, stamp
            return copy.deepcopy(config), False

    def load(self) -> dict[str, Any]:
        """Load the config merged over defaults. A bad file reads as defaults (never written)."""
        return self._read()[0]

    # ----------------------------------------------------------------- write
    def save(self, config: dict[str, Any]) -> None:
        """Atomically write ``config``. Raises OSError on failure."""
        with self._lock:
            os.makedirs(self.config_dir, exist_ok=True)
            fd, tmp_path = tempfile.mkstemp(dir=self.config_dir, prefix=".config-", suffix=".tmp")
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as f:
                    json.dump(config, f, indent=2)
                    f.flush()
                    os.fsync(f.fileno())
                try:
                    os.chmod(tmp_path, os.stat(self.config_file).st_mode & 0o777)
                except FileNotFoundError:
                    os.chmod(tmp_path, 0o600)  # contains credentials
                stamp = self._stamp_of(os.stat(tmp_path))  # inode/mtime/size survive the rename
                os.replace(tmp_path, self.config_file)
            except BaseException:
                with contextlib.suppress(OSError):
                    os.unlink(tmp_path)
                raise
            self._cache = copy.deepcopy(config)
            self._cache_stamp = stamp

    @contextlib.contextmanager
    def _exclusive(self):
        """Thread lock plus an inter-process flock around a read-modify-write."""
        with self._lock:
            os.makedirs(self.config_dir, exist_ok=True)
            with open(self._lock_file, "a") as lock:
                fcntl.flock(lock, fcntl.LOCK_EX)
                try:
                    yield
                finally:
                    fcntl.flock(lock, fcntl.LOCK_UN)

    def update(self, updates: dict[str, Any]) -> dict[str, Any]:
        """Partially merge ``updates`` into the stored config and return the result.

        Keys in ``MERGE_KEYS`` merge key by key; every other key is replaced.
        Raises ``ConfigCorruptError`` instead of overwriting an unparseable file.
        """
        with self._exclusive():
            config, corrupt = self._read()
            if corrupt:
                raise ConfigCorruptError(
                    "config.json is unreadable; a backup copy was kept. Fix or remove it first."
                )
            for key, value in updates.items():
                if key in MERGE_KEYS and isinstance(value, dict):
                    config[key].update(value)
                else:
                    config[key] = copy.deepcopy(value)
            self.save(config)
            return config
