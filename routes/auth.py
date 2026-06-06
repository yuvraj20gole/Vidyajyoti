import secrets
from datetime import datetime, timedelta

from flask import Blueprint, current_app, jsonify, redirect, render_template, request, url_for
from flask_login import login_user, logout_user

from extensions import db, login_manager
from models.email_otp import EmailOtp
from models.user import User
from services.email import EmailSendError, send_otp_email
from services.verification import make_verification_token, verify_verification_token

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
    return render_template("auth.html", mail_dev_mode=current_app.config.get("MAIL_DEV_MODE", False))


def _otp_expiry_minutes() -> int:
    return int(current_app.config.get("OTP_EXPIRY_MINUTES", 10))


def _can_send_otp(record: EmailOtp | None) -> tuple[bool, str | None]:
    if not record or not record.last_sent_at:
        return True, None
    if (datetime.utcnow() - record.last_sent_at).total_seconds() < 60:
        return False, "Please wait 60 seconds before requesting another code."
    return True, None


@auth_bp.post("/api/auth/otp/send")
def send_otp():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not is_vit_email(email):
        return jsonify({"error": "Only @vit.edu.in email addresses are allowed."}), 403
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "An account with this email already exists."}), 409

    record = EmailOtp.query.filter_by(email=email).first()
    allowed, err = _can_send_otp(record)
    if not allowed:
        return jsonify({"error": err}), 429

    code = f"{secrets.randbelow(1_000_000):06d}"
    expires_at = datetime.utcnow() + timedelta(minutes=_otp_expiry_minutes())
    now = datetime.utcnow()

    if record:
        record.set_otp(code)
        record.expires_at = expires_at
        record.verified_at = None
        record.last_sent_at = now
    else:
        record = EmailOtp(
            email=email,
            expires_at=expires_at,
            created_at=now,
            last_sent_at=now,
        )
        record.set_otp(code)
        db.session.add(record)

    try:
        send_otp_email(email, code)
    except EmailSendError as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 502

    db.session.commit()

    payload = {"ok": True, "message": "Verification code sent."}
    if current_app.config.get("MAIL_DEV_MODE"):
        payload["dev_hint"] = "MAIL_DEV_MODE is on - check server logs for the OTP."
    return jsonify(payload)


@auth_bp.post("/api/auth/otp/verify")
def verify_otp():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    otp = (data.get("otp") or "").strip()

    if not is_vit_email(email):
        return jsonify({"error": "Only @vit.edu.in email addresses are allowed."}), 403
    if not otp or len(otp) != 6 or not otp.isdigit():
        return jsonify({"error": "Enter the 6-digit verification code."}), 400

    record = EmailOtp.query.filter_by(email=email).first()
    if not record:
        return jsonify({"error": "No verification code found. Send a new code first."}), 400
    if record.expires_at < datetime.utcnow():
        return jsonify({"error": "Verification code expired. Send a new code."}), 400
    if not record.check_otp(otp):
        return jsonify({"error": "Invalid verification code."}), 400

    record.verified_at = datetime.utcnow()
    db.session.commit()

    token = make_verification_token(email)
    return jsonify({"ok": True, "verification_token": token})


@auth_bp.post("/api/auth/register")
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    full_name = (data.get("full_name") or "").strip()
    verification_token = data.get("verification_token") or ""

    if not is_vit_email(email):
        return jsonify({"error": "Only @vit.edu.in email addresses are allowed."}), 403
    if not verify_verification_token(verification_token, email):
        return jsonify({"error": "Email not verified. Complete OTP verification first."}), 400
    if len(full_name) < 2:
        return jsonify({"error": "Name must be at least 2 characters."}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters."}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "An account with this email already exists."}), 409

    record = EmailOtp.query.filter_by(email=email).first()
    if not record or not record.verified_at:
        return jsonify({"error": "Email not verified. Complete OTP verification first."}), 400

    user = User(email=email, full_name=full_name)
    user.set_password(password)
    db.session.add(user)
    db.session.delete(record)
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
