import os
from pathlib import Path

BASE_DIR = Path(__file__).parent
INSTANCE_DIR = BASE_DIR / "instance"


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-change-me-in-production")
    ALLOWED_EMAIL_DOMAIN = os.environ.get("ALLOWED_EMAIL_DOMAIN", "vit.edu.in")
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        f"sqlite:///{INSTANCE_DIR / 'vidyajyoti.db'}",
    )
    # Render uses postgres:// — SQLAlchemy 2.x needs postgresql://
    if SQLALCHEMY_DATABASE_URI.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_URI.replace(
            "postgres://", "postgresql://", 1
        )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    REMEMBER_COOKIE_HTTPONLY = True
    PREFERRED_URL_SCHEME = "https"
    RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
    MAIL_FROM = os.environ.get("MAIL_FROM", "Vidyajyoti <onboarding@resend.dev>")
    MAIL_DEV_MODE = os.environ.get("MAIL_DEV_MODE", "0") in ("1", "true", "True")
    OTP_EXPIRY_MINUTES = int(os.environ.get("OTP_EXPIRY_MINUTES", "10"))

    @staticmethod
    def init_app(app):
        INSTANCE_DIR.mkdir(parents=True, exist_ok=True)
        if not app.debug and os.environ.get("FLASK_DEBUG", "0") in ("0", "false", "False"):
            app.config["SESSION_COOKIE_SECURE"] = True
            app.config["REMEMBER_COOKIE_SECURE"] = True
