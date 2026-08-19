"""Correlation ID and request logging middleware."""

from __future__ import annotations

import re
import time
import uuid
from collections.abc import Callable
from typing import Any

import structlog
from django.conf import settings
from django.http import HttpRequest, HttpResponse

logger = structlog.get_logger(__name__)

_VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{8,128}$")
_SENSITIVE_KEYS = frozenset(
    {
        "password",
        "password1",
        "password2",
        "passwd",
        "secret",
        "token",
        "csrfmiddlewaretoken",
        "authorization",
        "cookie",
        "sessionid",
        "fg_sessionid",
        "api_key",
        "apikey",
        "redis_url",
        "database_url",
        "secret_key",
        "mongodb_uri",
        "mongo_uri",
        "attachment",
        "attachments",
        "free_text",
        "answers",
    }
)


def _sanitize_path(path: str) -> str:
    return path.split("?", 1)[0]


def _incoming_correlation_id(request: HttpRequest) -> str:
    header_name = getattr(settings, "CORRELATION_ID_HEADER", "HTTP_X_REQUEST_ID")
    raw = request.META.get(header_name, "")
    if isinstance(raw, str) and _VALID_REQUEST_ID.fullmatch(raw.strip()):
        return raw.strip()
    return str(uuid.uuid4())


class CorrelationIdMiddleware:
    """Attach a correlation ID to the request, response, and structlog context."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        correlation_id = _incoming_correlation_id(request)
        request.correlation_id = correlation_id  # type: ignore[attr-defined]
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            correlation_id=correlation_id,
            environment=getattr(settings, "ENVIRONMENT_LABEL", "unspecified"),
            app_version=getattr(settings, "APP_VERSION", "unknown"),
        )
        response = self.get_response(request)
        header = getattr(settings, "CORRELATION_ID_RESPONSE_HEADER", "X-Request-ID")
        response[header] = correlation_id
        return response


class RequestLoggingMiddleware:
    """Log safe request metadata without secrets or connection strings."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        started = time.perf_counter()
        response = self.get_response(request)
        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        user = getattr(request, "user", None)
        user_id = ""
        org_id = ""
        if user is not None and getattr(user, "is_authenticated", False):
            user_id = str(getattr(user, "pk", "") or "")
            # Active org is optional request attribute set by views; never invent.
            org_id = str(getattr(request, "active_organization_id", "") or "")
        error_class = ""
        if response.status_code >= 500:
            error_class = "server_error"
        elif response.status_code == 403:
            error_class = "forbidden"
        elif response.status_code == 401:
            error_class = "unauthorized"
        logger.info(
            "http_request",
            method=request.method,
            path=_sanitize_path(request.path),
            status_code=response.status_code,
            duration_ms=duration_ms,
            user_id=user_id or None,
            organization_id=org_id or None,
            error_class=error_class or None,
        )
        return response


def redact_mapping(data: dict[str, Any]) -> dict[str, Any]:
    """Return a shallow copy with sensitive keys redacted."""
    redacted: dict[str, Any] = {}
    for key, value in data.items():
        if key.lower() in _SENSITIVE_KEYS:
            redacted[key] = "[REDACTED]"
        else:
            redacted[key] = value
    return redacted


class SecurityHeadersMiddleware:
    """
    Apply browser security headers for production readiness (Phase 19).

    CSP is intentionally conservative. Inline styles used by the current UI are
    allowed via 'unsafe-inline' for style-src until a nonce-based CSP is approved.
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        response = self.get_response(request)
        csp = getattr(settings, "CONTENT_SECURITY_POLICY", "") or ""
        if csp:
            response.setdefault("Content-Security-Policy", csp)
        permissions = getattr(settings, "PERMISSIONS_POLICY", "") or ""
        if permissions:
            response.setdefault("Permissions-Policy", permissions)
        # Defense-in-depth even when SECURE_* settings apply at SecurityMiddleware.
        response.setdefault("X-Content-Type-Options", "nosniff")
        referrer = getattr(settings, "SECURE_REFERRER_POLICY", "same-origin")
        if referrer:
            response.setdefault("Referrer-Policy", str(referrer))
        return response
