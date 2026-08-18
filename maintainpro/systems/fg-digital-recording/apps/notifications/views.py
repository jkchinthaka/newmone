"""In-app workflow notification views."""

from __future__ import annotations

import uuid
from typing import cast

from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied, ValidationError
from django.http import HttpRequest, HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.views.decorators.http import require_http_methods, require_POST

from apps.accounts.models import User
from apps.notifications.models import Notification
from apps.notifications.selectors import notifications_for_recipient
from apps.notifications.services import mark_notification_read


@login_required
@require_http_methods(["GET"])
def notification_list(request: HttpRequest) -> HttpResponse:
    """List the current user's in-app notifications (privacy: own only)."""
    user = cast(User, request.user)
    # Allow authenticated recipients to see own inbox; VIEW_OWN grants org-scoped visibility intent.
    unread_only = request.GET.get("unread") == "1"
    notifications = list(notifications_for_recipient(recipient=user, unread_only=unread_only)[:100])
    return render(
        request,
        "notifications/list.html",
        {
            "notifications": notifications,
            "unread_only": unread_only,
        },
    )


@login_required
@require_POST
def notification_mark_read(request: HttpRequest, notification_id: uuid.UUID) -> HttpResponse:
    notification = get_object_or_404(Notification, pk=notification_id)
    if notification.recipient_id != request.user.id:
        raise PermissionDenied("Only the recipient may mark this notification read.")
    try:
        mark_notification_read(actor=request.user, notification_id=notification.id)
    except ValidationError as exc:
        raise PermissionDenied(str(exc)) from exc
    next_url = request.POST.get("next") or reverse("notifications:list")
    return HttpResponseRedirect(next_url)
