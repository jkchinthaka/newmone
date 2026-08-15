from __future__ import annotations

from django.apps import AppConfig


class RcaConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.rca"
    label = "rca"
    verbose_name = "Root Cause Analysis"
