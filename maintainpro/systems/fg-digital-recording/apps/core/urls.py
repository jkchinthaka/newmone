"""Core URL routes."""

from __future__ import annotations

from django.urls import path

from apps.core import health, views

app_name = "core"

urlpatterns = [
    path("", views.home, name="home"),
    path("health/live/", health.liveness, name="health-live"),
    path("health/ready/", health.readiness, name="health-ready"),
    path("htmx/status/", views.htmx_status_partial, name="htmx-status"),
]
