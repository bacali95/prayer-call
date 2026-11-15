from datetime import datetime

import pytest

from backend.utils.file_utils import allowed_file, looks_like_mp3
from backend.utils.prayer_times import (
    extract_prayer_times_from_calendar,
    parse_hhmm,
    transform_prayer_times,
    validate_prayer_times,
)

DAY = ["05:00", "06:30", "13:00", "16:00", "19:00", "21:00"]


def calendar(month_index=0, day="5"):
    cal = [{} for _ in range(12)]
    cal[month_index] = {day: DAY}
    return cal


def test_calendar_extraction_keeps_shuruq():
    result = extract_prayer_times_from_calendar(calendar(2, "9"), datetime(2026, 3, 9))
    assert result == {
        "fajr": "05:00",
        "shuruq": "06:30",
        "dhuhr": "13:00",
        "asr": "16:00",
        "maghrib": "19:00",
        "isha": "21:00",
    }


@pytest.mark.parametrize(
    "cal",
    [[], None, [{}], [{"5": ["05:00"]}], ["not-a-dict"]],
)
def test_calendar_extraction_bad_input(cal):
    assert extract_prayer_times_from_calendar(cal, datetime(2026, 1, 5)) == {}


def test_transform_uses_calendar_and_includes_shuruq():
    out = transform_prayer_times({"calendar": calendar(0, "5")}, today=datetime(2026, 1, 5))
    assert out["shuruq"] == "06:30" and out["isha"] == "21:00"


def test_transform_legacy_shapes():
    today = datetime(2026, 1, 5)
    assert transform_prayer_times({"fajr": "05:00"}, today) == {"fajr": "05:00"}
    assert transform_prayer_times({"fajr": {"5": "05:01", "6": "05:02"}}, today) == {
        "fajr": "05:01"
    }
    assert transform_prayer_times({"fajr": {"9": "05:09"}}, today) == {"fajr": "05:09"}
    assert transform_prayer_times({}, today) == {}


def test_transform_list_values():
    out = transform_prayer_times({"x": ["1", "2", "3", "4", "5"]}, datetime(2026, 1, 5))
    assert out["fajr"] == "1" and out["isha"] == "5"


@pytest.mark.parametrize("value", ["5:00", "05:00", "23:59", "00:00"])
def test_parse_hhmm_ok(value):
    h, m = parse_hhmm(value)
    assert 0 <= h < 24 and 0 <= m < 60


@pytest.mark.parametrize("value", ["24:00", "12:60", "abc", "", "12", "12:5", None, 5, "1:2:3"])
def test_parse_hhmm_rejects(value):
    with pytest.raises(ValueError):
        parse_hhmm(value)


def test_validate_prayer_times():
    assert validate_prayer_times({"fajr": "05:00", "shuruq": "", "isha": None}) == {
        "fajr": "05:00",
        "shuruq": None,
        "isha": None,
    }
    with pytest.raises(ValueError):
        validate_prayer_times({"midnight": "00:00"})
    with pytest.raises(ValueError):
        validate_prayer_times({"fajr": "nope"})
    with pytest.raises(ValueError):
        validate_prayer_times([])


def test_file_utils():
    assert allowed_file("a.MP3") and not allowed_file("a.wav") and not allowed_file("mp3")
    assert looks_like_mp3(b"ID3\x04") and looks_like_mp3(b"\xff\xfb\x90\x00")
    assert not looks_like_mp3(b"") and not looks_like_mp3(b"MZ\x90\x00")
    assert not looks_like_mp3(b"\xff\x00")
