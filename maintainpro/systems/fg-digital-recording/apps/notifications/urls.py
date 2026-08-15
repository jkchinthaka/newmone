"""URL routes for in-app notifications."""

from __future__ import annotations

from django.urls import path

from apps.notifications import views

app_name = "notifications"

urlpatterns = [
    path("notifications/", views.notification_list, name="list"),
    path(
        "notifications/<uuid:notification_id>/read/",
        views.notification_mark_read,
        name="mark_read",
    ),
]
