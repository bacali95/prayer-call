"""File utility functions"""
from typing import Set


ALLOWED_EXTENSIONS: Set[str] = {"mp3"}


def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed"""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

