"""Template context for the application shell."""

from __future__ import annotations

from typing import Any

from django.conf import settings
from django.http import HttpRequest


def foundation(request: HttpRequest) -> dict[str, Any]:
    unread = 0
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        from apps.notifications.selectors import notifications_for_recipient

        unread = notifications_for_recipient(recipient=user, unread_only=True).count()
    label = str(getattr(settings, "ENVIRONMENT_LABEL", "unspecified") or "unspecified")
    return {
        "APP_VERSION": getattr(settings, "APP_VERSION", "unknown"),
        "ENVIRONMENT_LABEL": label,
        "ENVIRONMENT_BADGE": label.strip().upper() or "UNSPECIFIED",
        "unread_notification_count": unread,
        "correlation_id": getattr(request, "correlation_id", ""),
        "current_path": getattr(request, "path", "") or "",
    }
