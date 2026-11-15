"""Route blueprints"""

from .chromecasts import chromecasts_bp
from .config import config_bp
from .cron import cron_bp
from .files import files_bp
from .mosques import mosques_bp
from .screensaver import screensaver_bp
from .test import test_bp

ALL_BLUEPRINTS = (
    config_bp,
    mosques_bp,
    chromecasts_bp,
    files_bp,
    cron_bp,
    test_bp,
    screensaver_bp,
)

__all__ = [
    "ALL_BLUEPRINTS",
    "chromecasts_bp",
    "config_bp",
    "cron_bp",
    "files_bp",
    "mosques_bp",
    "screensaver_bp",
    "test_bp",
]
