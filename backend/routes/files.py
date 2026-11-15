"""File management routes.

Uploads never overwrite: uploading a name that already exists returns 409
(delete the old file first).
"""

import contextlib
import logging
import os
import tempfile
from pathlib import Path

from flask import Blueprint, jsonify, request, send_from_directory
from werkzeug.exceptions import BadRequest, Conflict, NotFound
from werkzeug.utils import secure_filename

from backend.utils import allowed_file, looks_like_mp3

from ._common import get_services, upload_dir

logger = logging.getLogger(__name__)

files_bp = Blueprint("files", __name__, url_prefix="/api/files")


def _safe_name(raw: str) -> str:
    name = secure_filename(raw)
    if not name:
        raise BadRequest("Invalid filename")
    return name


@files_bp.route("", methods=["GET"])
def list_files():
    files = [
        {"name": f.name, "size": f.stat().st_size}
        for f in sorted(Path(upload_dir()).iterdir())
        if f.is_file() and f.suffix.lower() == ".mp3"
    ]
    return jsonify({"files": files})


@files_bp.route("", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        raise BadRequest("No file provided")
    upload = request.files["file"]
    if not upload.filename:
        raise BadRequest("No file selected")

    filename = _safe_name(upload.filename)
    if not allowed_file(filename):
        raise BadRequest("Invalid file type: only .mp3 files are allowed")
    if not looks_like_mp3(upload.stream.read(4)):
        raise BadRequest("File is not a valid MP3")
    upload.stream.seek(0)

    directory = upload_dir()
    os.makedirs(directory, exist_ok=True)
    final = os.path.join(directory, filename)
    if os.path.exists(final):
        raise Conflict(f"A file named '{filename}' already exists; delete it first")

    fd, tmp = tempfile.mkstemp(dir=directory, prefix=".upload-", suffix=".tmp")
    try:
        with os.fdopen(fd, "wb") as out:
            while chunk := upload.stream.read(1024 * 1024):
                out.write(chunk)
        os.replace(tmp, final)
    except BaseException:
        with contextlib.suppress(OSError):
            os.unlink(tmp)
        raise
    return jsonify({"message": "File uploaded successfully", "filename": filename})


@files_bp.route("/<filename>", methods=["GET"])
def serve_file(filename):
    name = secure_filename(filename)
    if not name or not allowed_file(name):
        raise NotFound("File not found")
    return send_from_directory(upload_dir(), name, mimetype="audio/mpeg")


@files_bp.route("/<filename>", methods=["DELETE"])
def delete_file_route(filename):
    name = _safe_name(filename)
    path = os.path.join(upload_dir(), name)
    if not os.path.isfile(path):
        raise NotFound("File not found")
    config = get_services().config
    unassigned = [p for p, f in config.load()["adhan_files"].items() if f == name]
    if unassigned:
        config.update({"adhan_files": dict.fromkeys(unassigned)})
    os.remove(path)
    return jsonify(
        {"message": "File deleted successfully", "deleted": name, "unassigned": unassigned}
    )
