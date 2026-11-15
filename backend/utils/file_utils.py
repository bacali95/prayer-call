"""File utility functions"""

ALLOWED_EXTENSIONS: frozenset[str] = frozenset({"mp3"})


def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed"""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def looks_like_mp3(header: bytes) -> bool:
    """True when ``header`` starts with an ID3 tag or an MPEG audio frame sync."""
    if header[:3] == b"ID3":
        return True
    return len(header) >= 2 and header[0] == 0xFF and (header[1] & 0xE0) == 0xE0
