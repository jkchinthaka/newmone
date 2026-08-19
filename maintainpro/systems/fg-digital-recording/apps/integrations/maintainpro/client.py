"""Read-only Mongo client for allowlisted MaintainPro collections.

Never writes. Never returns credentials. Queries always require tenantId.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Protocol

from django.conf import settings

from apps.integrations.maintainpro.exceptions import ReferenceUnavailableError

logger = logging.getLogger(__name__)

# Prisma models map to PascalCase collection names (no @@map on model).
ALLOWLISTED_COLLECTIONS = frozenset({"Vehicle", "Asset", "Department", "User"})
FORBIDDEN_DATABASES = frozenset({"admin", "config", "local"})

VEHICLE_PROJECTION = {
    "_id": 1,
    "tenantId": 1,
    "registrationNo": 1,
    "make": 1,
    "vehicleModel": 1,
    "status": 1,
    "assetTag": 1,
    "type": 1,
    "decommissionedAt": 1,
    "customFields": 1,
}
ASSET_PROJECTION = {
    "_id": 1,
    "tenantId": 1,
    "assetTag": 1,
    "name": 1,
    "status": 1,
    "location": 1,
    "manufacturer": 1,
    "model": 1,
}
DEPARTMENT_PROJECTION = {
    "_id": 1,
    "tenantId": 1,
    "code": 1,
    "name": 1,
    "isActive": 1,
}


class ReferenceClient(Protocol):
    def find(
        self,
        collection: str,
        filter_doc: dict[str, Any],
        *,
        projection: dict[str, Any] | None = None,
        limit: int = 20,
    ) -> list[dict[str, Any]]: ...

    def find_one(
        self,
        collection: str,
        filter_doc: dict[str, Any],
        *,
        projection: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None: ...


def _object_id_type() -> type:
    try:
        from bson import ObjectId

        return ObjectId
    except ImportError as exc:  # pragma: no cover
        raise ReferenceUnavailableError(
            "MaintainPro reference lookup is temporarily unavailable.",
        ) from exc


def _require_object_id(value: str) -> Any:
    object_id = _object_id_type()
    try:
        return object_id(str(value).strip())
    except Exception as exc:  # noqa: BLE001 — InvalidId / TypeError
        raise ValueError("Invalid MaintainPro ObjectId.") from exc


def as_object_id_filter(value: str) -> Any:
    """Prefer ObjectId; fall back to string for test fakes."""
    try:
        return _require_object_id(value)
    except (ValueError, ReferenceUnavailableError):
        return str(value).strip()


class PyMongoReferenceClient:
    """Production read client — allowlisted collections only."""

    def __init__(
        self,
        *,
        uri: str | None = None,
        database_name: str | None = None,
    ) -> None:
        self._uri = (uri or getattr(settings, "MONGODB_URI", "") or "").strip()
        self._database_name = (
            database_name
            or getattr(settings, "MONGODB_DATABASE", "")
            or getattr(settings, "MAINTAINPRO_REFERENCE_DATABASE", "")
            or ""
        ).strip()
        self._client: Any = None

    def _connect(self) -> Any:
        if not self._uri or not self._database_name:
            raise ReferenceUnavailableError(
                "MaintainPro reference lookup is temporarily unavailable.",
                code="REFERENCE_VERIFICATION_REQUIRED",
            )
        if self._database_name in FORBIDDEN_DATABASES:
            raise ReferenceUnavailableError(
                "MaintainPro reference database configuration is invalid.",
            )
        if self._client is not None:
            return self._client
        try:
            from pymongo import MongoClient
        except ImportError as exc:
            raise ReferenceUnavailableError(
                "MaintainPro reference lookup is temporarily unavailable.",
            ) from exc
        self._client = MongoClient(self._uri, serverSelectionTimeoutMS=3000)
        return self._client

    def _collection(self, name: str) -> Any:
        if name not in ALLOWLISTED_COLLECTIONS:
            raise ReferenceUnavailableError(f"Collection {name!r} is not allowlisted.")
        client = self._connect()
        db = client[self._database_name]
        if db.name in FORBIDDEN_DATABASES:
            raise ReferenceUnavailableError(
                "MaintainPro reference database configuration is invalid.",
            )
        return db[name]

    def find(
        self,
        collection: str,
        filter_doc: dict[str, Any],
        *,
        projection: dict[str, Any] | None = None,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        if not filter_doc or "tenantId" not in filter_doc:
            raise ReferenceUnavailableError("Tenant scope is required for reference reads.")
        try:
            cursor = self._collection(collection).find(filter_doc, projection or {})
            return list(cursor.limit(max(1, min(int(limit), 20))))
        except ReferenceUnavailableError:
            raise
        except Exception as exc:  # noqa: BLE001 — never leak Mongo internals
            logger.warning("maintainpro_reference_find_failed collection=%s", collection)
            raise ReferenceUnavailableError(
                "MaintainPro reference lookup is temporarily unavailable.",
            ) from exc

    def find_one(
        self,
        collection: str,
        filter_doc: dict[str, Any],
        *,
        projection: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        if not filter_doc or "tenantId" not in filter_doc:
            raise ReferenceUnavailableError("Tenant scope is required for reference reads.")
        try:
            return self._collection(collection).find_one(filter_doc, projection or {})
        except ReferenceUnavailableError:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.warning("maintainpro_reference_find_one_failed collection=%s", collection)
            raise ReferenceUnavailableError(
                "MaintainPro reference lookup is temporarily unavailable.",
            ) from exc

    def close(self) -> None:
        if self._client is not None:
            try:
                self._client.close()
            except Exception:  # noqa: BLE001
                pass
            self._client = None


class InMemoryReferenceClient:
    """Deterministic test double — never touches a real database."""

    def __init__(self, documents: dict[str, list[dict[str, Any]]] | None = None) -> None:
        self._docs = documents or {}

    def find(
        self,
        collection: str,
        filter_doc: dict[str, Any],
        *,
        projection: dict[str, Any] | None = None,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        if collection not in ALLOWLISTED_COLLECTIONS:
            raise ReferenceUnavailableError(f"Collection {collection!r} is not allowlisted.")
        if not filter_doc or "tenantId" not in filter_doc:
            raise ReferenceUnavailableError("Tenant scope is required for reference reads.")
        rows = [d for d in self._docs.get(collection, []) if _matches(d, filter_doc)]
        return [_project(d, projection) for d in rows[: max(1, min(int(limit), 20))]]

    def find_one(
        self,
        collection: str,
        filter_doc: dict[str, Any],
        *,
        projection: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        rows = self.find(collection, filter_doc, projection=projection, limit=1)
        return rows[0] if rows else None


def _matches(doc: dict[str, Any], filter_doc: dict[str, Any]) -> bool:
    for key, expected in filter_doc.items():
        if key == "$or":
            if not any(_matches(doc, clause) for clause in expected):
                return False
            continue
        actual = doc.get(key)
        if key == "_id":
            if str(actual) != str(expected):
                return False
            continue
        if isinstance(expected, dict):
            if "$regex" in expected:
                flags = re.IGNORECASE if expected.get("$options") == "i" else 0
                if not re.search(str(expected["$regex"]), str(actual or ""), flags):
                    return False
                continue
            if "$in" in expected:
                allowed = expected["$in"]
                if actual not in allowed and str(actual) not in {str(x) for x in allowed}:
                    return False
                continue
            if "$ne" in expected and actual == expected["$ne"]:
                return False
            if "$exists" in expected:
                exists = key in doc and doc[key] is not None
                if bool(expected["$exists"]) != exists:
                    return False
                continue
        elif actual != expected:
            return False
    return True


def _project(doc: dict[str, Any], projection: dict[str, Any] | None) -> dict[str, Any]:
    if not projection:
        return dict(doc)
    out: dict[str, Any] = {}
    for key, flag in projection.items():
        if flag and key in doc:
            out[key] = doc[key]
    if "_id" in doc and projection.get("_id", 1):
        out["_id"] = doc["_id"]
    return out


def get_default_client() -> ReferenceClient:
    override = getattr(settings, "MAINTAINPRO_REFERENCE_CLIENT", None)
    if override is not None:
        return override
    return PyMongoReferenceClient()
