"""Cron job management routes"""
from flask import Blueprint, jsonify
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from backend.services import CronManager

cron_bp = Blueprint('cron', __name__, url_prefix='/api/cron')

# Initialize manager (will be injected)
cron_manager = None


def init_manager(manager: 'CronManager'):
    """Initialize cron manager for this blueprint"""
    global cron_manager
    cron_manager = manager


@cron_bp.route("/jobs", methods=["GET"])
def get_cron_jobs():
    """Get scheduled cron jobs"""
    jobs = cron_manager.get_scheduled_jobs()
    return jsonify({"jobs": jobs})


@cron_bp.route("/jobs/<prayer>", methods=["DELETE"])
def delete_cron_job(prayer):
    """Remove a specific cron job by prayer name"""
    success = cron_manager.remove_job(prayer)
    if success:
        return jsonify({"message": f"Cron job for {prayer} removed successfully"})
    return jsonify({"error": f"Cron job for {prayer} not found"}), 404


@cron_bp.route("/jobs/<prayer>/logs", methods=["GET"])
def get_cron_job_logs(prayer):
    """Get logs from the last run of a specific cron job"""
    from flask import request
    
    max_lines = request.args.get('max_lines', default=100, type=int)
    logs = cron_manager.get_job_logs(prayer, max_lines=max_lines)
    
    if logs is None:
        return jsonify({"error": f"No logs found for {prayer}"}), 404
    
    return jsonify({"logs": logs, "prayer": prayer})

