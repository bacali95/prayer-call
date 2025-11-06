"""Cron job management for scheduling adhan prayers"""
from crontab import CronTab
from typing import Dict, List
from pathlib import Path
import os


class CronManager:
    def __init__(self, script_path: str = None):
        """
        Initialize CronManager
        
        Args:
            script_path: Path to play_adhan.py script (auto-detected if None)
        """
        self.cron = CronTab(user=True)
        self.job_comment_prefix = "prayer-call-"
        self.script_path = script_path or self._get_script_path()
    
    def _get_script_path(self) -> str:
        """Get the absolute path to the play_adhan.py script"""
        # Go up from backend/services to project root, then to backend/scripts
        backend_dir = Path(__file__).parent.parent
        project_root = backend_dir.parent
        script_path = project_root / "backend" / "scripts" / "play_adhan.py"
        return str(script_path.absolute())
    
    def clear_all_jobs(self):
        """Remove all prayer call cron jobs"""
        jobs_to_remove = [
            job for job in self.cron
            if job.comment and job.comment.startswith(self.job_comment_prefix)
        ]
        for job in jobs_to_remove:
            self.cron.remove(job)
        self.cron.write()
    
    def schedule_prayers(self, prayer_times: Dict[str, str], chromecast_name: str):
        """Schedule cron jobs for all prayer times"""
        # Clear existing jobs first
        self.clear_all_jobs()
        
        # Get project root directory for cd command
        project_root = Path(self.script_path).parent.parent.parent
        
        for prayer_key, time_str in prayer_times.items():
            if not time_str:
                continue
            
            try:
                # Parse time (format: "HH:MM")
                hour, minute = map(int, time_str.split(":"))
                
                # Create cron job
                job = self.cron.new(
                    command=f"cd {project_root} && python3 {self.script_path} '{chromecast_name}' '{prayer_key}'",
                    comment=f"{self.job_comment_prefix}{prayer_key}"
                )
                job.setall(f"{minute} {hour} * * *")
                
            except Exception as e:
                print(f"Error scheduling {prayer_key}: {e}")
        
        self.cron.write()
        return True
    
    def get_scheduled_jobs(self) -> List[Dict]:
        """Get list of currently scheduled jobs"""
        jobs = []
        for job in self.cron:
            if job.comment and job.comment.startswith(self.job_comment_prefix):
                prayer_key = job.comment.replace(self.job_comment_prefix, "")
                # Get the schedule string
                schedule_str = job.schedule
                jobs.append({
                    "prayer": prayer_key,
                    "schedule": str(schedule_str),
                    "command": str(job.command)
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

