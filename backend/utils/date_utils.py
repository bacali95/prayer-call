"""Date utility functions for Gregorian and Hijri dates"""
from datetime import datetime, date
from typing import Dict, List, Tuple, Optional
from hijri_converter import convert
from zoneinfo import ZoneInfo


def format_date_both_calendars(target_date: date) -> Dict[str, str]:
    """
    Format a specific date in both Gregorian and Hijri formats.
    
    Args:
        target_date: The date to format
    
    Returns:
        Dict with 'gregorian' and 'hijri' keys containing formatted date strings
    """
    # Format Gregorian date (e.g., "Monday, January 15, 2024")
    gregorian = target_date.strftime("%A, %B %d, %Y")
    
    # Convert to Hijri
    try:
        hijri_date = convert.Gregorian(target_date.year, target_date.month, target_date.day).to_hijri()
        
        # Hijri month names in Arabic
        hijri_months = [
            "محرم", "صفر", "ربيع الأول", "ربيع الثاني", "جمادى الأولى", "جمادى الثانية",
            "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"
        ]
        
        # Day names in Arabic
        hijri_days = [
            "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"
        ]
        
        # Get day of week (0 = Monday, 6 = Sunday)
        day_of_week = target_date.weekday()
        day_name_ar = hijri_days[day_of_week]
        
        month_name_ar = hijri_months[hijri_date.month - 1]
        
        # Format Hijri date (e.g., "الاثنين، 5 جمادى الأولى 1445")
        hijri = f"{day_name_ar}، {hijri_date.day} {month_name_ar} {hijri_date.year}"
        
    except Exception as e:
        # Fallback if conversion fails
        print(f"Error converting to Hijri: {e}")
        hijri = "تاريخ غير متاح"
    
    return {
        "gregorian": gregorian,
        "hijri": hijri
    }


def get_prayer_schedule_date() -> Dict[str, str]:
    """
    Get current date in both Gregorian and Hijri formats.
    
    Returns:
        Dict with 'gregorian' and 'hijri' keys containing formatted date strings
    """
    today = datetime.now().date()
    return format_date_both_calendars(today)


def get_dst_periods(year: int, timezone_name: Optional[str] = None) -> List[Tuple[date, date, bool]]:
    """
    Get Daylight Saving Time (DST) periods for a given year.
    
    Args:
        year: The year to check
        timezone_name: Optional timezone name (e.g., 'Europe/Paris', 'America/New_York').
                      If None, uses system timezone or defaults to 'Europe/Paris'
    
    Returns:
        List of tuples: (start_date, end_date, is_dst)
        Each tuple represents a period where DST is active or not.
        Typically returns:
        - (Jan 1, DST_start, False) - Standard time
        - (DST_start, DST_end, True) - DST period
        - (DST_end, Dec 31, False) - Standard time
    """
    if ZoneInfo is None:
        # Fallback: approximate DST periods (Europe/North America typical pattern)
        # DST typically: 2nd Sunday in March to 1st Sunday in November
        import calendar
        
        # Find 2nd Sunday in March
        march_first = date(year, 3, 1)
        march_first_weekday = march_first.weekday()
        # Sunday is 6, so days to add to get to first Sunday
        days_to_first_sunday = (6 - march_first_weekday) % 7
        if days_to_first_sunday == 0 and march_first_weekday != 6:
            days_to_first_sunday = 7
        first_sunday = march_first.replace(day=1 + days_to_first_sunday)
        dst_start = first_sunday.replace(day=first_sunday.day + 7)  # 2nd Sunday
        
        # Find 1st Sunday in November
        nov_first = date(year, 11, 1)
        nov_first_weekday = nov_first.weekday()
        days_to_first_sunday = (6 - nov_first_weekday) % 7
        if days_to_first_sunday == 0 and nov_first_weekday != 6:
            days_to_first_sunday = 7
        dst_end = nov_first.replace(day=1 + days_to_first_sunday)
        
        periods = [
            (date(year, 1, 1), dst_start, False),
            (dst_start, dst_end, True),
            (dst_end, date(year, 12, 31), False)
        ]
        return periods
    
    # Use zoneinfo for accurate DST detection
    if timezone_name is None:
        # Default to Europe/Paris (common for many mosques)
        timezone_name = "Europe/Paris"
    
    try:
        tz = ZoneInfo(timezone_name)
    except Exception:
        # Fallback to system timezone or Europe/Paris
        try:
            import time
            tz_name = time.tzname[0] if time.daylight else time.tzname[1]
            tz = ZoneInfo(tz_name)
        except Exception:
            tz = ZoneInfo("Europe/Paris")
    
    periods = []
    current_date = date(year, 1, 1)
    last_dst = None
    
    # Check each day to find DST transitions
    while current_date.year == year:
        dt = datetime.combine(current_date, datetime.min.time())
        dt_tz = dt.replace(tzinfo=tz)
        is_dst = bool(dt_tz.dst().total_seconds() > 0)
        
        if last_dst is None:
            last_dst = is_dst
            period_start = current_date
        
        if is_dst != last_dst:
            # DST transition found
            periods.append((period_start, current_date, last_dst))
            period_start = current_date
            last_dst = is_dst
        
        # Move to next day
        try:
            current_date = date(current_date.year, current_date.month, current_date.day + 1)
        except ValueError:
            # End of month, move to next month
            if current_date.month == 12:
                break
            current_date = date(current_date.year, current_date.month + 1, 1)
    
    # Add final period
    if period_start:
        periods.append((period_start, date(year, 12, 31), last_dst))
    
    return periods if periods else [(date(year, 1, 1), date(year, 12, 31), False)]


def get_dst_transitions(year: int, timezone_name: Optional[str] = None) -> List[date]:
    """
    Get DST transition dates (start and end) for a given year.
    
    Returns:
        List of dates where DST transitions occur (typically 2 dates: start and end)
    """
    periods = get_dst_periods(year, timezone_name)
    transitions = []
    
    for i, (start, end, is_dst) in enumerate(periods):
        if i > 0:  # Skip first period start (Jan 1)
            transitions.append(start)
        if i < len(periods) - 1:  # Skip last period end (Dec 31)
            transitions.append(end)
    
    return sorted(set(transitions))

