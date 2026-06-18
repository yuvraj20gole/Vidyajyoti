"""Satellite pass prediction from TLE using Skyfield."""

import math
import os
from datetime import timedelta, timezone

from services.tle import SATELLITE_CATALOG, get_tle

GS_LAT = float(os.environ.get("GS_LAT", "19.08"))
GS_LON = float(os.environ.get("GS_LON", "72.88"))
GS_ELEVATION_M = float(os.environ.get("GS_ELEVATION_M", "14"))

DEG = "\u00b0"
NA = "-"
UP = "\u2191"
DOWN = "\u2193"

_ts = None
_ground = None
_skyfield_import_error: str | None = None


def _import_skyfield():
    global _skyfield_import_error
    try:
        from skyfield.api import EarthSatellite, Loader, wgs84

        return EarthSatellite, Loader, wgs84
    except Exception as exc:
        _skyfield_import_error = str(exc)
        return None


def _skyfield_ready():
    global _ts, _ground
    if _ts is not None and _ground is not None:
        return True
    skyfield = _import_skyfield()
    if not skyfield:
        return False
    EarthSatellite, Loader, wgs84 = skyfield
    try:
        base = os.environ.get("SKYFIELD_DATA", "")
        if not base:
            base = os.path.join(
                os.path.dirname(__file__), "..", "instance", "skyfield"
            )
        os.makedirs(base, exist_ok=True)
        loader = Loader(base)
        _ts = loader.timescale()
        _ground = wgs84.latlon(GS_LAT, GS_LON, elevation_m=GS_ELEVATION_M)
        return True
    except Exception:
        return False


def _safe_float(value) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(number) or math.isinf(number):
        return None
    return number


def _maidenhead(lat: float, lon: float) -> str:
    lon_adj = lon + 180
    lat_adj = lat + 90
    field = chr(65 + int(lon_adj / 20)) + chr(65 + int(lat_adj / 10))
    square = str(int((lon_adj % 20) / 2)) + chr(65 + int((lat_adj % 10)))
    return field + square


def _estimate_doppler(alt_km: float, el_deg: float, rising: bool) -> str:
    shift_hz = (alt_km / 700) * 800 * math.sin(math.radians(max(el_deg, 1)))
    if not rising:
        shift_hz = -shift_hz
    if abs(shift_hz) >= 1000:
        sign = "+" if shift_hz >= 0 else "-"
        return f"{sign}{abs(shift_hz / 1000):.1f}kHz"
    sign = "+" if shift_hz >= 0 else ""
    return f"{sign}{shift_hz:.0f}Hz"


def _orbit_period_minutes(line2: str) -> int:
    try:
        mean_motion = float(line2.split()[7])
        return int(round(1440.0 / mean_motion))
    except (IndexError, ValueError):
        return 0


def _find_next_pass(satellite, hours: int = 48):
    if not _skyfield_ready():
        return None
    t0 = _ts.now()
    t1 = _ts.from_datetime(
        t0.utc_datetime().replace(tzinfo=timezone.utc) + timedelta(hours=hours)
    )
    times, events = satellite.find_events(_ground, t0, t1, altitude_degrees=10.0)
    for ti, event in zip(times, events):
        if event == 1:
            difference = satellite - _ground
            topocentric = difference.at(ti)
            alt, az, _ = topocentric.altaz()
            az_deg = _safe_float(az.degrees)
            el_deg = _safe_float(alt.degrees)
            if az_deg is None or el_deg is None:
                continue
            return {
                "time": ti.utc_datetime().replace(tzinfo=timezone.utc),
                "az": az_deg,
                "el": el_deg,
                "rising": True,
            }
    return None


def _empty_row(sat: dict, **overrides) -> dict:
    row = {
        "name": sat["name"],
        "norad_id": sat.get("norad_id"),
        "az": NA,
        "el": NA,
        "dir": NA,
        "next_pass": NA,
        "next_pass_iso": None,
        "footprint": NA,
        "alt_km": NA,
        "doppler": NA,
        "orbit_min": NA,
        "color": sat["color"],
        "is_simulated": sat.get("is_simulated", False),
        "status": "unknown",
    }
    row.update(overrides)
    return row


def _fallback_passes(unavailable_label: str = "Pass calc unavailable") -> list[dict]:
    rows = []
    for sat in SATELLITE_CATALOG:
        if sat["is_simulated"]:
            rows.append(_empty_row(
                sat,
                dir="SIM",
                next_pass="Simulated",
                alt_km=412,
                doppler="Simulated",
                orbit_min=92,
                status="simulated",
            ))
        else:
            tle = get_tle(sat["norad_id"])
            orbit_min = _orbit_period_minutes(tle["line2"]) if tle else NA
            rows.append(_empty_row(
                sat,
                next_pass=unavailable_label,
                orbit_min=orbit_min or NA,
                status="error",
            ))
    return rows


def get_passes() -> list[dict]:
    if not _skyfield_ready():
        return _fallback_passes()

    skyfield = _import_skyfield()
    if not skyfield:
        return _fallback_passes()

    EarthSatellite, _, _ = skyfield
    rows = []
    for sat in SATELLITE_CATALOG:
        if sat["is_simulated"]:
            rows.append(_empty_row(
                sat,
                dir="SIM",
                next_pass="Simulated",
                footprint=NA,
                alt_km=412,
                doppler="Simulated",
                orbit_min=92,
                status="simulated",
            ))
            continue

        tle = get_tle(sat["norad_id"])
        if not tle:
            rows.append(_empty_row(sat, next_pass="No active TLE", status="no_tle"))
            continue

        try:
            satellite = EarthSatellite(tle["line1"], tle["line2"], tle["name"], _ts)
            difference = satellite - _ground
            now = _ts.now()
            geocentric = difference.at(now)
            alt_now, az_now, _ = geocentric.altaz()
            subpoint = satellite.at(now).subpoint()
            pass_info = _find_next_pass(satellite)
            orbit_min = _orbit_period_minutes(tle["line2"])
            lat = _safe_float(subpoint.latitude.degrees)
            lon = _safe_float(subpoint.longitude.degrees)
            alt_km = _safe_float(subpoint.elevation.km)
            az_now_deg = _safe_float(az_now.degrees)
            el_now_deg = _safe_float(alt_now.degrees)

            if lat is None or lon is None or alt_km is None:
                rows.append(_empty_row(sat, next_pass="Orbit error", status="error"))
                continue

            alt_km_int = int(round(alt_km))
            footprint = _maidenhead(lat, lon)

            if pass_info:
                rows.append(_empty_row(
                    sat,
                    az=f"{pass_info['az']:.1f}{DEG}",
                    el=f"{pass_info['el']:.1f}{DEG}",
                    dir=UP if pass_info["rising"] else DOWN,
                    next_pass=pass_info["time"].strftime("%H:%M:%S"),
                    next_pass_iso=pass_info["time"].isoformat(),
                    footprint=footprint,
                    alt_km=alt_km_int,
                    doppler=_estimate_doppler(alt_km_int, pass_info["el"], pass_info["rising"]),
                    orbit_min=orbit_min,
                    status="active",
                    current_az=pass_info["az"],
                    current_el=pass_info["el"],
                ))
            else:
                az_label = f"{az_now_deg:.1f}{DEG}" if az_now_deg is not None else NA
                el_label = f"{el_now_deg:.1f}{DEG}" if el_now_deg is not None else NA
                rows.append(_empty_row(
                    sat,
                    az=az_label,
                    el=el_label,
                    next_pass="No pass in 48h",
                    footprint=footprint,
                    alt_km=alt_km_int,
                    orbit_min=orbit_min,
                    status="active",
                    current_az=az_now_deg,
                    current_el=el_now_deg,
                ))
        except Exception:
            rows.append(_empty_row(sat, next_pass="Orbit error", status="error"))
    return rows
