"""Chromecast discovery and control"""
import pychromecast
import pychromecast.discovery
from typing import List, Dict, Optional
import time
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ChromecastScanner:
    def __init__(self):
        self.chromecasts = []
        self.browser = None
    
    def scan(self, timeout: int = 10) -> List[Dict]:
        """Scan for Chromecast devices on the network"""
        devices = []
        browser = None
        
        try:
            logger.info(f"Starting Chromecast discovery with timeout={timeout} seconds...")
            
            # Use get_chromecasts with explicit timeout
            # Increase timeout if it's too short
            actual_timeout = max(timeout, 10)
            
            try:
                chromecasts, browser = pychromecast.get_chromecasts(timeout=actual_timeout)
                logger.info(f"Discovery completed. Found {len(chromecasts)} Chromecast device(s)")
                
                for cc in chromecasts:
                    try:
                        # Chromecast object has properties: name, uuid, model_name, cast_type
                        # These properties access cast_info internally
                        device_info = {
                            "name": cc.name,
                            "uuid": cc.uuid,
                            "model_name": cc.model_name,
                            "cast_type": cc.cast_type,
                            "host": str(cc.socket_client.host) if hasattr(cc, 'socket_client') and hasattr(cc.socket_client, 'host') else None
                        }
                        devices.append(device_info)
                        logger.info(f"Found device: {device_info['name']} ({device_info['model_name']})")
                    except Exception as e:
                        logger.warning(f"Error getting details for Chromecast: {e}")
                        # Fallback: try accessing cast_info directly
                        try:
                            if hasattr(cc, 'cast_info') and cc.cast_info:
                                devices.append({
                                    "name": getattr(cc.cast_info, 'friendly_name', 'Unknown'),
                                    "uuid": getattr(cc.cast_info, 'uuid', ''),
                                    "model_name": getattr(cc.cast_info, 'model_name', 'Unknown'),
                                    "cast_type": getattr(cc.cast_info, 'cast_type', 'cast'),
                                    "host": str(cc.socket_client.host) if hasattr(cc, 'socket_client') and hasattr(cc.socket_client, 'host') else None
                                })
                                logger.info(f"Found device (fallback method): {getattr(cc.cast_info, 'friendly_name', 'Unknown')}")
                        except Exception as e2:
                            logger.error(f"Could not extract any info from Chromecast: {e2}")
                
            except Exception as e:
                logger.error(f"get_chromecasts failed: {e}", exc_info=True)
                # Try alternative: use discovery browser directly
                try:
                    logger.info("Trying alternative discovery method with CastBrowser...")
                    from pychromecast.discovery import CastBrowser
                    
                    def callback(name):
                        logger.info(f"Discovered: {name}")
                    
                    browser = CastBrowser(callback)
                    browser.start_discovery()
                    
                    # Wait for discovery
                    logger.info(f"Waiting {actual_timeout} seconds for devices to be discovered...")
                    time.sleep(actual_timeout)
                    
                    # Get discovered devices
                    discovered = browser.devices
                    logger.info(f"Found {len(discovered)} device(s) via CastBrowser")
                    
                    for service in discovered.values():
                        try:
                            # Try to create a Chromecast object to get full info
                            cc = pychromecast.get_chromecast_from_service(service, browser.zc)
                            if cc:
                                devices.append({
                                    "name": cc.name,
                                    "uuid": cc.uuid,
                                    "model_name": cc.model_name,
                                    "cast_type": cc.cast_type,
                                    "host": str(service.host) if hasattr(service, 'host') else None
                                })
                                logger.info(f"Found device via CastBrowser: {cc.name}")
                        except Exception as e:
                            logger.warning(f"Error processing discovered service: {e}")
                            # Add basic info from service
                            try:
                                devices.append({
                                    "name": service.friendly_name if hasattr(service, 'friendly_name') else 'Unknown',
                                    "uuid": service.uuid if hasattr(service, 'uuid') else '',
                                    "model_name": getattr(service, 'model_name', 'Unknown'),
                                    "cast_type": 'cast',
                                    "host": str(service.host) if hasattr(service, 'host') else None
                                })
                            except:
                                pass
                    
                except Exception as e2:
                    logger.error(f"Alternative discovery method also failed: {e2}", exc_info=True)
            
            # Clean up browser
            if browser:
                try:
                    if hasattr(browser, 'stop_discovery'):
                        browser.stop_discovery()
                    elif hasattr(pychromecast.discovery, 'stop_discovery'):
                        pychromecast.discovery.stop_discovery(browser)
                except Exception as e:
                    logger.warning(f"Error stopping discovery: {e}")
            
            if not devices:
                logger.warning("No Chromecast devices found. Troubleshooting tips:")
                logger.warning("  1. Ensure Chromecast is powered on and connected to the same network")
                logger.warning("  2. Check that mDNS/Bonjour is enabled (macOS: System Settings > General > Sharing)")
                logger.warning("  3. Verify firewall allows mDNS traffic (UDP port 5353)")
                logger.warning("  4. Try restarting the Chromecast device")
                logger.warning("  5. Increase the timeout value (current: {} seconds)".format(timeout))
            else:
                logger.info(f"Successfully found {len(devices)} Chromecast device(s)")
            
            self.chromecasts = chromecasts if 'chromecasts' in locals() else []
            return devices
            
        except Exception as e:
            logger.error(f"Unexpected error scanning for Chromecasts: {e}", exc_info=True)
            if browser:
                try:
                    if hasattr(browser, 'stop_discovery'):
                        browser.stop_discovery()
                    elif hasattr(pychromecast.discovery, 'stop_discovery'):
                        pychromecast.discovery.stop_discovery(browser)
                except:
                    pass
            return []
    
    def play_media(self, chromecast_name: str, media_url: str, volume: Optional[float] = None) -> bool:
        """Play media on a specific Chromecast"""
        browser = None
        try:
            logger.info(f"Searching for Chromecast: {chromecast_name}")
            chromecasts, browser = pychromecast.get_chromecasts(timeout=10)
            
            chromecast = next(
                (cc for cc in chromecasts if cc.name == chromecast_name),
                None
            )
            
            if not chromecast:
                logger.error(f"Chromecast '{chromecast_name}' not found")
                if browser:
                    try:
                        pychromecast.discovery.stop_discovery(browser)
                    except:
                        pass
                return False
            
            logger.info(f"Connecting to Chromecast: {chromecast_name}")
            chromecast.wait()
            
            # Set volume if provided (volume should be between 0.0 and 1.0)
            if volume is not None:
                try:
                    # Clamp volume between 0.0 and 1.0
                    volume = max(0.0, min(1.0, float(volume)))
                    logger.info(f"Setting volume to {volume}")
                    chromecast.set_volume(volume)
                    time.sleep(0.5)  # Wait for volume to be set
                except Exception as e:
                    logger.warning(f"Failed to set volume: {e}")
            
            logger.info(f"Playing media: {media_url}")
            # Start playing the media
            chromecast.media_controller.play_media(
                media_url,
                content_type="audio/mpeg"
            )
            
            # Wait a bit for the media to start
            time.sleep(1)
            
            if browser:
                try:
                    pychromecast.discovery.stop_discovery(browser)
                except:
                    pass
            
            logger.info("Media playback started successfully")
            return True
        except Exception as e:
            logger.error(f"Error playing media: {e}", exc_info=True)
            if browser:
                try:
                    pychromecast.discovery.stop_discovery(browser)
                except:
                    pass
            return False

