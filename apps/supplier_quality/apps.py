from __future__ import annotations

from django.apps import AppConfig


class SupplierQualityConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.supplier_quality"
    label = "supplier_quality"
    verbose_name = "Supplier Quality"
