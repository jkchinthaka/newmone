"""Phase 32 — supplier quality foundation tests."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.utils import timezone
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.capa.models import CorrectiveAction
from apps.capa.services import close_corrective_action, create_corrective_action
from apps.nonconformance.models import NonConformanceRecord
from apps.nonconformance.services import create_nonconformance
from apps.organizations.models import Organization
from apps.supplier_quality.models import (
    SupplierCertificate,
    SupplierQualityEventKind,
    SupplierQualityProfile,
)
from apps.supplier_quality.selectors import list_supplier_quality_profiles
from apps.supplier_quality.services import (
    add_supplier_certificate,
    build_supplier_quality_metrics,
    certificate_is_expired,
    create_supplier_quality_profile,
    record_supplier_quality_event,
    verify_supplier_certificate,
)


def _perm(model: type[Any], codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _qa_user(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"SQQA{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"SQQA{suffix}",
        name=f"Supplier QA {suffix}",
        permission=_perm(SupplierQualityProfile, "manage_supplierquality_qa"),
    )
    role.permissions.add(_perm(SupplierQualityProfile, "view_supplierqualityprofile"))
    role.permissions.add(_perm(NonConformanceRecord, "create_nonconformance"))
    role.permissions.add(_perm(NonConformanceRecord, "manage_nonconformance"))
    role.permissions.add(_perm(NonConformanceRecord, "close_nonconformance"))
    role.permissions.add(_perm(NonConformanceRecord, "view_nonconformancerecord"))
    role.permissions.add(_perm(CorrectiveAction, "create_capa"))
    role.permissions.add(_perm(CorrectiveAction, "manage_capa"))
    role.permissions.add(_perm(CorrectiveAction, "close_capa"))
    role.permissions.add(_perm(CorrectiveAction, "view_correctiveaction"))
    grant_role(user, role, organization=org)
    return user


def _procurement_user(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"SQPR{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"SQPR{suffix}",
        name=f"Procurement {suffix}",
        permission=_perm(SupplierQualityProfile, "view_supplierquality_procurement"),
    )
    grant_role(user, role, organization=org)
    return user


@pytest.mark.django_db
def test_supplier_profile_erp_ref_isolation_and_permissions() -> None:
    org_a = make_org(code=f"SQA{uuid.uuid4().hex[:5].upper()}")
    org_b = make_org(code=f"SQB{uuid.uuid4().hex[:5].upper()}")
    qa_a = _qa_user(org=org_a)
    qa_b = _qa_user(org=org_b)
    procurement_a = _procurement_user(org=org_a)

    profile = create_supplier_quality_profile(
        actor=qa_a,
        organization=org_a,
        erp_supplier_reference="ERP-SUP-100",
        display_name="Label only",
    )
    assert profile.erp_supplier_reference == "ERP-SUP-100"
    assert (
        list_supplier_quality_profiles(actor=procurement_a, organization_id=org_a.id).count() == 1
    )

    with pytest.raises(ValidationError):
        create_supplier_quality_profile(
            actor=qa_a,
            organization=org_a,
            erp_supplier_reference="erp-sup-100",
        )

    # Same ERP ref allowed in another org (isolation by organization).
    create_supplier_quality_profile(
        actor=qa_b,
        organization=org_b,
        erp_supplier_reference="ERP-SUP-100",
    )

    with pytest.raises(PermissionDenied):
        create_supplier_quality_profile(
            actor=procurement_a,
            organization=org_a,
            erp_supplier_reference="ERP-SUP-200",
        )

    with pytest.raises(PermissionDenied):
        list_supplier_quality_profiles(actor=qa_a, organization_id=org_b.id)


@pytest.mark.django_db
def test_certificate_expiry_and_verification() -> None:
    org = make_org(code=f"SQC{uuid.uuid4().hex[:5].upper()}")
    qa = _qa_user(org=org)
    procurement = _procurement_user(org=org)
    profile = create_supplier_quality_profile(
        actor=qa, organization=org, erp_supplier_reference="ERP-CERT-1"
    )
    today = timezone.localdate()
    expired = add_supplier_certificate(
        actor=qa,
        profile_id=profile.id,
        certificate_type="CUSTOM-TYPE-A",
        issued_on=today - timedelta(days=40),
        expires_on=today - timedelta(days=1),
        evidence_object_key="object-store/key/cert-a",
    )
    valid = add_supplier_certificate(
        actor=qa,
        profile_id=profile.id,
        certificate_type="CUSTOM-TYPE-B",
        issued_on=today - timedelta(days=1),
        expires_on=today + timedelta(days=30),
    )
    assert certificate_is_expired(expired, as_of=today) is True
    assert certificate_is_expired(valid, as_of=today) is False

    with pytest.raises(ValidationError):
        add_supplier_certificate(
            actor=qa,
            profile_id=profile.id,
            certificate_type="BAD-DATES",
            issued_on=today,
            expires_on=today - timedelta(days=1),
        )

    with pytest.raises(PermissionDenied):
        verify_supplier_certificate(actor=procurement, certificate_id=valid.id)

    verified = verify_supplier_certificate(
        actor=qa, certificate_id=valid.id, verification_note="Checked against evidence key"
    )
    assert verified.verified_by_id == qa.id
    assert verified.verified_at is not None


@pytest.mark.django_db
def test_ncr_capa_links_and_metrics_without_scores() -> None:
    org = make_org(code=f"SQN{uuid.uuid4().hex[:5].upper()}")
    qa = _qa_user(org=org)
    profile = create_supplier_quality_profile(
        actor=qa, organization=org, erp_supplier_reference="ERP-NCR-1"
    )
    ncr = create_nonconformance(actor=qa, organization=org, code="NCR-1", title="Incoming defect")
    capa = create_corrective_action(
        actor=qa,
        organization=org,
        code="CAPA-1",
        title="Supplier containment",
        nonconformance_id=ncr.id,
    )
    record_supplier_quality_event(
        actor=qa,
        profile_id=profile.id,
        event_kind=SupplierQualityEventKind.INCOMING_DEFECT,
        occurred_at=timezone.now(),
        summary="Defect recorded against ERP supplier ref",
        nonconformance_id=ncr.id,
        corrective_action_id=capa.id,
    )
    add_supplier_certificate(
        actor=qa,
        profile_id=profile.id,
        certificate_type="TYPE-X",
        expires_on=date(2000, 1, 1),
    )

    metrics = build_supplier_quality_metrics(actor=qa, profile_id=profile.id, as_of=date.today())
    assert metrics["certificate_count"] == 1
    assert metrics["expired_certificate_count"] == 1
    assert metrics["incoming_defect_count"] == 1
    assert metrics["linked_open_ncr_count"] == 1
    assert metrics["linked_open_capa_count"] == 1
    assert "score" not in metrics
    assert "threshold" not in metrics
    assert "grade" not in metrics

    close_corrective_action(actor=qa, capa_id=capa.id)
    metrics_after = build_supplier_quality_metrics(actor=qa, profile_id=profile.id)
    assert metrics_after["linked_open_capa_count"] == 0


@pytest.mark.django_db
def test_cross_org_ncr_link_rejected_and_no_hard_delete_admin() -> None:
    from django.contrib.admin.sites import AdminSite
    from django.test import RequestFactory

    from apps.supplier_quality.admin import SupplierQualityProfileAdmin

    org_a = make_org(code=f"SQX{uuid.uuid4().hex[:5].upper()}")
    org_b = make_org(code=f"SQY{uuid.uuid4().hex[:5].upper()}")
    qa_a = _qa_user(org=org_a)
    qa_b = _qa_user(org=org_b)
    profile_a = create_supplier_quality_profile(
        actor=qa_a, organization=org_a, erp_supplier_reference="ERP-X"
    )
    ncr_b = create_nonconformance(actor=qa_b, organization=org_b, code="NCR-B", title="Foreign NCR")
    with pytest.raises(ValidationError):
        record_supplier_quality_event(
            actor=qa_a,
            profile_id=profile_a.id,
            event_kind=SupplierQualityEventKind.OTHER,
            occurred_at=timezone.now(),
            summary="cross-org attempt",
            nonconformance_id=ncr_b.id,
        )

    admin = SupplierQualityProfileAdmin(SupplierQualityProfile, AdminSite())
    request = RequestFactory().get("/admin/")
    request.user = qa_a
    assert admin.has_delete_permission(request) is False


@pytest.mark.django_db
def test_procurement_can_view_metrics_not_manage() -> None:
    org = make_org(code=f"SQP{uuid.uuid4().hex[:5].upper()}")
    qa = _qa_user(org=org)
    procurement = _procurement_user(org=org)
    profile = create_supplier_quality_profile(
        actor=qa, organization=org, erp_supplier_reference="ERP-P"
    )
    metrics = build_supplier_quality_metrics(actor=procurement, profile_id=profile.id)
    assert metrics["certificate_count"] == 0
    with pytest.raises(PermissionDenied):
        add_supplier_certificate(
            actor=procurement,
            profile_id=profile.id,
            certificate_type="TYPE-Z",
        )


@pytest.mark.django_db
def test_certificate_model_rejects_blank_type() -> None:
    org = make_org(code=f"SQT{uuid.uuid4().hex[:5].upper()}")
    qa = _qa_user(org=org)
    profile = create_supplier_quality_profile(
        actor=qa, organization=org, erp_supplier_reference="ERP-T"
    )
    with pytest.raises(ValidationError):
        add_supplier_certificate(actor=qa, profile_id=profile.id, certificate_type="  ")
    assert SupplierCertificate.objects.filter(profile=profile).count() == 0


@pytest.mark.django_db
def test_update_profile_and_selectors() -> None:
    from apps.supplier_quality.selectors import (
        get_supplier_quality_profile,
        list_supplier_certificates,
    )
    from apps.supplier_quality.services import update_supplier_quality_profile

    org = make_org(code=f"SQU{uuid.uuid4().hex[:5].upper()}")
    qa = _qa_user(org=org)
    profile = create_supplier_quality_profile(
        actor=qa, organization=org, erp_supplier_reference="ERP-U"
    )
    updated = update_supplier_quality_profile(
        actor=qa,
        profile_id=profile.id,
        display_name="Updated label",
        quality_status="UNDER-REVIEW-LABEL",
        notes="note",
        is_active=False,
    )
    assert updated.display_name == "Updated label"
    assert updated.quality_status == "UNDER-REVIEW-LABEL"
    assert updated.is_active is False
    fetched = get_supplier_quality_profile(actor=qa, profile_id=profile.id)
    assert fetched.id == profile.id
    add_supplier_certificate(actor=qa, profile_id=profile.id, certificate_type="TYPE-U")
    assert list_supplier_certificates(actor=qa, profile_id=profile.id).count() == 1
    with pytest.raises(ValidationError):
        get_supplier_quality_profile(actor=qa, profile_id=uuid.uuid4())


@pytest.mark.django_db
def test_audit_events_audit_complaint_and_capa_cross_org() -> None:
    from apps.capa.services import create_corrective_action
    from apps.security_audit.models import SecurityAuditEvent

    org_a = make_org(code=f"SQZ{uuid.uuid4().hex[:5].upper()}")
    org_b = make_org(code=f"SQW{uuid.uuid4().hex[:5].upper()}")
    qa_a = _qa_user(org=org_a)
    qa_b = _qa_user(org=org_b)
    profile = create_supplier_quality_profile(
        actor=qa_a, organization=org_a, erp_supplier_reference="ERP-AUD"
    )
    assert SecurityAuditEvent.objects.filter(event_type="SUPPLIER_QUALITY_PROFILE_CREATED").exists()

    with pytest.raises(ValidationError):
        create_supplier_quality_profile(actor=qa_a, organization=org_a, erp_supplier_reference="  ")
    with pytest.raises(ValidationError):
        record_supplier_quality_event(
            actor=qa_a,
            profile_id=profile.id,
            event_kind="NOT_A_KIND",
            occurred_at=timezone.now(),
            summary="bad kind",
        )
    with pytest.raises(ValidationError):
        record_supplier_quality_event(
            actor=qa_a,
            profile_id=profile.id,
            event_kind=SupplierQualityEventKind.AUDIT,
            occurred_at=timezone.now(),
            summary="   ",
        )

    record_supplier_quality_event(
        actor=qa_a,
        profile_id=profile.id,
        event_kind=SupplierQualityEventKind.AUDIT,
        occurred_at=timezone.now(),
        summary="Supplier audit shell",
    )
    record_supplier_quality_event(
        actor=qa_a,
        profile_id=profile.id,
        event_kind=SupplierQualityEventKind.COMPLAINT,
        occurred_at=timezone.now(),
        summary="Complaint shell",
    )
    assert (
        SecurityAuditEvent.objects.filter(event_type="SUPPLIER_QUALITY_EVENT_RECORDED").count() >= 2
    )

    capa_b = create_corrective_action(
        actor=qa_b,
        organization=org_b,
        code="CAPA-B",
        title="Foreign CAPA",
    )
    with pytest.raises(ValidationError):
        record_supplier_quality_event(
            actor=qa_a,
            profile_id=profile.id,
            event_kind=SupplierQualityEventKind.OTHER,
            occurred_at=timezone.now(),
            summary="cross-org capa",
            corrective_action_id=capa_b.id,
        )

    cert = add_supplier_certificate(
        actor=qa_a,
        profile_id=profile.id,
        certificate_type="TYPE-AUD",
    )
    assert SecurityAuditEvent.objects.filter(event_type="SUPPLIER_CERTIFICATE_RECORDED").exists()
    verify_supplier_certificate(actor=qa_a, certificate_id=cert.id)
    assert SecurityAuditEvent.objects.filter(event_type="SUPPLIER_CERTIFICATE_VERIFIED").exists()
    assert certificate_is_expired(cert) is False
    assert str(profile)
