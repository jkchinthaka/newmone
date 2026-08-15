"""Strong content hashing for evidence integrity."""

from __future__ import annotations

import hashlib
from typing import BinaryIO

HASH_ALGORITHM = "sha256"
CHUNK_SIZE = 1024 * 1024


def hash_fileobj(fileobj: BinaryIO) -> str:
    """Return lowercase hex SHA-256 of the full stream; leaves pointer at end."""
    digest = hashlib.sha256()
    while True:
        chunk = fileobj.read(CHUNK_SIZE)
        if not chunk:
            break
        digest.update(chunk)
    return digest.hexdigest()


def hash_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
