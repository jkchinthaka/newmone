"""Sampling plan services — Phase 24."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError, transaction
from apps.core.persistence import lock_queryset, locked_get
from django.utils import timezone

from apps.access_control.services import Scope, require_permission
from apps.accounts.models import User
from apps.checklists.models import ChecklistItem, ChecklistItemKind
from apps.master_data.models import FGProduct
from apps.organizations.models import Organization, Site
from apps.organizations.services import normalize_code
from apps.sampling.models import (
    ChecklistItemSamplingBinding,
    SampleRequirement,
    SamplingHistoryEntry,
    SamplingPlan,
    SamplingPlanVersion,
    SamplingPlanVersionStatus,
    SamplingRule,
)
from apps.security_audit.services import record_event

MANAGE = "sampling.manage_samplingplan"
PUBLISH = "sampling.publish_samplingplan"
VIEW = "sampling.view_sampling"


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
    plan: SamplingPlan | None = None,
    plan_version: SamplingPlanVersion | None = None,
    note: str = "",
    metadata: dict[str, Any] | None = None,
) -> SamplingHistoryEntry:
    return SamplingHistoryEntry.objects.create(
        organization_id=organization_id,
        plan=plan,
        plan_version=plan_version,
        event_type=event_type,
        note=(note or "").strip()[:255],
        metadata=metadata or {},
        actor=actor,
    )


def _assert_draft(version: SamplingPlanVersion) -> None:
    if version.is_immutable:
        raise ValidationError(
            {"status": "Approved or retired sampling plan versions are immutable."}
        )


@transaction.atomic
def create_sampling_plan(
    *,
    actor: User | None,
    organization: Organization,
    code: str,
    title: str,
    description: str = "",
    external_standard_source: str = "",
) -> SamplingPlan:
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(organization.id))
    normalized = normalize_code(code)
    if not normalized or not (title or "").strip():
        raise ValidationError({"code": "Plan code and title are required."})
    try:
        plan = SamplingPlan.objects.create(
            organization=organization,
            code=normalized,
            title=title.strip(),
            description=(description or "").strip(),
            external_standard_source=(external_standard_source or "").strip(),
            created_by=user,
        )
    except IntegrityError as exc:
        raise ValidationError({"code": "Plan code already exists in organization."}) from exc
    _history(
        organization_id=organization.id,
        actor=user,
        event_type="PLAN_CREATED",
        plan=plan,
    )
    record_event(
        event_type="SAMPLING_PLAN_CREATED",
        actor=user,
        metadata={"organization_id": str(organization.id), "plan_id": str(plan.id)},
    )
    return plan


@transaction.atomic
def create_draft_plan_version(
    *,
    actor: User | None,
    plan_id: uuid.UUID,
    change_summary: str = "",
    effective_from: date | None = None,
    effective_to: date | None = None,
) -> SamplingPlanVersion:
    user = _require_actor(actor)
    plan = locked_get(SamplingPlan, pk=plan_id)
    if plan is None:
        raise ValidationError({"plan": "Sampling plan not found."})
    require_permission(user, MANAGE, scope=_org_scope(plan.organization_id))
    if effective_from is not None and effective_to is not None and effective_to < effective_from:
        raise ValidationError({"effective_to": "effective_to cannot be before effective_from."})
    next_number = (
        SamplingPlanVersion.objects.filter(plan_id=plan.id)
        .order_by("-version_number")
        .values_list("version_number", flat=True)
        .first()
        or 0
    ) + 1
    version = SamplingPlanVersion.objects.create(
        plan=plan,
        version_number=next_number,
        status=SamplingPlanVersionStatus.DRAFT,
        change_summary=(change_summary or "").strip(),
        effective_from=effective_from,
        effective_to=effective_to,
        created_by=user,
    )
    _history(
        organization_id=plan.organization_id,
        actor=user,
        event_type="VERSION_CREATED",
        plan=plan,
        plan_version=version,
        metadata={"version_number": next_number},
    )
    record_event(
        event_type="SAMPLING_PLAN_VERSION_CREATED",
        actor=user,
        metadata={
            "organization_id": str(plan.organization_id),
            "plan_id": str(plan.id),
            "plan_version_id": str(version.id),
            "version_number": next_number,
        },
    )
    return version


@transaction.atomic
def add_sampling_rule(
    *,
    actor: User | None,
    plan_version_id: uuid.UUID,
    code: str,
    title: str = "",
    priority: int = 100,
    product: FGProduct | None = None,
    product_group_code: str = "",
    lot_size_min: Decimal | None = None,
    lot_size_max: Decimal | None = None,
    inspection_type: str = "",
    risk_class: str = "",
    site: Site | None = None,
    process_code: str = "",
    notes: str = "",
) -> SamplingRule:
    user = _require_actor(actor)
    version = SamplingPlanVersion.objects.select_related("plan").filter(pk=plan_version_id).first()
    if version is None:
        raise ValidationError({"plan_version": "Plan version not found."})
    require_permission(user, MANAGE, scope=_org_scope(version.plan.organization_id))
    _assert_draft(version)
    if product is not None and product.organization_id != version.plan.organization_id:
        raise PermissionDenied("Cross-organization product link is denied.")
    if site is not None and site.organization_id != version.plan.organization_id:
        raise PermissionDenied("Cross-organization site link is denied.")
    normalized = normalize_code(code)
    if not normalized:
        raise ValidationError({"code": "Rule code is required."})
    rule = SamplingRule(
        plan_version=version,
        code=normalized,
        title=(title or "").strip(),
        priority=max(1, int(priority)),
        product=product,
        product_group_code=(product_group_code or "").strip(),
        lot_size_min=lot_size_min,
        lot_size_max=lot_size_max,
        inspection_type=(inspection_type or "").strip(),
        risk_class=(risk_class or "").strip(),
        site=site,
        process_code=(process_code or "").strip(),
        notes=(notes or "").strip(),
    )
    rule.full_clean()
    try:
        rule.save()
    except IntegrityError as exc:
        raise ValidationError({"code": "Rule code already exists on this version."}) from exc
    _history(
        organization_id=version.plan.organization_id,
        actor=user,
        event_type="RULE_ADDED",
        plan=version.plan,
        plan_version=version,
        metadata={"rule_id": str(rule.id)},
    )
    return rule


@transaction.atomic
def set_sample_requirement(
    *,
    actor: User | None,
    rule_id: uuid.UUID,
    required_sample_count: int | None = None,
    sample_grouping: str = "",
    accept_threshold: int | None = None,
    reject_threshold: int | None = None,
    inspection_level: str = "",
    notes: str = "",
) -> SampleRequirement:
    """Attach approved outputs only — callers must not invent ISO/AQL numbers."""
    user = _require_actor(actor)
    rule = (
        SamplingRule.objects.select_related("plan_version", "plan_version__plan")
        .filter(pk=rule_id)
        .first()
    )
    if rule is None:
        raise ValidationError({"rule": "Sampling rule not found."})
    require_permission(user, MANAGE, scope=_org_scope(rule.plan_version.plan.organization_id))
    _assert_draft(rule.plan_version)
    req = SampleRequirement(
        rule=rule,
        required_sample_count=required_sample_count,
        sample_grouping=(sample_grouping or "").strip(),
        accept_threshold=accept_threshold,
        reject_threshold=reject_threshold,
        inspection_level=(inspection_level or "").strip(),
        notes=(notes or "").strip(),
    )
    # update_or_create via full_clean path
    existing = SampleRequirement.objects.filter(rule=rule).first()
    if existing is not None:
        existing.required_sample_count = required_sample_count
        existing.sample_grouping = req.sample_grouping
        existing.accept_threshold = accept_threshold
        existing.reject_threshold = reject_threshold
        existing.inspection_level = req.inspection_level
        existing.notes = req.notes
        existing.full_clean()
        existing.save()
        return existing
    req.full_clean()
    req.save()
    return req


@transaction.atomic
def approve_plan_version(
    *,
    actor: User | None,
    plan_version_id: uuid.UUID,
    effective_from: date | None = None,
    effective_to: date | None = None,
) -> SamplingPlanVersion:
    user = _require_actor(actor)
    version = (
        lock_queryset(
        SamplingPlanVersion.objects.select_related("plan").filter(pk=plan_version_id)
        ).first()
    )
    if version is None:
        raise ValidationError({"plan_version": "Plan version not found."})
    require_permission(user, PUBLISH, scope=_org_scope(version.plan.organization_id))
    if version.status != SamplingPlanVersionStatus.DRAFT:
        raise ValidationError({"status": "Only DRAFT versions can be approved."})
    if effective_from is not None:
        version.effective_from = effective_from
    if effective_to is not None:
        version.effective_to = effective_to
    if (
        version.effective_from is not None
        and version.effective_to is not None
        and version.effective_to < version.effective_from
    ):
        raise ValidationError({"effective_to": "effective_to cannot be before effective_from."})
    version.status = SamplingPlanVersionStatus.APPROVED
    version.approved_by = user
    version.approved_at = timezone.now()
    version.save(
        update_fields=[
            "status",
            "approved_by",
            "approved_at",
            "effective_from",
            "effective_to",
            "updated_at",
        ]
    )
    _history(
        organization_id=version.plan.organization_id,
        actor=user,
        event_type="VERSION_APPROVED",
        plan=version.plan,
        plan_version=version,
    )
    record_event(
        event_type="SAMPLING_PLAN_VERSION_APPROVED",
        actor=user,
        metadata={
            "organization_id": str(version.plan.organization_id),
            "plan_version_id": str(version.id),
            "version_number": version.version_number,
        },
    )
    return version


@transaction.atomic
def retire_plan_version(*, actor: User | None, plan_version_id: uuid.UUID) -> SamplingPlanVersion:
    user = _require_actor(actor)
    version = (
        lock_queryset(
        SamplingPlanVersion.objects.select_related("plan").filter(pk=plan_version_id)
        ).first()
    )
    if version is None:
        raise ValidationError({"plan_version": "Plan version not found."})
    require_permission(user, PUBLISH, scope=_org_scope(version.plan.organization_id))
    if version.status != SamplingPlanVersionStatus.APPROVED:
        raise ValidationError({"status": "Only APPROVED versions can be retired."})
    version.status = SamplingPlanVersionStatus.RETIRED
    version.save(update_fields=["status", "updated_at"])
    _history(
        organization_id=version.plan.organization_id,
        actor=user,
        event_type="VERSION_RETIRED",
        plan=version.plan,
        plan_version=version,
    )
    record_event(
        event_type="SAMPLING_PLAN_VERSION_RETIRED",
        actor=user,
        metadata={
            "organization_id": str(version.plan.organization_id),
            "plan_version_id": str(version.id),
        },
    )
    return version


@transaction.atomic
def bind_checklist_item_to_sampling_plan(
    *,
    actor: User | None,
    checklist_item_id: uuid.UUID,
    plan_version_id: uuid.UUID,
) -> ChecklistItemSamplingBinding:
    user = _require_actor(actor)
    item = (
        ChecklistItem.objects.select_related(
            "section__version__template__organization",
        )
        .filter(pk=checklist_item_id)
        .first()
    )
    if item is None:
        raise ValidationError({"checklist_item": "Checklist item not found."})
    if item.item_kind != ChecklistItemKind.REPEATING_GROUP:
        raise ValidationError(
            {"checklist_item": "Sampling bindings apply to REPEATING_GROUP items only."}
        )
    org_id = item.section.version.template.organization_id
    require_permission(user, MANAGE, scope=_org_scope(org_id))
    version = SamplingPlanVersion.objects.select_related("plan").filter(pk=plan_version_id).first()
    if version is None:
        raise ValidationError({"plan_version": "Plan version not found."})
    if version.plan.organization_id != org_id:
        raise PermissionDenied("Cross-organization sampling binding is denied.")
    frozen = {
        "plan_id": str(version.plan_id),
        "plan_code": version.plan.code,
        "plan_version_id": str(version.id),
        "version_number": version.version_number,
        "plan_version_status": version.status,
        "checklist_item_id": str(item.id),
        "not_qa_disposition": True,
        "external_standard_source": version.plan.external_standard_source or "",
    }
    binding, _ = ChecklistItemSamplingBinding.objects.update_or_create(
        checklist_item=item,
        defaults={"plan_version": version, "frozen_sampling_context": frozen},
    )
    _history(
        organization_id=org_id,
        actor=user,
        event_type="CHECKLIST_ITEM_BOUND",
        plan=version.plan,
        plan_version=version,
        metadata={"checklist_item_id": str(item.id)},
    )
    record_event(
        event_type="SAMPLING_CHECKLIST_BINDING_SET",
        actor=user,
        metadata={
            "organization_id": str(org_id),
            "checklist_item_id": str(item.id),
            "plan_version_id": str(version.id),
        },
    )
    return binding
