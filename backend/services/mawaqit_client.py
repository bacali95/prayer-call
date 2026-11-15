"""Synchronous facade over the (async) Mawaqit client.

Each call runs its own short-lived event loop via ``asyncio.run`` so callers
(Flask threads, cron scripts) stay synchronous.
"""

import asyncio
import logging

from mawaqit import AsyncMawaqitClient
from mawaqit.consts import BadCredentialsException

from backend.config import ConfigManager

logger = logging.getLogger(__name__)


class MawaqitError(Exception):
    """Raised when Mawaqit cannot be reached or rejects the request."""


class MawaqitClient:
    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager

    def _credentials(self) -> dict:
        creds = self.config_manager.load().get("mawaqit") or {}
        if not creds.get("username") or not creds.get("password"):
            raise MawaqitError("Mawaqit credentials are not configured")
        return creds

    def search_mosques(self, query: str) -> list[dict]:
        return asyncio.run(self._search(query))

    def get_prayer_times(self, mosque_id: str) -> dict:
        return asyncio.run(self._prayer_times(mosque_id))

    async def _search(self, query: str) -> list[dict]:
        creds = self._credentials()
        client = AsyncMawaqitClient(username=creds["username"], password=creds["password"])
        try:
            await client.get_api_token()
            data = await client.fetch_mosques_by_keyword(query)
        except BadCredentialsException as exc:
            raise MawaqitError("Mawaqit rejected the configured credentials") from exc
        except Exception as exc:
            logger.exception("Mawaqit search failed")
            raise MawaqitError(f"Mawaqit search failed: {exc}") from exc
        finally:
            await client.close()
        if isinstance(data, list):
            return data
        return data.get("mosques", []) if isinstance(data, dict) else []

    async def _prayer_times(self, mosque_id: str) -> dict:
        creds = self._credentials()
        client = AsyncMawaqitClient(
            username=creds["username"], password=creds["password"], mosque=mosque_id
        )
        try:
            await client.get_api_token()
            data = await client.fetch_prayer_times()
        except BadCredentialsException as exc:
            raise MawaqitError("Mawaqit rejected the configured credentials") from exc
        except Exception as exc:
            logger.exception("Mawaqit prayer times fetch failed")
            raise MawaqitError(f"Could not fetch prayer times from Mawaqit: {exc}") from exc
        finally:
            await client.close()
        if not data:
            raise MawaqitError("Mawaqit returned no prayer times")
        return data
