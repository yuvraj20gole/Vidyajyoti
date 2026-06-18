"""CelesTrak TLE fetch and cache for amateur satellites."""

import os
import time
from typing import Any

import requests

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
        "norad_id": 24208,
        "color": "#ff4466",
        "is_simulated": False,
    },
    {
        "name": "HO-68",
        "norad_id": 36122,
        "color": "#00e5a0",
        "is_simulated": False,
    },
]

_tle_cache: dict[int, tuple[float, dict[str, str] | None]] = {}


def _fetch_tle(norad_id: int) -> dict[str, str] | None:
    url = f"https://celestrak.org/NORAD/elements/gp.php?CATNR={norad_id}&FORMAT=TLE"
    try:
        resp = requests.get(url, timeout=20, headers={"User-Agent": "VidyajyotiTracker/1.0"})
        resp.raise_for_status()
        lines = [ln.strip() for ln in resp.text.strip().splitlines() if ln.strip()]
        if len(lines) < 3:
            return None
        return {"name": lines[0], "line1": lines[1], "line2": lines[2]}
    except requests.RequestException:
        return None


def get_tle(norad_id: int) -> dict[str, str] | None:
    now = time.time()
    if norad_id in _tle_cache and now - _tle_cache[norad_id][0] < TLE_CACHE_TTL:
        return _tle_cache[norad_id][1]
    tle = _fetch_tle(norad_id)
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
