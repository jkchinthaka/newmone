"""Tests for FG MongoDB collection namespace helpers."""

from __future__ import annotations

import pytest
from django.apps import apps
from django.test import override_settings


@pytest.mark.django_db
def test_apply_fg_collection_namespace_prefixes_models() -> None:
    from apps.core.db_namespace import (
        apply_fg_collection_namespace,
        restore_postgresql_table_names,
    )

    user_model = apps.get_model("accounts", "User")
    original = user_model._meta.db_table
    try:
        with override_settings(
            FG_COLLECTION_NAMESPACE_ENABLED=True,
            FG_COLLECTION_PREFIX="fg_",
        ):
            count = apply_fg_collection_namespace()
            assert count > 0
            assert user_model._meta.db_table.startswith("fg_")
            assert user_model._meta.db_table == "fg_accounts_user"
    finally:
        restore_postgresql_table_names()
        assert user_model._meta.db_table == original or not user_model._meta.db_table.startswith(
            "fg_"
        )


def test_namespace_disabled_leaves_default_table_names() -> None:
    from django.conf import settings

    from apps.core.db_namespace import (
        apply_fg_collection_namespace,
        restore_postgresql_table_names,
    )

    if getattr(settings, "FG_COLLECTION_NAMESPACE_ENABLED", False):
        pytest.skip(
            "POC/settings keep FG namespace enabled for the process; "
            "disabled-namespace behavior is covered under override on a fresh restore path"
        )

    restore_postgresql_table_names()
    user_model = apps.get_model("accounts", "User")
    with override_settings(FG_COLLECTION_NAMESPACE_ENABLED=False):
        patched = apply_fg_collection_namespace()
        assert patched == 0
    assert not user_model._meta.db_table.startswith("fg_")


def test_mongo_same_db_poc_rejects_production_database_name(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import importlib
    import sys

    from django.core.exceptions import ImproperlyConfigured

    monkeypatch.setenv(
        "MONGODB_URI",
        "mongodb://127.0.0.1:27027/?replicaSet=nelnaPocRs&directConnection=true",
    )
    monkeypatch.setenv("MONGODB_DATABASE", "maintainpro_prod")
    monkeypatch.setenv("MONGODB_PRODUCTION_TARGET_DATABASE", "maintainpro_prod")
    sys.modules.pop("config.settings.mongo_same_db_poc", None)

    with pytest.raises(ImproperlyConfigured, match="refuses to use the production"):
        importlib.import_module("config.settings.mongo_same_db_poc")
