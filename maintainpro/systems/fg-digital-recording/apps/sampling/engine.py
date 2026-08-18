"""Sampling resolution and acceptance evaluation — Phase 24.

Deterministic matching against *approved configuration only*.
No ISO/AQL tables. Sampling REJECT != QA REJECT.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import UUID

from django.db.models import Q

from apps.core.persistence import prefetch_related_compat
from apps.sampling.models import (
    SampleRequirement,
    SamplingEvaluationResult,
    SamplingPlanVersion,
    SamplingPlanVersionStatus,
    SamplingRule,
)


@dataclass(frozen=True, slots=True)
class SamplingMatchContext:
    organization_id: UUID
    lot_size: Decimal | None = None
    product_id: UUID | None = None
    product_group_code: str = ""
    inspection_type: str = ""
    risk_class: str = ""
    site_id: UUID | None = None
    process_code: str = ""
    as_of: date | None = None


@dataclass(frozen=True, slots=True)
class SamplingResolution:
    matched: bool
    reason_code: str
    plan_version_id: str | None
    rule_id: str | None
    required_sample_count: int | None
    sample_grouping: str
    accept_threshold: int | None
    reject_threshold: int | None
    inspection_level: str
    conflicting_rule_ids: tuple[str, ...]
    snapshot: dict[str, Any]

    def as_dict(self) -> dict[str, Any]:
        return {
            "matched": self.matched,
            "reason_code": self.reason_code,
            "plan_version_id": self.plan_version_id,
            "rule_id": self.rule_id,
            "required_sample_count": self.required_sample_count,
            "sample_grouping": self.sample_grouping,
            "accept_threshold": self.accept_threshold,
            "reject_threshold": self.reject_threshold,
            "inspection_level": self.inspection_level,
            "conflicting_rule_ids": list(self.conflicting_rule_ids),
            "snapshot": dict(self.snapshot),
            "not_qa_disposition": True,
        }


@dataclass(frozen=True, slots=True)
class SamplingAcceptanceOutcome:
    result: str
    reason_code: str
    defective_count: int | None
    accept_threshold: int | None
    reject_threshold: int | None
    advisory_only: bool = True

    def as_dict(self) -> dict[str, Any]:
        return {
            "result": self.result,
            "reason_code": self.reason_code,
            "defective_count": self.defective_count,
            "accept_threshold": self.accept_threshold,
            "reject_threshold": self.reject_threshold,
            "advisory_only": self.advisory_only,
            "not_qa_disposition": True,
            "message": "Sampling evaluation does not auto RELEASE/HOLD/REJECT.",
        }


def parse_lot_size(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ValueError("lot_size must be a Decimal-compatible quantity.") from None


def _dimension_matches(rule: SamplingRule, ctx: SamplingMatchContext) -> bool:
    if rule.product_id is not None:
        if ctx.product_id is None or rule.product_id != ctx.product_id:
            return False
    if rule.product_group_code:
        ctx_group = (ctx.product_group_code or "").strip().upper()
        if ctx_group != rule.product_group_code.strip().upper():
            return False
    if rule.inspection_type:
        if (ctx.inspection_type or "").strip().upper() != rule.inspection_type.strip().upper():
            return False
    if rule.risk_class:
        if (ctx.risk_class or "").strip().upper() != rule.risk_class.strip().upper():
            return False
    if rule.site_id is not None:
        if ctx.site_id is None or rule.site_id != ctx.site_id:
            return False
    if rule.process_code:
        if (ctx.process_code or "").strip().upper() != rule.process_code.strip().upper():
            return False
    if rule.lot_size_min is not None or rule.lot_size_max is not None:
        if ctx.lot_size is None:
            return False
        if rule.lot_size_min is not None and ctx.lot_size < rule.lot_size_min:
            return False
        if rule.lot_size_max is not None and ctx.lot_size > rule.lot_size_max:
            return False
    return True


def _effective_versions(*, organization_id: UUID, as_of: date) -> list[SamplingPlanVersion]:
    qs = SamplingPlanVersion.objects.filter(
        plan__organization_id=organization_id,
        plan__is_active=True,
        status=SamplingPlanVersionStatus.APPROVED,
    ).filter(
        (Q(effective_from__isnull=True) | Q(effective_from__lte=as_of))
        & (Q(effective_to__isnull=True) | Q(effective_to__gte=as_of))
    )
    return list(
        prefetch_related_compat(qs.select_related("plan"), "rules__requirement")
    )


def resolve_sampling_requirement(
    *,
    context: SamplingMatchContext,
    plan_version: SamplingPlanVersion | None = None,
) -> SamplingResolution:
    """
    Resolve sample requirements from approved rules.

    If ``plan_version`` is provided, only that version is considered (historical path).
    """
    as_of = context.as_of or date.today()
    empty_snap: dict[str, Any] = {
        "organization_id": str(context.organization_id),
        "as_of": str(as_of),
        "not_qa_disposition": True,
    }
    if plan_version is not None:
        versions = [plan_version]
        if plan_version.plan.organization_id != context.organization_id:
            return SamplingResolution(
                matched=False,
                reason_code="CROSS_ORG_DENIED",
                plan_version_id=None,
                rule_id=None,
                required_sample_count=None,
                sample_grouping="",
                accept_threshold=None,
                reject_threshold=None,
                inspection_level="",
                conflicting_rule_ids=(),
                snapshot=empty_snap,
            )
        # Historical resolve may use a pinned/retired version; live callers pass APPROVED.
        _ = plan_version.status
    else:
        versions = _effective_versions(organization_id=context.organization_id, as_of=as_of)
        if not versions:
            return SamplingResolution(
                matched=False,
                reason_code="NO_EFFECTIVE_PLAN",
                plan_version_id=None,
                rule_id=None,
                required_sample_count=None,
                sample_grouping="",
                accept_threshold=None,
                reject_threshold=None,
                inspection_level="",
                conflicting_rule_ids=(),
                snapshot=empty_snap,
            )

    matches: list[tuple[SamplingPlanVersion, SamplingRule, SampleRequirement | None]] = []
    for version in versions:
        if hasattr(version, "_prefetched_objects_cache"):
            rules = list(version.rules.all())
        else:
            rules = list(
                SamplingRule.objects.filter(plan_version=version).select_related("requirement")
            )
        # Ensure requirement is available
        for rule in rules:
            if not _dimension_matches(rule, context):
                continue
            req: SampleRequirement | None
            try:
                req = rule.requirement
            except SampleRequirement.DoesNotExist:
                req = None
            matches.append((version, rule, req))

    if not matches:
        return SamplingResolution(
            matched=False,
            reason_code="NO_MATCHING_RULE",
            plan_version_id=str(versions[0].id) if len(versions) == 1 else None,
            rule_id=None,
            required_sample_count=None,
            sample_grouping="",
            accept_threshold=None,
            reject_threshold=None,
            inspection_level="",
            conflicting_rule_ids=(),
            snapshot=empty_snap,
        )

    # Deterministic winner: lowest priority, then code.
    matches.sort(key=lambda row: (row[1].priority, row[1].code.lower()))
    best_priority = matches[0][1].priority
    same_priority = [m for m in matches if m[1].priority == best_priority]
    if len(same_priority) > 1:
        # Same priority = conflict; keep code-order pick for stability.
        conflict_ids = tuple(str(m[1].id) for m in same_priority)
        version, rule, req = same_priority[0]
        snap = _snapshot(version, rule, req, context, as_of)
        return SamplingResolution(
            matched=True,
            reason_code="CONFLICTING_RULES",
            plan_version_id=str(version.id),
            rule_id=str(rule.id),
            required_sample_count=req.required_sample_count if req else None,
            sample_grouping=(req.sample_grouping if req else "") or "",
            accept_threshold=req.accept_threshold if req else None,
            reject_threshold=req.reject_threshold if req else None,
            inspection_level=(req.inspection_level if req else "") or "",
            conflicting_rule_ids=conflict_ids,
            snapshot=snap,
        )

    version, rule, req = matches[0]
    snap = _snapshot(version, rule, req, context, as_of)
    return SamplingResolution(
        matched=True,
        reason_code="MATCHED",
        plan_version_id=str(version.id),
        rule_id=str(rule.id),
        required_sample_count=req.required_sample_count if req else None,
        sample_grouping=(req.sample_grouping if req else "") or "",
        accept_threshold=req.accept_threshold if req else None,
        reject_threshold=req.reject_threshold if req else None,
        inspection_level=(req.inspection_level if req else "") or "",
        conflicting_rule_ids=(),
        snapshot=snap,
    )


def _snapshot(
    version: SamplingPlanVersion,
    rule: SamplingRule,
    req: SampleRequirement | None,
    context: SamplingMatchContext,
    as_of: date,
) -> dict[str, Any]:
    return {
        "organization_id": str(context.organization_id),
        "as_of": str(as_of),
        "plan_id": str(version.plan_id),
        "plan_code": version.plan.code,
        "plan_version_id": str(version.id),
        "version_number": version.version_number,
        "plan_version_status": version.status,
        "rule_id": str(rule.id),
        "rule_code": rule.code,
        "rule_priority": rule.priority,
        "required_sample_count": req.required_sample_count if req else None,
        "accept_threshold": req.accept_threshold if req else None,
        "reject_threshold": req.reject_threshold if req else None,
        "inspection_level": (req.inspection_level if req else "") or "",
        "lot_size": str(context.lot_size) if context.lot_size is not None else None,
        "not_qa_disposition": True,
        "external_standard_source": version.plan.external_standard_source or "",
    }


def evaluate_sampling_acceptance(
    *,
    defective_count: int | None,
    accept_threshold: int | None,
    reject_threshold: int | None,
) -> SamplingAcceptanceOutcome:
    """
    Deterministic accept/reject from configured thresholds only.

    Missing thresholds => NOT_EVALUATED. Never implies QA disposition.
    """
    if accept_threshold is None or reject_threshold is None:
        return SamplingAcceptanceOutcome(
            result=SamplingEvaluationResult.NOT_EVALUATED,
            reason_code="THRESHOLDS_NOT_CONFIGURED",
            defective_count=defective_count,
            accept_threshold=accept_threshold,
            reject_threshold=reject_threshold,
        )
    if defective_count is None:
        return SamplingAcceptanceOutcome(
            result=SamplingEvaluationResult.NOT_EVALUATED,
            reason_code="DEFECTIVE_COUNT_MISSING",
            defective_count=None,
            accept_threshold=accept_threshold,
            reject_threshold=reject_threshold,
        )
    if defective_count <= accept_threshold:
        return SamplingAcceptanceOutcome(
            result=SamplingEvaluationResult.ACCEPT,
            reason_code="WITHIN_ACCEPT_THRESHOLD",
            defective_count=defective_count,
            accept_threshold=accept_threshold,
            reject_threshold=reject_threshold,
        )
    if defective_count >= reject_threshold:
        return SamplingAcceptanceOutcome(
            result=SamplingEvaluationResult.REJECT,
            reason_code="MEETS_REJECT_THRESHOLD",
            defective_count=defective_count,
            accept_threshold=accept_threshold,
            reject_threshold=reject_threshold,
        )
    return SamplingAcceptanceOutcome(
        result=SamplingEvaluationResult.NOT_EVALUATED,
        reason_code="BETWEEN_THRESHOLDS_PENDING_POLICY",
        defective_count=defective_count,
        accept_threshold=accept_threshold,
        reject_threshold=reject_threshold,
    )
