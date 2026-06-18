from flask import Blueprint, jsonify
from flask_login import login_required

from data.generators import get_orbit
from services.passes import get_passes
from services.tle import get_satellites
from services.weather import get_cities_weather, get_telemetry, get_telemetry_history

api_bp = Blueprint("api", __name__, url_prefix="/api")


@api_bp.get("/telemetry")
@login_required
def telemetry():
    return jsonify(get_telemetry())


@api_bp.get("/telemetry/history")
@login_required
def telemetry_history():
    return jsonify(get_telemetry_history())


@api_bp.get("/weather/cities")
@login_required
def weather_cities():
    return jsonify(get_cities_weather())


@api_bp.get("/orbit")
@login_required
def orbit():
    return jsonify(get_orbit())


@api_bp.get("/satellites")
@login_required
def satellites():
    return jsonify(get_satellites())


@api_bp.get("/passes")
@login_required
def passes():
    return jsonify(get_passes())
