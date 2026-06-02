from flask import Blueprint, jsonify

from data.generators import get_orbit, get_satellites, get_telemetry

api_bp = Blueprint("api", __name__, url_prefix="/api")


@api_bp.get("/telemetry")
def telemetry():
    return jsonify(get_telemetry())


@api_bp.get("/orbit")
def orbit():
    return jsonify(get_orbit())


@api_bp.get("/satellites")
def satellites():
    return jsonify(get_satellites())
