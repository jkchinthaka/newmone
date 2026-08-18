from __future__ import annotations

from django.apps import AppConfig


class ProcessFmeaConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.process_fmea"
    label = "process_fmea"
    verbose_name = "Process FMEA"
