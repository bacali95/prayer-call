"""Configuration file management"""
import json
import os
from typing import Dict, Any


class ConfigManager:
    """Manages loading and saving of configuration"""
    
    def __init__(self, config_dir: str = None, config_file: str = "config.json"):
        """
        Initialize ConfigManager
        
        Args:
            config_dir: Directory containing config file (defaults to current directory)
            config_file: Name of config file
        """
        if config_dir is None:
            config_dir = os.environ.get("CONFIG_DIR")
            if config_dir is None:
                # Default to project root (go up from backend/config)
                current_file = os.path.abspath(__file__)
                # backend/config/manager.py -> backend -> project root
                config_dir = os.path.dirname(os.path.dirname(os.path.dirname(current_file)))
        
        self.config_dir = config_dir
        self.config_file = os.path.join(config_dir, config_file)
        self._default_config = self._get_default_config()
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Get default configuration structure"""
        return {
            "mosque": None,
            "chromecast": None,
            "adhan_files": {
                "fajr": None,
                "dhuhr": None,
                "asr": None,
                "maghrib": None,
                "isha": None
            },
            "adhan_volumes": {
                "fajr": None,
                "dhuhr": None,
                "asr": None,
                "maghrib": None,
                "isha": None
            },
            "prayer_times": {},
            "prayer_schedule_date": None
        }
    
    def load(self) -> Dict[str, Any]:
        """Load configuration from JSON file"""
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, "r") as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError) as e:
                print(f"Error loading config: {e}")
                return self._default_config.copy()
        return self._default_config.copy()
    
    def save(self, config: Dict[str, Any]) -> bool:
        """Save configuration to JSON file"""
        try:
            # Ensure config directory exists
            os.makedirs(self.config_dir, exist_ok=True)
            with open(self.config_file, "w") as f:
                json.dump(config, f, indent=2)
            return True
        except (IOError, OSError) as e:
            print(f"Error saving config: {e}")
            return False
    
    def update(self, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update configuration with new values"""
        config = self.load()
        
        if "mosque" in updates:
            config["mosque"] = updates["mosque"]
        
        if "chromecast" in updates:
            config["chromecast"] = updates["chromecast"]
        
        if "adhan_files" in updates:
            config["adhan_files"].update(updates["adhan_files"])
        
        if "adhan_volumes" in updates:
            config["adhan_volumes"].update(updates["adhan_volumes"])
        
        if "prayer_times" in updates:
            config["prayer_times"] = updates["prayer_times"]
        
        if "prayer_schedule_date" in updates:
            config["prayer_schedule_date"] = updates["prayer_schedule_date"]
        
        self.save(config)
        return config

