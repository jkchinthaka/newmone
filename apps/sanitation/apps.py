from __future__ import annotations

from django.apps import AppConfig


class SanitationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.sanitation"
    label = "sanitation"
    verbose_name = "Sanitation / SSOP"
