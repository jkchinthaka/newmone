from __future__ import annotations

from django.apps import AppConfig


class SamplingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.sampling"
    label = "sampling"
    verbose_name = "Quality Sampling Engine"
