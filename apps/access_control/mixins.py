"""Class-based view mixins for permission checks."""

from __future__ import annotations

from typing import Any

from django.contrib.auth.mixins import AccessMixin
from django.core.exceptions import PermissionDenied

from apps.access_control.services import Scope, user_has_permission


class PermissionRequiredMixin(AccessMixin):
    """CBV mixin: require a permission, optionally scoped. Deny by default."""

    permission_required: str = ""
    permission_scope: Scope | None = None

    def get_permission_required(self) -> str:
        if not self.permission_required:
            raise ValueError("permission_required must be set.")
        return self.permission_required

    def get_permission_scope(self) -> Scope | None:
        return self.permission_scope

    def has_permission(self) -> bool:
        user = self.request.user  # type: ignore[attr-defined]
        if not user.is_authenticated:
            return False
        return user_has_permission(
            user,
            self.get_permission_required(),
            scope=self.get_permission_scope(),
        )

    def dispatch(self, request: Any, *args: Any, **kwargs: Any) -> Any:
        if not request.user.is_authenticated:
            return self.handle_no_permission()
        if not self.has_permission():
            raise PermissionDenied("Permission denied.")
        return super().dispatch(request, *args, **kwargs)  # type: ignore[misc]
