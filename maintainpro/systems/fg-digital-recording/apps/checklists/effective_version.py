"""Checklist effective-version selection (Phase 07D).

Deterministic selection of exactly one PUBLISHED ChecklistVersion for a template
at a caller-supplied as_of instant.

Business policy (APR-015) is unresolved — callers choose which instant to pass
(task creation / batch creation / production completion / other approved event).
This module does not invent that policy.

Outcomes are explicit:
  ONE_ELIGIBLE_VERSION
  NO_ELIGIBLE_VERSION (BLOCKED)
  OVERLAPPING_ELIGIBLE_VERSIONS (conflict — never arbitrary pick)
  INVALID_TEMPLATE

RETIRED versions remain readable historically but are never newly selected.
Existing ChecklistTask pins are never auto-upgraded by this engine.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db.models import Q, QuerySet
from django.utils import timezone

from apps.access_control.services import Scope, require_permission
from apps.accounts.models import User
from apps.checklists.models import (
    ChecklistTemplate,
    ChecklistVersion,
    ChecklistVersionStatus,
)
from apps.core.persistence import atomic_fn, lock_queryset
from apps.security_audit.services import record_event

MANAGE_CHECKLIST = "checklists.manage_checklist"
VIEW_CHECKLIST = "checklists.view_checklisttemplate"


class EffectiveVersionOutcome:
    """Closed outcome labels for effective-version resolution."""

    ONE_ELIGIBLE_VERSION = "ONE_ELIGIBLE_VERSION"
    NO_ELIGIBLE_VERSION = "NO_ELIGIBLE_VERSION"
    OVERLAPPING_ELIGIBLE_VERSIONS = "OVERLAPPING_ELIGIBLE_VERSIONS"
    INVALID_TEMPLATE = "INVALID_TEMPLATE"
    # Explicit blocked synonym for task-creation callers.
    BLOCKED = "BLOCKED"


@dataclass(slots=True)
class EffectiveVersionResolution:
    outcome: str
    template_id: uuid.UUID | None
    as_of: datetime
    selected_version: ChecklistVersion | None = None
    candidates: list[ChecklistVersion] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)
    message: str = ""
    blocked: bool = False
    apr_015_note: str = (
        "APR-015: which business event supplies as_of "
        "(task creation / batch creation / production completion / other) "
        "remains DECISION REQUIRED — not invented by this engine."
    )

    @property
    def checklist_version_id(self) -> uuid.UUID | None:
        if self.selected_version is None:
            return None
        return self.selected_version.id

    def to_dict(self) -> dict[str, Any]:
        def _row(v: ChecklistVersion) -> dict[str, Any]:
            return {
                "checklist_version_id": str(v.id),
                "version_number": v.version_number,
                "status": v.status,
                "effective_from": v.effective_from.isoformat() if v.effective_from else None,
                "effective_to": v.effective_to.isoformat() if v.effective_to else None,
                "published_at": v.published_at.isoformat() if v.published_at else None,
            }

        return {
            "outcome": self.outcome,
            "blocked": self.blocked,
            "template_id": str(self.template_id) if self.template_id else None,
            "as_of": self.as_of.isoformat(),
            "selected": _row(self.selected_version) if self.selected_version else None,
            "candidates": [_row(v) for v in self.candidates],
            "reasons": list(self.reasons),
            "message": self.message,
            "never_arbitrary_selection": True,
            "historical_task_pin_note": (
                "Existing ChecklistTask rows keep their pinned checklist_version; "
                "effective-version changes never auto-upgrade historical tasks."
            ),
            "apr_015_note": self.apr_015_note,
        }


def _require_authenticated_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def _normalize_as_of(as_of: datetime | None) -> datetime:
    if as_of is None:
        return timezone.now()
    if timezone.is_naive(as_of):
        return timezone.make_aware(as_of, timezone.get_current_timezone())
    return as_of


def published_versions_queryset(template_id: uuid.UUID) -> QuerySet[ChecklistVersion]:
    return ChecklistVersion.objects.filter(
        template_id=template_id,
        status=ChecklistVersionStatus.PUBLISHED,
    ).select_related("template", "template__organization")


def eligible_published_versions_at(
    *,
    template_id: uuid.UUID,
    as_of: datetime,
) -> list[ChecklistVersion]:
    """
    PUBLISHED versions whose inclusive [effective_from, effective_to] covers as_of.

    Null bound = unbounded on that side. RETIRED/DRAFT excluded.
    """
    as_of_aware = _normalize_as_of(as_of)
    qs = (
        published_versions_queryset(template_id)
        .filter(Q(effective_from__isnull=True) | Q(effective_from__lte=as_of_aware))
        .filter(Q(effective_to__isnull=True) | Q(effective_to__gte=as_of_aware))
        .order_by("version_number")
    )
    # Double-check inclusivity in Python for exact timestamp boundary clarity.
    return [v for v in qs if v.is_effective_at(as_of_aware)]


def resolve_effective_checklist_version(
    *,
    template_id: uuid.UUID,
    as_of: datetime | None = None,
) -> EffectiveVersionResolution:
    """
    Resolve exactly one eligible PUBLISHED version for a template at as_of.

    Never silently picks among overlaps. Never falls back to RETIRED/DRAFT/latest.
    """
    as_of_aware = _normalize_as_of(as_of)
    template = (
        ChecklistTemplate.objects.select_related("organization").filter(pk=template_id).first()
    )
    if template is None:
        return EffectiveVersionResolution(
            outcome=EffectiveVersionOutcome.INVALID_TEMPLATE,
            template_id=template_id,
            as_of=as_of_aware,
            reasons=["template_not_found"],
            message="Checklist template not found.",
            blocked=True,
        )
    if not template.is_active:
        return EffectiveVersionResolution(
            outcome=EffectiveVersionOutcome.INVALID_TEMPLATE,
            template_id=template_id,
            as_of=as_of_aware,
            reasons=["template_inactive"],
            message="Checklist template is inactive.",
            blocked=True,
        )

    eligible = eligible_published_versions_at(template_id=template_id, as_of=as_of_aware)
    if not eligible:
        return EffectiveVersionResolution(
            outcome=EffectiveVersionOutcome.NO_ELIGIBLE_VERSION,
            template_id=template_id,
            as_of=as_of_aware,
            candidates=[],
            reasons=["no_published_version_effective_at_as_of", EffectiveVersionOutcome.BLOCKED],
            message=(
                "BLOCKED: no eligible PUBLISHED checklist version for this template "
                "at the supplied as_of. No silent fallback."
            ),
            blocked=True,
        )
    if len(eligible) == 1:
        return EffectiveVersionResolution(
            outcome=EffectiveVersionOutcome.ONE_ELIGIBLE_VERSION,
            template_id=template_id,
            as_of=as_of_aware,
            selected_version=eligible[0],
            candidates=eligible,
            reasons=["single_published_version_effective"],
            message="Exactly one eligible PUBLISHED version at as_of.",
            blocked=False,
        )
    return EffectiveVersionResolution(
        outcome=EffectiveVersionOutcome.OVERLAPPING_ELIGIBLE_VERSIONS,
        template_id=template_id,
        as_of=as_of_aware,
        selected_version=None,
        candidates=eligible,
        reasons=[
            "overlapping_published_effectivity_windows",
            "never_arbitrary_selection",
            EffectiveVersionOutcome.BLOCKED,
        ],
        message=(
            "BLOCKED: multiple PUBLISHED versions are eligible at as_of. "
            "Overlap must be resolved explicitly — no arbitrary selection."
        ),
        blocked=True,
    )


def assert_exactly_one_effective_version(
    *,
    template_id: uuid.UUID,
    as_of: datetime | None = None,
) -> ChecklistVersion:
    """
    Return the single eligible version or raise ValidationError (BLOCKED).

    Used by task-creation paths that require deterministic selection.
    """
    resolution = resolve_effective_checklist_version(template_id=template_id, as_of=as_of)
    if resolution.outcome == EffectiveVersionOutcome.ONE_ELIGIBLE_VERSION:
        if resolution.selected_version is None:
            raise ValidationError(
                {"checklist_version": "ONE_ELIGIBLE_VERSION without a selected version."}
            )
        return resolution.selected_version
    raise ValidationError(
        {
            "checklist_version": (
                f"{resolution.outcome}: {resolution.message} (as_of={resolution.as_of.isoformat()})"
            ),
            "effective_version_outcome": resolution.outcome,
            "blocked": True,
            "candidates": [str(v.id) for v in resolution.candidates],
            "reasons": resolution.reasons,
        }
    )


def _version_effectivity_metadata(version: ChecklistVersion) -> dict[str, Any]:
    return {
        "checklist_version_id": str(version.id),
        "checklist_template_id": str(version.template_id),
        "checklist_template_code": version.template.code,
        "organization_id": str(version.template.organization_id),
        "version_number": version.version_number,
        "status": version.status,
        "effective_from": version.effective_from.isoformat() if version.effective_from else None,
        "effective_to": version.effective_to.isoformat() if version.effective_to else None,
        "published_at": version.published_at.isoformat() if version.published_at else None,
    }


def _assert_no_published_overlap_excluding(
    *,
    version: ChecklistVersion,
    effective_from: datetime | None,
    effective_to: datetime | None,
) -> None:
    """
    Disallow ambiguous overlapping PUBLISHED windows on the same template.

    Unbounded (null) ranges are treated as open-ended for conflict detection.
    """
    siblings = ChecklistVersion.objects.filter(
        template_id=version.template_id,
        status=ChecklistVersionStatus.PUBLISHED,
    ).exclude(pk=version.pk)
    for other in siblings:
        # Overlap if ranges intersect (null = ±inf).
        start_a = effective_from
        end_a = effective_to
        start_b = other.effective_from
        end_b = other.effective_to
        # a starts before b ends (or b unbounded end) AND b starts before a ends
        a_before_b_end = end_b is None or start_a is None or start_a <= end_b
        b_before_a_end = end_a is None or start_b is None or start_b <= end_a
        if a_before_b_end and b_before_a_end:
            raise ValidationError(
                {
                    "effective_from": (
                        "PUBLISHED effectivity window overlaps another PUBLISHED "
                        f"version (v{other.version_number}). Resolve overlap explicitly — "
                        "selection will not pick arbitrarily."
                    )
                }
            )


@atomic_fn
def set_checklist_version_effectivity(
    *,
    actor: User | None,
    version_id: uuid.UUID,
    effective_from: datetime | None = None,
    effective_to: datetime | None = None,
    clear_effective_from: bool = False,
    clear_effective_to: bool = False,
) -> ChecklistVersion:
    """
    Set technical effectivity on a DRAFT or PUBLISHED version (audited).

    RETIRED versions keep historical windows readable but are not re-opened for
    new eligibility. Overlaps among PUBLISHED siblings are rejected.
    """
    user = _require_authenticated_actor(actor)
    version = lock_queryset(
        ChecklistVersion.objects.select_related("template", "template__organization").filter(
            pk=version_id
        )
    ).first()
    if version is None:
        raise ValidationError({"version": "Checklist version not found."})
    require_permission(
        user,
        MANAGE_CHECKLIST,
        scope=Scope(organization_id=version.template.organization_id),
    )
    if version.status == ChecklistVersionStatus.RETIRED:
        raise ValidationError(
            {
                "status": (
                    "Cannot change effectivity on RETIRED versions. "
                    "Historical windows remain readable for existing task pins."
                )
            }
        )

    if clear_effective_from:
        version.effective_from = None
    elif effective_from is not None:
        version.effective_from = _normalize_as_of(effective_from)
    if clear_effective_to:
        version.effective_to = None
    elif effective_to is not None:
        version.effective_to = _normalize_as_of(effective_to)

    if (
        version.effective_to is not None
        and version.effective_from is not None
        and version.effective_to < version.effective_from
    ):
        raise ValidationError(
            {"effective_to": "effective_to cannot be earlier than effective_from."}
        )

    if version.status == ChecklistVersionStatus.PUBLISHED:
        _assert_no_published_overlap_excluding(
            version=version,
            effective_from=version.effective_from,
            effective_to=version.effective_to,
        )

    version.full_clean()
    version.save(update_fields=["effective_from", "effective_to", "updated_at"])
    record_event(
        event_type="CHECKLIST_VERSION_EFFECTIVITY_UPDATED",
        actor=user,
        metadata=_version_effectivity_metadata(version),
    )
    return version
