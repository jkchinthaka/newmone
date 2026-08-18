from __future__ import annotations

from django.apps import AppConfig


class HaccpConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.haccp"
    label = "haccp"
    verbose_name = "HACCP / Control-Point Foundation"
