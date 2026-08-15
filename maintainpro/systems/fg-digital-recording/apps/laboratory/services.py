"""Laboratory domain services — Phase 22.

Business logic lives here (not views). Org RBAC deny-by-default.
Finalized results are immutable; amendments create new revisions.
Positive-release blocking stays OFF without company approval.
"""

from __future__ import annotations

import uuid
from decimal import Decimal, InvalidOperation
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.access_control.services import Scope, require_permission
from apps.accounts.models import User
from apps.core.persistence import locked_get
from apps.laboratory.models import (
    LAB_SAMPLE_STATUS_TRANSITIONS,
    LabAuditEventKind,
    LabExternalCertificate,
    LabHistoryEntry,
    LabPositiveReleasePolicy,
    LabResult,
    LabResultStatus,
    LabResultType,
    LabResultVerificationStatus,
    LabSample,
    LabSampleStatus,
    LabTest,
    LabTestParameter,
    TestMethodReference,
)
from apps.laboratory.policy import get_or_init_policy
from apps.master_data.models import FGProduct, SpecificationParameter
from apps.nonconformance.models import HoldCase, NonConformanceRecord
from apps.organizations.models import Organization, Site
from apps.organizations.services import normalize_code
from apps.recording.models import ChecklistSubmission
from apps.security_audit.services import record_event

REGISTER_SAMPLE = "laboratory.register_labsample"
VIEW_LAB = "laboratory.view_laboratory"
ENTER_RESULT = "laboratory.enter_labresult"
VERIFY_RESULT = "laboratory.verify_labresult"
FINALIZE_RESULT = "laboratory.finalize_labresult"
MANAGE_LAB = "laboratory.manage_laboratory"


def _require_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def _org_scope(organization_id: uuid.UUID) -> Scope:
    return Scope(organization_id=organization_id)


def _history(
    *,
    organization_id: uuid.UUID,
    actor: User,
    event_type: str,
    sample: LabSample | None = None,
    lab_result: LabResult | None = None,
    from_status: str = "",
    to_status: str = "",
    note: str = "",
    metadata: dict[str, Any] | None = None,
) -> LabHistoryEntry:
    return LabHistoryEntry.objects.create(
        organization_id=organization_id,
        sample=sample,
        lab_result=lab_result,
        event_type=event_type,
        from_status=from_status or "",
        to_status=to_status or "",
        note=(note or "").strip()[:255],
        metadata=metadata or {},
        actor=actor,
    )


def _assert_same_org(organization_id: uuid.UUID, **fk_org_ids: uuid.UUID | None) -> None:
    for name, oid in fk_org_ids.items():
        if oid is not None and oid != organization_id:
            raise PermissionDenied(f"Cross-organization {name} link is denied.")


@transaction.atomic
def register_lab_sample(
    *,
    actor: User | None,
    organization: Organization,
    code: str,
    site: Site | None = None,
    product: FGProduct | None = None,
    batch_reference: str = "",
    sub_lot_reference: str = "",
    checklist_submission: ChecklistSubmission | None = None,
    nonconformance: NonConformanceRecord | None = None,
    hold_case: HoldCase | None = None,
    provenance_note: str = "",
) -> LabSample:
    user = _require_actor(actor)
    require_permission(user, REGISTER_SAMPLE, scope=_org_scope(organization.id))
    _assert_same_org(
        organization.id,
        site=site.organization_id if site else None,
        product=product.organization_id if product else None,
        checklist_submission=(
            checklist_submission.checklist_record.organization_id if checklist_submission else None
        ),
        nonconformance=nonconformance.organization_id if nonconformance else None,
        hold_case=hold_case.organization_id if hold_case else None,
    )
    normalized = normalize_code(code)
    if not normalized:
        raise ValidationError({"code": "Sample code is required."})
    try:
        sample = LabSample.objects.create(
            organization=organization,
            site=site,
            code=normalized,
            status=LabSampleStatus.REGISTERED,
            product=product,
            batch_reference=(batch_reference or "").strip(),
            sub_lot_reference=(sub_lot_reference or "").strip(),
            checklist_submission=checklist_submission,
            nonconformance=nonconformance,
            hold_case=hold_case,
            provenance_note=(provenance_note or "").strip()[:255],
            registered_by=user,
        )
    except IntegrityError as exc:
        raise ValidationError(
            {"code": "A sample with this code already exists in the organization."}
        ) from exc

    _history(
        organization_id=organization.id,
        actor=user,
        event_type=LabAuditEventKind.SAMPLE_CREATED,
        sample=sample,
        to_status=sample.status,
    )
    record_event(
        event_type="LAB_SAMPLE_CREATED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "sample_id": str(sample.id),
            "sample_code": sample.code,
            "batch_reference": sample.batch_reference,
        },
    )
    return sample


@transaction.atomic
def transition_lab_sample(
    *,
    actor: User | None,
    sample_id: uuid.UUID,
    to_status: str,
    note: str = "",
) -> LabSample:
    user = _require_actor(actor)
    sample = locked_get(LabSample, pk=sample_id)
    if sample is None:
        raise ValidationError({"sample": "Lab sample not found."})
    require_permission(user, REGISTER_SAMPLE, scope=_org_scope(sample.organization_id))
    allowed = LAB_SAMPLE_STATUS_TRANSITIONS.get(sample.status, frozenset())
    if to_status not in allowed:
        raise ValidationError({"status": f"Cannot transition from {sample.status} to {to_status}."})
    previous = sample.status
    sample.status = to_status
    if to_status == LabSampleStatus.CANCELLED:
        sample.cancelled_at = timezone.now()
    sample.save(update_fields=["status", "cancelled_at", "updated_at"])
    _history(
        organization_id=sample.organization_id,
        actor=user,
        event_type=LabAuditEventKind.SAMPLE_STATUS_CHANGED,
        sample=sample,
        from_status=previous,
        to_status=to_status,
        note=note,
    )
    record_event(
        event_type="LAB_SAMPLE_STATUS_CHANGED",
        actor=user,
        metadata={
            "organization_id": str(sample.organization_id),
            "sample_id": str(sample.id),
            "from_status": previous,
            "to_status": to_status,
        },
    )
    return sample


@transaction.atomic
def create_lab_test(
    *,
    actor: User | None,
    sample_id: uuid.UUID,
    code: str,
    title: str = "",
    method_reference: TestMethodReference | None = None,
    external_lab_code: str = "",
) -> LabTest:
    user = _require_actor(actor)
    sample = locked_get(LabSample, pk=sample_id)
    if sample is None:
        raise ValidationError({"sample": "Lab sample not found."})
    require_permission(user, REGISTER_SAMPLE, scope=_org_scope(sample.organization_id))
    if method_reference and method_reference.organization_id != sample.organization_id:
        raise PermissionDenied("Cross-organization method reference is denied.")
    normalized = normalize_code(code)
    if not normalized:
        raise ValidationError({"code": "Test code is required."})
    try:
        test = LabTest.objects.create(
            organization_id=sample.organization_id,
            sample=sample,
            code=normalized,
            title=(title or "").strip(),
            method_reference=method_reference,
            external_lab_code=(external_lab_code or "").strip(),
        )
    except IntegrityError as exc:
        raise ValidationError(
            {"code": "A test with this code already exists on the sample."}
        ) from exc
    _history(
        organization_id=sample.organization_id,
        actor=user,
        event_type=LabAuditEventKind.TEST_CREATED,
        sample=sample,
        metadata={"lab_test_id": str(test.id), "test_code": test.code},
    )
    return test


def _parse_decimal(raw: Any) -> Decimal | None:
    if raw is None or raw == "":
        return None
    try:
        return Decimal(str(raw))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValidationError({"numeric_value": "Invalid numeric value."}) from exc


@transaction.atomic
def enter_lab_result(
    *,
    actor: User | None,
    lab_test_id: uuid.UUID,
    parameter_id: uuid.UUID,
    numeric_value: Any = None,
    text_value: str = "",
    select_value: str = "",
) -> LabResult:
    user = _require_actor(actor)
    lab_test = LabTest.objects.select_related("sample").filter(pk=lab_test_id).first()
    if lab_test is None:
        raise ValidationError({"lab_test": "Lab test not found."})
    require_permission(user, ENTER_RESULT, scope=_org_scope(lab_test.organization_id))
    parameter = LabTestParameter.objects.filter(pk=parameter_id).first()
    if parameter is None or parameter.organization_id != lab_test.organization_id:
        raise PermissionDenied("Parameter not found in the active organization.")

    existing = (
        LabResult.objects.filter(lab_test=lab_test, parameter=parameter)
        .exclude(status=LabResultStatus.CANCELLED)
        .order_by("-revision_number")
        .first()
    )
    if existing is not None and existing.status == LabResultStatus.FINALIZED:
        raise ValidationError(
            {
                "result": (
                    "Finalized results cannot be overwritten. "
                    "Use amend_lab_result to create a new revision."
                )
            }
        )
    if existing is not None and existing.status not in {
        LabResultStatus.SUPERSEDED,
        LabResultStatus.CANCELLED,
    }:
        raise ValidationError(
            {
                "result": (
                    "An open result already exists for this parameter. "
                    "Verify/finalize or amend after finalization."
                )
            }
        )

    num = _parse_decimal(numeric_value)
    text = (text_value or "").strip()
    select = (select_value or "").strip()
    if parameter.result_type == LabResultType.NUMERIC and num is None:
        raise ValidationError({"numeric_value": "Numeric value is required."})
    if parameter.result_type == LabResultType.TEXT and not text:
        raise ValidationError({"text_value": "Text value is required."})
    if parameter.result_type == LabResultType.SELECT:
        options = parameter.select_options or []
        if options and select not in options:
            raise ValidationError({"select_value": "Value is not in approved select options."})
        if not select:
            raise ValidationError({"select_value": "Select value is required."})

    result = LabResult.objects.create(
        organization_id=lab_test.organization_id,
        lab_test=lab_test,
        parameter=parameter,
        revision_number=1,
        status=LabResultStatus.ENTERED,
        result_type=parameter.result_type,
        numeric_value=num,
        text_value=text,
        select_value=select,
        unit=parameter.unit,
        bound_min=parameter.bound_min,
        bound_max=parameter.bound_max,
        specification_parameter=parameter.specification_parameter,
        entered_by=user,
    )
    _history(
        organization_id=lab_test.organization_id,
        actor=user,
        event_type=LabAuditEventKind.RESULT_ENTERED,
        sample=lab_test.sample,
        lab_result=result,
        to_status=result.status,
        metadata={"parameter_code": parameter.code, "revision": 1},
    )
    record_event(
        event_type="LAB_RESULT_ENTERED",
        actor=user,
        metadata={
            "organization_id": str(lab_test.organization_id),
            "result_id": str(result.id),
            "lab_test_id": str(lab_test.id),
            "parameter_code": parameter.code,
            "revision_number": 1,
        },
    )
    return result


@transaction.atomic
def verify_lab_result(*, actor: User | None, result_id: uuid.UUID) -> LabResult:
    user = _require_actor(actor)
    result = locked_get(LabResult, pk=result_id)
    if result is None:
        raise ValidationError({"result": "Lab result not found."})
    require_permission(user, VERIFY_RESULT, scope=_org_scope(result.organization_id))
    if result.status != LabResultStatus.ENTERED:
        raise ValidationError({"status": "Only ENTERED results can be verified."})
    result.status = LabResultStatus.VERIFIED
    result.verified_by = user
    result.verified_at = timezone.now()
    result.save(update_fields=["status", "verified_by", "verified_at"])
    _history(
        organization_id=result.organization_id,
        actor=user,
        event_type=LabAuditEventKind.RESULT_VERIFIED,
        sample=result.lab_test.sample,
        lab_result=result,
        from_status=LabResultStatus.ENTERED,
        to_status=LabResultStatus.VERIFIED,
    )
    record_event(
        event_type="LAB_RESULT_VERIFIED",
        actor=user,
        metadata={
            "organization_id": str(result.organization_id),
            "result_id": str(result.id),
        },
    )
    return result


@transaction.atomic
def finalize_lab_result(*, actor: User | None, result_id: uuid.UUID) -> LabResult:
    user = _require_actor(actor)
    result = locked_get(LabResult, pk=result_id)
    if result is None:
        raise ValidationError({"result": "Lab result not found."})
    require_permission(user, FINALIZE_RESULT, scope=_org_scope(result.organization_id))
    if result.status != LabResultStatus.VERIFIED:
        raise ValidationError({"status": "Only VERIFIED results can be finalized."})
    result.status = LabResultStatus.FINALIZED
    result.finalized_by = user
    result.finalized_at = timezone.now()
    result.save(update_fields=["status", "finalized_by", "finalized_at"])
    _history(
        organization_id=result.organization_id,
        actor=user,
        event_type=LabAuditEventKind.RESULT_FINALIZED,
        sample=result.lab_test.sample,
        lab_result=result,
        from_status=LabResultStatus.VERIFIED,
        to_status=LabResultStatus.FINALIZED,
    )
    record_event(
        event_type="LAB_RESULT_FINALIZED",
        actor=user,
        metadata={
            "organization_id": str(result.organization_id),
            "result_id": str(result.id),
            "revision_number": result.revision_number,
        },
    )
    return result


@transaction.atomic
def amend_lab_result(
    *,
    actor: User | None,
    result_id: uuid.UUID,
    reason: str,
    numeric_value: Any = None,
    text_value: str = "",
    select_value: str = "",
) -> LabResult:
    """Create a new revision from a FINALIZED result — never silent overwrite."""
    user = _require_actor(actor)
    reason_clean = (reason or "").strip()
    if len(reason_clean) < 3:
        raise ValidationError({"reason": "Amendment reason is required."})
    previous = locked_get(LabResult, pk=result_id)
    if previous is None:
        raise ValidationError({"result": "Lab result not found."})
    require_permission(user, ENTER_RESULT, scope=_org_scope(previous.organization_id))
    if previous.status != LabResultStatus.FINALIZED:
        raise ValidationError({"status": "Only FINALIZED results can be amended."})

    previous.status = LabResultStatus.SUPERSEDED
    previous.save(update_fields=["status"])

    num = (
        _parse_decimal(numeric_value) if numeric_value not in (None, "") else previous.numeric_value
    )
    text = (text_value or "").strip() or previous.text_value
    select = (select_value or "").strip() or previous.select_value

    amended = LabResult.objects.create(
        organization_id=previous.organization_id,
        lab_test_id=previous.lab_test_id,
        parameter_id=previous.parameter_id,
        revision_number=previous.revision_number + 1,
        previous_result=previous,
        status=LabResultStatus.ENTERED,
        result_type=previous.result_type,
        numeric_value=num,
        text_value=text,
        select_value=select,
        unit=previous.unit,
        bound_min=previous.bound_min,
        bound_max=previous.bound_max,
        specification_parameter=previous.specification_parameter,
        amendment_reason=reason_clean[:512],
        entered_by=user,
    )
    _history(
        organization_id=previous.organization_id,
        actor=user,
        event_type=LabAuditEventKind.RESULT_AMENDED,
        sample=previous.lab_test.sample,
        lab_result=amended,
        from_status=LabResultStatus.FINALIZED,
        to_status=LabResultStatus.ENTERED,
        note=reason_clean[:255],
        metadata={
            "previous_result_id": str(previous.id),
            "revision_number": amended.revision_number,
        },
    )
    record_event(
        event_type="LAB_RESULT_AMENDED",
        actor=user,
        metadata={
            "organization_id": str(previous.organization_id),
            "previous_result_id": str(previous.id),
            "new_result_id": str(amended.id),
            "revision_number": amended.revision_number,
            # Intentionally omit free-text reason body from security audit.
        },
    )
    return amended


@transaction.atomic
def create_test_method_reference(
    *,
    actor: User | None,
    organization: Organization,
    code: str,
    title: str = "",
    notes: str = "",
) -> TestMethodReference:
    user = _require_actor(actor)
    require_permission(user, MANAGE_LAB, scope=_org_scope(organization.id))
    normalized = normalize_code(code)
    if not normalized:
        raise ValidationError({"code": "Method code is required."})
    try:
        return TestMethodReference.objects.create(
            organization=organization,
            code=normalized,
            title=(title or "").strip(),
            notes=(notes or "").strip(),
        )
    except IntegrityError as exc:
        raise ValidationError({"code": "Method code already exists."}) from exc


@transaction.atomic
def create_lab_test_parameter(
    *,
    actor: User | None,
    organization: Organization,
    code: str,
    name: str,
    result_type: str = LabResultType.NUMERIC,
    unit: str = "",
    select_options: list[str] | None = None,
    bound_min: Any = None,
    bound_max: Any = None,
    specification_parameter: SpecificationParameter | None = None,
    method_reference: TestMethodReference | None = None,
) -> LabTestParameter:
    user = _require_actor(actor)
    require_permission(user, MANAGE_LAB, scope=_org_scope(organization.id))
    if method_reference and method_reference.organization_id != organization.id:
        raise PermissionDenied("Cross-organization method reference is denied.")
    if specification_parameter is not None:
        spec_org = specification_parameter.version.specification.organization_id
        if spec_org != organization.id:
            raise PermissionDenied("Cross-organization specification link is denied.")
    normalized = normalize_code(code)
    if not normalized or not (name or "").strip():
        raise ValidationError({"code": "Parameter code and name are required."})
    param = LabTestParameter(
        organization=organization,
        code=normalized,
        name=name.strip(),
        result_type=result_type,
        unit=(unit or "").strip(),
        select_options=list(select_options or []),
        bound_min=_parse_decimal(bound_min),
        bound_max=_parse_decimal(bound_max),
        specification_parameter=specification_parameter,
        method_reference=method_reference,
    )
    param.full_clean()
    try:
        param.save()
    except IntegrityError as exc:
        raise ValidationError({"code": "Parameter code already exists."}) from exc
    return param


@transaction.atomic
def record_external_lab_certificate(
    *,
    actor: User | None,
    sample_id: uuid.UUID,
    external_lab_reference: str,
    certificate_reference: str = "",
    lab_test: LabTest | None = None,
    result_received_at: Any = None,
) -> LabExternalCertificate:
    user = _require_actor(actor)
    sample = LabSample.objects.filter(pk=sample_id).first()
    if sample is None:
        raise ValidationError({"sample": "Lab sample not found."})
    require_permission(user, ENTER_RESULT, scope=_org_scope(sample.organization_id))
    ref = (external_lab_reference or "").strip()
    if not ref:
        raise ValidationError({"external_lab_reference": "External lab reference is required."})
    if lab_test and lab_test.organization_id != sample.organization_id:
        raise PermissionDenied("Cross-organization lab test link is denied.")
    cert = LabExternalCertificate.objects.create(
        organization_id=sample.organization_id,
        sample=sample,
        lab_test=lab_test,
        external_lab_reference=ref,
        certificate_reference=(certificate_reference or "").strip(),
        result_received_at=result_received_at,
        verification_status=LabResultVerificationStatus.PENDING,
        created_by=user,
    )
    _history(
        organization_id=sample.organization_id,
        actor=user,
        event_type=LabAuditEventKind.EXTERNAL_CERT_RECORDED,
        sample=sample,
        metadata={"certificate_id": str(cert.id)},
    )
    record_event(
        event_type="LAB_EXTERNAL_CERTIFICATE_RECORDED",
        actor=user,
        metadata={
            "organization_id": str(sample.organization_id),
            "sample_id": str(sample.id),
            "certificate_id": str(cert.id),
        },
    )
    return cert


@transaction.atomic
def update_positive_release_policy(
    *,
    actor: User | None,
    organization: Organization,
    policy_enabled: bool,
    require_finalized_results: bool = True,
    notes: str = "",
) -> LabPositiveReleasePolicy:
    """Record policy preference only — does not enable runtime blocking alone."""
    user = _require_actor(actor)
    require_permission(user, MANAGE_LAB, scope=_org_scope(organization.id))
    policy = get_or_init_policy(organization)
    policy.policy_enabled = bool(policy_enabled)
    policy.require_finalized_results = bool(require_finalized_results)
    policy.notes = (notes or "").strip()
    policy.updated_by = user
    policy.save()
    _history(
        organization_id=organization.id,
        actor=user,
        event_type=LabAuditEventKind.POLICY_UPDATED,
        metadata={
            "policy_enabled": policy.policy_enabled,
            "require_finalized_results": policy.require_finalized_results,
        },
    )
    record_event(
        event_type="LAB_POSITIVE_RELEASE_POLICY_UPDATED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "policy_enabled": policy.policy_enabled,
        },
    )
    return policy
