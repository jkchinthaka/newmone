from __future__ import annotations

from django.apps import AppConfig


class IqcConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.iqc"
    label = "iqc"
    verbose_name = "Incoming Quality Control (IQC)"
