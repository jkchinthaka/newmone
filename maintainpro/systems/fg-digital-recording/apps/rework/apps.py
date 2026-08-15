from __future__ import annotations

from django.apps import AppConfig


class ReworkConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.rework"
    label = "rework"
    verbose_name = "Controlled Rework"
