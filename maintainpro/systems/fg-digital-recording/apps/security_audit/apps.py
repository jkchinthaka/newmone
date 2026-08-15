from __future__ import annotations

from django.apps import AppConfig


class SecurityAuditConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.security_audit"
    label = "security_audit"
    verbose_name = "Security Audit"
