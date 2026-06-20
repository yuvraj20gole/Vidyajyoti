"""Vidyajyoti simulated orbit data (mission telemetry not public)."""

import math
import time

GTS = [
    "Bay of Bengal",
    "Tamil Nadu Coast",
    "Indian Ocean",
    "Arabian Sea",
    "Bay of Bengal",
]

VJ_PERIOD_SEC = 92 * 60
VJ_CENTER_LAT = 20.0
VJ_CENTER_LON = 78.0

orbit = type("OrbitState", (), {"ground_track_idx": 0, "countdown_sec": 13620})()


def _vidyajyoti_position(now: float | None = None) -> dict[str, float]:
    ts = now if now is not None else time.time()
    phase = (ts % VJ_PERIOD_SEC) / VJ_PERIOD_SEC * 2 * math.pi
    lat = VJ_CENTER_LAT + 14 * math.sin(phase)
    lon = VJ_CENTER_LON + 12 * math.cos(phase * 0.92 + 0.35)
    lon = max(68.0, min(92.0, lon))
    alt = 412 + 4 * math.sin(phase * 2)
    return {
        "lat": round(lat, 2),
        "lon": round(lon, 2),
        "alt": round(alt, 1),
        "vel": 7.662,
        "dop": round(3.12 * math.sin(phase), 2),
    }


def get_orbit() -> dict:
    pos = _vidyajyoti_position()
    orbit.ground_track_idx = (orbit.ground_track_idx + 1) % len(GTS)
    orbit.countdown_sec = max(0, orbit.countdown_sec - 4)
    return {
        "lat": pos["lat"],
        "lon": pos["lon"],
        "alt": pos["alt"],
        "vel": pos["vel"],
        "dop": pos["dop"],
        "ground_track": GTS[orbit.ground_track_idx],
        "countdown_sec": orbit.countdown_sec,
        "source": "simulated",
        "name": "VIDYAJYOTI",
        "is_simulated": True,
    }
