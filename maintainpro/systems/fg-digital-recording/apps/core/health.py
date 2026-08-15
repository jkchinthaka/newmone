"""Liveness and readiness probes — Phase 19 expanded dependency surface."""

from __future__ import annotations

from contextlib import suppress
from pathlib import Path
from typing import Any

import redis
from django.conf import settings
from django.db import connection
from django.http import HttpRequest, JsonResponse

from apps.core.persistence.backend import is_mongodb


def check_postgres() -> dict[str, Any]:
    try:
        connection.ensure_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return {"name": "postgresql", "status": "ok"}
    except Exception:  # noqa: BLE001 — readiness must not leak exception details
        return {"name": "postgresql", "status": "unavailable"}


def check_redis() -> dict[str, Any]:
    client: Any = None
    try:
        client = redis.Redis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        if client.ping():
            status = {"name": "redis", "status": "ok"}
        else:
            status = {"name": "redis", "status": "unavailable"}
        return status
    except Exception:  # noqa: BLE001
        return {"name": "redis", "status": "unavailable"}
    finally:
        if client is not None:
            with suppress(Exception):
                client.close()


def check_celery_broker() -> dict[str, Any]:
    """Queue/broker reachability via Redis broker URL (Celery uses Redis)."""
    broker = getattr(settings, "CELERY_BROKER_URL", "") or getattr(settings, "REDIS_URL", "")
    client: Any = None
    try:
        client = redis.Redis.from_url(broker, socket_connect_timeout=2)
        if client.ping():
            return {"name": "celery_broker", "status": "ok"}
        return {"name": "celery_broker", "status": "unavailable"}
    except Exception:  # noqa: BLE001
        return {"name": "celery_broker", "status": "unavailable"}
    finally:
        if client is not None:
            with suppress(Exception):
                client.close()


def check_evidence_storage() -> dict[str, Any]:
    """Evidence private storage root is writable (local path or mounted volume)."""
    try:
        root = Path(getattr(settings, "EVIDENCE_STORAGE_ROOT", ""))
        if not str(root):
            return {"name": "evidence_storage", "status": "unavailable"}
        root.mkdir(parents=True, exist_ok=True)
        probe = root / ".health_write_probe"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
        return {"name": "evidence_storage", "status": "ok"}
    except Exception:  # noqa: BLE001
        return {"name": "evidence_storage", "status": "unavailable"}


def check_mongodb() -> dict[str, Any]:
    """Required Mongo ping when the active Django database engine is MongoDB.

    Never includes URI, host, or password in the payload.
    """
    try:
        connection.ensure_connection()
        return {"name": "mongodb", "status": "ok"}
    except Exception:  # noqa: BLE001 — readiness must not leak exception details
        return {"name": "mongodb", "status": "unavailable"}


def check_mongodb_optional() -> dict[str, Any]:
    """
    MongoDB is not the system of record (ADR-002 / ADR-018).

    Report configured/skipped — never required for readiness of core FG recording.
    """
    uri = (getattr(settings, "MONGODB_URI", "") or "").strip()
    if not uri:
        return {"name": "mongodb", "status": "skipped", "detail": "not_configured"}
    # Do not connect with secrets in logs; optional probe only when explicitly enabled.
    if not bool(getattr(settings, "HEALTHCHECK_MONGODB_ENABLED", False)):
        return {"name": "mongodb", "status": "skipped", "detail": "probe_disabled"}
    try:
        from pymongo import MongoClient

        client: Any = MongoClient(uri, serverSelectionTimeoutMS=2000)
        client.admin.command("ping")
        client.close()
        return {"name": "mongodb", "status": "ok"}
    except Exception:  # noqa: BLE001
        return {"name": "mongodb", "status": "unavailable"}


def check_critical_integration() -> dict[str, Any]:
    """
    Bileeta/ERP live connector remains evidence-gated (Phase 17).

    Readiness reports blocked/skipped — never invents live vendor reachability.
    """
    try:
        from apps.integrations.vendor_evidence import evidence_is_complete

        if not evidence_is_complete():
            return {
                "name": "bileeta_integration",
                "status": "skipped",
                "detail": "vendor_evidence_incomplete",
            }
        live = bool(getattr(settings, "BILEETA_LIVE_ENABLED", False))
        if not live:
            return {
                "name": "bileeta_integration",
                "status": "skipped",
                "detail": "live_disabled",
            }
        return {
            "name": "bileeta_integration",
            "status": "skipped",
            "detail": "live_enabled_but_endpoints_not_wired",
        }
    except Exception:  # noqa: BLE001
        return {"name": "bileeta_integration", "status": "skipped", "detail": "module_unavailable"}


def liveness(_request: HttpRequest) -> JsonResponse:
    """Process-alive check — does not depend on PostgreSQL or Redis."""
    return JsonResponse(
        {
            "status": "alive",
            "service": "nelna-fg",
            "version": getattr(settings, "APP_VERSION", "unknown"),
        }
    )


def readiness(_request: HttpRequest) -> JsonResponse:
    """
    Dependency readiness.

    PostgreSQL mode required: PostgreSQL, Redis, Celery broker, evidence storage.
    MongoDB mode required: Mongo ping, Redis, Celery broker, evidence storage.
    Optional/skipped checks are reported but do not fail readiness.
    Never expose connection URIs or passwords.
    """
    if is_mongodb():
        required = [
            check_mongodb(),
            check_redis(),
            check_celery_broker(),
            check_evidence_storage(),
        ]
        optional = [check_critical_integration()]
    else:
        required = [
            check_postgres(),
            check_redis(),
            check_celery_broker(),
            check_evidence_storage(),
        ]
        optional = [check_mongodb_optional(), check_critical_integration()]
    checks = required + optional
    ready = all(item["status"] == "ok" for item in required)
    payload = {
        "status": "ready" if ready else "not_ready",
        "checks": checks,
    }
    return JsonResponse(payload, status=200 if ready else 503)
