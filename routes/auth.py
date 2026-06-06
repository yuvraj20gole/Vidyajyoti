from flask import Blueprint, current_app, jsonify, redirect, render_template, request, url_for
from flask_login import login_user, logout_user

from extensions import db, login_manager
from models.user import User

auth_bp = Blueprint("auth", __name__)


@login_manager.unauthorized_handler
def unauthorized():
    if request.path.startswith("/api/"):
        return jsonify({"error": "Authentication required"}), 401
    return redirect(url_for("auth.login_page"))


def is_vit_email(email: str) -> bool:
    domain = current_app.config.get("ALLOWED_EMAIL_DOMAIN", "vit.edu.in")
    email = (email or "").strip().lower()
    return "@" in email and email.endswith(f"@{domain}")


@login_manager.user_loader
def load_user(user_id: str):
    return db.session.get(User, int(user_id))


@auth_bp.get("/login")
def login_page():
    return render_template("auth.html")


@auth_bp.post("/api/auth/register")
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    full_name = (data.get("full_name") or "").strip()
    station_id = (data.get("station_id") or "").strip()

    if not is_vit_email(email):
        return jsonify({"error": "Only @vit.edu.in email addresses are allowed."}), 403
    if len(full_name) < 2:
        return jsonify({"error": "Name must be at least 2 characters."}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters."}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "An account with this email already exists."}), 409

    user = User(email=email, full_name=full_name, station_id=station_id or None)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    login_user(user, remember=bool(data.get("remember")))
    return jsonify({"ok": True, "redirect": url_for("dashboard")})


@auth_bp.post("/api/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not is_vit_email(email):
        return jsonify({"error": "Only @vit.edu.in email addresses are allowed."}), 403
    if len(password) < 6:
        return jsonify({"error": "Invalid email or password."}), 401

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email or password."}), 401

    login_user(user, remember=bool(data.get("remember")))
    return jsonify({"ok": True, "redirect": url_for("dashboard")})


@auth_bp.get("/logout")
def logout():
    logout_user()
    return redirect(url_for("auth.login_page"))
