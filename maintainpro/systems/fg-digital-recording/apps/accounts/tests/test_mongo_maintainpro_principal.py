"""Non-destructive Mongo validation for MaintainPro principal projection fields.

Requires isolated mongo_test settings (never maintainpro_prod).
"""

from __future__ import annotations

import uuid

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection

from apps.accounts.sso import FgSsoClaims, project_maintainpro_principal
from apps.core.persistence import is_mongodb
from apps.security_audit.models import SecurityAuditEvent
from tests.factories import make_user

User = get_user_model()

pytestmark = pytest.mark.django_db


def _require_mongo() -> None:
    if not is_mongodb():
        pytest.skip("Mongo engine required")
    db = getattr(settings, "MONGODB_DATABASE", "") or settings.DATABASES["default"]["NAME"]
    assert db not in {"maintainpro_prod", "admin", "config", "local"}


def _claims(sub: str | None = None) -> FgSsoClaims:
    mp_id = sub or uuid.uuid4().hex[:24]
    return FgSsoClaims(
        sub=mp_id,
        email=f"{mp_id}@example.com",
        first_name="Mongo",
        last_name="Principal",
        tenant_id="tenant-1",
        role="ADMIN",
        permissions=("fg.access", "fg.recording.view"),
        jti=str(uuid.uuid4()),
        exp=2_000_000_000,
        iss="maintainpro",
        aud="fg-digital-recording",
    )


def test_mongo_schema_exposes_maintainpro_fields() -> None:
    _require_mongo()
    field_names = {f.name for f in User._meta.get_fields()}
    assert "maintainpro_user_id" in field_names
    assert "maintainpro_email" in field_names
    assert "maintainpro_synced_at" in field_names
    constraint_names = {c.name for c in User._meta.constraints}
    assert "acct_user_mp_id_uniq" in constraint_names


def test_mongo_jit_principal_create_update_and_unusable_password() -> None:
    _require_mongo()
    claims = _claims()
    first = project_maintainpro_principal(claims)
    assert first.maintainpro_user_id == claims.sub
    assert first.has_usable_password() is False
    assert first.employee_code is None

    claims2 = FgSsoClaims(
        sub=claims.sub,
        email="updated-" + claims.email,
        first_name="Updated",
        last_name="Name",
        tenant_id=claims.tenant_id,
        role=claims.role,
        permissions=claims.permissions,
        jti=str(uuid.uuid4()),
        exp=claims.exp,
        iss=claims.iss,
        aud=claims.aud,
    )
    second = project_maintainpro_principal(claims2)
    assert second.pk == first.pk
    assert User.objects.filter(maintainpro_user_id=claims.sub).count() == 1
    assert second.email.startswith("updated-")
    assert second.has_usable_password() is False


def test_mongo_duplicate_maintainpro_id_constraint() -> None:
    _require_mongo()
    mp_id = uuid.uuid4().hex[:24]
    project_maintainpro_principal(_claims(sub=mp_id))
    dup = User(
        username=f"dup_{mp_id}",
        email="dup@example.com",
        maintainpro_user_id=mp_id,
    )
    dup.set_unusable_password()
    with pytest.raises((ValidationError, IntegrityError, Exception)):
        dup.save()


def test_mongo_projected_principal_can_own_existing_style_audit_row() -> None:
    _require_mongo()
    db_name = settings.DATABASES["default"]["NAME"]
    before_collections = set(connection.connection[db_name].list_collection_names())
    claims = _claims()
    principal = project_maintainpro_principal(claims)
    event = SecurityAuditEvent.objects.create(
        event_type=SecurityAuditEvent.EventType.LOGIN_SUCCESS,
        actor=principal,
        subject_user=principal,
        metadata={"maintainpro_user_id": claims.sub},
    )
    assert event.actor_id == principal.pk
    after_collections = set(connection.connection[db_name].list_collection_names())
    assert before_collections.issubset(after_collections)


def test_mongo_legacy_local_user_still_creatable() -> None:
    _require_mongo()
    legacy = make_user(employee_code=f"L{uuid.uuid4().hex[:6].upper()}")
    assert legacy.maintainpro_user_id == ""
    assert User.objects.filter(pk=legacy.pk).exists()
