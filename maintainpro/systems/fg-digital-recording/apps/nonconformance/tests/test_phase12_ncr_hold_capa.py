"""Phase 12 — NCR / Hold / CAPA foundation tests."""

from __future__ import annotations

import inspect
import uuid
from datetime import date
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.capa.models import CorrectiveAction, CorrectiveActionStatus
from apps.capa.services import (
    add_capa_action_item,
    close_corrective_action,
    complete_capa_action_item,
    create_corrective_action,
    record_capa_effectiveness_review,
    record_capa_verification,
    transition_capa_status,
)
from apps.nonconformance.models import (
    HoldCase,
    NonConformanceRecord,
    NonConformanceSource,
    NonConformanceStatus,
    QualityCaseHistoryEntry,
    QualityCaseHistoryKind,
)
from apps.nonconformance.services import (
    close_hold_case,
    close_nonconformance,
    create_hold_case,
    create_nonconformance,
    transition_nonconformance_status,
    update_nonconformance_case_fields,
)
from apps.organizations.models import Organization
from apps.recording.models import ChecklistCorrection
from apps.security_audit.models import SecurityAuditEvent


def _perm(model: type[Any], codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _grant(user: User, org: Organization, model: type[Any], *codenames: str) -> None:
    suffix = uuid.uuid4().hex[:6].upper()
    role = make_role_with_permission(
        code=f"R{suffix}",
        name=f"Role {suffix}",
        permission=_perm(model, codenames[0]),
    )
    for code in codenames[1:]:
        role.permissions.add(_perm(model, code))
    grant_role(user, role, organization=org)


@pytest.mark.django_db
def test_ncr_lifecycle_and_history() -> None:
    org = make_org(code=f"N{uuid.uuid4().hex[:6].upper()}")
    actor = make_user(employee_code=f"A{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(
        actor,
        org,
        NonConformanceRecord,
        "create_nonconformance",
        "manage_nonconformance",
        "close_nonconformance",
        "view_nonconformancerecord",
    )
    ncr = create_nonconformance(
        actor=actor,
        organization=org,
        code=f"NC-{uuid.uuid4().hex[:6].upper()}",
        title="Test NCR",
        description="Desc",
        containment="Hold product pending investigation",
    )
    assert ncr.status == NonConformanceStatus.OPEN
    assert ncr.source == NonConformanceSource.MANUAL
    ncr = transition_nonconformance_status(
        actor=actor,
        nonconformance_id=ncr.id,
        to_status=NonConformanceStatus.INVESTIGATING,
        note="Started",
    )
    ncr = update_nonconformance_case_fields(
        actor=actor,
        nonconformance_id=ncr.id,
        investigation="Root cause TBD",
    )
    ncr = transition_nonconformance_status(
        actor=actor,
        nonconformance_id=ncr.id,
        to_status=NonConformanceStatus.VERIFICATION,
    )
    ncr = close_nonconformance(
        actor=actor, nonconformance_id=ncr.id, closure_notes="Closed after verify"
    )
    assert ncr.status == NonConformanceStatus.CLOSED
    assert ncr.closed_by_id == actor.id
    history = list(
        QualityCaseHistoryEntry.objects.filter(
            case_kind=QualityCaseHistoryKind.NONCONFORMANCE, case_id=ncr.id
        )
    )
    assert len(history) >= 4
    with pytest.raises(ValidationError):
        update_nonconformance_case_fields(actor=actor, nonconformance_id=ncr.id, description="nope")
    with pytest.raises(ValidationError):
        transition_nonconformance_status(
            actor=actor,
            nonconformance_id=ncr.id,
            to_status=NonConformanceStatus.OPEN,
        )
    assert SecurityAuditEvent.objects.filter(event_type="NONCONFORMANCE_CREATED").exists()
    assert SecurityAuditEvent.objects.filter(event_type="NONCONFORMANCE_CLOSED").exists()


@pytest.mark.django_db
def test_ncr_invalid_transition_and_duplicate_code() -> None:
    org = make_org(code=f"N{uuid.uuid4().hex[:6].upper()}")
    actor = make_user(employee_code=f"A{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(
        actor,
        org,
        NonConformanceRecord,
        "create_nonconformance",
        "manage_nonconformance",
        "close_nonconformance",
    )
    code = f"NC-{uuid.uuid4().hex[:6].upper()}"
    ncr = create_nonconformance(
        actor=actor, organization=org, code=code, title="One", description="d"
    )
    with pytest.raises(ValidationError):
        create_nonconformance(
            actor=actor, organization=org, code=code, title="Dup", description="d"
        )
    with pytest.raises(ValidationError):
        transition_nonconformance_status(
            actor=actor,
            nonconformance_id=ncr.id,
            to_status=NonConformanceStatus.VERIFICATION,
        )


@pytest.mark.django_db
def test_ncr_authorization_and_cross_org() -> None:
    org_a = make_org(code=f"A{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"B{uuid.uuid4().hex[:6].upper()}")
    actor_a = make_user(employee_code=f"AA{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    actor_b = make_user(employee_code=f"BB{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(actor_a, org_a, NonConformanceRecord, "create_nonconformance", "manage_nonconformance")
    _grant(actor_b, org_b, NonConformanceRecord, "create_nonconformance", "manage_nonconformance")
    ncr = create_nonconformance(
        actor=actor_a, organization=org_a, code="NC1", title="A", description="d"
    )
    with pytest.raises(PermissionDenied):
        transition_nonconformance_status(
            actor=actor_b,
            nonconformance_id=ncr.id,
            to_status=NonConformanceStatus.INVESTIGATING,
        )
    stranger = make_user(employee_code=f"S{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    with pytest.raises(PermissionDenied):
        create_nonconformance(
            actor=stranger, organization=org_a, code="NC2", title="X", description="d"
        )


@pytest.mark.django_db
def test_hold_case_lifecycle_and_free_text_resolution() -> None:
    org = make_org(code=f"H{uuid.uuid4().hex[:6].upper()}")
    actor = make_user(employee_code=f"A{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(
        actor,
        org,
        NonConformanceRecord,
        "create_nonconformance",
        "manage_nonconformance",
    )
    _grant(actor, org, HoldCase, "create_holdcase", "close_holdcase", "view_holdcase")
    ncr = create_nonconformance(
        actor=actor, organization=org, code="NC-H1", title="Linked", description="d"
    )
    hold = create_hold_case(
        actor=actor,
        organization=org,
        code="HOLD1",
        reason_reference="Pending investigation",
        scope="Batch opaque-ref",
        nonconformance_id=ncr.id,
    )
    assert hold.status == "OPEN"
    closed = close_hold_case(
        actor=actor,
        hold_case_id=hold.id,
        resolution="Released after QA review — free text, not an enum",
    )
    assert closed.status == "CLOSED"
    assert "enum" in closed.resolution
    assert QualityCaseHistoryEntry.objects.filter(
        case_kind=QualityCaseHistoryKind.HOLD, case_id=hold.id
    ).exists()
    with pytest.raises(ValidationError):
        create_hold_case(
            actor=actor,
            organization=org,
            code="HOLD1",
            reason_reference="again",
        )


@pytest.mark.django_db
def test_capa_actions_verification_effectiveness_closure() -> None:
    org = make_org(code=f"C{uuid.uuid4().hex[:6].upper()}")
    actor = make_user(employee_code=f"A{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(
        actor,
        org,
        NonConformanceRecord,
        "create_nonconformance",
        "manage_nonconformance",
    )
    _grant(
        actor,
        org,
        CorrectiveAction,
        "create_capa",
        "manage_capa",
        "close_capa",
        "view_correctiveaction",
    )
    ncr = create_nonconformance(
        actor=actor, organization=org, code="NC-C1", title="NCR", description="d"
    )
    capa = create_corrective_action(
        actor=actor,
        organization=org,
        code="CA1",
        title="CAPA",
        nonconformance_id=ncr.id,
        owner_id=actor.id,
    )
    item = add_capa_action_item(
        actor=actor,
        capa_id=capa.id,
        description="Retrain operators",
        owner_id=actor.id,
        due_date=date(2026, 12, 31),
    )
    complete_capa_action_item(actor=actor, action_item_id=item.id)
    item.refresh_from_db()
    assert item.status == "DONE"
    capa = record_capa_verification(actor=actor, capa_id=capa.id, notes="Verified")
    assert capa.status == CorrectiveActionStatus.VERIFICATION
    capa = record_capa_effectiveness_review(
        actor=actor, capa_id=capa.id, notes="Effective enough for close"
    )
    assert capa.status == CorrectiveActionStatus.EFFECTIVENESS_REVIEW
    capa = close_corrective_action(actor=actor, capa_id=capa.id, closure_notes="Human closure")
    assert capa.status == CorrectiveActionStatus.CLOSED
    assert capa.closed_by_id == actor.id
    with pytest.raises(ValidationError):
        add_capa_action_item(actor=actor, capa_id=capa.id, description="late")
    assert SecurityAuditEvent.objects.filter(event_type="CAPA_CLOSED").exists()


@pytest.mark.django_db
def test_capa_cross_org_link_integrity() -> None:
    org_a = make_org(code=f"A{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"B{uuid.uuid4().hex[:6].upper()}")
    actor_a = make_user(employee_code=f"AA{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    actor_b = make_user(employee_code=f"BB{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(actor_a, org_a, NonConformanceRecord, "create_nonconformance", "manage_nonconformance")
    _grant(actor_b, org_b, NonConformanceRecord, "create_nonconformance", "manage_nonconformance")
    _grant(actor_a, org_a, CorrectiveAction, "create_capa", "manage_capa")
    ncr_b = create_nonconformance(
        actor=actor_b, organization=org_b, code="NC-B", title="B", description="d"
    )
    with pytest.raises(ValidationError):
        create_corrective_action(
            actor=actor_a,
            organization=org_a,
            code="CA-X",
            title="Bad link",
            nonconformance_id=ncr_b.id,
        )


@pytest.mark.django_db
def test_checklist_correction_not_ncr_and_no_auto_raise_hook() -> None:
    field_names = {f.name for f in ChecklistCorrection._meta.get_fields()}
    assert "nonconformance" not in field_names

    from apps.quality import services as quality_services
    from apps.recording import evaluation_runtime

    quality_src = inspect.getsource(quality_services)
    assert "create_nonconformance" not in quality_src
    assert "create_hold_case" not in quality_src
    eval_src = inspect.getsource(evaluation_runtime)
    assert "create_nonconformance" not in eval_src
    assert "HoldCase" not in eval_src


@pytest.mark.django_db
def test_separate_close_permission_for_ncr() -> None:
    org = make_org(code=f"P{uuid.uuid4().hex[:6].upper()}")
    creator = make_user(employee_code=f"C{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    closer = make_user(employee_code=f"K{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(creator, org, NonConformanceRecord, "create_nonconformance", "manage_nonconformance")
    _grant(closer, org, NonConformanceRecord, "close_nonconformance")
    ncr = create_nonconformance(
        actor=creator, organization=org, code="NC-P", title="Perm", description="d"
    )
    closed = close_nonconformance(actor=creator, nonconformance_id=ncr.id)
    assert closed.status == NonConformanceStatus.CLOSED

    ncr2 = create_nonconformance(
        actor=creator, organization=org, code="NC-P2", title="Perm2", description="d"
    )
    closed2 = close_nonconformance(actor=closer, nonconformance_id=ncr2.id)
    assert closed2.status == NonConformanceStatus.CLOSED


@pytest.mark.django_db
def test_capa_invalid_transition() -> None:
    org = make_org(code=f"T{uuid.uuid4().hex[:6].upper()}")
    actor = make_user(employee_code=f"A{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(actor, org, CorrectiveAction, "create_capa", "manage_capa", "close_capa")
    capa = create_corrective_action(actor=actor, organization=org, code="CA-T", title="T")
    with pytest.raises(ValidationError):
        transition_capa_status(
            actor=actor,
            capa_id=capa.id,
            to_status=CorrectiveActionStatus.EFFECTIVENESS_REVIEW,
        )


@pytest.mark.django_db
def test_selectors_list_cases() -> None:
    from apps.capa.selectors import list_capa_history, list_corrective_actions_for_org
    from apps.nonconformance.selectors import (
        list_case_history,
        list_hold_cases_for_org,
        list_nonconformances_for_org,
    )

    org = make_org(code=f"L{uuid.uuid4().hex[:6].upper()}")
    actor = make_user(employee_code=f"A{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(
        actor,
        org,
        NonConformanceRecord,
        "create_nonconformance",
        "manage_nonconformance",
        "view_nonconformancerecord",
    )
    _grant(actor, org, HoldCase, "create_holdcase", "view_holdcase", "manage_holdcase")
    _grant(
        actor,
        org,
        CorrectiveAction,
        "create_capa",
        "manage_capa",
        "view_correctiveaction",
    )
    ncr = create_nonconformance(
        actor=actor, organization=org, code="NC-L", title="L", description="d"
    )
    hold = create_hold_case(actor=actor, organization=org, code="H-L", reason_reference="r")
    capa = create_corrective_action(actor=actor, organization=org, code="CA-L", title="L")
    assert (
        list_nonconformances_for_org(actor=actor, organization_id=org.id).filter(pk=ncr.id).exists()
    )
    assert list_hold_cases_for_org(actor=actor, organization_id=org.id).filter(pk=hold.id).exists()
    assert (
        list_corrective_actions_for_org(actor=actor, organization_id=org.id)
        .filter(pk=capa.id)
        .exists()
    )
    assert list_case_history(
        organization_id=org.id,
        case_kind=QualityCaseHistoryKind.NONCONFORMANCE,
        case_id=ncr.id,
    ).exists()
    assert list_capa_history(capa_id=capa.id).exists()
    stranger = make_user(employee_code=f"Z{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    assert list_nonconformances_for_org(actor=stranger, organization_id=org.id).count() == 0
