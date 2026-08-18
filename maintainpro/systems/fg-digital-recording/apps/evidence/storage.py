"""
Private evidence storage abstraction.

Files are never exposed via MEDIA_URL or other predictable public paths.
Local development and tests use a filesystem root outside the public media URL
map. Production may swap in an S3-compatible backend that still never publishes
world-readable object ACLs; authorized download remains application-mediated
(or short-lived pre-signed URLs issued only after RBAC checks — future).
"""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import BinaryIO, Protocol, cast

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage, Storage


class EvidenceBlobStore(Protocol):
    """Backend-agnostic private blob operations."""

    def save_bytes(self, *, relative_key: str, data: bytes) -> str: ...

    def open_read(self, relative_key: str) -> BinaryIO: ...

    def exists(self, relative_key: str) -> bool: ...

    def delete(self, relative_key: str) -> None: ...


class PrivateFileSystemEvidenceStore:
    """Filesystem store with no public URL generation."""

    def __init__(self, root: Path | None = None) -> None:
        self.root = Path(root or settings.EVIDENCE_STORAGE_ROOT)
        self.root.mkdir(parents=True, exist_ok=True)
        self._storage: Storage = FileSystemStorage(location=str(self.root))

    def save_bytes(self, *, relative_key: str, data: bytes) -> str:
        # Avoid FileSystemStorage.get_available_name collisions changing keys.
        name = self._storage.save(relative_key, ContentFile(data))
        return name

    def open_read(self, relative_key: str) -> BinaryIO:
        return cast(BinaryIO, self._storage.open(relative_key, mode="rb"))

    def exists(self, relative_key: str) -> bool:
        return self._storage.exists(relative_key)

    def delete(self, relative_key: str) -> None:
        if self._storage.exists(relative_key):
            self._storage.delete(relative_key)


class PrivateEvidenceStorage(FileSystemStorage):
    """
    Django Storage used only for evidence — url() is intentionally unavailable.

    Prefer EvidenceBlobStore via get_evidence_store() in services.
    """

    def __init__(self, location: str | None = None, base_url: str | None = None) -> None:
        root = location or str(settings.EVIDENCE_STORAGE_ROOT)
        # base_url must stay None so Django never builds /media/... links.
        super().__init__(location=root, base_url=None)

    def url(self, name: str | None) -> str:
        raise RuntimeError("Evidence files have no public URL. Use the authorized download view.")


def build_randomized_storage_key(*, organization_id: uuid.UUID, extension: str) -> str:
    """Opaque storage key — not derived from original filename or object id."""
    ext = (extension or "").lower().lstrip(".")
    if ext and not ext.isalnum():
        ext = "bin"
    suffix = f".{ext}" if ext else ""
    token = uuid.uuid4().hex
    # Shard lightly for filesystem friendliness; never encode PII.
    return f"{organization_id.hex}/{token[:2]}/{token}{suffix}"


def get_evidence_store() -> EvidenceBlobStore:
    """Resolve private store. Phase 11: local private filesystem only."""
    return PrivateFileSystemEvidenceStore()
