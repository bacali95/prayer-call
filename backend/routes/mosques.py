"""Mosque-related routes"""
from flask import Blueprint, request, jsonify
from typing import TYPE_CHECKING
from backend.utils import transform_prayer_times, get_prayer_schedule_date
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
        
        # Get current date in both formats
        schedule_date = get_prayer_schedule_date()
        
        # Update config with transformed prayer times and schedule date
        config_manager.update({
            "prayer_times": transformed_times,
            "prayer_schedule_date": schedule_date
        })
        
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


@mosques_bp.route("/<mosque_id>/prayer-times/year", methods=["GET"])
def get_prayer_times_year(mosque_id):
    """Get prayer times for the entire current year"""
    from datetime import date
    import calendar as cal_module
    from backend.utils.date_utils import get_dst_periods, get_dst_transitions, format_date_both_calendars
    
    # Get current year
    current_year = datetime.now().year
    year_start = date(current_year, 1, 1)
    
    # Fetch prayer times for the year (API returns full calendar)
    prayer_times = mawaqit_client.get_prayer_times(mosque_id, year_start.strftime("%Y-%m-%d"))
    
    if not prayer_times or "calendar" not in prayer_times:
        return jsonify({"error": "Failed to get prayer times calendar"}), 500
    
    calendar_data = prayer_times["calendar"]
    if not isinstance(calendar_data, list) or len(calendar_data) != 12:
        return jsonify({"error": "Invalid calendar structure"}), 500
    
    # Get DST periods for the year
    # Note: We don't have the mosque's timezone, so we'll use a default
    # The API times are already in local time (which includes DST adjustments)
    dst_periods = get_dst_periods(current_year)
    dst_transitions = get_dst_transitions(current_year)
    
    # Create a map of dates to DST status for quick lookup
    date_to_dst = {}
    for start_date, end_date, is_dst in dst_periods:
        current = start_date
        while current <= end_date and current.year == current_year:
            date_to_dst[current] = is_dst
            try:
                current = date(current.year, current.month, current.day + 1)
            except ValueError:
                if current.month == 12:
                    break
                current = date(current.year, current.month + 1, 1)
    
    # Transform calendar to array of daily prayer times
    # Each entry: { dayOfYear: int, date: "YYYY-MM-DD", fajr: "HH:MM", dhuhr: "HH:MM", asr: "HH:MM", maghrib: "HH:MM", isha: "HH:MM", isDST: bool }
    year_data = []
    day_of_year = 1
    
    for month_idx, month_data in enumerate(calendar_data):
        if not isinstance(month_data, dict):
            continue
        
        month_num = month_idx + 1
        # Get number of days in this month
        days_in_month = cal_module.monthrange(current_year, month_num)[1]
        
        for day_num in range(1, days_in_month + 1):
            day_key = str(day_num)
            if day_key not in month_data:
                continue
            
            day_times = month_data[day_key]
            if not isinstance(day_times, list) or len(day_times) < 6:
                continue
            
            # Map: [Fajr, Shuruq, Dhuhr, Asr, Maghrib, Isha]
            current_date = date(current_year, month_num, day_num)
            is_dst = date_to_dst.get(current_date, False)
            
            # Format date in both calendars
            date_formats = format_date_both_calendars(current_date)
            
            year_data.append({
                "dayOfYear": day_of_year,
                "date": current_date.strftime("%Y-%m-%d"),
                "fajr": day_times[0],
                "dhuhr": day_times[2],
                "asr": day_times[3],
                "maghrib": day_times[4],
                "isha": day_times[5],
                "isDST": is_dst,
                "gregorian": date_formats["gregorian"],
                "hijri": date_formats["hijri"]
            })
            day_of_year += 1
    
    # Convert DST transitions to day of year for frontend
    dst_transition_days = []
    for transition_date in dst_transitions:
        # Calculate day of year
        year_start = date(current_year, 1, 1)
        day_of_year = (transition_date - year_start).days + 1
        dst_transition_days.append({
            "dayOfYear": day_of_year,
            "date": transition_date.strftime("%Y-%m-%d")
        })
    
    return jsonify({
        "year": current_year,
        "data": year_data,
        "dstTransitions": dst_transition_days
    })

