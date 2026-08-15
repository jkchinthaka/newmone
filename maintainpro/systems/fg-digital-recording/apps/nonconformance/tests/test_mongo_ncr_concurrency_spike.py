"""Concurrency tests for NCR / Hold CAS close and immutable updates."""

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
from apps.core.db_namespace import restore_postgresql_table_names
from apps.nonconformance.models import HoldCase, NonConformanceRecord, NonConformanceStatus
from apps.nonconformance.services import (
    close_hold_case,
    close_nonconformance,
    create_hold_case,
    create_nonconformance,
    update_nonconformance_case_fields,
)
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


def _ncr_actor(org: Organization) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"NCR{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"RNCR{suffix}",
        name=f"NCR {suffix}",
        permission=_perm(NonConformanceRecord, "create_nonconformance"),
    )
    role.permissions.add(_perm(NonConformanceRecord, "manage_nonconformance"))
    role.permissions.add(_perm(NonConformanceRecord, "close_nonconformance"))
    role.permissions.add(_perm(NonConformanceRecord, "view_nonconformancerecord"))
    role.permissions.add(_perm(HoldCase, "create_holdcase"))
    role.permissions.add(_perm(HoldCase, "manage_holdcase"))
    role.permissions.add(_perm(HoldCase, "close_holdcase"))
    grant_role(user, role, organization=org)
    return user


def test_duplicate_ncr_close_idempotent() -> None:
    org = make_org(code=f"NC{uuid.uuid4().hex[:6].upper()}")
    actor = _ncr_actor(org)
    ncr = create_nonconformance(
        actor=actor, organization=org, code="NC-RACE", title="Race", description="d"
    )

    def _close() -> str:
        connection.close()
        closed = close_nonconformance(actor=actor, nonconformance_id=ncr.id, closure_notes="x")
        return closed.status

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = [f.result() for f in as_completed([pool.submit(_close) for _ in range(4)])]

    assert set(results) == {NonConformanceStatus.CLOSED}
    assert NonConformanceRecord.objects.filter(pk=ncr.pk).count() == 1


def test_update_vs_close_closed_immutable() -> None:
    org = make_org(code=f"NU{uuid.uuid4().hex[:6].upper()}")
    actor = _ncr_actor(org)
    ncr = create_nonconformance(
        actor=actor, organization=org, code="NC-UPD", title="Update race", description="d"
    )

    def _update() -> str:
        connection.close()
        try:
            update_nonconformance_case_fields(
                actor=actor, nonconformance_id=ncr.id, investigation="late"
            )
            return "UPDATED"
        except ValidationError:
            return "BLOCKED"

    def _close() -> str:
        connection.close()
        close_nonconformance(actor=actor, nonconformance_id=ncr.id, closure_notes="closed")
        return "CLOSED"

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = {f.result() for f in as_completed([pool.submit(_update), pool.submit(_close)])}

    ncr.refresh_from_db()
    assert ncr.status == NonConformanceStatus.CLOSED
    assert "CLOSED" in outcomes
    with pytest.raises(ValidationError):
        update_nonconformance_case_fields(
            actor=actor, nonconformance_id=ncr.id, investigation="after close"
        )


def test_hold_close_vs_close() -> None:
    org = make_org(code=f"NH{uuid.uuid4().hex[:6].upper()}")
    actor = _ncr_actor(org)
    hold = create_hold_case(
        actor=actor,
        organization=org,
        code=f"H{uuid.uuid4().hex[:6].upper()}",
        reason_reference="Pending",
        scope="Batch",
    )

    def _close() -> str:
        connection.close()
        closed = close_hold_case(actor=actor, hold_case_id=hold.id, resolution="released")
        return closed.status

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = [f.result() for f in as_completed([pool.submit(_close) for _ in range(4)])]

    assert set(results) == {"CLOSED"}
    hold.refresh_from_db()
    assert hold.status == "CLOSED"
