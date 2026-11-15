"""Play the adhan for one prayer on the configured Chromecast (run by cron).

Usage: ``play_adhan.py <prayer_key>``. The chromecast, file and volume all come
from the config. The legacy form ``play_adhan.py <chromecast_name> <prayer_key>``
is still accepted (the chromecast argument is ignored).
"""

import logging
import sys
from pathlib import Path
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend import settings  # noqa: E402
from backend.config import ConfigManager  # noqa: E402
from backend.constants import ADHAN_PRAYERS  # noqa: E402
from backend.services import ChromecastScanner  # noqa: E402

logger = logging.getLogger("play_adhan")


def main(argv: list[str] | None = None) -> int:
    settings.configure_logging()
    args = sys.argv[1:] if argv is None else argv
    if len(args) not in (1, 2):
        logger.error("Usage: play_adhan.py <prayer_key>")
        return 2
    prayer_key = args[-1]
    if prayer_key not in ADHAN_PRAYERS:
        logger.error("Unknown prayer %r", prayer_key)
        return 2

    config = ConfigManager().load()
    chromecast_name = (config.get("chromecast") or {}).get("name")
    if not chromecast_name:
        logger.error("No chromecast configured")
        return 1

    adhan_file = (config.get("adhan_files") or {}).get(prayer_key)
    if not adhan_file:
        logger.error("No adhan file configured for %s", prayer_key)
        return 1
    filename = Path(adhan_file).name
    adhan_path = Path(settings.upload_dir()) / filename
    if not adhan_path.exists():
        logger.error("Adhan file not found: %s", adhan_path)
        return 1

    volume = (config.get("adhan_volumes") or {}).get(prayer_key)
    media_url = f"{settings.media_base_url()}/api/files/{quote(filename)}"
    logger.info(
        "Playing %s adhan on %s (%s, volume=%s)", prayer_key, chromecast_name, media_url, volume
    )

    if ChromecastScanner().play_media(chromecast_name, media_url, volume=volume):
        logger.info("Started playing %s adhan on %s", prayer_key, chromecast_name)
        return 0
    logger.error("Failed to play adhan on %s", chromecast_name)
    return 1


if __name__ == "__main__":
    sys.exit(main())
