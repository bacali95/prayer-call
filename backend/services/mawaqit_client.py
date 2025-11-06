"""Client for interacting with Mawaqit API"""
import requests
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)


class MawaqitClient:
    BASE_URL = "https://mawaqit.net/api/2.0"
    
    def search_mosques(self, query: str, limit: int = 20) -> List[Dict]:
        """Search for mosques by name or location"""
        try:
            url = f"{self.BASE_URL}/mosque/search"
            params = {
                "word": query,
                "fields": "slug,label"
            }
            headers = {
                "accept": "*/*",
                "x-requested-with": "XMLHttpRequest",
                "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
            }
            response = requests.get(url, params=params, headers=headers, timeout=10)
            response.raise_for_status()
            data = response.json()
            # API returns a list directly, not a dict with "mosques" key
            if isinstance(data, list):
                return data
            # Fallback: if it's a dict, try to get "mosques" key
            return data.get("mosques", []) if isinstance(data, dict) else []
        except requests.exceptions.RequestException as e:
            logger.error(f"Error searching mosques (request failed): {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response status: {e.response.status_code}")
                logger.error(f"Response body: {e.response.text[:500]}")
            return []
        except Exception as e:
            logger.error(f"Error searching mosques: {e}")
            return []
    
    def get_prayer_times(self, mosque_id: str, date: Optional[str] = None) -> Optional[Dict]:
        """Get prayer times for a mosque"""
        try:
            url = f"{self.BASE_URL}/mosque/{mosque_id}/prayer-times"
            params = {}
            if date:
                params["date"] = date
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error getting prayer times: {e}")
            return None

