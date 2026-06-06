"""Vidyajyoti Tracker — Flask application entry point."""

import os

from flask import Flask, redirect, render_template, url_for
from flask_login import current_user, login_required

from config import Config
from extensions import db, login_manager
from routes.api import api_bp
from routes.auth import auth_bp


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    config_class.init_app(app)

    db.init_app(app)
    login_manager.init_app(app)

    app.register_blueprint(auth_bp)
    app.register_blueprint(api_bp)

    with app.app_context():
        import models.user  # noqa: F401
        db.create_all()

    @app.get("/")
    def index():
        if current_user.is_authenticated:
            return redirect(url_for("dashboard"))
        return redirect(url_for("auth.login_page"))

    @app.get("/dashboard")
    @login_required
    def dashboard():
        return render_template("index.html")

    return app


app = create_app()


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "1") not in ("0", "false", "False")
    app.run(debug=debug, host="127.0.0.1", port=5001)
