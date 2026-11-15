"""Service modules and the services container."""

from dataclasses import dataclass

from backend.config import ConfigManager

from .chromecast_scanner import ChromecastScanner
from .cron_manager import CronManager
from .mawaqit_client import MawaqitClient, MawaqitError
from .unsplash_client import UnsplashClient


@dataclass
class Services:
    """Everything the routes need; tests swap members for fakes."""

    config: ConfigManager
    cron: CronManager
    mawaqit: MawaqitClient
    scanner: ChromecastScanner
    unsplash: UnsplashClient


def build_services(
    config_dir: str | None = None,
    log_dir: str | None = None,
    upload_dir: str | None = None,
) -> Services:
    config = ConfigManager(config_dir)
    return Services(
        config=config,
        cron=CronManager(log_dir=log_dir, config_dir=config.config_dir, upload_dir=upload_dir),
        mawaqit=MawaqitClient(config),
        scanner=ChromecastScanner(),
        unsplash=UnsplashClient(config),
    )


__all__ = [
    "ChromecastScanner",
    "CronManager",
    "MawaqitClient",
    "MawaqitError",
    "Services",
    "UnsplashClient",
    "build_services",
]
