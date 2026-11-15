from datetime import date

from backend.utils.date_utils import (
    format_date_both_calendars,
    get_dst_periods,
    get_dst_transitions,
    get_prayer_schedule_date,
)


def test_format_both_calendars():
    out = format_date_both_calendars(date(2024, 1, 15))
    assert out["gregorian"] == "Monday, January 15, 2024"
    assert "1445" in out["hijri"] and "الاثنين" in out["hijri"]


def test_schedule_date_defaults_and_override():
    assert get_prayer_schedule_date(date(2024, 1, 15))["gregorian"].startswith("Monday")
    assert set(get_prayer_schedule_date()) == {"gregorian", "hijri"}


def test_dst_periods_europe():
    periods = get_dst_periods(2026, "Europe/Amsterdam")
    assert [p[2] for p in periods] == [False, True, False]
    assert periods[1][0] == date(2026, 3, 29)
    assert periods[1][1] == date(2026, 10, 24)
    assert get_dst_transitions(2026, "Europe/Amsterdam") == [
        date(2026, 3, 29),
        date(2026, 10, 25),
    ]


def test_dst_none_for_utc():
    assert get_dst_transitions(2026, "UTC") == []
