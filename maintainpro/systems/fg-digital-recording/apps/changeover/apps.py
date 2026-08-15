from __future__ import annotations

from django.apps import AppConfig


class ChangeoverConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.changeover"
    label = "changeover"
    verbose_name = "Allergen / Changeover / Line Clearance"
