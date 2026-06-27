from flask import Blueprint, current_app, jsonify, redirect, render_template, request, url_for
from flask_login import current_user, login_required, login_user, logout_user

from extensions import db, login_manager
from models.user import User

auth_bp = Blueprint("auth", __name__)

PUBLIC_API_PATHS = {"/api/auth/login", "/api/auth/register"}


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
    try:
        return db.session.get(User, int(user_id))
    except (TypeError, ValueError):
        return None


@auth_bp.before_app_request
def enforce_authentication():
    path = request.path
    if path.startswith("/static"):
        return None
    if path in {"/", "/login", "/logout"} or path in PUBLIC_API_PATHS:
        return None
    if path.startswith("/api/auth/"):
        return None
    if path == "/api/sensor" and request.method == "POST":
        return None
    if current_user.is_authenticated:
        return None
    if path.startswith("/api/"):
        return jsonify({"error": "Authentication required"}), 401
    if path == "/dashboard" or path.startswith("/dashboard/"):
        return redirect(url_for("auth.login_page"))
    return None


@auth_bp.get("/login")
def login_page():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard"))
    return render_template("auth.html")


@auth_bp.get("/api/auth/session")
@login_required
def session_status():
    return jsonify({
        "ok": True,
        "email": current_user.email,
        "full_name": current_user.full_name,
    })


@auth_bp.post("/api/auth/register")
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    full_name = (data.get("full_name") or "").strip()

    if not is_vit_email(email):
        return jsonify({"error": "Only @vit.edu.in email addresses are allowed."}), 403
    if len(full_name) < 2:
        return jsonify({"error": "Name must be at least 2 characters."}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters."}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "An account with this email already exists."}), 409

    user = User(email=email, full_name=full_name)
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

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email or password."}), 401

    login_user(user, remember=bool(data.get("remember")))
    return jsonify({"ok": True, "redirect": url_for("dashboard")})


@auth_bp.post("/api/auth/change-password")
@login_required
def change_password():
    data = request.get_json(silent=True) or {}
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""
    confirm_password = data.get("confirm_password") or ""

    if not current_user.check_password(current_password):
        return jsonify({"error": "Current password is incorrect."}), 401
    if len(new_password) < 8:
        return jsonify({"error": "New password must be at least 8 characters."}), 400
    if new_password != confirm_password:
        return jsonify({"error": "New passwords do not match."}), 400
    if current_user.check_password(new_password):
        return jsonify({"error": "Choose a password different from your current one."}), 400

    current_user.set_password(new_password)
    db.session.commit()
    return jsonify({"ok": True, "message": "Password updated successfully."})


@auth_bp.get("/logout")
def logout():
    logout_user()
    return redirect(url_for("auth.login_page"))
