from __future__ import annotations

from django.apps import AppConfig


class ForeignBodyConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.foreign_body"
    label = "foreign_body"
    verbose_name = "Foreign Body / Metal Detector Control"
