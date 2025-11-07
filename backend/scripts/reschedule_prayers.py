"""Script to reschedule prayers (called by cron job at 2am daily)"""
import sys
from pathlib import Path

# Add parent directories to path to import backend modules
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.config import ConfigManager
from backend.services import MawaqitClient, CronManager
from backend.utils import transform_prayer_times, get_prayer_schedule_date


def main():
    """Reschedule prayers by fetching new times and updating cron jobs"""
    print("Starting prayer reschedule at 2am...")
    
    # Load config
    config_manager = ConfigManager()
    config = config_manager.load()
    
    # Check if mosque and chromecast are configured
    mosque = config.get("mosque")
    chromecast = config.get("chromecast")
    
    if not mosque or not mosque.get("uuid"):
        print("No mosque configured. Skipping reschedule.")
        sys.exit(0)
    
    if not chromecast or not chromecast.get("name"):
        print("No chromecast configured. Skipping reschedule.")
        sys.exit(0)
    
    mosque_id = mosque["uuid"]
    chromecast_name = chromecast["name"]
    
    print(f"Fetching prayer times for mosque: {mosque.get('name', mosque_id)}")
    print(f"Chromecast: {chromecast_name}")
    
    # Fetch prayer times from API
    mawaqit_client = MawaqitClient()
    prayer_times_data = mawaqit_client.get_prayer_times(mosque_id)
    
    if not prayer_times_data:
        print("Failed to fetch prayer times from API. Skipping reschedule.")
        sys.exit(1)
    
    # Transform prayer times to simple format
    transformed_times = transform_prayer_times(prayer_times_data)
    
    if not transformed_times:
        print("No prayer times extracted. Skipping reschedule.")
        sys.exit(1)
    
    print(f"Extracted prayer times: {transformed_times}")
    
    # Get current date in both formats
    schedule_date = get_prayer_schedule_date()
    
    # Update config with new prayer times and schedule date
    config_manager.update({
        "prayer_times": transformed_times,
        "prayer_schedule_date": schedule_date
    })
    
    # Schedule new cron jobs
    cron_manager = CronManager()
    success = cron_manager.schedule_prayers(transformed_times, chromecast_name)
    
    if success:
        print("Successfully rescheduled all prayer times!")
    else:
        print("Failed to reschedule prayer times.")
        sys.exit(1)


if __name__ == "__main__":
    main()

