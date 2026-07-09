import logging

from flask import Blueprint, Response, jsonify, request
from flask_login import login_required

from data.generators import get_orbit
from services.jsonutil import json_safe
from services.passes import get_passes
from services.sensors import get_sensor_data, update_sensor_data
from services.tle import get_satellites
from services.eo_imagery import fetch_eo_image_bytes, get_eo_preview, is_eo_satellite
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


@api_bp.get("/eo-imagery/image")
@login_required
def eo_imagery_image():
    try:
        lat = float(request.args.get("lat", ""))
        lon = float(request.args.get("lon", ""))
        sat = (request.args.get("sat") or "").strip()
    except (TypeError, ValueError):
        return jsonify({"error": "lat and lon are required"}), 400
    if not sat or not is_eo_satellite(sat):
        return jsonify({"error": "Invalid Earth observation satellite"}), 400
    try:
        result = fetch_eo_image_bytes(lat, lon, sat)
        if not result:
            return jsonify({"error": "Imagery not available"}), 404
        data, content_type = result
        return Response(data, mimetype=content_type)
    except Exception as exc:
        logger.exception("EO imagery image failed")
        return jsonify({"error": str(exc)}), 500


@api_bp.get("/eo-imagery")
@login_required
def eo_imagery():
    try:
        lat = float(request.args.get("lat", ""))
        lon = float(request.args.get("lon", ""))
        sat = (request.args.get("sat") or "").strip()
    except (TypeError, ValueError):
        return jsonify({"error": "lat and lon are required"}), 400
    if not sat or not is_eo_satellite(sat):
        return jsonify({"error": "Invalid Earth observation satellite"}), 400
    try:
        return jsonify(json_safe(get_eo_preview(lat, lon, sat)))
    except Exception as exc:
        logger.exception("EO imagery failed")
        return jsonify({"error": str(exc)}), 500


@api_bp.post("/sensor")
def sensor_ingest():
    import os
    expected_key = os.environ.get("SENSOR_API_KEY", "")
    provided_key = request.headers.get("X-Sensor-Key", "")
    if not expected_key or provided_key != expected_key:
        return jsonify({"error": "unauthorized"}), 401
    try:
        payload = request.get_json(force=True)
        updated = update_sensor_data(payload)
        return jsonify(json_safe(updated))
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
