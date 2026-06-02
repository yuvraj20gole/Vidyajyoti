"""Vidyajyoti Tracker — Flask application entry point."""

import os

from flask import Flask, render_template

from routes.api import api_bp

app = Flask(__name__)
app.register_blueprint(api_bp)


@app.get("/")
def index():
    return render_template("index.html")


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "1") not in ("0", "false", "False")
    app.run(debug=debug, host="127.0.0.1", port=5001)
