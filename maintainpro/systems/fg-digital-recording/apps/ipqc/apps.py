from __future__ import annotations

from django.apps import AppConfig


class IpqcConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.ipqc"
    label = "ipqc"
    verbose_name = "In-Process Quality Control (IPQC)"
