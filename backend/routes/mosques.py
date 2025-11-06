"""Mosque-related routes"""
from flask import Blueprint, request, jsonify
from typing import TYPE_CHECKING
from backend.utils import transform_prayer_times
from datetime import datetime

if TYPE_CHECKING:
    from backend.services import MawaqitClient, CronManager
    from backend.config import ConfigManager

mosques_bp = Blueprint('mosques', __name__, url_prefix='/api/mosques')

# Initialize services (will be injected)
mawaqit_client = None
config_manager = None
cron_manager = None


def init_services(mawaqit: 'MawaqitClient', cm: 'ConfigManager', cron_mgr: 'CronManager'):
    """Initialize services for this blueprint"""
    global mawaqit_client, config_manager, cron_manager
    mawaqit_client = mawaqit
    config_manager = cm
    cron_manager = cron_mgr


@mosques_bp.route("/search", methods=["GET"])
def search_mosques():
    """Search for mosques"""
    query = request.args.get("q", "")
    if not query:
        return jsonify({"error": "Query parameter 'q' is required"}), 400
    
    mosques = mawaqit_client.search_mosques(query)
    # Transform API response to match frontend Mosque type
    # API returns 'localisation' but frontend expects 'address'
    transformed_mosques = []
    for mosque in mosques:
        transformed = {
            "uuid": mosque.get("uuid"),
            "id": mosque.get("uuid"),  # Also include as 'id' for compatibility
            "name": mosque.get("name") or mosque.get("label", ""),
            "address": mosque.get("localisation") or mosque.get("address")
        }
        transformed_mosques.append(transformed)
    
    return jsonify({"mosques": transformed_mosques})


@mosques_bp.route("/<mosque_id>/prayer-times", methods=["GET"])
def get_prayer_times(mosque_id):
    """Get prayer times for a mosque"""
    date = request.args.get("date")
    prayer_times = mawaqit_client.get_prayer_times(mosque_id, date)
    
    if prayer_times:
        # Log calendar structure for exploration
        if "calendar" in prayer_times and prayer_times["calendar"]:
            calendar = prayer_times["calendar"]
            print(f"\n📅 Calendar found: {len(calendar)} months")
            if len(calendar) > 0:
                first_month = calendar[0]
                print(f"   First month has {len(first_month)} days")
                if "1" in first_month:
                    print(f"   Day 1 times: {first_month['1']}")
                    print(f"   Structure: [Fajr, Shuruq, Dhuhr, Asr, Maghrib, Isha]")
        
        # Transform prayer times to simple string format
        transformed_times = transform_prayer_times(prayer_times)
        
        # Log which format was used
        if "calendar" in prayer_times and prayer_times["calendar"]:
            print(f"✅ Using calendar format - extracted: {transformed_times}")
        else:
            print(f"⚠️  Using fallback format - extracted: {transformed_times}")
        
        # Update config with transformed prayer times
        config_manager.update({"prayer_times": transformed_times})
        
        # Update cron jobs if chromecast is set
        config = config_manager.load()
        if config.get("chromecast"):
            cron_manager.schedule_prayers(
                transformed_times,
                config["chromecast"]["name"]
            )
        
        return jsonify(transformed_times)
    
    return jsonify({"error": "Failed to get prayer times"}), 500


@mosques_bp.route("/<mosque_id>/calendar/explore", methods=["GET"])
def explore_calendar(mosque_id):
    """Explore the calendar structure for debugging"""
    date = request.args.get("date")
    prayer_times = mawaqit_client.get_prayer_times(mosque_id, date)
    
    if not prayer_times or "calendar" not in prayer_times:
        return jsonify({
            "error": "Calendar not found in response",
            "available_keys": list(prayer_times.keys()) if prayer_times else []
        }), 404
    
    calendar = prayer_times["calendar"]
    today = datetime.now()
    
    info = {
        "structure": "array of month objects",
        "total_months": len(calendar) if isinstance(calendar, list) else 0,
        "current_month_index": today.month - 1,
        "current_day": today.day,
    }
    
    if isinstance(calendar, list) and len(calendar) > 0:
        # Get current month data
        month_index = today.month - 1
        if 0 <= month_index < len(calendar):
            month_data = calendar[month_index]
            info["current_month"] = {
                "month_number": today.month,
                "days_available": len(month_data) if isinstance(month_data, dict) else 0,
                "sample_day_1": month_data.get("1") if isinstance(month_data, dict) else None,
                "sample_day_15": month_data.get("15") if isinstance(month_data, dict) else None,
            }
            
            # Get today's times
            day_key = str(today.day)
            if day_key in month_data:
                info["today_times"] = {
                    "date": today.strftime("%Y-%m-%d"),
                    "times": month_data[day_key],
                    "mapping": {
                        "0": "Fajr",
                        "1": "Shuruq (Sunrise)",
                        "2": "Dhuhr",
                        "3": "Asr",
                        "4": "Maghrib",
                        "5": "Isha"
                    }
                }
    
    return jsonify(info)

