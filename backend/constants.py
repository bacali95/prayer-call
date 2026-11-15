"""Shared constants."""

# Prayers that have an adhan (and therefore a cron job).
ADHAN_PRAYERS: tuple[str, ...] = ("fajr", "dhuhr", "asr", "maghrib", "isha")

# Prayer keys exposed in ``prayer_times``. Shuruq (sunrise) is display only:
# it is never scheduled and never has an adhan file.
PRAYER_KEYS: tuple[str, ...] = ("fajr", "shuruq", "dhuhr", "asr", "maghrib", "isha")

# Comment prefix used to identify the crontab entries owned by this app.
CRON_COMMENT_PREFIX = "prayer-call-"
RESCHEDULE_KEY = "reschedule"
