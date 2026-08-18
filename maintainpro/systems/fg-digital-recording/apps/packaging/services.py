"""Packaging artwork services — Phase 29.

Product Master drafts artwork; Document Control approves/retires.
Does not invent shelf life, date-code formulas, or customer label rules.
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError
from django.utils import timezone

from apps.core.persistence.transactions import atomic_fn
from apps.access_control.services import Scope, require_permission, user_has_permission
from apps.accounts.models import User
from apps.checklists.models import ChecklistItem, ChecklistTemplate
from apps.master_data.models import FGProduct
from apps.organizations.models import Organization
from apps.organizations.services import normalize_code
from apps.packaging.models import (
    ArtworkVerificationRecord,
    ArtworkVersion,
    ArtworkVersionStatus,
    ChecklistItemArtworkBinding,
    LineClearanceArtworkHook,
    PackagingArtwork,
    PackagingHistoryEntry,
)
from apps.packaging.snapshots import build_frozen_artwork_context
from apps.packaging.verification import assert_artwork_matches_expected
from apps.security_audit.services import record_event

MANAGE = "packaging.manage_packagingartwork"
APPROVE = "packaging.approve_packagingartwork"
VIEW = "packaging.view_packaging"


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
    artwork: PackagingArtwork | None = None,
    artwork_version: ArtworkVersion | None = None,
    note: str = "",
    metadata: dict[str, Any] | None = None,
) -> PackagingHistoryEntry:
    return PackagingHistoryEntry.objects.create(
        organization_id=organization_id,
        artwork=artwork,
        artwork_version=artwork_version,
        event_type=event_type,
        note=(note or "").strip()[:255],
        metadata=metadata or {},
        actor=actor,
    )


def _assert_draft(version: ArtworkVersion) -> None:
    if version.is_immutable:
        raise ValidationError({"status": "Approved or retired artwork versions are immutable."})


@atomic_fn
def create_packaging_artwork(
    *,
    actor: User | None,
    organization: Organization,
    product: FGProduct,
    code: str,
    title: str,
    pack_configuration_label: str = "",
    description: str = "",
) -> PackagingArtwork:
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(organization.id))
    if product.organization_id != organization.id:
        raise ValidationError({"product": "Product must belong to the organization."})
    normalized = normalize_code(code)
    if not normalized or not (title or "").strip():
        raise ValidationError({"code": "Artwork code and title are required."})
    try:
        artwork = PackagingArtwork.objects.create(
            organization=organization,
            product=product,
            code=normalized,
            title=title.strip(),
            pack_configuration_label=(pack_configuration_label or "").strip()[:128],
            description=(description or "").strip(),
            created_by=user,
        )
    except IntegrityError as exc:
        raise ValidationError({"code": "Artwork code already exists."}) from exc
    ArtworkVersion.objects.create(
        artwork=artwork,
        version_number=1,
        status=ArtworkVersionStatus.DRAFT,
        change_summary="Initial draft",
        created_by=user,
    )
    _history(
        organization_id=organization.id,
        actor=user,
        event_type="ARTWORK_CREATED",
        artwork=artwork,
    )
    record_event(
        event_type="PACKAGING_ARTWORK_CREATED",
        actor=user,
        metadata={
            "artwork_id": str(artwork.id),
            "organization_id": str(organization.id),
            "product_id": str(product.id),
            "code": artwork.code,
        },
    )
    return artwork


@atomic_fn
def create_artwork_version_draft(
    *,
    actor: User | None,
    artwork: PackagingArtwork,
    change_summary: str = "",
    date_code_format_reference: str = "",
    batch_code_format_reference: str = "",
    approval_reference: str = "",
    evidence_object_key: str = "",
    evidence_file_name: str = "",
    evidence_content_type: str = "",
    notes: str = "",
) -> ArtworkVersion:
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(artwork.organization_id))
    latest = artwork.versions.order_by("-version_number").first()
    next_number = (latest.version_number + 1) if latest else 1
    version = ArtworkVersion.objects.create(
        artwork=artwork,
        version_number=next_number,
        status=ArtworkVersionStatus.DRAFT,
        change_summary=(change_summary or "").strip(),
        date_code_format_reference=(date_code_format_reference or "").strip()[:255],
        batch_code_format_reference=(batch_code_format_reference or "").strip()[:255],
        approval_reference=(approval_reference or "").strip()[:255],
        evidence_object_key=(evidence_object_key or "").strip()[:512],
        evidence_file_name=(evidence_file_name or "").strip()[:255],
        evidence_content_type=(evidence_content_type or "").strip()[:128],
        notes=(notes or "").strip(),
        created_by=user,
    )
    _history(
        organization_id=artwork.organization_id,
        actor=user,
        event_type="ARTWORK_VERSION_CREATED",
        artwork=artwork,
        artwork_version=version,
    )
    record_event(
        event_type="PACKAGING_ARTWORK_VERSION_CREATED",
        actor=user,
        metadata={
            "artwork_version_id": str(version.id),
            "artwork_id": str(artwork.id),
            "version_number": next_number,
        },
    )
    return version


@atomic_fn
def update_artwork_version_draft(
    *,
    actor: User | None,
    version: ArtworkVersion,
    change_summary: str | None = None,
    date_code_format_reference: str | None = None,
    batch_code_format_reference: str | None = None,
    approval_reference: str | None = None,
    evidence_object_key: str | None = None,
    evidence_file_name: str | None = None,
    evidence_content_type: str | None = None,
    notes: str | None = None,
    effective_from: date | None = None,
    effective_to: date | None = None,
    clear_effective_from: bool = False,
    clear_effective_to: bool = False,
) -> ArtworkVersion:
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(version.artwork.organization_id))
    _assert_draft(version)
    if change_summary is not None:
        version.change_summary = change_summary.strip()
    if date_code_format_reference is not None:
        version.date_code_format_reference = date_code_format_reference.strip()[:255]
    if batch_code_format_reference is not None:
        version.batch_code_format_reference = batch_code_format_reference.strip()[:255]
    if approval_reference is not None:
        version.approval_reference = approval_reference.strip()[:255]
    if evidence_object_key is not None:
        version.evidence_object_key = evidence_object_key.strip()[:512]
    if evidence_file_name is not None:
        version.evidence_file_name = evidence_file_name.strip()[:255]
    if evidence_content_type is not None:
        version.evidence_content_type = evidence_content_type.strip()[:128]
    if notes is not None:
        version.notes = notes.strip()
    if clear_effective_from:
        version.effective_from = None
    elif effective_from is not None:
        version.effective_from = effective_from
    if clear_effective_to:
        version.effective_to = None
    elif effective_to is not None:
        version.effective_to = effective_to
    version.full_clean()
    version.save()
    return version


@atomic_fn
def approve_artwork_version(
    *,
    actor: User | None,
    version: ArtworkVersion,
    effective_from: date | None = None,
    effective_to: date | None = None,
    approval_reference: str = "",
) -> ArtworkVersion:
    """Document Control approval — separate from Product Master manage permission."""
    user = _require_actor(actor)
    org_id = version.artwork.organization_id
    require_permission(user, APPROVE, scope=_org_scope(org_id))
    if version.status != ArtworkVersionStatus.DRAFT:
        raise ValidationError({"status": "Only draft versions can be approved."})
    if effective_from is not None:
        version.effective_from = effective_from
    if effective_to is not None:
        version.effective_to = effective_to
    if approval_reference:
        version.approval_reference = approval_reference.strip()[:255]
    version.full_clean()
    version.status = ArtworkVersionStatus.APPROVED
    version.approved_by = user
    version.approved_at = timezone.now()
    version.save()
    _history(
        organization_id=org_id,
        actor=user,
        event_type="ARTWORK_VERSION_APPROVED",
        artwork=version.artwork,
        artwork_version=version,
    )
    record_event(
        event_type="PACKAGING_ARTWORK_VERSION_APPROVED",
        actor=user,
        metadata={
            "artwork_version_id": str(version.id),
            "artwork_id": str(version.artwork_id),
            "version_number": version.version_number,
            "approval_reference": version.approval_reference,
        },
    )
    return version


@atomic_fn
def retire_artwork_version(
    *,
    actor: User | None,
    version: ArtworkVersion,
) -> ArtworkVersion:
    user = _require_actor(actor)
    org_id = version.artwork.organization_id
    require_permission(user, APPROVE, scope=_org_scope(org_id))
    if version.status != ArtworkVersionStatus.APPROVED:
        raise ValidationError({"status": "Only approved versions can be retired."})
    version.status = ArtworkVersionStatus.RETIRED
    version.save(update_fields=["status", "updated_at"])
    _history(
        organization_id=org_id,
        actor=user,
        event_type="ARTWORK_VERSION_RETIRED",
        artwork=version.artwork,
        artwork_version=version,
    )
    record_event(
        event_type="PACKAGING_ARTWORK_VERSION_RETIRED",
        actor=user,
        metadata={"artwork_version_id": str(version.id)},
    )
    return version


@atomic_fn
def bind_checklist_item_to_artwork(
    *,
    actor: User | None,
    checklist_item: ChecklistItem,
    artwork_version: ArtworkVersion,
) -> ChecklistItemArtworkBinding:
    user = _require_actor(actor)
    org_id = checklist_item.section.version.template.organization_id
    require_permission(user, MANAGE, scope=_org_scope(org_id))
    # Reload to avoid stale draft status on callers.
    version = (
        ArtworkVersion.objects.select_related("artwork__product")
        .filter(pk=artwork_version.pk)
        .first()
    )
    if version is None:
        raise ValidationError({"artwork_version": "Artwork version not found."})
    if version.artwork.organization_id != org_id:
        raise PermissionDenied("Cross-organization artwork binding is denied.")
    if version.status != ArtworkVersionStatus.APPROVED:
        raise ValidationError({"artwork_version": "Only APPROVED artwork versions may be bound."})
    frozen = build_frozen_artwork_context(version)
    frozen["checklist_item_id"] = str(checklist_item.id)
    binding, _ = ChecklistItemArtworkBinding.objects.update_or_create(
        checklist_item=checklist_item,
        defaults={
            "artwork_version": version,
            "frozen_artwork_context": frozen,
        },
    )
    _history(
        organization_id=org_id,
        actor=user,
        event_type="CHECKLIST_ITEM_ARTWORK_BOUND",
        artwork=version.artwork,
        artwork_version=version,
        metadata={"checklist_item_id": str(checklist_item.id)},
    )
    record_event(
        event_type="PACKAGING_ARTWORK_CHECKLIST_BINDING_SET",
        actor=user,
        metadata={
            "checklist_item_id": str(checklist_item.id),
            "artwork_version_id": str(version.id),
        },
    )
    return binding


@atomic_fn
def create_line_clearance_hook(
    *,
    actor: User | None,
    organization: Organization,
    artwork_version: ArtworkVersion,
    code: str,
    title: str = "",
    line_code: str = "",
    checklist_template: ChecklistTemplate | None = None,
    notes: str = "",
) -> LineClearanceArtworkHook:
    """Prepared future changeover/line-clearance link — not a clearance workflow."""
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(organization.id))
    version = ArtworkVersion.objects.select_related("artwork").filter(pk=artwork_version.pk).first()
    if version is None:
        raise ValidationError({"artwork_version": "Artwork version not found."})
    if version.artwork.organization_id != organization.id:
        raise ValidationError({"artwork_version": "Artwork must belong to the organization."})
    if version.status != ArtworkVersionStatus.APPROVED:
        raise ValidationError({"artwork_version": "Only APPROVED artwork versions may be hooked."})
    if checklist_template is not None and checklist_template.organization_id != organization.id:
        raise ValidationError({"checklist_template": "Template must belong to the organization."})
    normalized = normalize_code(code)
    if not normalized:
        raise ValidationError({"code": "Hook code is required."})
    try:
        hook = LineClearanceArtworkHook(
            organization=organization,
            code=normalized,
            title=(title or "").strip()[:255],
            artwork_version=version,
            line_code=(line_code or "").strip()[:64],
            checklist_template=checklist_template,
            notes=(notes or "").strip(),
            created_by=user,
        )
        hook.full_clean()
        hook.save()
    except IntegrityError as exc:
        raise ValidationError({"code": "Hook code already exists."}) from exc
    record_event(
        event_type="PACKAGING_LINE_CLEARANCE_HOOK_CREATED",
        actor=user,
        metadata={
            "hook_id": str(hook.id),
            "artwork_version_id": str(version.id),
            "line_code": hook.line_code,
        },
    )
    return hook


@atomic_fn
def record_artwork_verification(
    *,
    actor: User | None,
    organization: Organization,
    artwork_version: ArtworkVersion,
    batch_reference: str = "",
    mfg_date: date | None = None,
    exp_date: date | None = None,
    batch_code: str = "",
    observed_artwork_version_id: uuid.UUID | None = None,
    notes: str = "",
) -> tuple[ArtworkVerificationRecord, dict[str, Any]]:
    """
    Record batch artwork verification values.

    Does not calculate EXP from shelf life. Wrong observed version is reported
    via match decision — not a QA disposition.
    """
    user = _require_actor(actor)
    org_scope = _org_scope(organization.id)
    if not (
        user_has_permission(user, MANAGE, scope=org_scope)
        or user_has_permission(user, VIEW, scope=org_scope)
    ):
        raise PermissionDenied("Permission denied.")

    version = (
        ArtworkVersion.objects.select_related("artwork__product")
        .filter(pk=artwork_version.pk)
        .first()
    )
    if version is None:
        raise ValidationError({"artwork_version": "Artwork version not found."})
    if version.artwork.organization_id != organization.id:
        raise PermissionDenied("Cross-organization verification denied.")
    if version.status != ArtworkVersionStatus.APPROVED:
        raise ValidationError(
            {"artwork_version": "Only APPROVED artwork versions may be verified against."}
        )

    observed_id = observed_artwork_version_id or version.id
    decision = assert_artwork_matches_expected(
        expected_version=version,
        observed_artwork_version_id=observed_id,
    )
    # Wrong artwork is recorded with matched=False — not a QA disposition.
    frozen = build_frozen_artwork_context(version)
    frozen["verification"] = decision.as_dict()
    frozen["batch_reference"] = (batch_reference or "").strip()[:128]
    frozen["mfg_date"] = mfg_date.isoformat() if mfg_date else None
    frozen["exp_date"] = exp_date.isoformat() if exp_date else None
    frozen["batch_code"] = (batch_code or "").strip()[:128]

    record = ArtworkVerificationRecord.objects.create(
        organization=organization,
        artwork_version=version,
        batch_reference=(batch_reference or "").strip()[:128],
        mfg_date=mfg_date,
        exp_date=exp_date,
        batch_code=(batch_code or "").strip()[:128],
        date_code_format_reference_snapshot=version.date_code_format_reference,
        frozen_artwork_context=frozen,
        notes=(notes or "").strip(),
        recorded_by=user,
    )
    _history(
        organization_id=organization.id,
        actor=user,
        event_type="ARTWORK_VERIFICATION_RECORDED",
        artwork=version.artwork,
        artwork_version=version,
        metadata={"verification_id": str(record.id), "matched": decision.matched},
    )
    record_event(
        event_type="PACKAGING_ARTWORK_VERIFICATION_RECORDED",
        actor=user,
        metadata={
            "verification_id": str(record.id),
            "artwork_version_id": str(version.id),
            "matched": decision.matched,
            "reason_code": decision.reason_code,
            "not_qa_disposition": True,
        },
    )
    return record, decision.as_dict()
