from __future__ import annotations

from django.apps import AppConfig


class ComplianceMappingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.compliance_mapping"
    label = "compliance_mapping"
    verbose_name = "Compliance Control Mapping"
