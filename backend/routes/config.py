"""Configuration routes"""
from flask import Blueprint, request, jsonify
from typing import TYPE_CHECKING
from backend.utils import transform_prayer_times

if TYPE_CHECKING:
    from backend.config import ConfigManager
    from backend.services import CronManager

config_bp = Blueprint('config', __name__, url_prefix='/api/config')

# Initialize managers (will be injected via app context or dependency injection)
config_manager = None
cron_manager = None


def init_managers(cm: 'ConfigManager', cron_mgr: 'CronManager'):
    """Initialize managers for this blueprint"""
    global config_manager, cron_manager
    config_manager = cm
    cron_manager = cron_mgr


@config_bp.route("", methods=["GET"])
def get_config():
    """Get current configuration"""
    return jsonify(config_manager.load())


@config_bp.route("", methods=["POST"])
def update_config():
    """Update configuration"""
    data = request.json
    config = config_manager.load()
    
    # Prepare updates
    updates = {}
    
    if "mosque" in data:
        updates["mosque"] = data["mosque"]
    
    if "chromecast" in data:
        updates["chromecast"] = data["chromecast"]
    
    if "adhan_files" in data:
        updates["adhan_files"] = data["adhan_files"]
    
    if "adhan_volumes" in data:
        updates["adhan_volumes"] = data["adhan_volumes"]
    
    if "prayer_times" in data:
        # Transform prayer times to simple string format if needed
        updates["prayer_times"] = transform_prayer_times(data["prayer_times"])
    
    # Apply updates
    updated_config = config_manager.update(updates)
    
    # Update cron jobs if prayer times and chromecast are set
    if updated_config.get("chromecast") and updated_config.get("prayer_times"):
        cron_manager.schedule_prayers(
            updated_config["prayer_times"],
            updated_config["chromecast"]["name"]
        )
    
    return jsonify(updated_config)

