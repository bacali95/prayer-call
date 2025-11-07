"""Flask backend for Prayer Call App"""
from flask import Flask, send_from_directory
from flask_cors import CORS
import os

# Import services and managers
from backend.config import ConfigManager
from backend.services import ChromecastScanner, CronManager, MawaqitClient

# Import route blueprints
from backend.routes import (
    config_bp, mosques_bp, chromecasts_bp, files_bp, cron_bp, test_bp
)

# Determine if we're in production (serving static files)
STATIC_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")
PRODUCTION = os.path.exists(STATIC_FOLDER)

# Configuration
CONFIG_DIR = os.environ.get("CONFIG_DIR", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")

# Ensure uploads directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def create_app():
    """Create and configure Flask application"""
    app = Flask(__name__, static_folder=STATIC_FOLDER if PRODUCTION else None)
    CORS(app)
    
    # Initialize services and managers
    config_manager = ConfigManager(config_dir=CONFIG_DIR)
    chromecast_scanner = ChromecastScanner()
    cron_manager = CronManager()
    mawaqit_client = MawaqitClient()
    
    # Schedule the daily reschedule job at 2am
    cron_manager.schedule_reschedule_job()
    
    # Schedule prayers for today if mosque and chromecast are configured
    config = config_manager.load()
    mosque = config.get("mosque")
    chromecast = config.get("chromecast")
    
    if mosque and mosque.get("uuid") and chromecast and chromecast.get("name"):
        print(f"Mosque and chromecast configured. Fetching prayer times for today...")
        try:
            # Fetch prayer times for today
            prayer_times_data = mawaqit_client.get_prayer_times(mosque["uuid"])
            if prayer_times_data:
                from backend.utils import transform_prayer_times
                transformed_times = transform_prayer_times(prayer_times_data)
                if transformed_times:
                    # Schedule prayers for today
                    cron_manager.schedule_prayers(
                        transformed_times,
                        chromecast["name"]
                    )
                    # Update config with prayer times
                    config_manager.update({"prayer_times": transformed_times})
                    print("Scheduled prayers for today")
                else:
                    print("No prayer times extracted from API response")
            else:
                print("Failed to fetch prayer times from API")
        except Exception as e:
            print(f"Error scheduling prayers on startup: {e}")
    else:
        print("Mosque or chromecast not configured. Skipping prayer scheduling on startup.")
    
    # Initialize route blueprints with dependencies
    from backend.routes.config import init_managers as init_config_managers
    from backend.routes.mosques import init_services as init_mosques_services
    from backend.routes.chromecasts import init_scanner as init_chromecasts_scanner
    from backend.routes.files import init_files
    from backend.routes.cron import init_manager as init_cron_manager
    from backend.routes.test import init_scanner as init_test_scanner
    
    init_config_managers(config_manager, cron_manager)
    init_mosques_services(mawaqit_client, config_manager, cron_manager)
    init_chromecasts_scanner(chromecast_scanner)
    init_files(UPLOAD_FOLDER)
    init_cron_manager(cron_manager)
    init_test_scanner(chromecast_scanner)
    
    # Register blueprints
    app.register_blueprint(config_bp)
    app.register_blueprint(mosques_bp)
    app.register_blueprint(chromecasts_bp)
    app.register_blueprint(files_bp)
    app.register_blueprint(cron_bp)
    app.register_blueprint(test_bp)
    
    # Serve React app for production
    if PRODUCTION:
        @app.route("/", defaults={"path": ""})
        @app.route("/<path:path>")
        def serve_react(path):
            """Serve React app for all non-API routes"""
            if path != "" and os.path.exists(os.path.join(STATIC_FOLDER, path)):
                return send_from_directory(STATIC_FOLDER, path)
            else:
                return send_from_directory(STATIC_FOLDER, "index.html")
    
    return app


# Create app instance
app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3001, debug=not PRODUCTION)

