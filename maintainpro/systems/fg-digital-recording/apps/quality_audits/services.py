"""QMS quality audit services — Phase 45 (ADR-056)."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from apps.access_control.services import Scope, user_has_permission
from apps.accounts.models import User
from apps.capa.services import create_corrective_action
from apps.checklists.models import ChecklistTemplate, ChecklistVersion
from apps.nonconformance.models import NonConformanceSource
from apps.nonconformance.services import create_nonconformance
from apps.quality_audits.models import (
    AUDIT_TRANSITIONS,
    FINDING_TRANSITIONS,
    QualityAudit,
    QualityAuditChecklistBinding,
    QualityAuditEvent,
    QualityAuditFinding,
    QualityAuditFindingCodeConfig,
    QualityAuditFindingStatus,
    QualityAuditParticipant,
    QualityAuditStatus,
    QualityAuditType,
)
from apps.security_audit.services import record_event

PERM_VIEW = "quality_audits.view_qualityaudit"
PERM_PLAN = "quality_audits.plan_qualityaudit"
PERM_EXECUTE = "quality_audits.execute_qualityaudit"
PERM_CLOSE = "quality_audits.close_qualityaudit"
PERM_LINK_CASE = "quality_audits.link_audit_quality_case"
PERM_CONFIG = "quality_audits.manage_auditfindingconfig"


def _scope(organization_id: uuid.UUID) -> Scope:
    return Scope(organization_id=organization_id)


def _require(actor: User, permission: str, organization_id: uuid.UUID) -> None:
    if not user_has_permission(actor, permission, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")


def _append_event(
    *,
    audit: QualityAudit,
    event_type: str,
    actor: User,
    summary: str,
    finding: QualityAuditFinding | None = None,
    payload: dict[str, Any] | None = None,
) -> QualityAuditEvent:
    return QualityAuditEvent.objects.create(
        audit=audit,
        finding=finding,
        event_type=event_type,
        summary=summary,
        payload=payload or {},
        actor=actor,
    )


def _assert_not_terminal(audit: QualityAudit) -> None:
    if audit.is_terminal:
        raise ValidationError({"status": "Closed or cancelled audits are historically immutable."})


def _transition_audit(audit: QualityAudit, target: str) -> None:
    allowed = AUDIT_TRANSITIONS.get(audit.status, frozenset())
    if target not in allowed:
        raise ValidationError(
            {"status": f"Cannot transition audit from {audit.status} to {target}."}
        )


def _transition_finding(finding: QualityAuditFinding, target: str) -> None:
    allowed = FINDING_TRANSITIONS.get(finding.status, frozenset())
    if target not in allowed:
        raise ValidationError(
            {"status": f"Cannot transition finding from {finding.status} to {target}."}
        )


@transaction.atomic
def create_quality_audit(
    *,
    actor: User,
    organization_id: uuid.UUID,
    audit_code: str,
    title: str,
    scope_summary: str,
    audit_type: str,
    type_code_reference: str = "",
    site_reference: str = "",
    department_reference: str = "",
    process_reference: str = "",
    planned_date: date | None = None,
    lead_auditor: User | None = None,
) -> QualityAudit:
    _require(actor, PERM_PLAN, organization_id)
    if audit_type not in QualityAuditType.values:
        raise ValidationError({"audit_type": "Unknown architectural audit type."})
    code = (audit_code or "").strip()
    if QualityAudit.objects.filter(
        organization_id=organization_id, audit_code__iexact=code
    ).exists():
        raise ValidationError({"audit_code": "An audit with this identifier already exists."})
    audit = QualityAudit(
        organization_id=organization_id,
        audit_code=code,
        audit_type=audit_type,
        type_code_reference=(type_code_reference or "").strip(),
        title=(title or "").strip(),
        scope_summary=scope_summary,
        site_reference=(site_reference or "").strip(),
        department_reference=(department_reference or "").strip(),
        process_reference=(process_reference or "").strip(),
        planned_date=planned_date,
        lead_auditor=lead_auditor or actor,
        status=QualityAuditStatus.PLANNED,
        created_by=actor,
    )
    audit.full_clean()
    audit.save()
    _append_event(
        audit=audit,
        event_type="QUALITY_AUDIT_PLANNED",
        actor=actor,
        summary="QMS quality audit planned.",
        payload={"audit_code": audit.audit_code},
    )
    record_event(
        event_type="QUALITY_AUDIT_PLANNED",
        actor=actor,
        metadata={
            "organization_id": str(organization_id),
            "audit_id": str(audit.id),
            "module": "quality_audits",
            "not_security_audit_log": True,
        },
    )
    return audit


@transaction.atomic
def add_audit_participant(
    *, actor: User, audit_id: uuid.UUID, user: User, role_reference: str = ""
) -> QualityAuditParticipant:
    audit = QualityAudit.objects.select_related("organization").get(pk=audit_id)
    _require(actor, PERM_PLAN, audit.organization_id)
    _assert_not_terminal(audit)
    existing = QualityAuditParticipant.objects.filter(audit=audit, user=user).first()
    if existing is not None:
        return existing
    participant = QualityAuditParticipant.objects.create(
        audit=audit, user=user, role_reference=(role_reference or "").strip()
    )
    _append_event(
        audit=audit,
        event_type="QUALITY_AUDIT_PARTICIPANT_ADDED",
        actor=actor,
        summary="Participant added.",
        payload={"user_id": str(user.id)},
    )
    record_event(
        event_type="QUALITY_AUDIT_PARTICIPANT_ADDED",
        actor=actor,
        metadata={"organization_id": str(audit.organization_id), "audit_id": str(audit.id)},
    )
    return participant


@transaction.atomic
def register_audit_checklist_template(
    *, actor: User, organization_id: uuid.UUID, checklist_template_id: uuid.UUID
) -> QualityAuditChecklistBinding:
    _require(actor, PERM_PLAN, organization_id)
    template = ChecklistTemplate.objects.get(pk=checklist_template_id)
    if template.organization_id != organization_id:
        raise PermissionDenied("Permission denied.")
    existing = QualityAuditChecklistBinding.objects.filter(
        organization_id=organization_id, checklist_template=template
    ).first()
    if existing is not None:
        return existing
    binding = QualityAuditChecklistBinding.objects.create(
        organization_id=organization_id,
        checklist_template=template,
        created_by=actor,
    )
    record_event(
        event_type="QUALITY_AUDIT_CHECKLIST_REGISTERED",
        actor=actor,
        metadata={
            "organization_id": str(organization_id),
            "checklist_template_id": str(template.id),
            "not_operational_fg_checklist": True,
        },
    )
    return binding


@transaction.atomic
def bind_audit_checklist(
    *,
    actor: User,
    audit_id: uuid.UUID,
    checklist_template_id: uuid.UUID,
    checklist_version_id: uuid.UUID,
) -> QualityAudit:
    audit = QualityAudit.objects.select_related("organization").get(pk=audit_id)
    _require(actor, PERM_PLAN, audit.organization_id)
    _assert_not_terminal(audit)
    registered = QualityAuditChecklistBinding.objects.filter(
        organization_id=audit.organization_id,
        checklist_template_id=checklist_template_id,
    ).exists()
    if not registered:
        raise ValidationError(
            {
                "checklist_template": (
                    "Only templates registered as quality-audit checklists may be bound. "
                    "Operational FG checklists are not reused automatically."
                )
            }
        )
    version = ChecklistVersion.objects.select_related("template").get(pk=checklist_version_id)
    if version.template_id != checklist_template_id:
        raise ValidationError({"checklist_version": "Version does not belong to the template."})
    audit.checklist_template_id = checklist_template_id
    audit.checklist_version_id = checklist_version_id
    audit.save(update_fields=["checklist_template", "checklist_version", "updated_at"])
    _append_event(
        audit=audit,
        event_type="QUALITY_AUDIT_CHECKLIST_BOUND",
        actor=actor,
        summary="Audit checklist version bound.",
        payload={"checklist_version_id": str(checklist_version_id)},
    )
    record_event(
        event_type="QUALITY_AUDIT_CHECKLIST_BOUND",
        actor=actor,
        metadata={"organization_id": str(audit.organization_id), "audit_id": str(audit.id)},
    )
    return audit


@transaction.atomic
def start_quality_audit(*, actor: User, audit_id: uuid.UUID) -> QualityAudit:
    audit = QualityAudit.objects.select_related("organization").get(pk=audit_id)
    _require(actor, PERM_EXECUTE, audit.organization_id)
    _assert_not_terminal(audit)
    _transition_audit(audit, QualityAuditStatus.IN_PROGRESS)
    audit.status = QualityAuditStatus.IN_PROGRESS
    audit.save(update_fields=["status", "updated_at"])
    _append_event(
        audit=audit,
        event_type="QUALITY_AUDIT_STARTED",
        actor=actor,
        summary="QMS quality audit execution started.",
        payload={},
    )
    record_event(
        event_type="QUALITY_AUDIT_STARTED",
        actor=actor,
        metadata={"organization_id": str(audit.organization_id), "audit_id": str(audit.id)},
    )
    return audit


@transaction.atomic
def create_audit_finding(
    *,
    actor: User,
    audit_id: uuid.UUID,
    description: str,
    reference: str = "",
    classification_code: str = "",
    severity_code: str = "",
    owner: User | None = None,
    due_date: date | None = None,
) -> QualityAuditFinding:
    audit = QualityAudit.objects.select_related("organization").get(pk=audit_id)
    _require(actor, PERM_EXECUTE, audit.organization_id)
    _assert_not_terminal(audit)
    if audit.status not in {QualityAuditStatus.IN_PROGRESS, QualityAuditStatus.FINDINGS}:
        raise ValidationError({"status": "Findings can be recorded only during execution."})
    class_code = (classification_code or "").strip()
    sev_code = (severity_code or "").strip()
    if (
        class_code
        and not QualityAuditFindingCodeConfig.objects.filter(
            organization_id=audit.organization_id,
            kind=QualityAuditFindingCodeConfig.Kind.CLASSIFICATION,
            code__iexact=class_code,
            is_active=True,
        ).exists()
    ):
        raise ValidationError(
            {"classification_code": "Classification must be an owner-configured active code."}
        )
    if (
        sev_code
        and not QualityAuditFindingCodeConfig.objects.filter(
            organization_id=audit.organization_id,
            kind=QualityAuditFindingCodeConfig.Kind.SEVERITY,
            code__iexact=sev_code,
            is_active=True,
        ).exists()
    ):
        raise ValidationError(
            {"severity_code": "Severity must be an owner-configured active code."}
        )
    finding = QualityAuditFinding(
        audit=audit,
        description=description,
        reference=(reference or "").strip(),
        classification_code=class_code,
        severity_code=sev_code,
        owner=owner,
        due_date=due_date,
        status=QualityAuditFindingStatus.OPEN,
        created_by=actor,
    )
    finding.full_clean()
    finding.save()
    if audit.status == QualityAuditStatus.IN_PROGRESS:
        _transition_audit(audit, QualityAuditStatus.FINDINGS)
        audit.status = QualityAuditStatus.FINDINGS
        audit.save(update_fields=["status", "updated_at"])
    _append_event(
        audit=audit,
        finding=finding,
        event_type="QUALITY_AUDIT_FINDING_CREATED",
        actor=actor,
        summary="Audit finding recorded. NCR/CAPA not auto-created.",
        payload={"auto_created_capa": False},
    )
    record_event(
        event_type="QUALITY_AUDIT_FINDING_CREATED",
        actor=actor,
        metadata={
            "organization_id": str(audit.organization_id),
            "audit_id": str(audit.id),
            "finding_id": str(finding.id),
            "auto_created_capa": False,
        },
    )
    return finding


@transaction.atomic
def complete_finding_action(*, actor: User, finding_id: uuid.UUID) -> QualityAuditFinding:
    finding = QualityAuditFinding.objects.select_related("audit").get(pk=finding_id)
    _require(actor, PERM_EXECUTE, finding.audit.organization_id)
    _assert_not_terminal(finding.audit)
    _transition_finding(finding, QualityAuditFindingStatus.ACTION_COMPLETED)
    finding.status = QualityAuditFindingStatus.ACTION_COMPLETED
    finding.action_completed_by = actor
    finding.action_completed_at = timezone.now()
    finding.save(
        update_fields=["status", "action_completed_by", "action_completed_at", "updated_at"]
    )
    _append_event(
        audit=finding.audit,
        finding=finding,
        event_type="QUALITY_AUDIT_FINDING_ACTION_COMPLETED",
        actor=actor,
        summary="Finding action marked completed. Not closed.",
        payload={},
    )
    record_event(
        event_type="QUALITY_AUDIT_FINDING_ACTION_COMPLETED",
        actor=actor,
        metadata={
            "organization_id": str(finding.audit.organization_id),
            "finding_id": str(finding.id),
        },
    )
    return finding


@transaction.atomic
def verify_audit_finding(*, actor: User, finding_id: uuid.UUID) -> QualityAuditFinding:
    finding = QualityAuditFinding.objects.select_related("audit").get(pk=finding_id)
    _require(actor, PERM_CLOSE, finding.audit.organization_id)
    _assert_not_terminal(finding.audit)
    _transition_finding(finding, QualityAuditFindingStatus.VERIFIED)
    finding.status = QualityAuditFindingStatus.VERIFIED
    finding.verified_by = actor
    finding.verified_at = timezone.now()
    finding.save(update_fields=["status", "verified_by", "verified_at", "updated_at"])
    _append_event(
        audit=finding.audit,
        finding=finding,
        event_type="QUALITY_AUDIT_FINDING_VERIFIED",
        actor=actor,
        summary="Finding verified.",
        payload={},
    )
    record_event(
        event_type="QUALITY_AUDIT_FINDING_VERIFIED",
        actor=actor,
        metadata={
            "organization_id": str(finding.audit.organization_id),
            "finding_id": str(finding.id),
        },
    )
    return finding


@transaction.atomic
def close_audit_finding(*, actor: User, finding_id: uuid.UUID) -> QualityAuditFinding:
    finding = QualityAuditFinding.objects.select_related("audit").get(pk=finding_id)
    _require(actor, PERM_CLOSE, finding.audit.organization_id)
    _assert_not_terminal(finding.audit)
    _transition_finding(finding, QualityAuditFindingStatus.CLOSED)
    finding.status = QualityAuditFindingStatus.CLOSED
    finding.closed_by = actor
    finding.closed_at = timezone.now()
    finding.save(update_fields=["status", "closed_by", "closed_at", "updated_at"])
    _append_event(
        audit=finding.audit,
        finding=finding,
        event_type="QUALITY_AUDIT_FINDING_CLOSED",
        actor=actor,
        summary="Finding closed after verification.",
        payload={},
    )
    record_event(
        event_type="QUALITY_AUDIT_FINDING_CLOSED",
        actor=actor,
        metadata={
            "organization_id": str(finding.audit.organization_id),
            "finding_id": str(finding.id),
        },
    )
    return finding


@transaction.atomic
def link_finding_quality_case(
    *,
    actor: User,
    finding_id: uuid.UUID,
    explicit_user_action: bool,
    create_quality_case: bool,
    link_kind: str,
    ncr_code: str = "",
    capa_code: str = "",
    existing_ncr_id: uuid.UUID | None = None,
    existing_capa_id: uuid.UUID | None = None,
) -> QualityAuditFinding:
    finding = QualityAuditFinding.objects.select_related("audit", "audit__organization").get(
        pk=finding_id
    )
    _require(actor, PERM_LINK_CASE, finding.audit.organization_id)
    _assert_not_terminal(finding.audit)
    if not explicit_user_action:
        raise ValidationError(
            {"explicit_user_action": "NCR/CAPA links require explicit_user_action=True."}
        )
    kind = (link_kind or "").strip().upper()
    if kind not in {"NCR", "CAPA"}:
        raise ValidationError({"link_kind": "link_kind must be NCR or CAPA."})
    org = finding.audit.organization
    if kind == "NCR":
        if create_quality_case:
            supplied = (ncr_code or "").strip()
            if not supplied:
                raise ValidationError({"ncr_code": "Owner-supplied NCR code is required."})
            ncr = create_nonconformance(
                actor=actor,
                organization=org,
                code=supplied,
                title=f"Audit {finding.audit.audit_code}",
                summary=finding.description[:500],
                source=NonConformanceSource.OTHER,
            )
            finding.nonconformance = ncr
        elif existing_ncr_id is not None:
            from apps.nonconformance.models import NonConformanceRecord

            found_ncr = NonConformanceRecord.objects.filter(
                pk=existing_ncr_id, organization_id=org.id
            ).first()
            if found_ncr is None:
                raise ValidationError({"existing_ncr_id": "NCR not found in organization."})
            finding.nonconformance = found_ncr
        else:
            raise ValidationError(
                {"nonconformance": "Provide create_quality_case or existing_ncr_id."}
            )
    else:
        if create_quality_case:
            supplied = (capa_code or "").strip()
            if not supplied:
                raise ValidationError({"capa_code": "Owner-supplied CAPA code is required."})
            capa = create_corrective_action(
                actor=actor,
                organization=org,
                code=supplied,
                title=f"Audit {finding.audit.audit_code}",
                summary=finding.description[:500],
                nonconformance_id=finding.nonconformance_id,
            )
            finding.corrective_action = capa
        elif existing_capa_id is not None:
            from apps.capa.models import CorrectiveAction

            found_capa = CorrectiveAction.objects.filter(
                pk=existing_capa_id, organization_id=org.id
            ).first()
            if found_capa is None:
                raise ValidationError({"existing_capa_id": "CAPA not found in organization."})
            finding.corrective_action = found_capa
        else:
            raise ValidationError(
                {"corrective_action": "Provide create_quality_case or existing_capa_id."}
            )
    finding.save()
    _append_event(
        audit=finding.audit,
        finding=finding,
        event_type="QUALITY_AUDIT_CASE_LINKED",
        actor=actor,
        summary=f"{kind} linked by explicit authorized action.",
        payload={"link_kind": kind, "create_quality_case": create_quality_case},
    )
    record_event(
        event_type="QUALITY_AUDIT_CASE_LINKED",
        actor=actor,
        metadata={
            "organization_id": str(org.id),
            "finding_id": str(finding.id),
            "link_kind": kind,
        },
    )
    return finding


@transaction.atomic
def cancel_quality_audit(*, actor: User, audit_id: uuid.UUID) -> QualityAudit:
    audit = QualityAudit.objects.select_related("organization").get(pk=audit_id)
    _require(actor, PERM_CLOSE, audit.organization_id)
    _assert_not_terminal(audit)
    _transition_audit(audit, QualityAuditStatus.CANCELLED)
    now = timezone.now()
    audit.status = QualityAuditStatus.CANCELLED
    audit.closed_by = actor
    audit.closed_at = now
    audit.save(update_fields=["status", "closed_by", "closed_at", "updated_at"])
    _append_event(
        audit=audit,
        event_type="QUALITY_AUDIT_CANCELLED",
        actor=actor,
        summary="QMS quality audit cancelled.",
        payload={},
    )
    record_event(
        event_type="QUALITY_AUDIT_CANCELLED",
        actor=actor,
        metadata={"organization_id": str(audit.organization_id), "audit_id": str(audit.id)},
    )
    return audit


@transaction.atomic
def reopen_finding_action(*, actor: User, finding_id: uuid.UUID) -> QualityAuditFinding:
    finding = QualityAuditFinding.objects.select_related("audit").get(pk=finding_id)
    _require(actor, PERM_EXECUTE, finding.audit.organization_id)
    _assert_not_terminal(finding.audit)
    _transition_finding(finding, QualityAuditFindingStatus.OPEN)
    finding.status = QualityAuditFindingStatus.OPEN
    finding.save(update_fields=["status", "updated_at"])
    _append_event(
        audit=finding.audit,
        finding=finding,
        event_type="QUALITY_AUDIT_FINDING_REOPENED",
        actor=actor,
        summary="Finding returned to open after incomplete action.",
        payload={},
    )
    return finding


@transaction.atomic
def close_quality_audit(*, actor: User, audit_id: uuid.UUID) -> QualityAudit:
    audit = QualityAudit.objects.select_related("organization").get(pk=audit_id)
    _require(actor, PERM_CLOSE, audit.organization_id)
    _assert_not_terminal(audit)
    _transition_audit(audit, QualityAuditStatus.CLOSED)
    now = timezone.now()
    audit.status = QualityAuditStatus.CLOSED
    audit.closed_by = actor
    audit.closed_at = now
    audit.save(update_fields=["status", "closed_by", "closed_at", "updated_at"])
    _append_event(
        audit=audit,
        event_type="QUALITY_AUDIT_CLOSED",
        actor=actor,
        summary="QMS quality audit closed.",
        payload={},
    )
    record_event(
        event_type="QUALITY_AUDIT_CLOSED",
        actor=actor,
        metadata={"organization_id": str(audit.organization_id), "audit_id": str(audit.id)},
    )
    return audit


@transaction.atomic
def upsert_finding_code(
    *,
    actor: User,
    organization_id: uuid.UUID,
    kind: str,
    code: str,
    label: str,
    is_active: bool = True,
) -> QualityAuditFindingCodeConfig:
    _require(actor, PERM_CONFIG, organization_id)
    if kind not in QualityAuditFindingCodeConfig.Kind.values:
        raise ValidationError({"kind": "Kind must be CLASSIFICATION or SEVERITY."})
    normalized = (code or "").strip()
    if not normalized:
        raise ValidationError({"code": "Code is required."})
    config, _created = QualityAuditFindingCodeConfig.objects.get_or_create(
        organization_id=organization_id,
        kind=kind,
        code=normalized,
        defaults={
            "label": (label or "").strip() or normalized,
            "is_active": is_active,
            "created_by": actor,
        },
    )
    config.label = (label or "").strip() or normalized
    config.is_active = is_active
    config.save()
    record_event(
        event_type="QUALITY_AUDIT_FINDING_CODE_UPSERTED",
        actor=actor,
        metadata={"organization_id": str(organization_id), "kind": kind, "code": normalized},
    )
    return config
