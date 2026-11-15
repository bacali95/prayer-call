"""Production WSGI entry: ``gunicorn backend.wsgi:app``."""

import os

from backend import settings
from backend.app import create_app
from backend.startup import start_background

settings.configure_logging()
app = create_app()

if os.environ.get("PRAYER_CALL_SKIP_STARTUP") != "1":
    start_background(app.extensions["prayer_call"])
