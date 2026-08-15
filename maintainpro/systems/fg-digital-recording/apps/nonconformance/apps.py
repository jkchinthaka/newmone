from __future__ import annotations

from django.apps import AppConfig


class NonconformanceConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.nonconformance"
    label = "nonconformance"
    verbose_name = "Nonconformance"
