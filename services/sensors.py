"""In-memory store for live Arduino sensor telemetry."""

import time

_latest_reading: dict = {
    "temperature": None,
    "humidity": None,
    "distance_cm": None,
    "ir": None,
    "gps_lat": None,
    "gps_lon": None,
    "gps_alt": None,
    "gps_speed": None,
    "gps_sats": None,
    "gps_fixed": False,
    "received_at": None,
    "connected": False,
}


def update_sensor_data(payload: dict) -> dict:
    _latest_reading.update(payload)
    _latest_reading["received_at"] = time.time()
    _latest_reading["connected"] = True
    return _latest_reading


def get_sensor_data() -> dict:
    reading = dict(_latest_reading)
    if reading["received_at"] is not None:
        age = time.time() - reading["received_at"]
        reading["age_seconds"] = round(age, 1)
        reading["connected"] = age < 10
    else:
        reading["age_seconds"] = None
        reading["connected"] = False
    return reading
