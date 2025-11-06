"""Prayer time transformation utilities"""
from datetime import datetime
from typing import Dict, Any, Optional, List


def extract_prayer_times_from_calendar(calendar: List[Dict], date: Optional[datetime] = None) -> Dict[str, str]:
    """Extract prayer times from calendar array structure.
    
    Calendar structure:
    - Array of 12 objects (one per month, 0-indexed: Jan=0, Dec=11)
    - Each month object has keys "1" through "31" (day numbers as strings)
    - Each day has an array of 6 times: [Fajr, Shuruq, Dhuhr, Asr, Maghrib, Isha]
    
    Args:
        calendar: Array of month objects
        date: datetime object (defaults to today)
    
    Returns:
        Dict with prayer names as keys and times as values
    """
    if not calendar or not isinstance(calendar, list) or len(calendar) == 0:
        return {}
    
    if date is None:
        date = datetime.now()
    
    month_index = date.month - 1  # Convert to 0-indexed (Jan=0, Dec=11)
    day = str(date.day)  # Day as string key
    
    # Ensure we have a valid month
    if month_index < 0 or month_index >= len(calendar):
        return {}
    
    month_data = calendar[month_index]
    if not isinstance(month_data, dict) or day not in month_data:
        return {}
    
    day_times = month_data[day]
    if not isinstance(day_times, list) or len(day_times) < 6:
        return {}
    
    # Map array indices to prayer names
    # Index 0 = Fajr, 1 = Shuruq, 2 = Dhuhr, 3 = Asr, 4 = Maghrib, 5 = Isha
    return {
        "fajr": day_times[0],
        "shuruq": day_times[1],  # Sunrise (optional, not always used)
        "dhuhr": day_times[2],
        "asr": day_times[3],
        "maghrib": day_times[4],
        "isha": day_times[5]
    }


def transform_prayer_times(prayer_times: Dict[str, Any]) -> Dict[str, str]:
    """Transform prayer times from API format to simple string format.
    
    The API may return prayer times in different formats:
    1. Calendar array structure (preferred if available)
    2. Objects with day numbers (1-31) as keys
    3. Simple string values
    
    This function extracts today's prayer times or the first available day.
    """
    if not prayer_times:
        return {}
    
    today = datetime.now()
    
    # First, try to extract from calendar if available
    if "calendar" in prayer_times and prayer_times["calendar"]:
        calendar_times = extract_prayer_times_from_calendar(prayer_times["calendar"], today)
        if calendar_times:
            # Remove shuruq if not needed (it's sunrise, not a prayer time)
            calendar_times.pop("shuruq", None)
            return calendar_times
    
    # Fallback to old format handling
    transformed = {}
    for prayer, time_value in prayer_times.items():
        # Skip calendar since we already handled it
        if prayer == "calendar":
            continue
            
        if isinstance(time_value, dict):
            # If time is an object with day numbers, get today's time or first available
            day_key = str(today.day)
            if day_key in time_value:
                transformed[prayer] = time_value[day_key]
            elif today.day in time_value:
                transformed[prayer] = time_value[today.day]
            elif time_value:
                # Fall back to first available day
                first_value = next(iter(time_value.values()), None)
                transformed[prayer] = first_value
            else:
                transformed[prayer] = None
        elif isinstance(time_value, str):
            # Already in string format
            transformed[prayer] = time_value
        elif isinstance(time_value, list) and len(time_value) > 0:
            # Handle times array format (like in the "times" field)
            # Map: [Fajr, Dhuhr, Asr, Maghrib, Isha] - 5 times
            prayer_map = ["fajr", "dhuhr", "asr", "maghrib", "isha"]
            for idx, prayer_name in enumerate(prayer_map):
                if idx < len(time_value):
                    transformed[prayer_name] = time_value[idx]
        else:
            transformed[prayer] = None
    
    return transformed

