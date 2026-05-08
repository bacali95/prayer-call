"""Screensaver routes — Unsplash collection proxy"""
import math
import os
import random
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from flask import Blueprint, jsonify

logger = logging.getLogger(__name__)

screensaver_bp = Blueprint("screensaver", __name__, url_prefix="/api/screensaver")

UNSPLASH_KEY = os.environ.get("UNSPLASH_ACCESS_KEY")
PER_PAGE = 30
COLLECTIONS = {"mekkah": "aKLHq9Y-cx0", "medina": "JDKcPJOK6kA"}


def _auth() -> dict:
    return {"Authorization": f"Client-ID {UNSPLASH_KEY}"}


def _fetch_page(collection_id: str, page: int) -> list[str]:
    try:
        res = requests.get(
            f"https://api.unsplash.com/collections/{collection_id}/photos",
            headers=_auth(),
            params={"page": page, "per_page": PER_PAGE, "orientation": "landscape"},
            timeout=10,
        )
        if res.ok:
            return [p["urls"]["regular"] for p in res.json()]
    except Exception as exc:
        logger.warning("Page fetch failed — collection=%s page=%d: %s", collection_id, page, exc)
    return []


def _fetch_collection(collection_id: str) -> list[str]:
    try:
        info = requests.get(
            f"https://api.unsplash.com/collections/{collection_id}",
            headers=_auth(),
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
        futures = [pool.submit(_fetch_page, collection_id, p) for p in range(1, total_pages + 1)]
        urls: list[str] = []
        for future in as_completed(futures):
            urls.extend(future.result())
    return urls


@screensaver_bp.route("/slides", methods=["GET"])
def get_slides():
    """Return shuffled landscape photo URLs from the Mekkah + Medina Unsplash collections."""
    if not UNSPLASH_KEY:
        return jsonify({"error": "UNSPLASH_ACCESS_KEY not configured"}), 503

    with ThreadPoolExecutor(max_workers=2) as pool:
        f_mekkah = pool.submit(_fetch_collection, COLLECTIONS["mekkah"])
        f_medina = pool.submit(_fetch_collection, COLLECTIONS["medina"])
        combined = list({*f_mekkah.result(), *f_medina.result()})

    random.shuffle(combined)
    return jsonify({"urls": combined})
