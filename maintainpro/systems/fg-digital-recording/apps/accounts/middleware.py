"""Force password change middleware — redirect until password is updated."""

from __future__ import annotations

from collections.abc import Callable

from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect
from django.urls import NoReverseMatch, reverse


class ForcedPasswordChangeMiddleware:
    """
    Redirect authenticated users with must_change_password to the force-change page.

    Exempts login, logout, force-change, static/media, health, and admin logout paths
    to avoid redirect loops.
    """

    EXEMPT_PREFIXES = (
        "/static/",
        "/media/",
        "/health/",
        "/admin/logout/",
    )

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if self._should_redirect(request):
            return redirect("accounts:force_password_change")
        return self.get_response(request)

    def _should_redirect(self, request: HttpRequest) -> bool:
        user = request.user
        if not getattr(user, "is_authenticated", False):
            return False
        if not getattr(user, "must_change_password", False):
            return False

        path = request.path
        for prefix in self.EXEMPT_PREFIXES:
            if path.startswith(prefix):
                return False

        exempt_names = {
            "accounts:login",
            "accounts:logout",
            "accounts:force_password_change",
            "accounts:account_locked",
            "core:health-live",
            "core:health-ready",
        }
        try:
            for name in exempt_names:
                if path == reverse(name) or path.rstrip("/") == reverse(name).rstrip("/"):
                    return False
        except NoReverseMatch:
            # Resolver may be unavailable during early startup; use path fallback below.
            pass

        # Fallback path matching if reverse fails or admin paths.
        if path.startswith("/accounts/login"):
            return False
        if path.startswith("/accounts/logout"):
            return False
        if path.startswith("/accounts/force-change-password"):
            return False
        if path.startswith("/accounts/locked"):
            return False

        return True
