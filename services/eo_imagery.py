"""Fetch recent Earth observation imagery near a satellite nadir point."""

from __future__ import annotations

import io
import logging
import time
from typing import Any
from urllib.parse import quote

import requests

logger = logging.getLogger(__name__)

EO_SATELLITES = frozenset(
    {"Cartosat-2F", "RISAT-2B", "Sentinel-2A", "Resourcesat-2A"}
)

SAT_IMAGERY_PROFILE: dict[str, dict[str, str]] = {
    "Sentinel-2A": {
        "collection": "sentinel-2-l2a",
        "source": "Copernicus Sentinel-2",
        "label": "Multispectral surface reflectance",
    },
    "Cartosat-2F": {
        "collection": "sentinel-2-l2a",
        "source": "Representative high-res optical (Sentinel-2 nearest scene)",
        "label": "Optical ground scene at nadir",
    },
    "RISAT-2B": {
        "collection": "sentinel-2-l2a",
        "source": "Representative terrain view (Sentinel-2 nearest scene)",
        "label": "Radar-style surface view at nadir",
    },
    "Resourcesat-2A": {
        "collection": "sentinel-2-l2a",
        "source": "Representative multispectral (Sentinel-2 nearest scene)",
        "label": "Land / water monitoring view",
    },
}

EARTH_SEARCH_URL = "https://earth-search.aws.element84.com/v1/search"
CACHE_TTL = int(900)  # 15 minutes
_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_image_bytes_cache: dict[str, tuple[float, bytes, str]] = {}


def is_eo_satellite(name: str) -> bool:
    return name in EO_SATELLITES


def _cache_key(lat: float, lon: float, sat_name: str) -> str:
    return f"{sat_name}:{round(lat, 1)}:{round(lon, 1)}"


def _stac_search(
    lat: float, lon: float, collection: str, *, cloud_max: float | None = 40
) -> dict[str, Any] | None:
    body: dict[str, Any] = {
        "collections": [collection],
        "intersects": {"type": "Point", "coordinates": [lon, lat]},
        "limit": 1,
        "sortby": [{"field": "properties.datetime", "direction": "desc"}],
    }
    if cloud_max is not None and collection.startswith("sentinel-2"):
        body["query"] = {"eo:cloud_cover": {"lt": cloud_max}}

    try:
        resp = requests.post(
            EARTH_SEARCH_URL,
            json=body,
            timeout=20,
            headers={"User-Agent": "VidyajyotiTracker/1.0"},
        )
        resp.raise_for_status()
        features = resp.json().get("features") or []
        if not features and cloud_max is not None:
            return _stac_search(lat, lon, collection, cloud_max=None)
        return features[0] if features else None
    except requests.RequestException as exc:
        logger.warning("STAC search failed for %s: %s", collection, exc)
        return None


def _gibs_url(lat: float, lon: float, layer: str) -> str:
    """NASA GIBS WMS quicklook for a small bbox around the nadir point."""
    pad = 0.45
    south = max(-85, lat - pad)
    north = min(85, lat + pad)
    west = lon - pad
    east = lon + pad
    params = (
        f"SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS={layer}"
        f"&CRS=EPSG:4326&BBOX={south},{west},{north},{east}"
        "&WIDTH=768&HEIGHT=768&FORMAT=image/jpeg&STYLES="
    )
    return f"https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?{params}"


def _candidate_image_urls(
    feature: dict[str, Any] | None, lat: float, lon: float
) -> list[tuple[str, str]]:
    """Ordered (url, source_label) candidates — first usable image wins."""
    candidates: list[tuple[str, str]] = []
    assets = (feature or {}).get("assets") or {}
    visual_href = (assets.get("visual") or {}).get("href")
    if visual_href and visual_href.startswith("https://") and visual_href.lower().endswith(
        (".tif", ".tiff")
    ):
        pad = 0.12
        bbox = f"{lon - pad},{lat - pad},{lon + pad},{lat + pad}"
        candidates.append(
            (
                "https://titiler.xyz/cog/bbox/"
                f"{bbox}/768x768.jpg?url={quote(visual_href, safe='')}",
                "Copernicus Sentinel-2 (nadir crop)",
            )
        )
    for key in ("thumbnail", "rendered_preview", "preview"):
        href = (assets.get(key) or {}).get("href")
        if href and href.startswith(("http://", "https://")) and not href.lower().endswith(
            (".tif", ".tiff")
        ):
            candidates.append((href, "Copernicus Sentinel-2 (scene preview)"))
            break
    # GIBS layer fallback: MODIS can occasionally return blank tiles, so keep a
    # guaranteed-available base as a final fallback.
    candidates.append(
        (_gibs_url(lat, lon, "MODIS_Terra_CorrectedReflectance_TrueColor"), "NASA MODIS Terra (regional composite)")
    )
    candidates.append(
        (_gibs_url(lat, lon, "BlueMarble_ShadedRelief"), "NASA Blue Marble (static basemap)")
    )
    return candidates


def _image_is_usable(data: bytes) -> bool:
    """Reject empty, corrupt, or flat black/white placeholder tiles."""
    if data[:2] not in (b"\xff\xd8", b"\x89P"):
        return False
    try:
        from PIL import Image

        im = Image.open(io.BytesIO(data)).convert("RGB")
        im.thumbnail((96, 96))
        pixels = list(im.getdata())
        if not pixels:
            return False
        means = [sum(px) / 3.0 for px in pixels]
        avg = sum(means) / len(means)
        variance = sum((m - avg) ** 2 for m in means) / len(means)
        if avg < 3 or avg > 253:
            return False
        # Very low-contrast tiles are often blank ocean/ice renders. Prefer other sources.
        # But don't reject legitimately dark scenes.
        if variance < 1.2 and (avg < 8 or avg > 247):
            return False
        return True
    except Exception:
        # If Pillow isn't available, be permissive; the browser can still decode it.
        return len(data) > 1200


def _download_image(url: str) -> tuple[bytes, str] | None:
    try:
        resp = requests.get(
            url,
            timeout=60,
            headers={"User-Agent": "VidyajyotiTracker/1.0"},
        )
        resp.raise_for_status()
        data = resp.content
        content_type = resp.headers.get("Content-Type", "image/jpeg")
        if not content_type.startswith("image/"):
            if data[:2] == b"\xff\xd8":
                content_type = "image/jpeg"
            elif data[:8] == b"\x89PNG\r\n\x1a\n":
                content_type = "image/png"
            else:
                return None
        if not _image_is_usable(data):
            return None
        return data, content_type
    except requests.RequestException as exc:
        logger.warning("EO image fetch failed for %s: %s", url[:80], exc)
        return None


def _resolve_scene(
    lat: float, lon: float, sat_name: str
) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    profile = SAT_IMAGERY_PROFILE.get(sat_name, SAT_IMAGERY_PROFILE["Sentinel-2A"])
    collection = profile["collection"]
    feature = _stac_search(lat, lon, collection)
    if not feature and collection != "sentinel-2-l2a":
        feature = _stac_search(lat, lon, "sentinel-2-l2a")

    captured_at = None
    scene_id = None
    cloud_cover = None
    source_note = profile["source"]
    if feature:
        props = feature.get("properties") or {}
        captured_at = props.get("datetime")
        scene_id = feature.get("id")
        cloud_cover = props.get("eo:cloud_cover")

    return feature, {
        "profile": profile,
        "source_note": source_note,
        "captured_at": captured_at,
        "scene_id": scene_id,
        "cloud_cover": cloud_cover,
    }


def get_eo_preview(lat: float, lon: float, sat_name: str) -> dict[str, Any]:
    if not is_eo_satellite(sat_name):
        return {"error": "Not an Earth observation satellite"}

    key = _cache_key(lat, lon, sat_name)
    now = time.time()
    if key in _cache and now - _cache[key][0] < CACHE_TTL:
        return dict(_cache[key][1])

    feature, meta = _resolve_scene(lat, lon, sat_name)
    profile = meta["profile"]
    source_note = meta["source_note"]
    captured_at = meta["captured_at"]
    scene_id = meta["scene_id"]
    cloud_cover = meta["cloud_cover"]

    caption = (
        f"{profile['label']} · {source_note} · "
        f"Nadir {lat:.2f}°, {lon:.2f}°"
    )
    if captured_at:
        caption += f" · Scene {captured_at[:10]}"
    if cloud_cover is not None:
        caption += f" · Cloud {cloud_cover:.0f}%"

    result: dict[str, Any] = {
        "ok": True,
        "satellite": sat_name,
        "view_label": profile["label"],
        "image_url": (
            f"/api/eo-imagery/image?lat={lat}&lon={lon}&sat={quote(sat_name, safe='')}"
        ),
        "captured_at": captured_at,
        "scene_id": scene_id,
        "cloud_cover": cloud_cover,
        "source": source_note,
        "caption": caption,
        "nadir_lat": lat,
        "nadir_lon": lon,
        "style": "optical",
        "disclaimer": (
            "Nearest archived pass at the satellite ground position — "
            "not a live downlink feed."
        ),
    }
    _cache[key] = (now, result)
    return result


def fetch_eo_image_bytes(lat: float, lon: float, sat_name: str) -> tuple[bytes, str] | None:
    if not is_eo_satellite(sat_name):
        return None

    key = _cache_key(lat, lon, sat_name)
    now = time.time()
    if key in _image_bytes_cache and now - _image_bytes_cache[key][0] < CACHE_TTL:
        cached = _image_bytes_cache[key]
        return cached[1], cached[2]

    preview = get_eo_preview(lat, lon, sat_name)
    if not preview.get("ok"):
        return None

    feature, meta = _resolve_scene(lat, lon, sat_name)
    for url, source_label in _candidate_image_urls(feature, lat, lon):
        result = _download_image(url)
        if not result:
            continue
        data, content_type = result
        _image_bytes_cache[key] = (now, data, content_type)
        # Refresh metadata source to match the image that actually loaded.
        if key in _cache:
            cached_preview = dict(_cache[key][1])
            cached_preview["source"] = source_label
            _cache[key] = (_cache[key][0], cached_preview)
        logger.info("EO imagery for %s via %s", sat_name, source_label)
        return data, content_type

    return None
