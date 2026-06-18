"""Vidyajyoti simulated orbit data (mission telemetry not public)."""

import random

GTS = [
    "Bay of Bengal",
    "Tamil Nadu Coast",
    "Indian Ocean",
    "Arabian Sea",
    "Bay of Bengal",
]


def nudge(value: float, delta: float, mn: float, mx: float) -> float:
    return round(min(mx, max(mn, value + (random.random() - 0.5) * delta)), 1)


class OrbitState:
    lat: float = 22.14
    lon: float = 88.36
    alt: float = 412.6
    vel: float = 7.662
    dop: float = 3.12
    ground_track_idx: int = 0
    countdown_sec: int = 13620


orbit = OrbitState()


def get_orbit() -> dict:
    o = orbit
    o.lat = nudge(o.lat, 0.15, -85, 85)
    o.lon = round(o.lon + 0.4 + (random.random() - 0.5) * 0.1, 2)
    if o.lon > 180:
        o.lon = -180
    o.alt = nudge(o.alt, 0.5, 400, 425)
    o.vel = round(min(7.72, max(7.6, o.vel + (random.random() - 0.5) * 0.002)), 3)
    o.dop = nudge(o.dop, 0.15, -5, 5)
    o.ground_track_idx = (o.ground_track_idx + 1) % len(GTS)
    o.countdown_sec = max(0, o.countdown_sec - 4)
    return {
        "lat": o.lat,
        "lon": o.lon,
        "alt": o.alt,
        "vel": o.vel,
        "dop": o.dop,
        "ground_track": GTS[o.ground_track_idx],
        "countdown_sec": o.countdown_sec,
        "source": "simulated",
        "name": "VIDYAJYOTI",
        "is_simulated": True,
    }
