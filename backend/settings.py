"""Runtime settings resolved from the environment.

Everything is a function so tests can change the environment at will.
"""

import logging
import os
import re
from pathlib import Path

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PORT = 3001


def config_dir() -> str:
    return os.environ.get("CONFIG_DIR") or str(PROJECT_ROOT)


def upload_dir() -> str:
    return os.environ.get("UPLOAD_DIR") or str(PROJECT_ROOT / "uploads")


def log_dir() -> str:
    return os.environ.get("LOG_DIR") or "/var/log"


def static_dir() -> str:
    return str(PROJECT_ROOT / "static")


def port() -> int:
    try:
        return int(os.environ.get("PORT", DEFAULT_PORT))
    except ValueError:
        return DEFAULT_PORT


def media_base_url() -> str:
    """Base URL the Chromecast uses to fetch adhan files.

    ``PUBLIC_URL`` wins; otherwise ``http://<local ip>:<PORT>`` (the historical
    behaviour, which relies on the pod using the host network).
    """
    public_url = os.environ.get("PUBLIC_URL", "").strip()
    if public_url:
        return public_url.rstrip("/")
    from backend.utils.network_utils import get_local_ip

    return f"http://{get_local_ip()}:{port()}"


def cors_origins() -> list[str]:
    raw = os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    return [o.strip() for o in raw.split(",") if o.strip()]


def read_version(root: Path | None = None) -> str:
    path = (root or PROJECT_ROOT) / "VERSION"
    try:
        value = path.read_text(encoding="utf-8").strip()
    except OSError:
        return "unknown"
    return value if re.fullmatch(r"[\w.+-]{1,64}", value) else "unknown"


def configure_logging() -> None:
    """Idempotent root logger setup used by every entry point."""
    level = os.environ.get("LOG_LEVEL", "INFO").upper()
    logging.basicConfig(
        level=getattr(logging, level, logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
