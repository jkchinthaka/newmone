from __future__ import annotations

from django.apps import AppConfig


class CustomerComplaintsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.customer_complaints"
    label = "customer_complaints"
    verbose_name = "Customer Quality Complaints"
