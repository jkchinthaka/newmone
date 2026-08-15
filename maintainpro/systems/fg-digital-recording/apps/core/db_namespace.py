"""Permanent FG MongoDB collection naming convention.

Source of truth for same-database cutover into ``mgintginpro_prod``.

Naming rule (mandatory):
    fg_{django_default_db_table}

Examples:
    accounts.User              → fg_accounts_user
    organizations.Organization → fg_organizations_organization
    recording.ChecklistRecord  → fg_recording_checklistrecord

Activation:
    FG_COLLECTION_NAMESPACE_ENABLED=True (mongo_same_db / mongo_same_db_poc only)

PostgreSQL on ``main`` keeps default Django table names until an approved cutover.
Runtime application via ``apply_fg_collection_namespace()`` is the migration-branch
activation mechanism. Cutover migrations must create/bind collections using these
exact names — do not rely on ad-hoc monkey-patches as the long-term contract.

MaintainPro PascalCase collections are never reused or renamed.
"""

from __future__ import annotations

from dataclasses import dataclass

from django.apps import apps
from django.conf import settings
from django.db import models

_SKIPPED_APP_LABELS = frozenset({"mongo_poc", "mongo_compat"})

DEFAULT_FG_PREFIX = "fg_"


def fg_prefix() -> str:
    return getattr(settings, "FG_COLLECTION_PREFIX", DEFAULT_FG_PREFIX)


def namespace_enabled() -> bool:
    return bool(getattr(settings, "FG_COLLECTION_NAMESPACE_ENABLED", False))


def planned_collection_for_model(model: type[models.Model], *, prefix: str | None = None) -> str:
    """Return the permanent FG Mongo collection name for a Django model.

    Uses the model's *unprefixed* Django default table name as the suffix so the
    name is stable even if namespace was already applied at runtime.
    """
    p = prefix if prefix is not None else fg_prefix()
    table = model._meta.db_table
    if table.startswith(p):
        table = table[len(p) :]
    return f"{p}{table}"


def postgresql_table_for_model(model: type[models.Model]) -> str:
    """Current PostgreSQL table name (strip fg_ if namespace already applied)."""
    p = fg_prefix()
    table = model._meta.db_table
    if table.startswith(p):
        return table[len(p) :]
    return table


@dataclass(frozen=True)
class FgCollectionSpec:
    app_label: str
    model_name: str
    model_class_name: str
    postgresql_table: str
    mongo_collection: str
    is_auto_created: bool
    is_managed: bool
    pk_field: str
    pk_type: str


def iter_fg_models(*, include_auto_created: bool = True) -> list[type[models.Model]]:
    models_out: list[type[models.Model]] = []
    for model in apps.get_models(include_auto_created=include_auto_created):
        if model._meta.proxy:
            continue
        if model._meta.app_label in _SKIPPED_APP_LABELS:
            continue
        models_out.append(model)
    models_out.sort(key=lambda m: (m._meta.app_label, m._meta.model_name))
    return models_out


def build_collection_specs(*, prefix: str | None = None) -> list[FgCollectionSpec]:
    p = prefix if prefix is not None else fg_prefix()
    specs: list[FgCollectionSpec] = []
    for model in iter_fg_models(include_auto_created=True):
        pk = model._meta.pk
        specs.append(
            FgCollectionSpec(
                app_label=model._meta.app_label,
                model_name=model._meta.model_name,
                model_class_name=model.__name__,
                postgresql_table=postgresql_table_for_model(model),
                mongo_collection=planned_collection_for_model(model, prefix=p),
                is_auto_created=model._meta.auto_created,
                is_managed=model._meta.managed,
                pk_field=pk.name if pk is not None else "",
                pk_type=type(pk).__name__ if pk is not None else "",
            )
        )
    specs.sort(key=lambda s: s.mongo_collection)
    return specs


def apply_fg_collection_namespace() -> int:
    """Bind ``model._meta.db_table`` to the permanent ``fg_`` name when enabled.

    Idempotent. This is the migration-branch activation path for Mongo settings.
    Production cutover must still emit Mongo schema using these exact names.
    """
    if not namespace_enabled():
        return 0

    prefix = fg_prefix()
    patched = 0
    for model in iter_fg_models(include_auto_created=True):
        target = planned_collection_for_model(model, prefix=prefix)
        if model._meta.db_table == target:
            continue
        model._meta.db_table = target
        patched += 1
    return patched


def restore_postgresql_table_names() -> int:
    """Undo runtime ``fg_`` db_table patches (for PostgreSQL tests / teardown)."""
    prefix = fg_prefix()
    restored = 0
    for model in iter_fg_models(include_auto_created=True):
        table = model._meta.db_table
        if table.startswith(prefix):
            model._meta.db_table = table[len(prefix) :]
            restored += 1
    return restored


def planned_fg_collections(*, prefix: str = DEFAULT_FG_PREFIX) -> list[tuple[str, str, str]]:
    """Return (app_label, model_name, collection_name) without mutating models."""
    rows = [
        (s.app_label, s.model_name, s.mongo_collection)
        for s in build_collection_specs(prefix=prefix)
    ]
    rows.sort(key=lambda r: r[2])
    return rows


def pk_classification(model: type[models.Model]) -> str:
    """Classify primary key for Mongo migration planning."""
    if model._meta.auto_created:
        return "THROUGH MODEL — REVIEW"
    pk = model._meta.pk
    if pk is None:
        return "CONTRIB MODEL — REVIEW"
    name = type(pk).__name__
    if name == "UUIDField":
        return "UUID — SAFE CANDIDATE"
    if name in {"ObjectIdAutoField", "ObjectIdField"}:
        return "OBJECTID-COMPATIBLE"
    if name in {"BigAutoField", "AutoField", "SmallAutoField"}:
        label = model._meta.app_label
        if label in {"auth", "admin", "contenttypes", "sessions", "django_celery_beat"}:
            return "CONTRIB MODEL — REVIEW"
        return "IMPLICIT BIGAUTOFIELD — REQUIRES REDESIGN"
    return f"OTHER ({name}) — REVIEW"


def index_summary(model: type[models.Model]) -> list[str]:
    rows: list[str] = []
    for index in model._meta.indexes:
        fields = list(getattr(index, "fields", []) or [])
        rows.append(",".join(fields) if fields else index.__class__.__name__)
    for unique in model._meta.unique_together:
        rows.append(f"unique_together:{','.join(unique)}")
    for constraint in model._meta.constraints:
        rows.append(f"constraint:{constraint.__class__.__name__}:{constraint.name}")
    if model._meta.pk is not None:
        rows.insert(0, f"pk:{model._meta.pk.name}")
    for field in model._meta.local_fields:
        if getattr(field, "unique", False) and not field.primary_key:
            rows.append(f"unique:{field.name}")
    return rows


def relationship_summary(model: type[models.Model]) -> list[str]:
    rows: list[str] = []
    for field in model._meta.get_fields():
        if not field.is_relation or field.auto_created and not field.concrete:
            continue
        if getattr(field, "many_to_many", False):
            through = getattr(getattr(field, "remote_field", None), "through", None)
            through_name = getattr(through, "__name__", "auto")
            rows.append(f"M2M:{field.name}->{field.related_model._meta.label} via {through_name}")
        elif getattr(field, "many_to_one", False) or getattr(field, "one_to_one", False):
            rel = "O2O" if getattr(field, "one_to_one", False) else "FK"
            target = field.related_model._meta.label if field.related_model else "?"
            rows.append(f"{rel}:{field.name}->{target}")
    return rows


def collision_note(mongo_collection: str, maintainpro_names: set[str]) -> str:
    if mongo_collection in maintainpro_names:
        return "EXACT COLLISION"
    # Soft signal only — PascalCase vs fg_ snake should not collide
    bare = mongo_collection.removeprefix(DEFAULT_FG_PREFIX)
    if bare in maintainpro_names or mongo_collection in maintainpro_names:
        return "EXACT COLLISION"
    return "NONE"
