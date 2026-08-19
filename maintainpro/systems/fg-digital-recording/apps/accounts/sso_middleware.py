"""Gate FG requests behind MaintainPro SSO (no separate FG password login)."""

from __future__ import annotations

import time
from collections.abc import Callable
from urllib.parse import quote

from django.conf import settings
from django.contrib.auth import logout
from django.core.exceptions import PermissionDenied
from django.http import HttpRequest, HttpResponse, HttpResponseRedirect
from django.urls import resolve

from apps.access_control.maintainpro_bridge import attach_fg_permissions, session_has_fg_permission
from apps.accounts.sso import (
    live_revalidate_maintainpro_user,
    reject_forged_identity_headers,
    verify_maintainpro_access_token,
)


class MaintainProSessionGateMiddleware:
    """
    - Unauthenticated /fg requests → MaintainPro handoff (or /login).
    - Authenticated sessions require a valid MaintainPro access JWT (+ periodic live /auth/me).
    - /admin/ requires fg.admin for projected MaintainPro principals.
    - Rejects forged browser identity headers (fail closed).
    """

    EXEMPT_NAMES = frozenset(
        {
            "sso_consume",
            "sso_denied",
            "core:health-live",
            "core:health-ready",
        }
    )

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if not getattr(settings, "MAINTAINPRO_SSO_GATE_ENABLED", False):
            attach_fg_permissions(request)
            return self.get_response(request)

        path = request.path or "/"
        try:
            reject_forged_identity_headers(request)
        except PermissionDenied:
            return HttpResponse("Forbidden: forged identity headers rejected.", status=403)

        if self._is_exempt(request, path):
            return self.get_response(request)

        user = getattr(request, "user", None)
        authenticated = bool(getattr(user, "is_authenticated", False))
        access_cookie = (request.COOKIES.get("maintainpro_access") or "").strip()

        if authenticated:
            if not access_cookie:
                logout(request)
                return self._handoff(request)
            try:
                self._revalidate_maintainpro(request, access_cookie)
            except PermissionDenied:
                logout(request)
                return self._handoff(request)

            attach_fg_permissions(request)

            if self._is_admin_path(path) and not self._admin_allowed(request):
                return HttpResponse(
                    "Forbidden: fg.admin is required for Django admin.",
                    status=403,
                )
            return self.get_response(request)

        return self._handoff(request)

    def _revalidate_maintainpro(self, request: HttpRequest, access_token: str) -> None:
        payload = verify_maintainpro_access_token(access_token)
        token_sub = str(payload.get("sub") or "").strip()
        session_sub = str(request.session.get("maintainpro_user_id") or "").strip()
        user = request.user
        user_mp = str(getattr(user, "maintainpro_user_id", "") or "").strip()
        expected = session_sub or user_mp
        if expected and token_sub and token_sub != expected:
            raise PermissionDenied("MaintainPro identity mismatch.")

        interval = int(getattr(settings, "MAINTAINPRO_SSO_REVALIDATE_INTERVAL_SECONDS", 60) or 60)
        last = int(request.session.get("mp_revalidated_at") or 0)
        now = int(time.time())
        if now - last >= max(15, interval):
            live_revalidate_maintainpro_user(access_token)
            request.session["mp_revalidated_at"] = now
            request.session.modified = True

    def _is_admin_path(self, path: str) -> bool:
        normalized = path
        if normalized.startswith("/fg/"):
            normalized = "/" + normalized[4:]
        return normalized.startswith("/admin")

    def _admin_allowed(self, request: HttpRequest) -> bool:
        user = request.user
        if not getattr(user, "is_authenticated", False):
            return False
        # fg.access alone is never enough.
        if session_has_fg_permission(request, "fg.admin"):
            return bool(getattr(user, "is_staff", False) or getattr(user, "is_superuser", False))
        # Legacy local technical admin only when password login is enabled.
        if getattr(settings, "FG_PASSWORD_LOGIN_ENABLED", False):
            return bool(getattr(user, "is_staff", False) and not str(
                getattr(user, "maintainpro_user_id", "") or ""
            ).strip())
        return False

    def _is_exempt(self, request: HttpRequest, path: str) -> bool:
        normalized = path
        if normalized.startswith("/fg/"):
            normalized = "/" + normalized[4:]
        elif normalized == "/fg":
            normalized = "/"

        for prefix in ("/static/", "/health/", "/sso/", "/media/"):
            if normalized.startswith(prefix):
                return True

        try:
            match = resolve(normalized)
            if match.view_name in self.EXEMPT_NAMES:
                return True
        except Exception:
            pass
        return False

    def _handoff(self, request: HttpRequest) -> HttpResponseRedirect:
        next_path = request.get_full_path()
        if not next_path.startswith("/fg"):
            next_path = "/fg" + (next_path if next_path.startswith("/") else f"/{next_path}")
        handoff = f"/api/fg-sso/handoff?next={quote(next_path, safe='/:?=&')}"
        return HttpResponseRedirect(handoff)
