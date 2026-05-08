"""Unsplash API client — fetches landscape photos from curated collections"""
import math
import os
import random
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import TYPE_CHECKING

import requests

if TYPE_CHECKING:
    from backend.config import ConfigManager

logger = logging.getLogger(__name__)

PER_PAGE = 30
COLLECTIONS = {"mekkah": "aKLHq9Y-cx0", "medina": "JDKcPJOK6kA"}


class UnsplashClient:
    def __init__(self, config_manager: "ConfigManager"):
        self.config_manager = config_manager

    def _get_key(self) -> str | None:
        key = self.config_manager.load().get("unsplash_access_key")
        if key:
            return key
        return os.environ.get("UNSPLASH_ACCESS_KEY")

    def _auth(self) -> dict:
        return {"Authorization": f"Client-ID {self._get_key()}"}

    def _fetch_page(self, collection_id: str, page: int) -> list[str]:
        try:
            res = requests.get(
                f"https://api.unsplash.com/collections/{collection_id}/photos",
                headers=self._auth(),
                params={"page": page, "per_page": PER_PAGE, "orientation": "landscape"},
                timeout=10,
            )
            if res.ok:
                return [p["urls"]["regular"] for p in res.json()]
        except Exception as exc:
            logger.warning("Page fetch failed — collection=%s page=%d: %s", collection_id, page, exc)
        return []

    def _fetch_collection(self, collection_id: str) -> list[str]:
        try:
            info = requests.get(
                f"https://api.unsplash.com/collections/{collection_id}",
                headers=self._auth(),
                timeout=10,
            )
            if not info.ok:
                logger.warning("Collection info failed — id=%s status=%d", collection_id, info.status_code)
                return []
            total_pages = math.ceil(info.json().get("total_photos", 0) / PER_PAGE)
        except Exception as exc:
            logger.warning("Collection info error — id=%s: %s", collection_id, exc)
            return []

        with ThreadPoolExecutor(max_workers=min(total_pages, 10)) as pool:
            futures = [pool.submit(self._fetch_page, collection_id, p) for p in range(1, total_pages + 1)]
            urls: list[str] = []
            for future in as_completed(futures):
                urls.extend(future.result())
        return urls

    def get_slides(self) -> tuple[list[str], str | None]:
        """Return (shuffled_urls, error_message). error_message is None on success."""
        key = self._get_key()
        if not key:
            return [], "Unsplash access key not configured"

        with ThreadPoolExecutor(max_workers=2) as pool:
            f_mekkah = pool.submit(self._fetch_collection, COLLECTIONS["mekkah"])
            f_medina = pool.submit(self._fetch_collection, COLLECTIONS["medina"])
            combined = list({*f_mekkah.result(), *f_medina.result()})

        random.shuffle(combined)
        return combined, None
