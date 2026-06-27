import logging

from flask import Blueprint, jsonify, request
from flask_login import login_required

from data.generators import get_orbit
from services.jsonutil import json_safe
from services.passes import get_passes
from services.sensors import get_sensor_data, update_sensor_data
from services.tle import get_satellites
from services.weather import get_cities_weather, get_telemetry, get_telemetry_history

logger = logging.getLogger(__name__)

api_bp = Blueprint("api", __name__, url_prefix="/api")


@api_bp.get("/telemetry")
@login_required
def telemetry():
    try:
        return jsonify(json_safe(get_telemetry()))
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@api_bp.get("/telemetry/history")
@login_required
def telemetry_history():
    try:
        return jsonify(json_safe(get_telemetry_history()))
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@api_bp.get("/weather/cities")
@login_required
def weather_cities():
    try:
        return jsonify(json_safe(get_cities_weather()))
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@api_bp.get("/orbit")
@login_required
def orbit():
    try:
        return jsonify(json_safe(get_orbit()))
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@api_bp.get("/satellites")
@login_required
def satellites():
    try:
        return jsonify(json_safe(get_satellites()))
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@api_bp.get("/passes")
@login_required
def passes():
    try:
        return jsonify(json_safe(get_passes()))
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@api_bp.get("/sensor")
@login_required
def sensor():
    try:
        return jsonify(json_safe(get_sensor_data()))
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@api_bp.post("/sensor")
def sensor_ingest():
    import os
    expected_key = os.environ.get("SENSOR_API_KEY", "")
    provided_key = request.headers.get("X-Sensor-Key", "")
    logger.warning(f"DEBUG SENSOR: expected={repr(expected_key)} provided={repr(provided_key)} match={expected_key == provided_key}")
    if not expected_key or provided_key != expected_key:
        return jsonify({"error": "unauthorized"}), 401
    try:
        payload = request.get_json(force=True)
        updated = update_sensor_data(payload)
        return jsonify(json_safe(updated))
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
