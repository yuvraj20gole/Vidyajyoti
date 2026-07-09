"""CelesTrak TLE fetch and cache for amateur satellites."""

import os
import re
import time
from typing import Any

import requests

from data.tle_fallbacks import fallback_tle

TLE_CACHE_TTL = int(os.environ.get("TLE_CACHE_TTL", "21600"))

SATELLITE_CATALOG = [
    {
        "name": "VIDYAJYOTI",
        "norad_id": None,
        "color": "#4d9fff",
        "is_simulated": True,
    },
    {
        "name": "VO-52",
        "norad_id": 32791,
        "color": "#9d6fff",
        "is_simulated": False,
    },
    {
        "name": "SO-50",
        "norad_id": 27607,
        "color": "#ff7c3a",
        "is_simulated": False,
    },
    {
        "name": "AO-27",
        "norad_id": 22825,
        "color": "#ffc444",
        "is_simulated": False,
    },
    {
        "name": "FO-29",
        "norad_id": 24278,
        "color": "#ff4466",
        "is_simulated": False,
    },
    {
        "name": "HO-68",
        "norad_id": 36122,
        "color": "#00e5a0",
        "is_simulated": False,
    },
    {
        "name": "Cartosat-2F",
        "norad_id": 43111,
        "color": "#56d4ff",
        "is_simulated": False,
    },
    {
        "name": "RISAT-2B",
        "norad_id": 44233,
        "color": "#ff9933",
        "is_simulated": False,
    },
    {
        "name": "Sentinel-2A",
        "norad_id": 40697,
        "color": "#7dffb3",
        "is_simulated": False,
    },
    {
        "name": "Resourcesat-2A",
        "norad_id": 41877,
        "color": "#e879f9",
        "is_simulated": False,
    },
]

_tle_cache: dict[int, tuple[float, dict[str, str] | None]] = {}
_group_cache: tuple[float, dict[int, dict[str, str]]] | None = None

_NORAD_RE = re.compile(r"^1\s+(\d+)U")


def _parse_tle_block(lines: list[str]) -> dict[str, str] | None:
    if len(lines) < 3:
        return None
    return {"name": lines[0].strip(), "line1": lines[1].strip(), "line2": lines[2].strip()}


def _norad_from_line1(line1: str) -> int | None:
    match = _NORAD_RE.match(line1.strip())
    if not match:
        return None
    return int(match.group(1))


def _fetch_amateur_group() -> dict[int, dict[str, str]]:
    global _group_cache
    now = time.time()
    if _group_cache and now - _group_cache[0] < TLE_CACHE_TTL:
        return _group_cache[1]

    catalog_ids = {sat["norad_id"] for sat in SATELLITE_CATALOG if sat["norad_id"]}
    found: dict[int, dict[str, str]] = {}
    url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=amateur&FORMAT=tle"
    try:
        resp = requests.get(url, timeout=25, headers={"User-Agent": "VidyajyotiTracker/1.0"})
        resp.raise_for_status()
        raw = [ln.rstrip() for ln in resp.text.splitlines()]
        i = 0
        while i + 2 < len(raw):
            block = [raw[i], raw[i + 1], raw[i + 2]]
            parsed = _parse_tle_block(block)
            if parsed:
                norad_id = _norad_from_line1(parsed["line1"])
                if norad_id in catalog_ids:
                    found[norad_id] = parsed
            i += 3
    except requests.RequestException:
        found = {}

    _group_cache = (now, found)
    return found


def _fetch_tle(norad_id: int) -> dict[str, str] | None:
    group = _fetch_amateur_group()
    if norad_id in group:
        return group[norad_id]

    url = f"https://celestrak.org/NORAD/elements/gp.php?CATNR={norad_id}&FORMAT=TLE"
    try:
        resp = requests.get(url, timeout=15, headers={"User-Agent": "VidyajyotiTracker/1.0"})
        resp.raise_for_status()
        lines = [ln.strip() for ln in resp.text.strip().splitlines() if ln.strip()]
        return _parse_tle_block(lines[:3])
    except requests.RequestException:
        return None


def get_tle(norad_id: int) -> dict[str, str] | None:
    bundled = fallback_tle(norad_id)
    now = time.time()
    if norad_id in _tle_cache and now - _tle_cache[norad_id][0] < TLE_CACHE_TTL:
        cached = _tle_cache[norad_id][1]
        return cached or bundled

    tle = _fetch_tle(norad_id) or bundled
    _tle_cache[norad_id] = (now, tle)
    return tle


def get_satellites() -> list[dict[str, Any]]:
    results = []
    for sat in SATELLITE_CATALOG:
        entry: dict[str, Any] = {
            "name": sat["name"],
            "norad_id": sat["norad_id"],
            "color": sat["color"],
            "is_simulated": sat["is_simulated"],
            "tle_available": False,
            "line1": None,
            "line2": None,
            "tle_name": None,
            "status": "simulated" if sat["is_simulated"] else "unknown",
        }
        if sat["is_simulated"]:
            entry["status"] = "simulated"
            results.append(entry)
            continue

        tle = get_tle(sat["norad_id"])
        if tle:
            entry["tle_available"] = True
            entry["line1"] = tle["line1"]
            entry["line2"] = tle["line2"]
            entry["tle_name"] = tle["name"]
            entry["status"] = "active"
        else:
            entry["status"] = "no_tle"
        results.append(entry)
    return results
