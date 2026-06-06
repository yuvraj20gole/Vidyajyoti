from flask import Blueprint, jsonify
from flask_login import login_required

from data.generators import get_orbit, get_satellites, get_telemetry

api_bp = Blueprint("api", __name__, url_prefix="/api")


@api_bp.get("/telemetry")
@login_required
def telemetry():
    return jsonify(get_telemetry())


@api_bp.get("/orbit")
@login_required
def orbit():
    return jsonify(get_orbit())


@api_bp.get("/satellites")
@login_required
def satellites():
    return jsonify(get_satellites())
