from __future__ import annotations

from django.apps import AppConfig


class ProductReturnsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.product_returns"
    label = "product_returns"
    verbose_name = "Returned Product Quality"
