from __future__ import annotations

from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.core"
    label = "core"
    verbose_name = "Core Foundation"

    def ready(self) -> None:
        from apps.core.db_namespace import apply_fg_collection_namespace
        from apps.core.persistence.queries import apply_mongo_queryset_compat

        apply_fg_collection_namespace()
        apply_mongo_queryset_compat()
