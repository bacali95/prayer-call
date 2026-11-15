"""Cron job management for scheduling adhan prayers.

The crontab is re-read for every operation (never kept as stale state) and
written once per operation. Every interpolated value is passed through
``shlex.quote`` and ``%`` is escaped because cron treats it as a newline.
"""

import logging
import os
import shlex
import sys
import threading
from collections import deque
from datetime import datetime
from pathlib import Path

from crontab import CronTab

from backend import settings
from backend.constants import ADHAN_PRAYERS, CRON_COMMENT_PREFIX, RESCHEDULE_KEY
from backend.utils.prayer_times import parse_hhmm

logger = logging.getLogger(__name__)

RESCHEDULE_SCHEDULE = "0 2 * * *"
PASSTHROUGH_ENV = ("TZ", "PUBLIC_URL", "PORT")


def cron_escape(command: str) -> str:
    """Escape ``%`` (cron turns an unescaped one into a newline)."""
    return command.replace("%", r"\%")


class CronManager:
    def __init__(
        self,
        log_dir: str | None = None,
        config_dir: str | None = None,
        upload_dir: str | None = None,
        tabfile: str | None = None,
        python: str | None = None,
        project_root: Path | None = None,
    ):
        self.log_dir = log_dir or settings.log_dir()
        self.config_dir = config_dir or settings.config_dir()
        self.upload_dir = upload_dir or settings.upload_dir()
        self.tabfile = tabfile
        self.python = python or sys.executable
        self.project_root = Path(project_root or settings.PROJECT_ROOT).absolute()
        self.job_comment_prefix = CRON_COMMENT_PREFIX
        self._lock = threading.RLock()

    # --------------------------------------------------------------- helpers
    def _open(self) -> CronTab:
        """Read the crontab fresh from disk."""
        if self.tabfile:
            if not os.path.exists(self.tabfile):
                Path(self.tabfile).touch()
            return CronTab(tabfile=self.tabfile)
        return CronTab(user=True)

    def _comment(self, key: str) -> str:
        return f"{self.job_comment_prefix}{key}"

    def _log_file(self, key: str) -> str:
        return f"{self.log_dir}/prayer-call-{key}.log"

    def _env_prefix(self, with_log_dir: bool = True) -> str:
        env = {"CONFIG_DIR": self.config_dir, "UPLOAD_DIR": self.upload_dir}
        if with_log_dir:
            env["LOG_DIR"] = self.log_dir
        for name in PASSTHROUGH_ENV:
            if os.environ.get(name):
                env[name] = os.environ[name]
        assignments = " ".join(f"{k}={shlex.quote(v)}" for k, v in env.items())
        return f"env {assignments}"

    def _command(self, script: str, key: str, *args: str) -> str:
        parts = [
            f"cd {shlex.quote(str(self.project_root))}",
            "&&",
            self._env_prefix(),
            shlex.quote(self.python),
            shlex.quote(str(self.project_root / "backend" / "scripts" / script)),
            *(shlex.quote(a) for a in args),
            f"> {shlex.quote(self._log_file(key))} 2>&1",
        ]
        return cron_escape(" ".join(parts))

    def _remove(self, tab: CronTab, keep_reschedule: bool) -> None:
        resched = self._comment(RESCHEDULE_KEY)
        for job in list(tab):
            comment = job.comment or ""
            if comment.startswith(self.job_comment_prefix) and not (
                keep_reschedule and comment == resched
            ):
                tab.remove(job)

    def _add_reschedule(self, tab: CronTab) -> None:
        job = tab.new(
            command=self._command("reschedule_prayers.py", RESCHEDULE_KEY),
            comment=self._comment(RESCHEDULE_KEY),
        )
        job.setall(RESCHEDULE_SCHEDULE)

    # ------------------------------------------------------------ scheduling
    def schedule_prayers(self, prayer_times: dict[str, str | None]) -> list[str]:
        """Replace all adhan jobs (and the reschedule job) in one crontab write.

        Only the five adhan prayers are scheduled (shuruq and unknown keys are
        ignored). A prayer whose time is not ``HH:MM`` is logged and skipped; the
        others are still scheduled. Returns the scheduled prayer keys.
        """
        parsed: dict[str, tuple[int, int]] = {}
        skipped: list[str] = []
        for key in ADHAN_PRAYERS:
            value = prayer_times.get(key)
            if not value:
                continue
            try:
                parsed[key] = parse_hhmm(value)
            except ValueError:
                logger.warning("Skipping %s: invalid time %r", key, value)
                skipped.append(key)

        with self._lock:
            tab = self._open()
            self._remove(tab, keep_reschedule=False)
            for key, (hour, minute) in parsed.items():
                job = tab.new(
                    command=self._command("play_adhan.py", key, key),
                    comment=self._comment(key),
                )
                job.setall(f"{minute} {hour} * * *")
            self._add_reschedule(tab)
            tab.write()
        logger.info(
            "Scheduled prayers: %s (skipped: %s)", ", ".join(parsed) or "none", skipped or "none"
        )
        return list(parsed)

    def schedule_reschedule_job(self) -> bool:
        """Ensure exactly one daily 02:00 reschedule job exists."""
        with self._lock:
            tab = self._open()
            tab.remove_all(comment=self._comment(RESCHEDULE_KEY))
            self._add_reschedule(tab)
            tab.write()
        return True

    def clear_all_jobs(self) -> None:
        """Remove all adhan jobs, keeping the reschedule job."""
        with self._lock:
            tab = self._open()
            self._remove(tab, keep_reschedule=True)
            tab.write()

    def remove_job(self, prayer_key: str) -> bool:
        with self._lock:
            tab = self._open()
            jobs = [j for j in tab if j.comment == self._comment(prayer_key)]
            if not jobs:
                return False
            for job in jobs:
                tab.remove(job)
            tab.write()
        return True

    # --------------------------------------------------------------- reading
    def get_last_run_time(self, key: str) -> datetime | None:
        try:
            return datetime.fromtimestamp(os.path.getmtime(self._log_file(key)))
        except OSError:
            return None

    def get_job_logs(self, key: str, max_lines: int = 100) -> str | None:
        """Last ``max_lines`` lines of a job's log, or None when there is no log."""
        path = self._log_file(key)
        if not os.path.exists(path):
            return None
        try:
            with open(path, encoding="utf-8", errors="replace") as f:
                return "".join(deque(f, maxlen=max(1, max_lines)))
        except OSError as exc:
            logger.warning("Cannot read %s: %s", path, exc)
            return f"Error reading log file: {exc}"

    def get_scheduled_jobs(self) -> list[dict]:
        today = datetime.now().date()
        jobs = []
        for job in self._open():
            comment = job.comment or ""
            if not comment.startswith(self.job_comment_prefix):
                continue
            key = comment[len(self.job_comment_prefix) :]
            minute, hour = str(job.slices[0]), str(job.slices[1])
            planned_time = None
            if minute.isdigit() and hour.isdigit():
                planned_time = f"{int(hour):02d}:{int(minute):02d}"
            last_run = self.get_last_run_time(key)
            jobs.append(
                {
                    "prayer": key,
                    "schedule": " ".join(str(part) for part in job.slices),
                    "planned_time": planned_time,
                    "command": str(job.command),
                    "last_run": last_run.isoformat() if last_run else None,
                    "executed_today": bool(last_run and last_run.date() == today),
                }
            )
        return jobs
