"""Dummy telemetry and orbit data generators for Vidyajyoti Tracker."""

import random
from dataclasses import dataclass

WX_CONDS = ["Partly Cloudy", "Mostly Sunny", "Overcast", "Hazy", "Humid"]
GTS = [
    "Bay of Bengal",
    "Tamil Nadu Coast",
    "Indian Ocean",
    "Arabian Sea",
    "Bay of Bengal",
]

SATELLITES = [
    {"name": "VIDYAJYOTI", "lon": 88.36, "lat": 22.14, "color": "#4d9fff", "alt": 412, "dop": "+3.1kHz", "track": 0, "speed": 0.28},
    {"name": "VO-52", "lon": -20, "lat": 15, "color": "#9d6fff", "alt": 627, "dop": "+205Hz", "track": 55, "speed": 0.22},
    {"name": "HO-68", "lon": 140, "lat": -10, "color": "#00e5a0", "alt": 7308, "dop": "-1.6kHz", "track": 120, "speed": 0.12},
    {"name": "SO-50", "lon": 60, "lat": 35, "color": "#ff7c3a", "alt": 703, "dop": "-533Hz", "track": 85, "speed": 0.2},
    {"name": "AO-27", "lon": -100, "lat": -20, "color": "#ffc444", "alt": 779, "dop": "-2.1kHz", "track": 200, "speed": 0.18},
    {"name": "FO-29", "lon": 170, "lat": 30, "color": "#ff4466", "alt": 887, "dop": "+440Hz", "track": 160, "speed": 0.15},
]


def nudge(value: float, delta: float, mn: float, mx: float) -> float:
    return round(min(mx, max(mn, value + (random.random() - 0.5) * delta)), 1)


@dataclass
class TelemetryState:
    temp: float = 31.4
    hum: float = 78.0
    pres: float = 1008.0
    wind: float = 18.0
    uv: float = 7.2
    aqi: float = 142.0
    dew: float = 24.1
    vis: float = 6.2
    cloud: float = 68.0
    rain: float = 2.0


@dataclass
class OrbitState:
    lat: float = 22.14
    lon: float = 88.36
    alt: float = 412.6
    vel: float = 7.662
    dop: float = 3.12
    ground_track_idx: int = 0
    countdown_sec: int = 13620


telemetry = TelemetryState()
orbit = OrbitState()


def get_telemetry() -> dict:
    t = telemetry
    t.temp = nudge(t.temp, 0.4, 26, 38)
    t.hum = nudge(t.hum, 1.5, 55, 95)
    t.pres = nudge(t.pres, 1, 995, 1020)
    t.wind = nudge(t.wind, 1.5, 5, 45)
    t.uv = nudge(t.uv, 0.3, 0, 11)
    t.aqi = nudge(t.aqi, 4, 50, 200)
    t.dew = nudge(t.dew, 0.3, 18, 30)
    t.vis = nudge(t.vis, 0.2, 2, 12)
    t.cloud = nudge(t.cloud, 3, 10, 100)
    t.rain = nudge(t.rain, 1, 0, 100)
    return {
        "temp": t.temp,
        "hum": t.hum,
        "pres": t.pres,
        "wind": t.wind,
        "uv": t.uv,
        "aqi": t.aqi,
        "dew": t.dew,
        "vis": t.vis,
        "cloud": t.cloud,
        "rain": t.rain,
        "feels_like": round(t.temp + t.hum * 0.04, 1),
        "wx_cond": random.choice(WX_CONDS[:2]),
    }


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
    }


def get_satellites() -> list:
    return SATELLITES
