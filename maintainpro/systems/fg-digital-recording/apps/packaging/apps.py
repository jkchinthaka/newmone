from __future__ import annotations

from django.apps import AppConfig


class PackagingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.packaging"
    label = "packaging"
    verbose_name = "Packaging / Label Artwork"
