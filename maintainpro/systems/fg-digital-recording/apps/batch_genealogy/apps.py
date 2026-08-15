from __future__ import annotations

from django.apps import AppConfig


class BatchGenealogyConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.batch_genealogy"
    label = "batch_genealogy"
    verbose_name = "Batch Genealogy Traceability"
