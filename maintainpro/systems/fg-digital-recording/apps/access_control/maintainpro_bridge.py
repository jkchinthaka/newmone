"""MaintainPro fg.* permission bridge — AND with ScopedRoleAssignment scope checks."""

from __future__ import annotations

from collections.abc import Callable
from functools import wraps
from typing import Any, TypeVar

from django.conf import settings
from django.contrib.auth.views import redirect_to_login
from django.core.exceptions import PermissionDenied
from django.http import HttpRequest, HttpResponse

F = TypeVar("F", bound=Callable[..., HttpResponse])

# Session / user attribute populated by SSO gate middleware.
FG_PERMISSIONS_SESSION_KEY = "maintainpro_permissions"
FG_PERMISSIONS_USER_ATTR = "_maintainpro_fg_permissions"


def is_maintainpro_projected_user(user: object) -> bool:
    return bool(str(getattr(user, "maintainpro_user_id", "") or "").strip())


def fg_permissions_for_request(request: HttpRequest) -> frozenset[str]:
    cached = getattr(request, "maintainpro_fg_permissions", None)
    if isinstance(cached, frozenset):
        return cached
    raw = request.session.get(FG_PERMISSIONS_SESSION_KEY) or []
    if not isinstance(raw, (list, tuple)):
        return frozenset()
    return frozenset(str(p).strip() for p in raw if str(p).strip())


def fg_permissions_for_user(user: object) -> frozenset[str] | None:
    """
    Permissions attached by middleware for the current request.
    None means unknown (fail closed for projected users outside HTTP).
    """
    value = getattr(user, FG_PERMISSIONS_USER_ATTR, None)
    if value is None:
        return None
    if isinstance(value, frozenset):
        return value
    return frozenset(str(p).strip() for p in value if str(p).strip())


def attach_fg_permissions(request: HttpRequest) -> frozenset[str]:
    perms = fg_permissions_for_request(request)
    request.maintainpro_fg_permissions = perms  # type: ignore[attr-defined]
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        setattr(user, FG_PERMISSIONS_USER_ATTR, perms)
    return perms


def session_has_fg_permission(request: HttpRequest, permission: str) -> bool:
    key = (permission or "").strip()
    if not key:
        return False
    return key in fg_permissions_for_request(request)


def user_has_fg_permission(user: object, permission: str) -> bool:
    """
    Enforce MaintainPro fg.* for projected principals.
    Legacy local users (no maintainpro_user_id) skip this gate — ScopedRoleAssignment remains.
    When SSO gate is enabled and user is projected but permissions were not attached, fail closed.
    """
    key = (permission or "").strip()
    if not key:
        return False
    if not is_maintainpro_projected_user(user):
        # Local/legacy FG accounts: MaintainPro catalogue does not apply.
        return True
    perms = fg_permissions_for_user(user)
    if perms is None:
        # Projected user without request-bound permissions — deny.
        return False
    if key == "fg.access":
        return "fg.access" in perms or "fg.admin" in perms
    if "fg.admin" in perms and key.startswith("fg."):
        return True
    return key in perms


def assert_fg_permission(request: HttpRequest, permission: str) -> None:
    if not getattr(request.user, "is_authenticated", False):
        raise PermissionDenied("Authentication required.")
    attach_fg_permissions(request)
    # Entry permission is required for every FG operation when SSO is the IdP.
    if is_maintainpro_projected_user(request.user) or getattr(
        settings, "MAINTAINPRO_SSO_GATE_ENABLED", False
    ):
        if not user_has_fg_permission(request.user, "fg.access"):
            # Legacy local user under SSO gate: may lack session perms; require projection or perms.
            if is_maintainpro_projected_user(request.user):
                raise PermissionDenied("Missing required permission: fg.access")
            # Local user while gate enabled still needs module ScopedRoleAssignment (checked elsewhere).
        if is_maintainpro_projected_user(request.user):
            if not user_has_fg_permission(request.user, permission):
                raise PermissionDenied(f"Missing required permission: {permission}")


def assert_user_fg_permission(user: object, permission: str) -> None:
    if not user_has_fg_permission(user, permission):
        raise PermissionDenied(f"Missing required permission: {permission}")


def require_fg_permission(permission: str) -> Callable[[F], F]:
    """View decorator: MaintainPro fg.* (for projected users) — use with existing scope checks."""

    def decorator(view_func: F) -> F:
        @wraps(view_func)
        def _wrapped(request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse:
            if not request.user.is_authenticated:
                return redirect_to_login(request.get_full_path())
            assert_fg_permission(request, permission)
            return view_func(request, *args, **kwargs)

        return _wrapped  # type: ignore[return-value]

    return decorator
