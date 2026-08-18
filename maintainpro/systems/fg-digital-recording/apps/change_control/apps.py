from __future__ import annotations

from django.apps import AppConfig


class ChangeControlConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.change_control"
    label = "change_control"
    verbose_name = "Quality Change Control"
