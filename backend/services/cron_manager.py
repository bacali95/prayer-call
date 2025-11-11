"""Cron job management for scheduling adhan prayers"""
from crontab import CronTab
from typing import Dict, List, Optional
from pathlib import Path
from datetime import datetime
import os

from backend.config import ConfigManager


class CronManager:
    def __init__(self, log_dir: str = None):
        """
        Initialize CronManager
        
        Args:
            log_dir: Directory to store log files (defaults to /var/log)
        """
        if log_dir is None:
            log_dir = os.environ.get("LOG_DIR", "/var/log")
        self.log_dir = log_dir
        self.cron = CronTab(user=True)
        self.job_comment_prefix = "prayer-call-"
    
    def _refresh_crontab(self):
        """Refresh the crontab object to get the latest state from disk"""
        self.cron = CronTab(user=True)
    
    def _get_project_root(self) -> Path:
        """Get the absolute path to the project root directory"""
        backend_dir = Path(__file__).parent.parent
        project_root = backend_dir.parent
        return project_root.absolute()
    
    def _get_script_path(self) -> str:
        """Get the absolute path to the play_adhan.py script"""
        project_root = self._get_project_root()
        script_path = project_root / "backend" / "scripts" / "play_adhan.py"
        return str(script_path.absolute())

    def _get_config_dir(self) -> str:
        """Get the config directory from the ConfigManager"""
        return ConfigManager().config_dir
    
    def _get_log_file_path(self, prayer_key: str) -> str:
        """Get the log file path for a prayer job"""
        if prayer_key == "reschedule":
            return f"{self.log_dir}/prayer-call-reschedule.log"
        return f"{self.log_dir}/prayer-call-{prayer_key}.log"
    
    def get_last_run_time(self, prayer_key: str) -> Optional[datetime]:
        """Get the last run time for a cron job by checking log file modification time"""
        log_file = self._get_log_file_path(prayer_key)
        if os.path.exists(log_file):
            try:
                mtime = os.path.getmtime(log_file)
                return datetime.fromtimestamp(mtime)
            except Exception:
                return None
        return None
    
    def get_job_logs(self, prayer_key: str, max_lines: int = 100) -> Optional[str]:
        """Get logs from the last run of a cron job"""
        log_file = self._get_log_file_path(prayer_key)
        if os.path.exists(log_file):
            try:
                with open(log_file, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    # Return the last max_lines lines
                    return ''.join(lines[-max_lines:])
            except Exception as e:
                return f"Error reading log file: {str(e)}"
        return None
    
    def clear_all_jobs(self):
        """Remove all prayer call cron jobs (but keep reschedule job)"""
        reschedule_comment = f"{self.job_comment_prefix}reschedule"
        jobs_to_remove = [
            job for job in self.cron
            if job.comment and job.comment.startswith(self.job_comment_prefix) 
            and job.comment != reschedule_comment
        ]
        for job in jobs_to_remove:
            self.cron.remove(job)
        self.cron.write()
    
    def schedule_prayers(self, prayer_times: Dict[str, str], chromecast_name: str):
        """Schedule cron jobs for all prayer times"""
        # Clear existing prayer jobs (but keep reschedule job)
        self.clear_all_jobs()
        
        # Get project root directory (where config.json is located)
        project_root = self._get_project_root()
        config_dir = self._get_config_dir()
        script_path = self._get_script_path()
        
        for prayer_key, time_str in prayer_times.items():
            if not time_str:
                continue
            
            try:
                # Parse time (format: "HH:MM")
                hour, minute = map(int, time_str.split(":"))
                
                # Create cron job with logging and CONFIG_DIR env var
                log_file = self._get_log_file_path(prayer_key)
                job = self.cron.new(
                    command=f"cd {project_root} && CONFIG_DIR='{config_dir}' /usr/local/bin/python3 {script_path} '{chromecast_name}' '{prayer_key}' >> {log_file} 2>&1",
                    comment=f"{self.job_comment_prefix}{prayer_key}"
                )
                job.setall(f"{minute} {hour} * * *")
                
            except Exception as e:
                print(f"Error scheduling {prayer_key}: {e}")
        
        # Recreate reschedule job if it was removed
        self.schedule_reschedule_job()
        
        self.cron.write()
        return True
    
    def get_scheduled_jobs(self) -> List[Dict]:
        """Get list of currently scheduled jobs with last run time"""
        # Refresh crontab to get the latest state (important when reschedule job runs at 2am)
        self._refresh_crontab()
        
        jobs = []
        today = datetime.now().date()
        
        for job in self.cron:
            if job.comment and job.comment.startswith(self.job_comment_prefix):
                prayer_key = job.comment.replace(self.job_comment_prefix, "")
                # Get the schedule string from job slices (minute, hour, day, month, dow)
                schedule_parts = job.slices
                schedule_str = " ".join(str(part) for part in schedule_parts)
                
                # Extract planned time from schedule (minute hour * * *)
                planned_time = None
                if len(schedule_parts) >= 2:
                    try:
                        # Convert CronSlice objects to strings first
                        minute_str = str(schedule_parts[0])
                        hour_str = str(schedule_parts[1])
                        # Only parse if they're not wildcards
                        if minute_str != "*" and hour_str != "*":
                            minute = int(minute_str)
                            hour = int(hour_str)
                            planned_time = f"{hour:02d}:{minute:02d}"
                    except (ValueError, IndexError, TypeError):
                        pass
                
                # Get last run time
                last_run = self.get_last_run_time(prayer_key)
                last_run_str = last_run.isoformat() if last_run else None
                
                # Check if executed today
                executed_today = False
                if last_run:
                    executed_today = last_run.date() == today
                
                jobs.append({
                    "prayer": prayer_key,
                    "schedule": schedule_str,
                    "planned_time": planned_time,
                    "command": str(job.command),
                    "last_run": last_run_str,
                    "executed_today": executed_today
                })
        return jobs
    
    def remove_job(self, prayer_key: str) -> bool:
        """Remove a specific cron job by prayer name"""
        job_comment = f"{self.job_comment_prefix}{prayer_key}"
        jobs_to_remove = [
            job for job in self.cron
            if job.comment == job_comment
        ]
        
        if not jobs_to_remove:
            return False
        
        for job in jobs_to_remove:
            self.cron.remove(job)
        
        self.cron.write()
        return True
    
    def _get_reschedule_script_path(self) -> str:
        """Get the absolute path to the reschedule_prayers.py script"""
        project_root = self._get_project_root()
        script_path = project_root / "backend" / "scripts" / "reschedule_prayers.py"
        return str(script_path.absolute())
    
    def schedule_reschedule_job(self):
        """Schedule a daily job at 2am to reschedule prayers"""
        reschedule_comment = f"{self.job_comment_prefix}reschedule"
        
        # Remove existing reschedule job if it exists
        jobs_to_remove = [
            job for job in self.cron
            if job.comment == reschedule_comment
        ]
        for job in jobs_to_remove:
            self.cron.remove(job)
        
        # Get project root directory (where config.json is located)
        project_root = self._get_project_root()
        config_dir = self._get_config_dir()
        reschedule_script_path = self._get_reschedule_script_path()
        
        # Create new reschedule job at 2am daily with logging and CONFIG_DIR env var
        log_file = self._get_log_file_path("reschedule")
        job = self.cron.new(
            command=f"cd {project_root} && CONFIG_DIR='{config_dir}' LOG_DIR='{self.log_dir}' /usr/local/bin/python3 {reschedule_script_path} >> {log_file} 2>&1",
            comment=reschedule_comment
        )
        job.setall("0 2 * * *")  # 2:00 AM every day
        
        self.cron.write()
        return True
