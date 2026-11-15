"""Cron job management routes"""

from flask import Blueprint, jsonify
from werkzeug.exceptions import BadRequest, NotFound

from backend.constants import ADHAN_PRAYERS, RESCHEDULE_KEY

from ._common import get_services, int_arg

cron_bp = Blueprint("cron", __name__, url_prefix="/api/cron")

LOG_KEYS = (*ADHAN_PRAYERS, RESCHEDULE_KEY)
MAX_LOG_LINES = 1000


@cron_bp.route("/jobs", methods=["GET"])
def get_cron_jobs():
    return jsonify({"jobs": get_services().cron.get_scheduled_jobs()})


@cron_bp.route("/jobs/<prayer>", methods=["DELETE"])
def delete_cron_job(prayer):
    if prayer not in ADHAN_PRAYERS:
        raise BadRequest(f"Unknown prayer '{prayer}'")
    if get_services().cron.remove_job(prayer):
        return jsonify({"message": f"Cron job for {prayer} removed successfully"})
    raise NotFound(f"Cron job for {prayer} not found")


@cron_bp.route("/jobs/<prayer>/logs", methods=["GET"])
def get_cron_job_logs(prayer):
    if prayer not in LOG_KEYS:
        raise BadRequest(f"Unknown prayer '{prayer}'")
    max_lines = int_arg("max_lines", 100)
    if not 1 <= max_lines <= MAX_LOG_LINES:
        raise BadRequest(f"max_lines must be an integer between 1 and {MAX_LOG_LINES}")
    logs = get_services().cron.get_job_logs(prayer, max_lines=max_lines)
    if logs is None:
        raise NotFound(f"No logs found for {prayer}")
    return jsonify({"logs": logs, "prayer": prayer})
