"""Script to play adhan on Chromecast (called by cron jobs)"""
import sys
import json
from pathlib import Path

# Add parent directories to path to import backend modules
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.services import ChromecastScanner
from backend.config import ConfigManager
from backend.utils.network_utils import get_local_ip


def main():
    if len(sys.argv) < 3:
        print("Usage: python play_adhan.py <chromecast_name> <prayer_key>")
        sys.exit(1)
    
    chromecast_name = sys.argv[1]
    prayer_key = sys.argv[2]
    
    # Load config
    config_manager = ConfigManager()
    config = config_manager.load()
    
    # Get adhan file path for this prayer
    adhan_file = config.get("adhan_files", {}).get(prayer_key)
    
    if not adhan_file:
        print(f"No adhan file configured for {prayer_key}")
        sys.exit(1)
    
    # Get volume for this prayer (if set)
    volume = config.get("adhan_volumes", {}).get(prayer_key)
    
    # Convert to absolute path
    project_root = Path(__file__).parent.parent.parent
    adhan_path = project_root / "uploads" / Path(adhan_file).name
    
    if not adhan_path.exists():
        print(f"Adhan file not found: {adhan_path}")
        sys.exit(1)
    
    # Chromecast needs HTTP URL, not file path
    # Get local IP and construct URL
    local_ip = get_local_ip()
    filename = Path(adhan_file).name
    media_url = f"http://{local_ip}:3001/api/files/{filename}"
    
    print(f"Attempting to play {prayer_key} adhan on {chromecast_name}")
    print(f"Media URL: {media_url}")
    if volume is not None:
        print(f"Volume: {volume}")
    
    # Try to play on Chromecast
    scanner = ChromecastScanner()
    success = scanner.play_media(chromecast_name, media_url, volume=volume)
    
    if success:
        print(f"Successfully started playing {prayer_key} adhan on {chromecast_name}")
    else:
        print(f"Failed to play adhan on {chromecast_name}")
        sys.exit(1)


if __name__ == "__main__":
    main()

