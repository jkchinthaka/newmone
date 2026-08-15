from __future__ import annotations

from django.apps import AppConfig


class QualityAuditsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.quality_audits"
    label = "quality_audits"
    verbose_name = "Quality Audit Management"
