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
    # Render uses postgres:// - SQLAlchemy 2.x needs postgresql://
    if SQLALCHEMY_DATABASE_URI.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_URI.replace(
            "postgres://", "postgresql://", 1
        )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    REMEMBER_COOKIE_HTTPONLY = True
    PREFERRED_URL_SCHEME = "https"
    @staticmethod
    def init_app(app):
        INSTANCE_DIR.mkdir(parents=True, exist_ok=True)
        flask_debug = os.environ.get("FLASK_DEBUG", "1").lower() not in (
            "0",
            "false",
            "no",
        )
        if not flask_debug:
            app.config["SESSION_COOKIE_SECURE"] = True
            app.config["REMEMBER_COOKIE_SECURE"] = True
