"""Permission-required view decorators — deny by default."""

from __future__ import annotations

from collections.abc import Callable
from functools import wraps
from typing import Any, TypeVar

from django.contrib.auth.views import redirect_to_login
from django.core.exceptions import PermissionDenied
from django.http import HttpRequest, HttpResponse

from apps.access_control.services import Scope, user_has_permission

F = TypeVar("F", bound=Callable[..., HttpResponse])


def permission_required(
    permission: str,
    *,
    scope_getter: Callable[[HttpRequest], Scope | None] | None = None,
) -> Callable[[F], F]:
    def decorator(view_func: F) -> F:
        @wraps(view_func)
        def _wrapped(request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse:
            if not request.user.is_authenticated:
                return redirect_to_login(request.get_full_path())
            scope = scope_getter(request) if scope_getter else None
            if not user_has_permission(request.user, permission, scope=scope):
                raise PermissionDenied("Permission denied.")
            return view_func(request, *args, **kwargs)

        return _wrapped  # type: ignore[return-value]

    return decorator
