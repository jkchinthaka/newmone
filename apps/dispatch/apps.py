from __future__ import annotations

from django.apps import AppConfig


class DispatchConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.dispatch"
    label = "dispatch"
    verbose_name = "Loading / Dispatch Quality"
