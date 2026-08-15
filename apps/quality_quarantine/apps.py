from __future__ import annotations

from django.apps import AppConfig


class QualityQuarantineConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.quality_quarantine"
    label = "quality_quarantine"
    verbose_name = "Quality Quarantine"
