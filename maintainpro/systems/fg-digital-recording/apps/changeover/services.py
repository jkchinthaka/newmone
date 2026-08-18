"""Allergen / changeover / line-clearance services — Phase 30.

Does not invent allergen lists, cleaning sequences, or matrix block rules.
Production block remains dual-gated OFF by default (APR-056).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError
from django.utils import timezone

from apps.core.persistence.transactions import atomic_fn
from apps.access_control.services import Scope, require_permission, user_has_permission
from apps.accounts.models import User
from apps.changeover.models import (
    AllergenReference,
    AllergenRiskPolicy,
    ChangeoverHistoryEntry,
    ChangeoverRecord,
    ChangeoverStatus,
    DeclarationStatus,
    LineClearanceRecord,
    LineClearanceStatus,
    ProductAllergenDeclaration,
)
from apps.changeover.policy import evaluate_allergen_changeover_block
from apps.changeover.snapshots import (
    build_frozen_changeover_context,
    build_frozen_line_clearance_context,
)
from apps.checklists.models import ChecklistTemplate, ChecklistVersion
from apps.master_data.models import FGProduct
from apps.organizations.models import Organization
from apps.organizations.services import normalize_code
from apps.packaging.models import LineClearanceArtworkHook
from apps.recording.models import ChecklistSubmission
from apps.security_audit.services import record_event

MANAGE_ALLERGEN = "changeover.manage_allergenreference"
MANAGE_CHANGEOVER = "changeover.manage_changeover"
VERIFY_CHANGEOVER = "changeover.verify_changeover"
VIEW_CHANGEOVER = "changeover.view_changeover"
MANAGE_POLICY = "changeover.manage_allergenriskpolicy"


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
    changeover: ChangeoverRecord | None = None,
    line_clearance: LineClearanceRecord | None = None,
    note: str = "",
    metadata: dict[str, Any] | None = None,
) -> ChangeoverHistoryEntry:
    return ChangeoverHistoryEntry.objects.create(
        organization_id=organization_id,
        changeover=changeover,
        line_clearance=line_clearance,
        event_type=event_type,
        note=(note or "").strip()[:255],
        metadata=metadata or {},
        actor=actor,
    )


@atomic_fn
def create_allergen_reference(
    *,
    actor: User | None,
    organization: Organization,
    code: str,
    name: str,
    description: str = "",
) -> AllergenReference:
    user = _require_actor(actor)
    require_permission(user, MANAGE_ALLERGEN, scope=_org_scope(organization.id))
    normalized = normalize_code(code)
    if not normalized or not (name or "").strip():
        raise ValidationError({"code": "Allergen code and name are required."})
    try:
        ref = AllergenReference.objects.create(
            organization=organization,
            code=normalized,
            name=name.strip(),
            description=(description or "").strip(),
            created_by=user,
        )
    except IntegrityError as exc:
        raise ValidationError({"code": "Allergen code already exists."}) from exc
    record_event(
        event_type="ALLERGEN_REFERENCE_CREATED",
        actor=user,
        metadata={
            "allergen_reference_id": str(ref.id),
            "organization_id": str(organization.id),
            "code": ref.code,
        },
    )
    return ref


@atomic_fn
def create_product_allergen_declaration(
    *,
    actor: User | None,
    organization: Organization,
    product: FGProduct,
    declaration_reference: str = "",
    notes: str = "",
    allergen_reference_ids: list[uuid.UUID] | None = None,
) -> ProductAllergenDeclaration:
    user = _require_actor(actor)
    require_permission(user, MANAGE_CHANGEOVER, scope=_org_scope(organization.id))
    if product.organization_id != organization.id:
        raise ValidationError({"product": "Product must belong to the organization."})
    declaration = ProductAllergenDeclaration(
        organization=organization,
        product=product,
        status=DeclarationStatus.DRAFT,
        declaration_reference=(declaration_reference or "").strip()[:255],
        notes=(notes or "").strip(),
        created_by=user,
    )
    declaration.full_clean()
    declaration.save()
    if allergen_reference_ids:
        refs = list(
            AllergenReference.objects.filter(
                organization_id=organization.id,
                pk__in=allergen_reference_ids,
            )
        )
        if len(refs) != len(set(allergen_reference_ids)):
            raise ValidationError(
                {"allergen_references": "Unknown or cross-org allergen reference."}
            )
        declaration.allergen_references.set(refs)
    record_event(
        event_type="PRODUCT_ALLERGEN_DECLARATION_CREATED",
        actor=user,
        metadata={
            "declaration_id": str(declaration.id),
            "product_id": str(product.id),
        },
    )
    return declaration


@atomic_fn
def approve_product_allergen_declaration(
    *,
    actor: User | None,
    declaration: ProductAllergenDeclaration,
) -> ProductAllergenDeclaration:
    user = _require_actor(actor)
    require_permission(user, VERIFY_CHANGEOVER, scope=_org_scope(declaration.organization_id))
    if declaration.status != DeclarationStatus.DRAFT:
        raise ValidationError({"status": "Only draft declarations can be approved."})
    declaration.status = DeclarationStatus.APPROVED
    declaration.approved_by = user
    declaration.approved_at = timezone.now()
    declaration.full_clean()
    declaration.save()
    record_event(
        event_type="PRODUCT_ALLERGEN_DECLARATION_APPROVED",
        actor=user,
        metadata={"declaration_id": str(declaration.id)},
    )
    return declaration


@atomic_fn
def record_changeover(
    *,
    actor: User | None,
    organization: Organization,
    previous_product: FGProduct,
    next_product: FGProduct,
    line_code: str = "",
    started_at: datetime | None = None,
    completed_at: datetime | None = None,
    batch_reference: str = "",
    cleaning_checklist_template: ChecklistTemplate | None = None,
    cleaning_checklist_version: ChecklistVersion | None = None,
    packaging_artwork_hook: LineClearanceArtworkHook | None = None,
    previous_declaration: ProductAllergenDeclaration | None = None,
    next_declaration: ProductAllergenDeclaration | None = None,
    verification_notes: str = "",
    evidence_object_key: str = "",
    evidence_file_name: str = "",
    matrix_conflict_asserted: bool = False,
) -> tuple[ChangeoverRecord, dict[str, Any]]:
    """
    Record a changeover shell. Policy evaluation is advisory unless dual-gated ON.
    """
    user = _require_actor(actor)
    require_permission(user, MANAGE_CHANGEOVER, scope=_org_scope(organization.id))
    if previous_product.organization_id != organization.id:
        raise ValidationError(
            {"previous_product": "Previous product must belong to the organization."}
        )
    if next_product.organization_id != organization.id:
        raise ValidationError({"next_product": "Next product must belong to the organization."})
    if cleaning_checklist_template is not None:
        if cleaning_checklist_template.organization_id != organization.id:
            raise ValidationError(
                {
                    "cleaning_checklist_template": (
                        "Checklist template must belong to the organization."
                    )
                }
            )
    if cleaning_checklist_version is not None:
        if cleaning_checklist_template is None:
            raise ValidationError(
                {"cleaning_checklist_version": ("Checklist version requires a checklist template.")}
            )
        if cleaning_checklist_version.template_id != cleaning_checklist_template.id:
            raise ValidationError(
                {
                    "cleaning_checklist_version": (
                        "Checklist version must belong to the selected template."
                    )
                }
            )
    if packaging_artwork_hook is not None:
        if packaging_artwork_hook.organization_id != organization.id:
            raise ValidationError(
                {"packaging_artwork_hook": "Artwork hook must match organization."}
            )
    for decl, field in (
        (previous_declaration, "previous_declaration"),
        (next_declaration, "next_declaration"),
    ):
        if decl is None:
            continue
        if decl.organization_id != organization.id:
            raise ValidationError({field: "Declaration must match organization."})
        if decl.status != DeclarationStatus.APPROVED:
            raise ValidationError({field: "Only APPROVED allergen declarations may be referenced."})

    record = ChangeoverRecord(
        organization=organization,
        previous_product=previous_product,
        next_product=next_product,
        line_code=(line_code or "").strip()[:64],
        started_at=started_at or timezone.now(),
        completed_at=completed_at,
        status=ChangeoverStatus.RECORDED,
        batch_reference=(batch_reference or "").strip()[:128],
        cleaning_checklist_template=cleaning_checklist_template,
        cleaning_checklist_version=cleaning_checklist_version,
        packaging_artwork_hook=packaging_artwork_hook,
        previous_declaration=previous_declaration,
        next_declaration=next_declaration,
        verification_notes=(verification_notes or "").strip(),
        evidence_object_key=(evidence_object_key or "").strip()[:512],
        evidence_file_name=(evidence_file_name or "").strip()[:255],
        recorded_by=user,
    )
    record.full_clean()
    record.save()
    frozen = build_frozen_changeover_context(record)
    decision = evaluate_allergen_changeover_block(
        organization_id=organization.id,
        matrix_conflict_asserted=matrix_conflict_asserted,
    )
    frozen["allergen_block_decision"] = decision.as_dict()
    record.frozen_changeover_context = frozen
    record.save(update_fields=["frozen_changeover_context", "updated_at"])
    _history(
        organization_id=organization.id,
        actor=user,
        event_type="CHANGEOVER_RECORDED",
        changeover=record,
        metadata={"block_reason": decision.reason_code},
    )
    record_event(
        event_type="CHANGEOVER_RECORDED",
        actor=user,
        metadata={
            "changeover_id": str(record.id),
            "line_code": record.line_code,
            "batch_reference": record.batch_reference,
            "block_production": decision.block_production,
            "reason_code": decision.reason_code,
            "not_qa_disposition": True,
        },
    )
    return record, decision.as_dict()


@atomic_fn
def verify_changeover(
    *,
    actor: User | None,
    changeover: ChangeoverRecord,
    notes: str = "",
) -> ChangeoverRecord:
    user = _require_actor(actor)
    require_permission(user, VERIFY_CHANGEOVER, scope=_org_scope(changeover.organization_id))
    if changeover.status == ChangeoverStatus.VOIDED:
        raise ValidationError({"status": "Voided changeovers cannot be verified."})
    if changeover.status == ChangeoverStatus.VERIFIED:
        return changeover
    changeover.status = ChangeoverStatus.VERIFIED
    changeover.verified_by = user
    changeover.verified_at = timezone.now()
    if notes:
        changeover.verification_notes = notes.strip()
    if not changeover.completed_at:
        changeover.completed_at = timezone.now()
    frozen = dict(changeover.frozen_changeover_context or {})
    frozen.update(build_frozen_changeover_context(changeover))
    frozen["verified"] = True
    changeover.frozen_changeover_context = frozen
    changeover.save()
    _history(
        organization_id=changeover.organization_id,
        actor=user,
        event_type="CHANGEOVER_VERIFIED",
        changeover=changeover,
    )
    record_event(
        event_type="CHANGEOVER_VERIFIED",
        actor=user,
        metadata={"changeover_id": str(changeover.id)},
    )
    return changeover


@atomic_fn
def record_line_clearance(
    *,
    actor: User | None,
    organization: Organization,
    checklist_template: ChecklistTemplate,
    checklist_version: ChecklistVersion | None = None,
    checklist_submission: ChecklistSubmission | None = None,
    changeover: ChangeoverRecord | None = None,
    line_code: str = "",
    packaging_artwork_hook: LineClearanceArtworkHook | None = None,
    notes: str = "",
    evidence_object_key: str = "",
    completed_at: datetime | None = None,
) -> LineClearanceRecord:
    """Line clearance uses checklist engine references rather than hardcoded steps."""
    user = _require_actor(actor)
    require_permission(user, MANAGE_CHANGEOVER, scope=_org_scope(organization.id))
    if checklist_template.organization_id != organization.id:
        raise ValidationError({"checklist_template": "Checklist template must match organization."})
    if checklist_version is not None:
        if checklist_version.template_id != checklist_template.id:
            raise ValidationError(
                {"checklist_version": ("Checklist version must belong to the selected template.")}
            )
    if changeover is not None and changeover.organization_id != organization.id:
        raise ValidationError({"changeover": "Changeover must match organization."})
    if packaging_artwork_hook is not None:
        if packaging_artwork_hook.organization_id != organization.id:
            raise ValidationError(
                {"packaging_artwork_hook": "Artwork hook must match organization."}
            )
    if checklist_submission is not None:
        submission_org = getattr(
            getattr(checklist_submission, "checklist_record", None),
            "organization_id",
            None,
        )
        if submission_org is not None and submission_org != organization.id:
            raise ValidationError({"checklist_submission": "Submission must match organization."})

    record = LineClearanceRecord(
        organization=organization,
        changeover=changeover,
        line_code=(line_code or "").strip()[:64]
        or ((changeover.line_code if changeover else "") or ""),
        status=LineClearanceStatus.COMPLETED,
        checklist_template=checklist_template,
        checklist_version=checklist_version,
        checklist_submission=checklist_submission,
        packaging_artwork_hook=packaging_artwork_hook,
        notes=(notes or "").strip(),
        evidence_object_key=(evidence_object_key or "").strip()[:512],
        completed_at=completed_at or timezone.now(),
        recorded_by=user,
    )
    record.full_clean()
    record.save()
    record.frozen_clearance_context = build_frozen_line_clearance_context(record)
    record.save(update_fields=["frozen_clearance_context", "updated_at"])
    _history(
        organization_id=organization.id,
        actor=user,
        event_type="LINE_CLEARANCE_RECORDED",
        changeover=changeover,
        line_clearance=record,
    )
    record_event(
        event_type="LINE_CLEARANCE_RECORDED",
        actor=user,
        metadata={
            "line_clearance_id": str(record.id),
            "changeover_id": str(changeover.id) if changeover else None,
            "checklist_template_id": str(checklist_template.id),
            "checklist_version_id": (str(checklist_version.id) if checklist_version else None),
            "line_code": record.line_code,
            "batch_dossier_ready": True,
        },
    )
    return record


@atomic_fn
def upsert_allergen_risk_policy(
    *,
    actor: User | None,
    organization: Organization,
    policy_enabled: bool,
    procedure_reference: str = "",
    notes: str = "",
) -> AllergenRiskPolicy:
    user = _require_actor(actor)
    require_permission(user, MANAGE_POLICY, scope=_org_scope(organization.id))
    policy, _ = AllergenRiskPolicy.objects.update_or_create(
        organization=organization,
        defaults={
            "policy_enabled": bool(policy_enabled),
            "procedure_reference": (procedure_reference or "").strip()[:255],
            "notes": (notes or "").strip(),
            "updated_by": user,
        },
    )
    record_event(
        event_type="ALLERGEN_RISK_POLICY_UPDATED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "policy_enabled": policy.policy_enabled,
            "procedure_reference": policy.procedure_reference,
        },
    )
    return policy


def assert_can_view_changeover(*, actor: User, organization_id: uuid.UUID) -> None:
    org_scope = _org_scope(organization_id)
    if not (
        user_has_permission(actor, VIEW_CHANGEOVER, scope=org_scope)
        or user_has_permission(actor, MANAGE_CHANGEOVER, scope=org_scope)
        or user_has_permission(actor, VERIFY_CHANGEOVER, scope=org_scope)
    ):
        raise PermissionDenied("Permission denied.")
