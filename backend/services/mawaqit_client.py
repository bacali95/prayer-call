"""Client for interacting with Mawaqit API"""
from backend.config import ConfigManager
from mawaqit import AsyncMawaqitClient
from mawaqit.consts import BadCredentialsException
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)


class MawaqitClient:
    def __init__(self):
        self.config_manager = ConfigManager()

    async def search_mosques(self, query: str) -> List[Dict]:
        """Search for mosques by name or location"""
        try:
            config = self.config_manager.load()
            client = AsyncMawaqitClient(
                username=config.get("mawaqit").get("username"),
                password=config.get("mawaqit").get("password")
            )
            
            await client.get_api_token()

            data = await client.fetch_mosques_by_keyword(query)
            # API returns a list directly, not a dict with "mosques" key
            if isinstance(data, list):
                return data
            # Fallback: if it's a dict, try to get "mosques" key
            return data.get("mosques", []) if isinstance(data, dict) else []
        except BadCredentialsException as e:
            logger.error(f"Bad credentials: {e}")
            return []
        except Exception as e:
            logger.error(f"Error searching mosques: {e.message}")
            return []
        finally:
            await client.close()
    
    async def get_prayer_times(self, mosque_id: str) -> Optional[Dict]:
        """Get prayer times for a mosque"""
        try:
            config = self.config_manager.load()
            client = AsyncMawaqitClient(
                username=config.get("mawaqit").get("username"),
                password=config.get("mawaqit").get("password"),
                mosque=mosque_id
            )
            await client.get_api_token()

            data = await client.fetch_prayer_times()
            
            return data
        except Exception as e:
            logger.error(f"Error getting prayer times: {e}")
            return None
        finally:
            await client.close()

