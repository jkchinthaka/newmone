from __future__ import annotations

from django.apps import AppConfig


class BatchDossierConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.batch_dossier"
    label = "batch_dossier"
    verbose_name = "Electronic Batch Quality Dossier"
