"""Concurrency tests for CAPA status CAS (close / verification / mutation)."""

from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import connection
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.capa.models import CorrectiveAction, CorrectiveActionStatus
from apps.capa.services import (
    add_capa_action_item,
    close_corrective_action,
    create_corrective_action,
    record_capa_verification,
    transition_capa_status,
)
from apps.core.db_namespace import restore_postgresql_table_names
from apps.organizations.models import Organization

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture(autouse=True)
def _ensure_pg_table_names() -> None:
    restore_postgresql_table_names()


def _perm(model: type, codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _actor(org: Organization) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"CAP{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"RCAP{suffix}",
        name=f"CAPA {suffix}",
        permission=_perm(CorrectiveAction, "create_capa"),
    )
    role.permissions.add(_perm(CorrectiveAction, "manage_capa"))
    role.permissions.add(_perm(CorrectiveAction, "close_capa"))
    role.permissions.add(_perm(CorrectiveAction, "view_correctiveaction"))
    grant_role(user, role, organization=org)
    return user


def test_duplicate_close_is_idempotent() -> None:
    org = make_org(code=f"CC{uuid.uuid4().hex[:6].upper()}")
    actor = _actor(org)
    capa = create_corrective_action(
        actor=actor, organization=org, code="CA-DUP", title="Close race"
    )

    def _close() -> str:
        connection.close()
        closed = close_corrective_action(actor=actor, capa_id=capa.id, closure_notes="done")
        return closed.status

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = [f.result() for f in as_completed([pool.submit(_close) for _ in range(4)])]

    assert set(results) == {CorrectiveActionStatus.CLOSED}
    assert (
        CorrectiveAction.objects.filter(pk=capa.pk, status=CorrectiveActionStatus.CLOSED).count()
        == 1
    )


def test_verification_vs_close() -> None:
    org = make_org(code=f"CV{uuid.uuid4().hex[:6].upper()}")
    actor = _actor(org)
    capa = create_corrective_action(
        actor=actor, organization=org, code="CA-VER", title="Verify race"
    )
    transition_capa_status(
        actor=actor, capa_id=capa.id, to_status=CorrectiveActionStatus.IN_PROGRESS
    )

    def _verify() -> str:
        connection.close()
        try:
            record_capa_verification(actor=actor, capa_id=capa.id, notes="ok")
            return "VERIFIED"
        except ValidationError:
            return "BLOCKED"

    def _close() -> str:
        connection.close()
        closed = close_corrective_action(actor=actor, capa_id=capa.id, closure_notes="closed")
        return closed.status

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = {f.result() for f in as_completed([pool.submit(_verify), pool.submit(_close)])}

    capa.refresh_from_db()
    assert capa.status == CorrectiveActionStatus.CLOSED
    assert CorrectiveActionStatus.CLOSED in outcomes
    with pytest.raises(ValidationError):
        add_capa_action_item(actor=actor, capa_id=capa.id, description="late")
