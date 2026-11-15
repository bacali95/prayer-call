"""Chromecast discovery and playback (pychromecast 14.x)."""

import logging
import time

import pychromecast
import zeroconf as zeroconf_module
from pychromecast.discovery import CastBrowser, SimpleCastListener

logger = logging.getLogger(__name__)


class ChromecastScanner:
    @staticmethod
    def _discover(timeout: float):
        """Start mDNS discovery and wait. Returns ``(browser, zconf)``; caller must close both."""
        zconf = zeroconf_module.Zeroconf()
        browser = CastBrowser(SimpleCastListener(), zconf)
        browser.start_discovery()
        time.sleep(timeout)
        return browser, zconf

    @staticmethod
    def _close(browser, zconf) -> None:
        try:
            browser.stop_discovery()
        except Exception:
            logger.warning("Error stopping discovery", exc_info=True)
        try:
            zconf.close()
        except Exception:
            logger.warning("Error closing zeroconf", exc_info=True)

    def scan(self, timeout: int = 10) -> list[dict]:
        """Return the Chromecasts found on the network. Raises on discovery errors."""
        timeout = max(timeout, 10)
        logger.info("Starting Chromecast discovery (%s s)", timeout)
        browser, zconf = self._discover(timeout)
        try:
            devices = [
                {
                    "name": info.friendly_name,
                    "uuid": str(info.uuid),
                    "model_name": info.model_name,
                    "cast_type": info.cast_type,
                    "host": str(info.host) if info.host else None,
                }
                for info in list(browser.devices.values())
            ]
        finally:
            self._close(browser, zconf)
        if not devices:
            logger.warning(
                "No Chromecast found: check power, same network, mDNS (UDP 5353) and timeout"
            )
        return devices

    def play_media(self, chromecast_name: str, media_url: str, volume: float | None = None) -> bool:
        """Play ``media_url`` on the named Chromecast. Returns False on failure."""
        browser = zconf = chromecast = None
        try:
            logger.info("Searching for Chromecast %r", chromecast_name)
            browser, zconf = self._discover(10)
            cast_info = next(
                (i for i in list(browser.devices.values()) if i.friendly_name == chromecast_name),
                None,
            )
            if cast_info is None:
                logger.error("Chromecast %r not found", chromecast_name)
                return False

            chromecast = pychromecast.get_chromecast_from_cast_info(cast_info, zconf)
            chromecast.wait(timeout=10)

            if volume is not None:
                try:
                    chromecast.set_volume(max(0.0, min(1.0, float(volume))))
                    time.sleep(0.5)
                except Exception:
                    logger.warning("Failed to set volume", exc_info=True)

            logger.info("Playing %s", media_url)
            chromecast.media_controller.play_media(media_url, content_type="audio/mpeg")

            # Wait for the device to acknowledge before disconnecting, otherwise
            # a short-lived caller (cron script) closes the socket too early.
            deadline = time.time() + 30
            while time.time() < deadline:
                status = chromecast.media_controller.status
                if status and status.player_state in ("PLAYING", "BUFFERING"):
                    logger.info("Playback started")
                    return True
                time.sleep(0.5)
            logger.warning("Timed out waiting for playback to start")
            return True
        except Exception:
            logger.exception("Error playing media")
            return False
        finally:
            if chromecast is not None:
                try:
                    chromecast.disconnect(timeout=5)
                except Exception:
                    logger.warning("Error disconnecting Chromecast", exc_info=True)
            if browser is not None:
                self._close(browser, zconf)
