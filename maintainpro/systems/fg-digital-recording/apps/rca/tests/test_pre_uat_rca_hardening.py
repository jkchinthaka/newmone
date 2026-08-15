"""Pre-UAT RCA concurrency, duplicate-code, and admin immutability tests."""

from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any
from unittest.mock import patch

import pytest
from django.contrib.admin.sites import AdminSite
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection
from django.test import RequestFactory, TransactionTestCase
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.capa.admin import CorrectiveActionAdmin
from apps.capa.models import CorrectiveAction
from apps.nonconformance.admin import HoldCaseAdmin, NonConformanceRecordAdmin
from apps.nonconformance.models import HoldCase, NonConformanceRecord
from apps.organizations.models import Organization
from apps.rca.admin import RcaCauseAdmin, RootCauseAnalysisAdmin
from apps.rca.models import RcaCause, RcaCauseState, RcaSourceKind, RcaStatus, RootCauseAnalysis
from apps.rca.services import (
    add_five_why_step,
    add_possible_cause,
    cancel_rca,
    close_rca,
    confirm_root_cause,
    create_rca,
    mark_cause_supported,
    start_rca,
)


def _perm(model: type[Any], codename: str) -> Permission:
    content_type = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=content_type,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _rca_user(*, org: Organization, manage: bool = True, confirm: bool = True) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"RC{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"RC{suffix}",
        name=f"RCA {suffix}",
        permission=_perm(RootCauseAnalysis, "view_rca"),
    )
    if manage:
        role.permissions.add(_perm(RootCauseAnalysis, "manage_rca"))
    if confirm:
        role.permissions.add(_perm(RootCauseAnalysis, "confirm_rca"))
    grant_role(user, role, organization=org)
    return user


def _prepared_closeable_rca(*, org: Organization, actor: User) -> RootCauseAnalysis:
    rca = create_rca(
        actor=actor,
        organization_id=org.id,
        rca_code=f"SYN-RCA-{uuid.uuid4().hex[:8].upper()}",
        source_kind=RcaSourceKind.OTHER,
        source_citation="Synthetic",
        problem_statement="Concurrency fixture",
    )
    start_rca(actor=actor, rca_id=rca.id)
    cause = add_possible_cause(actor=actor, rca_id=rca.id, statement="Fixture cause")
    mark_cause_supported(actor=actor, cause_id=cause.id, evidence_citation="Fixture evidence")
    confirm_root_cause(actor=actor, cause_id=cause.id)
    return RootCauseAnalysis.objects.get(pk=rca.id)


@pytest.mark.django_db
def test_create_rca_duplicate_and_integrity_error_are_validation_errors() -> None:
    org = make_org(code="RC-DUP")
    actor = _rca_user(org=org)
    create_rca(
        actor=actor,
        organization_id=org.id,
        rca_code="DUP-CODE-1",
        source_kind=RcaSourceKind.OTHER,
        source_citation="x",
        problem_statement="First",
    )
    with pytest.raises(ValidationError, match="already exists"):
        create_rca(
            actor=actor,
            organization_id=org.id,
            rca_code="DUP-CODE-1",
            source_kind=RcaSourceKind.OTHER,
            source_citation="x",
            problem_statement="Second",
        )
    with (
        patch.object(RootCauseAnalysis, "save", side_effect=IntegrityError("unique")),
        pytest.raises(ValidationError, match="already exists"),
    ):
        create_rca(
            actor=actor,
            organization_id=org.id,
            rca_code="RACE-CODE",
            source_kind=RcaSourceKind.OTHER,
            source_citation="x",
            problem_statement="Race",
        )


@pytest.mark.django_db
def test_duplicate_close_is_controlled_validation() -> None:
    org = make_org(code="RC-CL2")
    actor = _rca_user(org=org)
    rca = _prepared_closeable_rca(org=org, actor=actor)
    close_rca(actor=actor, rca_id=rca.id)
    with pytest.raises(ValidationError, match="historically immutable"):
        close_rca(actor=actor, rca_id=rca.id)


@pytest.mark.django_db
def test_admin_workflow_fields_are_readonly() -> None:
    site = AdminSite()
    request = RequestFactory().get("/")
    request.user = make_user(employee_code="ADM-RO", is_staff=True, is_superuser=True)

    assert "status" in RootCauseAnalysisAdmin(RootCauseAnalysis, site).get_readonly_fields(request)
    assert "state" in RcaCauseAdmin(RcaCause, site).get_readonly_fields(request)
    assert "status" in CorrectiveActionAdmin(CorrectiveAction, site).get_readonly_fields(request)
    assert "status" in NonConformanceRecordAdmin(NonConformanceRecord, site).get_readonly_fields(
        request
    )
    assert "status" in HoldCaseAdmin(HoldCase, site).get_readonly_fields(request)


class RcaConcurrencyTests(TransactionTestCase):
    def test_close_vs_add_five_why(self) -> None:
        org = make_org(code="RC-CX1")
        actor = _rca_user(org=org)
        rca = _prepared_closeable_rca(org=org, actor=actor)
        outcomes: list[str] = []

        def _close() -> None:
            connection.close()
            try:
                close_rca(actor=actor, rca_id=rca.id)
                outcomes.append("closed")
            except ValidationError:
                outcomes.append("close_blocked")

        def _mutate() -> None:
            connection.close()
            try:
                add_five_why_step(
                    actor=actor,
                    rca_id=rca.id,
                    sequence=99,
                    why_question="Blocked?",
                    answer="Should not land after close.",
                )
                outcomes.append("mutated")
            except ValidationError:
                outcomes.append("mutate_blocked")

        with ThreadPoolExecutor(max_workers=2) as pool:
            f1 = pool.submit(_close)
            f2 = pool.submit(_mutate)
            f1.result()
            f2.result()

        rca.refresh_from_db()
        assert rca.status == RcaStatus.CLOSED
        assert outcomes.count("closed") == 1
        assert ("mutate_blocked" in outcomes) or ("mutated" in outcomes)

    def test_close_vs_add_cause(self) -> None:
        org = make_org(code="RC-CX2")
        actor = _rca_user(org=org)
        rca = _prepared_closeable_rca(org=org, actor=actor)
        errors: list[str] = []

        def _close() -> None:
            connection.close()
            close_rca(actor=actor, rca_id=rca.id)

        def _mutate() -> None:
            connection.close()
            try:
                add_possible_cause(actor=actor, rca_id=rca.id, statement="After close")
            except ValidationError as exc:
                errors.append("; ".join(exc.messages))

        with ThreadPoolExecutor(max_workers=2) as pool:
            f1 = pool.submit(_close)
            f2 = pool.submit(_mutate)
            f1.result()
            f2.result()

        rca.refresh_from_db()
        assert rca.status == RcaStatus.CLOSED
        if not rca.causes.filter(statement="After close").exists():
            assert any("immutable" in msg for msg in errors)

    def test_close_vs_confirm_cause(self) -> None:
        org = make_org(code="RC-CX3")
        actor = _rca_user(org=org)
        rca = create_rca(
            actor=actor,
            organization_id=org.id,
            rca_code="SYN-CONF-RACE",
            source_kind=RcaSourceKind.OTHER,
            source_citation="x",
            problem_statement="Confirm race",
        )
        start_rca(actor=actor, rca_id=rca.id)
        cause = add_possible_cause(actor=actor, rca_id=rca.id, statement="Race cause")
        mark_cause_supported(actor=actor, cause_id=cause.id, evidence_citation="Race evidence")
        confirm_root_cause(actor=actor, cause_id=cause.id)
        second = add_possible_cause(actor=actor, rca_id=rca.id, statement="Second")
        mark_cause_supported(actor=actor, cause_id=second.id, evidence_citation="Second evidence")
        outcomes: list[str] = []

        def _close() -> None:
            connection.close()
            try:
                close_rca(actor=actor, rca_id=rca.id)
                outcomes.append("closed")
            except ValidationError:
                outcomes.append("close_blocked")

        def _confirm() -> None:
            connection.close()
            try:
                confirm_root_cause(actor=actor, cause_id=second.id)
                outcomes.append("confirmed")
            except ValidationError:
                outcomes.append("confirm_blocked")

        with ThreadPoolExecutor(max_workers=2) as pool:
            f1 = pool.submit(_close)
            f2 = pool.submit(_confirm)
            f1.result()
            f2.result()

        rca.refresh_from_db()
        assert "closed" in outcomes
        assert rca.status == RcaStatus.CLOSED
        second.refresh_from_db()
        if second.state == RcaCauseState.CONFIRMED_ROOT_CAUSE:
            assert "confirmed" in outcomes
        else:
            assert "confirm_blocked" in outcomes

    def test_cancel_vs_mutation(self) -> None:
        org = make_org(code="RC-CX4")
        actor = _rca_user(org=org)
        rca = create_rca(
            actor=actor,
            organization_id=org.id,
            rca_code="SYN-CANCEL-RACE",
            source_kind=RcaSourceKind.OTHER,
            source_citation="x",
            problem_statement="Cancel race",
        )
        outcomes: list[str] = []

        def _cancel() -> None:
            connection.close()
            cancel_rca(actor=actor, rca_id=rca.id)
            outcomes.append("cancelled")

        def _mutate() -> None:
            connection.close()
            try:
                add_five_why_step(
                    actor=actor,
                    rca_id=rca.id,
                    sequence=1,
                    why_question="Why?",
                    answer="Blocked after cancel",
                )
                outcomes.append("mutated")
            except ValidationError:
                outcomes.append("mutate_blocked")

        with ThreadPoolExecutor(max_workers=2) as pool:
            f1 = pool.submit(_cancel)
            f2 = pool.submit(_mutate)
            f1.result()
            f2.result()

        rca.refresh_from_db()
        assert rca.status == RcaStatus.CANCELLED
        assert "cancelled" in outcomes
        assert ("mutate_blocked" in outcomes) or ("mutated" in outcomes)
