"""Sanitation / SSOP services — Phase 27."""

from __future__ import annotations

import uuid
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.access_control.services import Scope, require_permission
from apps.accounts.models import User
from apps.checklists.models import ChecklistTemplate
from apps.core.persistence import lock_queryset, locked_get
from apps.instruments.models import Equipment
from apps.organizations.models import Department, Organization, Site
from apps.organizations.services import normalize_code
from apps.sanitation.models import (
    ChecklistTemplateSanitationBinding,
    ChemicalReference,
    SanitationChemicalReference,
    SanitationFailPolicy,
    SanitationHistoryEntry,
    SanitationProgram,
    SanitationProgramVersion,
    SanitationProgramVersionStatus,
    SanitationScheduleKind,
    SanitationScheduleLink,
    SanitationScope,
    SanitationVerificationMode,
)
from apps.sanitation.snapshots import build_frozen_sanitation_context
from apps.scheduling.models import ChecklistSchedule
from apps.security_audit.services import record_event

MANAGE = "sanitation.manage_sanitationprogram"
PUBLISH = "sanitation.publish_sanitationprogram"
VIEW = "sanitation.view_sanitation"


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
    program: SanitationProgram | None = None,
    program_version: SanitationProgramVersion | None = None,
    note: str = "",
    metadata: dict[str, Any] | None = None,
) -> SanitationHistoryEntry:
    return SanitationHistoryEntry.objects.create(
        organization_id=organization_id,
        program=program,
        program_version=program_version,
        event_type=event_type,
        note=(note or "").strip()[:255],
        metadata=metadata or {},
        actor=actor,
    )


def _assert_draft(version: SanitationProgramVersion) -> None:
    if version.is_immutable:
        raise ValidationError(
            {"status": "Approved or retired sanitation program versions are immutable."}
        )


def _assert_same_org_template(organization: Organization, template: ChecklistTemplate) -> None:
    if template.organization_id != organization.id:
        raise ValidationError(
            {"checklist_template": "Checklist template must belong to the same organization."}
        )


@transaction.atomic
def create_sanitation_program(
    *,
    actor: User | None,
    organization: Organization,
    checklist_template: ChecklistTemplate,
    code: str,
    title: str,
    description: str = "",
) -> SanitationProgram:
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(organization.id))
    _assert_same_org_template(organization, checklist_template)
    normalized = normalize_code(code)
    if not normalized or not (title or "").strip():
        raise ValidationError({"code": "Program code and title are required."})
    try:
        program = SanitationProgram.objects.create(
            organization=organization,
            checklist_template=checklist_template,
            code=normalized,
            title=title.strip(),
            description=(description or "").strip(),
            created_by=user,
        )
    except IntegrityError as exc:
        raise ValidationError({"code": "Program code already exists in organization."}) from exc
    _history(
        organization_id=organization.id,
        actor=user,
        event_type="SANITATION_PROGRAM_CREATED",
        program=program,
        note=program.code,
    )
    record_event(
        event_type="SANITATION_PROGRAM_CREATED",
        actor=user,
        metadata={
            "program_id": str(program.id),
            "organization_id": str(organization.id),
            "checklist_template_id": str(checklist_template.id),
        },
    )
    return program


@transaction.atomic
def create_draft_program_version(
    *,
    actor: User | None,
    program_id: uuid.UUID,
    change_summary: str = "",
    verification_mode: str = SanitationVerificationMode.SELF_CHECK,
) -> SanitationProgramVersion:
    user = _require_actor(actor)
    program = locked_get(SanitationProgram, pk=program_id)
    if program is None:
        raise ValidationError({"program": "Sanitation program not found."})
    require_permission(user, MANAGE, scope=_org_scope(program.organization_id))
    if verification_mode not in SanitationVerificationMode.values:
        raise ValidationError({"verification_mode": "Unknown verification mode."})
    next_num = (
        SanitationProgramVersion.objects.filter(program=program)
        .order_by("-version_number")
        .values_list("version_number", flat=True)
        .first()
        or 0
    ) + 1
    version = SanitationProgramVersion.objects.create(
        program=program,
        version_number=next_num,
        change_summary=(change_summary or "").strip(),
        verification_mode=verification_mode,
        created_by=user,
    )
    _history(
        organization_id=program.organization_id,
        actor=user,
        event_type="SANITATION_PROGRAM_VERSION_CREATED",
        program=program,
        program_version=version,
    )
    record_event(
        event_type="SANITATION_PROGRAM_VERSION_CREATED",
        actor=user,
        metadata={
            "program_id": str(program.id),
            "program_version_id": str(version.id),
            "version_number": version.version_number,
        },
    )
    return version


@transaction.atomic
def add_sanitation_scope(
    *,
    actor: User | None,
    program_version_id: uuid.UUID,
    code: str,
    title: str = "",
    site: Site | None = None,
    department: Department | None = None,
    line_code: str = "",
    work_area_code: str = "",
    equipment: Equipment | None = None,
    notes: str = "",
) -> SanitationScope:
    user = _require_actor(actor)
    version = lock_queryset(
        SanitationProgramVersion.objects.select_related("program").filter(pk=program_version_id)
    ).first()
    if version is None:
        raise ValidationError({"program_version": "Version not found."})
    require_permission(user, MANAGE, scope=_org_scope(version.program.organization_id))
    _assert_draft(version)
    normalized = normalize_code(code)
    if not normalized:
        raise ValidationError({"code": "Scope code is required."})
    scope = SanitationScope(
        program_version=version,
        code=normalized,
        title=(title or "").strip(),
        site=site,
        department=department,
        line_code=(line_code or "").strip(),
        work_area_code=(work_area_code or "").strip(),
        equipment=equipment,
        notes=(notes or "").strip(),
    )
    scope.full_clean()
    try:
        scope.save()
    except IntegrityError as exc:
        raise ValidationError({"code": "Scope code already exists on this version."}) from exc
    return scope


@transaction.atomic
def add_schedule_link(
    *,
    actor: User | None,
    program_version_id: uuid.UUID,
    schedule_kind: str,
    checklist_schedule: ChecklistSchedule | None = None,
    label: str = "",
    notes: str = "",
) -> SanitationScheduleLink:
    user = _require_actor(actor)
    version = lock_queryset(
        SanitationProgramVersion.objects.select_related("program").filter(pk=program_version_id)
    ).first()
    if version is None:
        raise ValidationError({"program_version": "Version not found."})
    require_permission(user, MANAGE, scope=_org_scope(version.program.organization_id))
    _assert_draft(version)
    if schedule_kind not in SanitationScheduleKind.values:
        raise ValidationError({"schedule_kind": "Unknown schedule kind."})
    link = SanitationScheduleLink(
        program_version=version,
        schedule_kind=schedule_kind,
        checklist_schedule=checklist_schedule,
        label=(label or "").strip(),
        notes=(notes or "").strip(),
    )
    link.full_clean()
    link.save()
    return link


@transaction.atomic
def create_chemical_reference(
    *,
    actor: User | None,
    organization: Organization,
    code: str,
    name: str,
    manufacturer_label: str = "",
    concentration_label: str = "",
    notes: str = "",
) -> ChemicalReference:
    """Create an unseeded chemical shell — do not invent concentrations."""
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(organization.id))
    normalized = normalize_code(code)
    if not normalized or not (name or "").strip():
        raise ValidationError({"code": "Chemical code and name are required."})
    try:
        return ChemicalReference.objects.create(
            organization=organization,
            code=normalized,
            name=name.strip(),
            manufacturer_label=(manufacturer_label or "").strip(),
            concentration_label=(concentration_label or "").strip(),
            notes=(notes or "").strip(),
            created_by=user,
        )
    except IntegrityError as exc:
        raise ValidationError({"code": "Chemical code already exists in organization."}) from exc


@transaction.atomic
def link_chemical_to_version(
    *,
    actor: User | None,
    program_version_id: uuid.UUID,
    chemical_id: uuid.UUID,
    notes: str = "",
) -> SanitationChemicalReference:
    user = _require_actor(actor)
    version = lock_queryset(
        SanitationProgramVersion.objects.select_related("program").filter(pk=program_version_id)
    ).first()
    if version is None:
        raise ValidationError({"program_version": "Version not found."})
    require_permission(user, MANAGE, scope=_org_scope(version.program.organization_id))
    _assert_draft(version)
    chemical = ChemicalReference.objects.filter(pk=chemical_id).first()
    if chemical is None:
        raise ValidationError({"chemical": "Chemical reference not found."})
    link = SanitationChemicalReference(
        program_version=version,
        chemical=chemical,
        notes=(notes or "").strip(),
    )
    link.full_clean()
    try:
        link.save()
    except IntegrityError as exc:
        raise ValidationError({"chemical": "Chemical already linked to this version."}) from exc
    return link


@transaction.atomic
def approve_program_version(
    *,
    actor: User | None,
    program_version_id: uuid.UUID,
) -> SanitationProgramVersion:
    user = _require_actor(actor)
    version = lock_queryset(
        SanitationProgramVersion.objects.select_related("program").filter(pk=program_version_id)
    ).first()
    if version is None:
        raise ValidationError({"program_version": "Version not found."})
    require_permission(user, PUBLISH, scope=_org_scope(version.program.organization_id))
    if version.status != SanitationProgramVersionStatus.DRAFT:
        raise ValidationError({"status": "Only DRAFT versions can be approved."})
    version.status = SanitationProgramVersionStatus.APPROVED
    version.approved_by = user
    version.approved_at = timezone.now()
    version.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
    _history(
        organization_id=version.program.organization_id,
        actor=user,
        event_type="SANITATION_PROGRAM_VERSION_APPROVED",
        program=version.program,
        program_version=version,
    )
    record_event(
        event_type="SANITATION_PROGRAM_VERSION_APPROVED",
        actor=user,
        metadata={
            "program_id": str(version.program_id),
            "program_version_id": str(version.id),
            "verification_mode": version.verification_mode,
        },
    )
    return version


@transaction.atomic
def retire_program_version(
    *,
    actor: User | None,
    program_version_id: uuid.UUID,
) -> SanitationProgramVersion:
    user = _require_actor(actor)
    version = lock_queryset(
        SanitationProgramVersion.objects.select_related("program").filter(pk=program_version_id)
    ).first()
    if version is None:
        raise ValidationError({"program_version": "Version not found."})
    require_permission(user, PUBLISH, scope=_org_scope(version.program.organization_id))
    if version.status != SanitationProgramVersionStatus.APPROVED:
        raise ValidationError({"status": "Only APPROVED versions can be retired."})
    version.status = SanitationProgramVersionStatus.RETIRED
    version.save(update_fields=["status", "updated_at"])
    _history(
        organization_id=version.program.organization_id,
        actor=user,
        event_type="SANITATION_PROGRAM_VERSION_RETIRED",
        program=version.program,
        program_version=version,
    )
    record_event(
        event_type="SANITATION_PROGRAM_VERSION_RETIRED",
        actor=user,
        metadata={"program_version_id": str(version.id)},
    )
    return version


@transaction.atomic
def bind_checklist_template_to_sanitation_program(
    *,
    actor: User | None,
    program_version_id: uuid.UUID,
) -> ChecklistTemplateSanitationBinding:
    """Bind the program's checklist template to an APPROVED version with frozen context."""
    user = _require_actor(actor)
    version = lock_queryset(
        SanitationProgramVersion.objects.select_related(
            "program", "program__checklist_template"
        ).filter(pk=program_version_id)
    ).first()
    if version is None:
        raise ValidationError({"program_version": "Version not found."})
    require_permission(user, MANAGE, scope=_org_scope(version.program.organization_id))
    if version.status != SanitationProgramVersionStatus.APPROVED:
        raise ValidationError({"status": "Only APPROVED versions may be bound."})
    template = version.program.checklist_template
    frozen = build_frozen_sanitation_context(version)
    binding, _created = ChecklistTemplateSanitationBinding.objects.update_or_create(
        checklist_template=template,
        defaults={"program_version": version, "frozen_sanitation_context": frozen},
    )
    _history(
        organization_id=version.program.organization_id,
        actor=user,
        event_type="SANITATION_CHECKLIST_BINDING_SET",
        program=version.program,
        program_version=version,
        metadata={"checklist_template_id": str(template.id)},
    )
    record_event(
        event_type="SANITATION_CHECKLIST_BINDING_SET",
        actor=user,
        metadata={
            "program_version_id": str(version.id),
            "checklist_template_id": str(template.id),
            "verification_mode": version.verification_mode,
        },
    )
    return binding


@transaction.atomic
def upsert_sanitation_fail_policy(
    *,
    actor: User | None,
    organization: Organization,
    policy_enabled: bool = False,
    procedure_reference: str = "",
    notes: str = "",
) -> SanitationFailPolicy:
    """Upsert org fail policy. Default remains disabled — does not invent stop rules."""
    user = _require_actor(actor)
    require_permission(user, PUBLISH, scope=_org_scope(organization.id))
    policy, _ = SanitationFailPolicy.objects.update_or_create(
        organization=organization,
        defaults={
            "policy_enabled": bool(policy_enabled),
            "procedure_reference": (procedure_reference or "").strip(),
            "notes": (notes or "").strip(),
            "updated_by": user,
        },
    )
    _history(
        organization_id=organization.id,
        actor=user,
        event_type="SANITATION_FAIL_POLICY_UPDATED",
        note="enabled" if policy.policy_enabled else "disabled",
        metadata={"policy_enabled": policy.policy_enabled},
    )
    record_event(
        event_type="SANITATION_FAIL_POLICY_UPDATED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "policy_enabled": policy.policy_enabled,
        },
    )
    return policy


def assert_scope_matches_organization(
    *,
    scope: SanitationScope,
    organization_id: uuid.UUID,
) -> None:
    """Cross-org guard for scope usage."""
    if scope.program_version.program.organization_id != organization_id:
        raise ValidationError({"organization": "Sanitation scope belongs to another organization."})
