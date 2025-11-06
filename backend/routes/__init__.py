"""Route blueprints"""
from .config import config_bp
from .mosques import mosques_bp
from .chromecasts import chromecasts_bp
from .files import files_bp
from .cron import cron_bp
from .test import test_bp

__all__ = ['config_bp', 'mosques_bp', 'chromecasts_bp', 'files_bp', 'cron_bp', 'test_bp']

