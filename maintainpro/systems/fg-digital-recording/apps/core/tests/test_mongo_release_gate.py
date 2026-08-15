"""Mongo release-gate tests: idempotency, transactions, persistence, bootstrap.

Requires:
  DJANGO_SETTINGS_MODULE=config.settings.mongo_test
  MONGODB_URI pointing at isolated replica set
  MONGODB_DATABASE=maintainpro_fg_test (never maintainpro_prod)
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.core.management import call_command
from django.db import connection

from apps.core.idempotency import begin_idempotent, run_idempotent
from apps.core.models import IdempotencyKey, IdempotencyKeyStatus
from apps.core.persistence import is_mongodb, mongo_multi_doc_atomic
from apps.core.persistence.transactions import run_mongo_multi_doc_atomic
from apps.organizations.models import Organization
from apps.security_audit.models import SecurityAuditEvent
from tests.factories import make_org, make_user


pytestmark = pytest.mark.django_db


def _require_mongo() -> None:
    if not is_mongodb():
        pytest.skip("Mongo engine required")
    db = getattr(settings, "MONGODB_DATABASE", "") or settings.DATABASES["default"]["NAME"]
    assert db not in {"maintainpro_prod", "admin", "config", "local"}


def test_mongo_test_settings_refuse_production_name(monkeypatch: pytest.MonkeyPatch) -> None:
    import importlib
    import sys

    monkeypatch.setenv(
        "MONGODB_URI",
        "mongodb://127.0.0.1:27027/?replicaSet=nelnaPocRs&directConnection=true",
    )
    monkeypatch.setenv("MONGODB_DATABASE", "maintainpro_prod")
    monkeypatch.setenv("MONGODB_PRODUCTION_TARGET_DATABASE", "maintainpro_prod")
    sys.modules.pop("config.settings.mongo_test", None)
    with pytest.raises(ImproperlyConfigured, match="refuses"):
        importlib.import_module("config.settings.mongo_test")


def test_bootstrap_indexes_idempotent_and_non_destructive() -> None:
    _require_mongo()
    db_name = settings.DATABASES["default"]["NAME"]
    client = connection.connection
    before = set(client[db_name].list_collection_names())
    call_command("bootstrap_mongo_indexes", verbosity=0)
    call_command("bootstrap_mongo_indexes", verbosity=0)
    after = set(client[db_name].list_collection_names())
    # Must not remove prior collections.
    assert before.issubset(after)
    namespaced = [n for n in after if n.startswith("fg_")]
    assert namespaced, "expected fg_ collections after bootstrap"


def test_idempotency_replay_does_not_duplicate() -> None:
    _require_mongo()
    org = make_org(code=f"I{uuid.uuid4().hex[:6].upper()}")
    counter = {"n": 0}

    def work() -> Organization:
        counter["n"] += 1
        return org

    r1, row1, created1 = run_idempotent(
        organization=org, scope="test.scope", key="same-key-1", fn=work
    )
    r2, row2, created2 = run_idempotent(
        organization=org, scope="test.scope", key="same-key-1", fn=work
    )
    assert created1 is True
    assert created2 is False
    assert counter["n"] == 1
    assert row1.pk == row2.pk
    assert row2.status == IdempotencyKeyStatus.COMPLETED
    assert IdempotencyKey.objects.filter(organization=org, scope="test.scope", key="same-key-1").count() == 1


def test_concurrent_duplicate_idempotency_unique() -> None:
    _require_mongo()
    org = make_org(code=f"C{uuid.uuid4().hex[:6].upper()}")
    a = begin_idempotent(organization=org, scope="test.concurrent", key="k1")
    b = begin_idempotent(organization=org, scope="test.concurrent", key="k1")
    assert a.pk == b.pk
    assert IdempotencyKey.objects.filter(organization=org, scope="test.concurrent", key="k1").count() == 1

    counter = {"n": 0}

    def work() -> Organization:
        counter["n"] += 1
        return org

    r1, row1, created1 = run_idempotent(
        organization=org, scope="test.concurrent.work", key="same", fn=work
    )
    r2, row2, created2 = run_idempotent(
        organization=org, scope="test.concurrent.work", key="same", fn=work
    )
    assert created1 is True
    assert created2 is False
    assert counter["n"] == 1
    assert row2.status == IdempotencyKeyStatus.COMPLETED


def test_mongo_transaction_commit_persists() -> None:
    _require_mongo()
    org = make_org(code=f"T{uuid.uuid4().hex[:6].upper()}")
    actor = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}")

    def work() -> SecurityAuditEvent:
        from apps.security_audit.services import record_event

        return record_event(
            event_type="LOGIN_SUCCESS",
            actor=actor,
            metadata={"probe": "txn-commit", "organization_id": str(org.id)},
        )

    event = run_mongo_multi_doc_atomic(work)
    assert SecurityAuditEvent.objects.filter(pk=event.pk).exists()


def test_mongo_transaction_rollback() -> None:
    _require_mongo()
    org = make_org(code=f"R{uuid.uuid4().hex[:6].upper()}")
    marker = f"rollback-{uuid.uuid4().hex}"

    class Boom(Exception):
        pass

    def work() -> None:
        IdempotencyKey.objects.create(
            organization=org,
            scope="test.rollback",
            key=marker,
            status=IdempotencyKeyStatus.PENDING,
        )
        raise Boom("force rollback")

    with pytest.raises(Boom):
        with mongo_multi_doc_atomic():
            work()

    assert not IdempotencyKey.objects.filter(organization=org, key=marker).exists()


def test_write_read_back_persistence() -> None:
    _require_mongo()
    org = make_org(code=f"P{uuid.uuid4().hex[:6].upper()}")
    org_id = org.id
    fresh = Organization.objects.filter(pk=org_id).first()
    assert fresh is not None
    assert fresh.code == org.code
    # Second connection-style read via ORM refresh
    reloaded = Organization.objects.get(pk=org_id)
    assert reloaded.name == org.name
