"""Chromecast discovery and control"""
import pychromecast
from pychromecast.discovery import CastBrowser, SimpleCastListener
from typing import List, Dict, Optional, Tuple
import time
import logging
import zeroconf as zeroconf_module

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ChromecastScanner:
    def __init__(self):
        self.chromecasts = []
        self.browser = None

    def _discover(self, timeout: int = 10) -> Tuple[CastBrowser, List]:
        """Discover Chromecast devices using CastBrowser. Returns (browser, chromecasts).

        A Zeroconf instance must be passed to CastBrowser — without it,
        start_discovery() skips the mDNS ServiceBrowser and finds nothing.
        """
        zconf = zeroconf_module.Zeroconf()
        browser = CastBrowser(SimpleCastListener(), zconf)
        browser.start_discovery()
        time.sleep(timeout)

        chromecasts = []
        for cast_info in list(browser.devices.values()):
            try:
                cc = pychromecast.get_chromecast_from_cast_info(cast_info, zconf)
                if cc:
                    chromecasts.append(cc)
            except Exception as e:
                logger.warning(f"Error getting Chromecast from cast_info: {e}")

        return browser, chromecasts

    def scan(self, timeout: int = 10) -> List[Dict]:
        """Scan for Chromecast devices on the network"""
        actual_timeout = max(timeout, 10)
        browser = None
        try:
            logger.info(f"Starting Chromecast discovery with timeout={actual_timeout} seconds...")
            browser, chromecasts = self._discover(actual_timeout)
            logger.info(f"Discovery completed. Found {len(chromecasts)} Chromecast device(s)")

            devices = []
            for cc in chromecasts:
                try:
                    device_info = {
                        "name": cc.name,
                        "uuid": cc.uuid,
                        "model_name": cc.model_name,
                        "cast_type": cc.cast_type,
                        "host": str(cc.socket_client.host) if hasattr(cc, "socket_client") and hasattr(cc.socket_client, "host") else None,
                    }
                    devices.append(device_info)
                    logger.info(f"Found device: {device_info['name']} ({device_info['model_name']})")
                except Exception as e:
                    logger.warning(f"Error getting details for Chromecast: {e}")
                    try:
                        if hasattr(cc, "cast_info") and cc.cast_info:
                            devices.append({
                                "name": getattr(cc.cast_info, "friendly_name", "Unknown"),
                                "uuid": getattr(cc.cast_info, "uuid", ""),
                                "model_name": getattr(cc.cast_info, "model_name", "Unknown"),
                                "cast_type": getattr(cc.cast_info, "cast_type", "cast"),
                                "host": None,
                            })
                    except Exception as e2:
                        logger.error(f"Could not extract any info from Chromecast: {e2}")

            self.chromecasts = chromecasts

            if not devices:
                logger.warning("No Chromecast devices found. Troubleshooting tips:")
                logger.warning("  1. Ensure Chromecast is powered on and connected to the same network")
                logger.warning("  2. Check that mDNS/Bonjour is enabled (macOS: System Settings > General > Sharing)")
                logger.warning("  3. Verify firewall allows mDNS traffic (UDP port 5353)")
                logger.warning("  4. Try restarting the Chromecast device")
                logger.warning(f"  5. Increase the timeout value (current: {timeout} seconds)")
            else:
                logger.info(f"Successfully found {len(devices)} Chromecast device(s)")

            return devices

        except Exception as e:
            logger.error(f"Unexpected error scanning for Chromecasts: {e}", exc_info=True)
            return []
        finally:
            if browser:
                try:
                    browser.stop_discovery()
                except Exception as e:
                    logger.warning(f"Error stopping discovery: {e}")

    def play_media(self, chromecast_name: str, media_url: str, volume: Optional[float] = None) -> bool:
        """Play media on a specific Chromecast"""
        browser = None
        try:
            logger.info(f"Searching for Chromecast: {chromecast_name}")
            browser, chromecasts = self._discover(timeout=10)

            chromecast = next(
                (cc for cc in chromecasts if cc.name == chromecast_name),
                None,
            )

            if not chromecast:
                logger.error(f"Chromecast '{chromecast_name}' not found")
                return False

            logger.info(f"Connecting to Chromecast: {chromecast_name}")
            chromecast.wait(timeout=10)

            if volume is not None:
                try:
                    volume = max(0.0, min(1.0, float(volume)))
                    logger.info(f"Setting volume to {volume}")
                    chromecast.set_volume(volume)
                    time.sleep(0.5)
                except Exception as e:
                    logger.warning(f"Failed to set volume: {e}")

            logger.info(f"Playing media: {media_url}")
            chromecast.media_controller.play_media(media_url, content_type="audio/mpeg")

            # Wait until Chromecast is actually buffering/playing before disconnecting.
            # Without this the cron script exits too fast, closing the socket before
            # the Chromecast has acknowledged the command.
            deadline = time.time() + 30
            while time.time() < deadline:
                status = chromecast.media_controller.status
                if status and status.player_state in ("PLAYING", "BUFFERING"):
                    break
                time.sleep(0.5)
            else:
                logger.warning("Timed out waiting for playback to start")

            logger.info("Media playback started successfully")
            return True

        except Exception as e:
            logger.error(f"Error playing media: {e}", exc_info=True)
            return False
        finally:
            if browser:
                try:
                    browser.stop_discovery()
                except Exception as e:
                    logger.warning(f"Error stopping discovery: {e}")
