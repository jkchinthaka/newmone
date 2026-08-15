from __future__ import annotations

from django.apps import AppConfig


class EnvironmentalConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.environmental"
    label = "environmental"
    verbose_name = "Environmental Monitoring"
