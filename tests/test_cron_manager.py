import shlex
from pathlib import Path

import pytest
from crontab import CronTab

from backend.services import CronManager

TIMES = {
    "fajr": "05:10",
    "shuruq": "06:40",
    "dhuhr": "13:00",
    "asr": "16:05",
    "maghrib": "19:30",
    "isha": "21:15",
}


def jobs(cron: CronManager):
    return {j.comment: j for j in CronTab(tabfile=cron.tabfile)}


def test_schedules_five_prayers_and_never_shuruq(services):
    services.cron.schedule_prayers(TIMES)
    found = jobs(services.cron)
    assert set(found) == {
        f"prayer-call-{k}" for k in ("fajr", "dhuhr", "asr", "maghrib", "isha")
    } | {"prayer-call-reschedule"}
    assert "prayer-call-shuruq" not in found
    assert str(found["prayer-call-fajr"].slices) == "10 5 * * *"
    assert str(found["prayer-call-reschedule"].slices) == "0 2 * * *"


def test_reschedule_job_present_exactly_once_across_calls(services):
    cron = services.cron
    cron.schedule_reschedule_job()
    cron.schedule_reschedule_job()
    cron.schedule_prayers(TIMES)
    cron.schedule_prayers(TIMES)
    comments = [j.comment for j in CronTab(tabfile=cron.tabfile)]
    assert comments.count("prayer-call-reschedule") == 1
    assert comments.count("prayer-call-fajr") == 1


def test_rescheduling_replaces_old_jobs_including_legacy(services):
    legacy = "10 5 * * * python x.py 'Kitchen' 'fajr' > /var/log/a.log 2>&1 # prayer-call-fajr\n"
    Path(services.cron.tabfile).write_text("MAILTO=me\n0 1 * * * echo keep\n" + legacy)
    services.cron.schedule_prayers({"dhuhr": "13:00"})
    tab = CronTab(tabfile=services.cron.tabfile)
    comments = [j.comment for j in tab]
    assert "prayer-call-fajr" not in comments
    assert "prayer-call-dhuhr" in comments
    assert any(j.command == "echo keep" for j in tab)  # foreign jobs untouched


def test_command_has_no_chromecast_and_uses_quoting(services):
    services.cron.schedule_prayers({"fajr": "05:10"})
    cmd = jobs(services.cron)["prayer-call-fajr"].command
    parts = shlex.split(cmd.replace(r"\%", "%"))
    assert parts[:2] == ["cd", str(services.cron.project_root)]
    assert parts[parts.index("/usr/bin/python3") + 1].endswith("play_adhan.py")
    assert parts[parts.index("/usr/bin/python3") + 2] == "fajr"
    assert parts[-3:] == [">", f"{services.cron.log_dir}/prayer-call-fajr.log", "2>&1"]


@pytest.mark.parametrize(
    "evil",
    ["O'Brien", "100%", "a; rm -rf /", "$(touch /tmp/pwn)", "`id`", "a b", 'q"q', "x\\y"],
)
def test_dangerous_paths_are_quoted(services, tmp_path, evil):
    """Every interpolated value is quoted; % never reaches cron unescaped."""
    root = tmp_path / evil
    cron = CronManager(
        log_dir=str(tmp_path / evil / "logs"),
        config_dir=str(tmp_path / evil / "cfg"),
        upload_dir=str(tmp_path / evil / "up"),
        tabfile=str(tmp_path / "tab"),
        python="/usr/bin/python3",
        project_root=root,
    )
    cron.schedule_prayers({"fajr": "05:10"})
    cmd = jobs(cron)["prayer-call-fajr"].command

    # Unescaped % would be turned into a newline by cron.
    assert "%" not in cmd.replace(r"\%", "")
    # Undo cron escaping, then the shell must see exactly the intended words.
    words = shlex.split(cmd.replace(r"\%", "%"))
    assert words[0:2] == ["cd", str(root.absolute())]
    assert words[2] == "&&" and words[3] == "env"
    assert f"CONFIG_DIR={tmp_path / evil / 'cfg'}" in words
    assert words[-1] == "2>&1" and words[-3] == ">"
    assert str(tmp_path / evil / "logs" / "prayer-call-fajr.log") in words
    # nothing dangerous became its own shell word
    assert not any(w in (";", "|", "`id`") for w in words)


def test_chromecast_name_never_reaches_crontab(services):
    services.config.update({"chromecast": {"name": "x'; touch /tmp/pwn; echo '"}})
    services.cron.schedule_prayers(TIMES)
    assert "pwn" not in Path(services.cron.tabfile).read_text()


@pytest.mark.parametrize("bad", ["25:00", "12:99", "noon", "5", "12:5", 7])
def test_bad_time_skipped_others_scheduled(services, bad, caplog):
    scheduled = services.cron.schedule_prayers({"fajr": "05:10", "asr": bad, "isha": "21:00"})
    assert scheduled == ["fajr", "isha"]
    assert set(jobs(services.cron)) == {
        "prayer-call-fajr",
        "prayer-call-isha",
        "prayer-call-reschedule",
    }
    assert "Skipping asr" in caplog.text


def test_empty_and_unknown_entries_ignored(services):
    scheduled = services.cron.schedule_prayers({"fajr": None, "dhuhr": "", "bogus": "01:00"})
    assert scheduled == []


def test_remove_job_and_clear(services):
    cron = services.cron
    cron.schedule_prayers(TIMES)
    assert cron.remove_job("fajr") is True
    assert cron.remove_job("fajr") is False
    cron.clear_all_jobs()
    assert set(jobs(cron)) == {"prayer-call-reschedule"}


def test_get_scheduled_jobs_reads_fresh_state(services, dirs):
    cron = services.cron
    cron.schedule_prayers({"fajr": "05:10"})
    (dirs[2] / "prayer-call-fajr.log").write_text("hello\n")
    # Another process (e.g. the 02:00 job) rewrites the crontab behind our back.
    other = CronManager(log_dir=cron.log_dir, tabfile=cron.tabfile, project_root=cron.project_root)
    other.schedule_prayers({"isha": "21:15"})
    listed = {j["prayer"]: j for j in cron.get_scheduled_jobs()}
    assert set(listed) == {"isha", "reschedule"}
    assert listed["isha"]["planned_time"] == "21:15"
    cron.schedule_prayers({"fajr": "05:10"})
    fajr = {j["prayer"]: j for j in cron.get_scheduled_jobs()}["fajr"]
    assert fajr["executed_today"] is True and fajr["last_run"]


def test_job_logs_tail(services, dirs):
    (dirs[2] / "prayer-call-asr.log").write_text("\n".join(f"l{i}" for i in range(10)) + "\n")
    assert services.cron.get_job_logs("asr", max_lines=3) == "l7\nl8\nl9\n"
    assert services.cron.get_job_logs("fajr") is None


def test_cron_command_runs_in_minimal_environment(tmp_path):
    """The real command line works under /bin/sh with cron's bare environment."""
    import subprocess
    import sys

    root = tmp_path / "pro ject's%dir"
    script_dir = root / "backend" / "scripts"
    script_dir.mkdir(parents=True)
    (script_dir / "play_adhan.py").write_text(
        "import os, sys\n"
        "print('ran', sys.argv[1:], os.environ['CONFIG_DIR'], os.environ['LOG_DIR'])\n"
    )
    logs = tmp_path / "log s"
    logs.mkdir()
    cron = CronManager(
        log_dir=str(logs),
        config_dir=str(tmp_path / "cfg"),
        upload_dir=str(tmp_path / "up"),
        tabfile=str(tmp_path / "tab"),
        python=sys.executable,
        project_root=root,
    )
    cron.schedule_prayers({"fajr": "05:10"})
    command = jobs(cron)["prayer-call-fajr"].command.replace(r"\%", "%")  # cron unescapes %
    result = subprocess.run(  # noqa: S603
        ["env", "-i", "PATH=/usr/bin:/bin", "/bin/sh", "-c", command],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
    out = (logs / "prayer-call-fajr.log").read_text()
    assert "ran ['fajr']" in out and str(tmp_path / "cfg") in out
