"""Open-Meteo weather and air-quality integration."""

import os
import time
from typing import Any

import requests

WEATHER_LAT = float(os.environ.get("WEATHER_LAT", "19.08"))
WEATHER_LON = float(os.environ.get("WEATHER_LON", "72.88"))
CACHE_TTL = int(os.environ.get("WEATHER_CACHE_TTL", "600"))

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"

INDIA_CITIES = [
    {"name": "Mumbai", "lat": 19.08, "lon": 72.88},
    {"name": "Delhi", "lat": 28.61, "lon": 77.21},
    {"name": "Chennai", "lat": 13.08, "lon": 80.27},
    {"name": "Kolkata", "lat": 22.57, "lon": 88.36},
    {"name": "Bengaluru", "lat": 12.97, "lon": 77.59},
    {"name": "Hyderabad", "lat": 17.38, "lon": 78.47},
]

WX_CODES = {
    0: "Clear",
    1: "Mainly Clear",
    2: "Partly Cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Foggy",
    51: "Light Drizzle",
    61: "Rain",
    63: "Rain",
    80: "Showers",
    95: "Thunderstorm",
}

_cache: dict[str, tuple[float, Any]] = {}


def _cached(key: str, fetcher):
    now = time.time()
    if key in _cache and now - _cache[key][0] < CACHE_TTL:
        return _cache[key][1]
    data = fetcher()
    _cache[key] = (now, data)
    return data


def _aqi_label(pm25: float | None) -> str:
    if pm25 is None:
        return "N/A"
    if pm25 <= 12:
        return "Good"
    if pm25 <= 35:
        return "Moderate"
    if pm25 <= 55:
        return "Unhealthy (Sens.)"
    if pm25 <= 150:
        return "Unhealthy"
    return "Very Unhealthy"


def _pm25_to_aqi(pm25: float | None) -> float:
    if pm25 is None:
        return 0.0
    return round(min(500.0, pm25 * 2.5), 0)


def _fetch_forecast(lat: float, lon: float) -> dict:
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": [
            "temperature_2m",
            "relative_humidity_2m",
            "surface_pressure",
            "wind_speed_10m",
            "cloud_cover",
            "precipitation",
            "weather_code",
            "uv_index",
            "dew_point_2m",
        ],
        "hourly": [
            "temperature_2m",
            "relative_humidity_2m",
            "surface_pressure",
        ],
        "timezone": "Asia/Kolkata",
        "forecast_days": 2,
    }
    resp = requests.get(FORECAST_URL, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


def _fetch_air_quality(lat: float, lon: float) -> dict:
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": ["pm2_5", "us_aqi"],
        "timezone": "Asia/Kolkata",
    }
    try:
        resp = requests.get(AIR_QUALITY_URL, params=params, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException:
        return {"current": {}}


def get_telemetry() -> dict:
    def fetch():
        forecast = _fetch_forecast(WEATHER_LAT, WEATHER_LON)
        aq = _fetch_air_quality(WEATHER_LAT, WEATHER_LON)
        cur = forecast.get("current", {})
        aq_cur = aq.get("current", {})
        pm25 = aq_cur.get("pm2_5")
        us_aqi = aq_cur.get("us_aqi")
        temp = float(cur.get("temperature_2m", 28.0))
        hum = float(cur.get("relative_humidity_2m", 70.0))
        code = int(cur.get("weather_code", 2))
        aqi_val = float(us_aqi) if us_aqi is not None else _pm25_to_aqi(pm25)
        return {
            "temp": round(temp, 1),
            "hum": round(hum, 1),
            "pres": round(float(cur.get("surface_pressure", 1010)), 0),
            "wind": round(float(cur.get("wind_speed_10m", 12)), 1),
            "uv": round(float(cur.get("uv_index", 5)), 1),
            "aqi": round(aqi_val, 0),
            "aqi_label": _aqi_label(pm25),
            "dew": round(float(cur.get("dew_point_2m", temp - 4)), 1),
            "vis": 10.0,
            "cloud": round(float(cur.get("cloud_cover", 50)), 0),
            "rain": round(float(cur.get("precipitation", 0)) * 10, 0),
            "feels_like": round(temp + hum * 0.04, 1),
            "wx_cond": WX_CODES.get(code, "Partly Cloudy"),
            "source": "Open-Meteo",
            "location": "Mumbai",
        }

    return _cached("telemetry", fetch)


def get_telemetry_history() -> dict:
    def fetch():
        forecast = _fetch_forecast(WEATHER_LAT, WEATHER_LON)
        hourly = forecast.get("hourly", {})
        times = hourly.get("time", [])[-24:]
        temps = hourly.get("temperature_2m", [])[-24:]
        hums = hourly.get("relative_humidity_2m", [])[-24:]
        pres = hourly.get("surface_pressure", [])[-24:]
        labels = []
        for t in times:
            try:
                labels.append(t.split("T")[1][:5])
            except (IndexError, AttributeError):
                labels.append("--:--")
        return {
            "labels": labels,
            "temp": [round(float(v), 1) for v in temps],
            "hum": [round(float(v), 1) for v in hums],
            "pressure": [round(float(v) - 1000, 1) for v in pres],
            "source": "Open-Meteo",
            "location": "Mumbai",
        }

    return _cached("history", fetch)


def get_cities_weather() -> list:
    def fetch():
        results = []
        for city in INDIA_CITIES:
            try:
                forecast = _fetch_forecast(city["lat"], city["lon"])
                cur = forecast.get("current", {})
                results.append({
                    "name": city["name"],
                    "lat": city["lat"],
                    "lon": city["lon"],
                    "temp": round(float(cur.get("temperature_2m", 0)), 1),
                    "hum": round(float(cur.get("relative_humidity_2m", 0)), 0),
                })
            except requests.RequestException:
                results.append({
                    "name": city["name"],
                    "lat": city["lat"],
                    "lon": city["lon"],
                    "temp": None,
                    "hum": None,
                })
        return results

    return _cached("cities", fetch)
