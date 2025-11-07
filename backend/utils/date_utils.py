"""Date utility functions for Gregorian and Hijri dates"""
from datetime import datetime
from typing import Dict
from hijri_converter import convert


def get_prayer_schedule_date() -> Dict[str, str]:
    """
    Get current date in both Gregorian and Hijri formats.
    
    Returns:
        Dict with 'gregorian' and 'hijri' keys containing formatted date strings
    """
    today = datetime.now()
    
    # Format Gregorian date (e.g., "Monday, January 15, 2024")
    gregorian = today.strftime("%A, %B %d, %Y")
    
    # Convert to Hijri
    try:
        hijri_date = convert.Gregorian(today.year, today.month, today.day).to_hijri()
        
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
        day_of_week = today.weekday()
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

