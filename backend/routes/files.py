"""File management routes"""
from flask import Blueprint, request, jsonify, send_from_directory
from pathlib import Path
import os
from werkzeug.utils import secure_filename
from backend.utils import allowed_file

files_bp = Blueprint('files', __name__, url_prefix='/api/files')

# Upload folder (will be set during initialization)
UPLOAD_FOLDER = None


def init_files(upload_folder: str):
    """Initialize file routes with upload folder"""
    global UPLOAD_FOLDER
    UPLOAD_FOLDER = upload_folder
    # Ensure uploads directory exists
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@files_bp.route("", methods=["GET"])
def list_files():
    """List uploaded adhan files"""
    files = []
    upload_path = Path(UPLOAD_FOLDER)
    if upload_path.exists():
        for file in upload_path.glob("*.mp3"):
            files.append({
                "name": file.name,
                "size": file.stat().st_size
            })
    return jsonify({"files": files})


@files_bp.route("", methods=["POST"])
def upload_file():
    """Upload an adhan MP3 file"""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        return jsonify({
            "message": "File uploaded successfully",
            "filename": filename
        })
    
    return jsonify({"error": "Invalid file type"}), 400


@files_bp.route("/<filename>", methods=["GET"])
def serve_file(filename):
    """Serve uploaded files"""
    return send_from_directory(UPLOAD_FOLDER, filename)


@files_bp.route("/<filename>", methods=["DELETE"])
def delete_file_route(filename):
    """Delete an uploaded file"""
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    if os.path.exists(filepath):
        os.remove(filepath)
        return jsonify({"message": "File deleted successfully"})
    return jsonify({"error": "File not found"}), 404

