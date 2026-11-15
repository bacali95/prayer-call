"""Flask application factory for Prayer Call.

``create_app`` is synchronous, performs no network or crontab access and takes
its collaborators as arguments. Startup scheduling lives in ``backend.startup``
and is triggered by the production entry point (``backend.wsgi``).
"""

import logging
import os
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.exceptions import HTTPException, NotFound
from werkzeug.utils import safe_join

from backend import settings
from backend.config import ConfigCorruptError
from backend.routes import ALL_BLUEPRINTS
from backend.services import Services, build_services

logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 50 * 1024 * 1024


def create_app(
    config_dir: str | None = None,
    upload_dir: str | None = None,
    services: Services | None = None,
    static_dir: str | None = None,
) -> Flask:
    upload_dir = upload_dir or settings.upload_dir()
    static_dir = static_dir if static_dir is not None else settings.static_dir()
    os.makedirs(upload_dir, exist_ok=True)

    app = Flask(__name__, static_folder=None)
    app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES
    app.config["UPLOAD_DIR"] = upload_dir
    app.config["VERSION"] = settings.read_version()
    app.extensions["prayer_call"] = services or build_services(
        config_dir=config_dir, upload_dir=upload_dir
    )

    CORS(app, resources={r"/api/*": {"origins": settings.cors_origins()}})

    for blueprint in ALL_BLUEPRINTS:
        app.register_blueprint(blueprint)

    _register_meta_routes(app)
    _register_error_handlers(app)
    if os.path.isfile(os.path.join(static_dir, "index.html")):
        _register_spa(app, static_dir)
    return app


def _register_meta_routes(app: Flask) -> None:
    @app.get("/healthz")
    def healthz():
        return jsonify({"status": "ok", "version": app.config["VERSION"]})

    @app.get("/api/version")
    def version():
        return jsonify({"version": app.config["VERSION"]})

    @app.route("/api/<path:_path>", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
    def api_not_found(_path):
        raise NotFound("Unknown API endpoint")


def _register_error_handlers(app: Flask) -> None:
    @app.errorhandler(HTTPException)
    def handle_http(exc: HTTPException):
        if request.path.startswith("/api/"):
            return jsonify({"error": exc.description or exc.name}), exc.code
        return exc

    @app.errorhandler(ConfigCorruptError)
    def handle_corrupt_config(exc: ConfigCorruptError):
        logger.error("%s", exc)
        return jsonify({"error": str(exc)}), 500

    @app.errorhandler(Exception)
    def handle_unexpected(exc: Exception):
        logger.exception("Unhandled error on %s %s", request.method, request.path)
        return jsonify({"error": "Internal server error"}), 500


def _register_spa(app: Flask, static_dir: str) -> None:
    root = str(Path(static_dir).resolve())

    @app.get("/", defaults={"path": ""})
    @app.get("/<path:path>")
    def serve_react(path):
        full = safe_join(root, path) if path else None
        if full and os.path.isfile(full):
            return send_from_directory(root, path)
        response = send_from_directory(root, "index.html")
        response.headers["Cache-Control"] = "no-cache"
        return response


if __name__ == "__main__":
    settings.configure_logging()
    create_app().run(
        host="127.0.0.1",
        port=settings.port(),
        debug=os.environ.get("FLASK_DEBUG") == "1",
    )
