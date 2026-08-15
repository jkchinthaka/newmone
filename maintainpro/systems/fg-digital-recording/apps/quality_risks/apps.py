from __future__ import annotations

from django.apps import AppConfig


class QualityRisksConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.quality_risks"
    label = "quality_risks"
    verbose_name = "Quality Risk Management"
