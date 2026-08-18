from __future__ import annotations

from collections.abc import Callable

from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.core"
    label = "core"
    verbose_name = "Core Foundation"

    def ready(self) -> None:
        from apps.core.db_namespace import apply_fg_collection_namespace
        from apps.core.mongo_schema_compat import apply_mongo_schema_compat
        from apps.core.persistence.queries import apply_mongo_queryset_compat

        apply_fg_collection_namespace()
        apply_mongo_queryset_compat()
        apply_mongo_schema_compat()
        _apply_mongo_post_migrate_seed_compat()


def _is_duplicate_seed_error(exc: BaseException) -> bool:
    cur: BaseException | None = exc
    seen: set[int] = set()
    while cur is not None and id(cur) not in seen:
        seen.add(id(cur))
        name = type(cur).__name__.lower()
        text = str(cur).lower()
        if "integrity" in name or "e11000" in text or "duplicate" in text:
            return True
        cur = cur.__cause__ or cur.__context__
    return False


def _apply_mongo_post_migrate_seed_compat() -> None:
    """Make Django auth/contenttypes post_migrate seeds idempotent on Mongo.

    Re-running migrate against an existing test DB otherwise fails with E11000
    on fg_auth_permission / fg_django_content_type unique indexes.
    """
    from django.db import IntegrityError
    from django.db.models.signals import post_migrate

    from apps.core.persistence.backend import is_mongodb

    if not is_mongodb():
        return
    if getattr(_apply_mongo_post_migrate_seed_compat, "_applied", False):
        return

    from django.contrib.auth.management import create_permissions as django_create_permissions
    from django.contrib.contenttypes.management import (
        create_contenttypes as django_create_contenttypes,
    )

    def _wrap(fn: Callable[..., None]) -> Callable[..., None]:
        def _safe(sender: object, **kwargs: object) -> None:
            # post_migrate passes both sender=app_config and app_config=.
            kwargs.pop("app_config", None)
            try:
                fn(sender, **kwargs)
            except IntegrityError:
                return
            except Exception as exc:  # noqa: BLE001
                if _is_duplicate_seed_error(exc):
                    return
                raise

        return _safe

    # Auth/ContentTypes register with dispatch_uid — must disconnect the same way.
    post_migrate.disconnect(
        django_create_permissions,
        dispatch_uid="django.contrib.auth.management.create_permissions",
    )
    post_migrate.disconnect(django_create_permissions)
    post_migrate.disconnect(
        django_create_contenttypes,
        dispatch_uid="django.contrib.contenttypes.management.create_contenttypes",
    )
    post_migrate.disconnect(django_create_contenttypes)
    post_migrate.connect(
        _wrap(django_create_permissions),
        dispatch_uid="apps.core.mongo_safe_create_permissions",
    )
    post_migrate.connect(
        _wrap(django_create_contenttypes),
        dispatch_uid="apps.core.mongo_safe_create_contenttypes",
    )
    _apply_mongo_post_migrate_seed_compat._applied = True  # type: ignore[attr-defined]
