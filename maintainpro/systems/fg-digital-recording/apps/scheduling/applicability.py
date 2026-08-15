"""Checklist applicability resolution engine and services (Phase 07C).

Outcomes are explicit:
  NO_MATCH | ONE_MATCH | MULTIPLE_MATCHES | INVALID_INACTIVE_REFERENCE

Never silently selects the first of multiple matches.
Does not rewrite historical ChecklistTask version pins.

Dimensions justified by architecture: Organization, Product, Site, Department,
Shift, effective dates. Optional free-text process_reference is a label only —
not a Process master (EVIDENCE REQUIRED). Production Line is not modeled.
"""

from __future__ import annotations

import datetime
import uuid
from dataclasses import dataclass, field
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError
from django.db.models import Q, QuerySet

from apps.access_control.services import Scope, require_permission
from apps.accounts.models import User
from apps.checklists.models import (
    ChecklistTemplate,
    ChecklistVersion,
    ChecklistVersionStatus,
)
from apps.core.persistence import atomic_fn, lock_queryset
from apps.master_data.models import FGProduct
from apps.organizations.models import Department, Organization, Shift, Site
from apps.scheduling.models import (
    ApplicabilityMatchOutcome,
    ChecklistApplicabilityRule,
)
from apps.security_audit.services import record_event

MANAGE_APPLICABILITY = "scheduling.manage_checklistapplicability"
VIEW_APPLICABILITY = "scheduling.view_checklistapplicability"


def _require_authenticated_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def applicability_authorization_scope(rule: ChecklistApplicabilityRule) -> Scope:
    return Scope(organization_id=rule.organization_id)


@dataclass(frozen=True, slots=True)
class ApplicabilityContext:
    organization_id: uuid.UUID
    product_id: uuid.UUID | None = None
    site_id: uuid.UUID | None = None
    department_id: uuid.UUID | None = None
    shift_id: uuid.UUID | None = None
    process_reference: str = ""
    as_of: datetime.date | None = None


@dataclass(slots=True)
class ApplicabilityResolution:
    outcome: str
    context: ApplicabilityContext | None = None
    matches: list[ChecklistApplicabilityRule] = field(default_factory=list)
    invalid_matches: list[ChecklistApplicabilityRule] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)
    selected_rule: ChecklistApplicabilityRule | None = None
    message: str = ""
    as_of: datetime.date | None = None

    # Aliases expected by Phase 07C tests / preview UI
    @property
    def matched_rule(self) -> ChecklistApplicabilityRule | None:
        return self.selected_rule

    @property
    def matched_rules(self) -> list[ChecklistApplicabilityRule]:
        return self.matches

    @property
    def invalid_rules(self) -> list[ChecklistApplicabilityRule]:
        return self.invalid_matches

    @property
    def checklist_version(self) -> ChecklistVersion | None:
        if self.selected_rule is None:
            return None
        return self.selected_rule.checklist_version

    @property
    def checklist_version_id(self) -> uuid.UUID | None:
        if self.selected_rule is None:
            return None
        return self.selected_rule.checklist_version_id

    @property
    def checklist_template_id(self) -> uuid.UUID | None:
        if self.selected_rule is None:
            return None
        return self.selected_rule.checklist_template_id

    def to_preview_dict(self) -> dict[str, Any]:
        def _rule_row(rule: ChecklistApplicabilityRule) -> dict[str, Any]:
            return {
                "rule_id": str(rule.id),
                "code": rule.code,
                "name": rule.name,
                "checklist_template_id": str(rule.checklist_template_id),
                "checklist_template_code": rule.checklist_template.code,
                "checklist_version_id": str(rule.checklist_version_id),
                "checklist_version_number": rule.checklist_version.version_number,
                "product_id": str(rule.product_id) if rule.product_id else None,
                "site_id": str(rule.site_id) if rule.site_id else None,
                "department_id": str(rule.department_id) if rule.department_id else None,
                "shift_id": str(rule.shift_id) if rule.shift_id else None,
                "process_reference": rule.process_reference or "",
                "effective_from": (
                    rule.effective_from.isoformat() if rule.effective_from else None
                ),
                "effective_to": rule.effective_to.isoformat() if rule.effective_to else None,
                "is_active": rule.is_active,
            }

        return {
            "outcome": self.outcome,
            "message": self.message,
            "selected": _rule_row(self.selected_rule) if self.selected_rule else None,
            "matches": [_rule_row(r) for r in self.matches],
            "invalid_matches": [_rule_row(r) for r in self.invalid_matches],
            "reasons": list(self.reasons),
            "never_silent_first_match": True,
            "historical_task_pin_note": (
                "Existing ChecklistTask rows keep their pinned checklist_version; "
                "applicability changes do not rewrite history."
            ),
            "dimensions_supported": [
                "organization",
                "product",
                "site",
                "department",
                "shift",
                "process_reference_label",
                "effective_date",
            ],
            "dimensions_not_modeled": ["production_line", "process_master"],
        }


def _dimension_matches(
    *,
    rule_value_id: uuid.UUID | None,
    context_value_id: uuid.UUID | None,
) -> bool:
    if rule_value_id is None:
        return True
    if context_value_id is None:
        return False
    return rule_value_id == context_value_id


def _process_matches(*, rule_value: str, context_value: str) -> bool:
    required = (rule_value or "").strip()
    if not required:
        return True
    return required == (context_value or "").strip()


def _effective_on(rule: ChecklistApplicabilityRule, as_of: datetime.date) -> bool:
    if rule.effective_from is not None and as_of < rule.effective_from:
        return False
    if rule.effective_to is not None and as_of > rule.effective_to:
        return False
    return True


def _rule_target_is_valid(rule: ChecklistApplicabilityRule) -> tuple[bool, str]:
    template = rule.checklist_template
    version = rule.checklist_version
    if not template.is_active:
        return False, "checklist_template_inactive"
    if version.status != ChecklistVersionStatus.PUBLISHED:
        return False, f"checklist_version_not_published:{version.status}"
    if version.template_id != template.id:
        return False, "checklist_version_template_mismatch"
    if rule.product_id and rule.product is not None and not rule.product.is_active:
        return False, "product_inactive"
    if rule.site_id and rule.site is not None and not rule.site.is_active:
        return False, "site_inactive"
    if rule.department_id and rule.department is not None and not rule.department.is_active:
        return False, "department_inactive"
    if rule.shift_id and rule.shift is not None and not rule.shift.is_active:
        return False, "shift_inactive"
    return True, ""


def validate_applicability_context(
    context: ApplicabilityContext,
) -> tuple[bool, list[str]]:
    reasons: list[str] = []
    org = Organization.objects.filter(pk=context.organization_id).first()
    if org is None:
        return False, ["organization_not_found"]
    if not org.is_active:
        return False, ["organization_inactive"]

    if context.product_id is not None:
        product = FGProduct.objects.filter(pk=context.product_id).first()
        if product is None:
            reasons.append("product_not_found")
        elif product.organization_id != context.organization_id:
            reasons.append("product_cross_org")
        elif not product.is_active:
            reasons.append("product_inactive")

    if context.site_id is not None:
        site = Site.objects.filter(pk=context.site_id).first()
        if site is None:
            reasons.append("site_not_found")
        elif site.organization_id != context.organization_id:
            reasons.append("site_cross_org")
        elif not site.is_active:
            reasons.append("site_inactive")

    if context.department_id is not None:
        department = Department.objects.filter(pk=context.department_id).first()
        if department is None:
            reasons.append("department_not_found")
        elif department.organization_id != context.organization_id:
            reasons.append("department_cross_org")
        elif not department.is_active:
            reasons.append("department_inactive")

    if context.shift_id is not None:
        shift = Shift.objects.filter(pk=context.shift_id).first()
        if shift is None:
            reasons.append("shift_not_found")
        elif shift.organization_id != context.organization_id:
            reasons.append("shift_cross_org")
        elif not shift.is_active:
            reasons.append("shift_inactive")

    return (len(reasons) == 0), reasons


def candidate_applicability_rules(
    *,
    organization_id: uuid.UUID,
    product_id: uuid.UUID | None = None,
    site_id: uuid.UUID | None = None,
    department_id: uuid.UUID | None = None,
    shift_id: uuid.UUID | None = None,
    as_of: datetime.date | None = None,
) -> QuerySet[ChecklistApplicabilityRule]:
    as_of_date = as_of or datetime.date.today()
    qs = (
        ChecklistApplicabilityRule.objects.filter(
            organization_id=organization_id,
            is_active=True,
        )
        .filter(Q(effective_from__isnull=True) | Q(effective_from__lte=as_of_date))
        .filter(Q(effective_to__isnull=True) | Q(effective_to__gte=as_of_date))
        .select_related(
            "organization",
            "checklist_template",
            "checklist_version",
            "product",
            "site",
            "department",
            "shift",
        )
    )
    if product_id is not None:
        qs = qs.filter(Q(product_id__isnull=True) | Q(product_id=product_id))
    if site_id is not None:
        qs = qs.filter(Q(site_id__isnull=True) | Q(site_id=site_id))
    if department_id is not None:
        qs = qs.filter(Q(department_id__isnull=True) | Q(department_id=department_id))
    if shift_id is not None:
        qs = qs.filter(Q(shift_id__isnull=True) | Q(shift_id=shift_id))
    return qs


def resolve_checklist_applicability(
    *,
    organization_id: uuid.UUID,
    product_id: uuid.UUID | None = None,
    site_id: uuid.UUID | None = None,
    department_id: uuid.UUID | None = None,
    shift_id: uuid.UUID | None = None,
    process_reference: str = "",
    as_of: datetime.date | None = None,
) -> ApplicabilityResolution:
    """Resolve matching rules. Never returns a silent first-of-many selection."""
    context = ApplicabilityContext(
        organization_id=organization_id,
        product_id=product_id,
        site_id=site_id,
        department_id=department_id,
        shift_id=shift_id,
        process_reference=(process_reference or "").strip(),
        as_of=as_of,
    )
    as_of_date = context.as_of or datetime.date.today()

    ok, ctx_reasons = validate_applicability_context(context)
    if not ok:
        return ApplicabilityResolution(
            outcome=ApplicabilityMatchOutcome.INVALID_INACTIVE_REFERENCE,
            context=context,
            reasons=ctx_reasons,
            message="Context contains invalid or inactive references.",
            as_of=as_of_date,
        )

    candidates = list(
        candidate_applicability_rules(
            organization_id=context.organization_id,
            product_id=context.product_id,
            site_id=context.site_id,
            department_id=context.department_id,
            shift_id=context.shift_id,
            as_of=as_of_date,
        )
    )

    dimension_hits: list[ChecklistApplicabilityRule] = []
    for rule in candidates:
        if not _effective_on(rule, as_of_date):
            continue
        if not _dimension_matches(
            rule_value_id=rule.product_id, context_value_id=context.product_id
        ):
            continue
        if not _dimension_matches(rule_value_id=rule.site_id, context_value_id=context.site_id):
            continue
        if not _dimension_matches(
            rule_value_id=rule.department_id, context_value_id=context.department_id
        ):
            continue
        if not _dimension_matches(rule_value_id=rule.shift_id, context_value_id=context.shift_id):
            continue
        if not _process_matches(
            rule_value=rule.process_reference, context_value=context.process_reference
        ):
            continue
        dimension_hits.append(rule)

    valid: list[ChecklistApplicabilityRule] = []
    invalid: list[ChecklistApplicabilityRule] = []
    invalid_reasons: list[str] = []
    for rule in dimension_hits:
        is_valid, reason = _rule_target_is_valid(rule)
        if is_valid:
            valid.append(rule)
        else:
            invalid.append(rule)
            invalid_reasons.append(f"rule:{rule.id}:{reason}")

    if not valid and invalid:
        return ApplicabilityResolution(
            outcome=ApplicabilityMatchOutcome.INVALID_INACTIVE_REFERENCE,
            context=context,
            invalid_matches=invalid,
            reasons=invalid_reasons or ["matched_rules_have_inactive_or_invalid_targets"],
            message="Matched rules reference inactive or non-published targets.",
            as_of=as_of_date,
        )
    if not valid:
        return ApplicabilityResolution(
            outcome=ApplicabilityMatchOutcome.NO_MATCH,
            context=context,
            invalid_matches=invalid,
            reasons=["no_active_applicability_rule_matched"],
            message="No applicability rule matched the context.",
            as_of=as_of_date,
        )
    if len(valid) == 1:
        return ApplicabilityResolution(
            outcome=ApplicabilityMatchOutcome.ONE_MATCH,
            context=context,
            matches=valid,
            invalid_matches=invalid,
            selected_rule=valid[0],
            reasons=["single_valid_match"],
            message="Exactly one applicability rule matched.",
            as_of=as_of_date,
        )
    return ApplicabilityResolution(
        outcome=ApplicabilityMatchOutcome.MULTIPLE_MATCHES,
        context=context,
        matches=valid,
        invalid_matches=invalid,
        selected_rule=None,
        reasons=["multiple_valid_matches_conflict", "never_silently_choose_first"],
        message="Multiple applicability rules matched — conflict requires explicit resolution.",
        as_of=as_of_date,
    )


def _rule_metadata(
    rule: ChecklistApplicabilityRule, *, extra: dict[str, Any] | None = None
) -> dict[str, Any]:
    meta: dict[str, Any] = {
        "applicability_rule_id": str(rule.id),
        "organization_id": str(rule.organization_id),
        "code": rule.code,
        "checklist_template_id": str(rule.checklist_template_id),
        "checklist_version_id": str(rule.checklist_version_id),
        "product_id": str(rule.product_id) if rule.product_id else None,
        "site_id": str(rule.site_id) if rule.site_id else None,
        "department_id": str(rule.department_id) if rule.department_id else None,
        "shift_id": str(rule.shift_id) if rule.shift_id else None,
        "process_reference": rule.process_reference or "",
        "is_active": rule.is_active,
    }
    if extra:
        meta.update(extra)
    return meta


def _as_org(organization: Organization | uuid.UUID) -> Organization:
    if isinstance(organization, Organization):
        return organization
    org = Organization.objects.filter(pk=organization).first()
    if org is None:
        raise ValidationError({"organization": "Organization not found."})
    return org


def _optional_fk(
    *,
    model: type[Any],
    value: Any,
    field: str,
) -> Any:
    if value is None or value == "":
        return None
    if hasattr(value, "pk"):
        return value
    obj = model.objects.filter(pk=value).first()
    if obj is None:
        raise ValidationError({field: f"{field} not found."})
    return obj


@atomic_fn
def create_checklist_applicability_rule(
    *,
    actor: User | None,
    organization: Organization | uuid.UUID,
    code: str,
    name: str,
    checklist_template_id: uuid.UUID,
    checklist_version_id: uuid.UUID,
    product: FGProduct | uuid.UUID | None = None,
    site: Site | uuid.UUID | None = None,
    department: Department | uuid.UUID | None = None,
    shift: Shift | uuid.UUID | None = None,
    process_reference: str = "",
    effective_from: datetime.date | None = None,
    effective_to: datetime.date | None = None,
    is_active: bool = True,
    notes: str = "",
) -> ChecklistApplicabilityRule:
    user = _require_authenticated_actor(actor)
    org = _as_org(organization)
    require_permission(user, MANAGE_APPLICABILITY, scope=Scope(organization_id=org.id))

    template = ChecklistTemplate.objects.filter(pk=checklist_template_id).first()
    if template is None:
        raise ValidationError({"checklist_template": "Checklist template not found."})
    version = ChecklistVersion.objects.filter(pk=checklist_version_id).first()
    if version is None:
        raise ValidationError({"checklist_version": "Checklist version not found."})

    rule = ChecklistApplicabilityRule(
        organization=org,
        checklist_template=template,
        checklist_version=version,
        code=(code or "").strip(),
        name=(name or "").strip(),
        process_reference=(process_reference or "").strip(),
        product=_optional_fk(model=FGProduct, value=product, field="product"),
        site=_optional_fk(model=Site, value=site, field="site"),
        department=_optional_fk(model=Department, value=department, field="department"),
        shift=_optional_fk(model=Shift, value=shift, field="shift"),
        effective_from=effective_from,
        effective_to=effective_to,
        is_active=is_active,
        notes=(notes or "").strip(),
    )
    try:
        rule.full_clean()
        rule.save()
    except IntegrityError as exc:
        raise ValidationError(
            {"code": "An applicability rule with this code already exists in the organization."}
        ) from exc

    record_event(
        event_type="CHECKLIST_APPLICABILITY_RULE_CREATED",
        actor=user,
        metadata=_rule_metadata(rule),
    )
    return rule


@atomic_fn
def update_checklist_applicability_rule(
    *,
    actor: User | None,
    rule_id: uuid.UUID,
    code: str | None = None,
    name: str | None = None,
    checklist_template_id: uuid.UUID | None = None,
    checklist_version_id: uuid.UUID | None = None,
    product: Any = None,
    site: Any = None,
    department: Any = None,
    shift: Any = None,
    process_reference: str | None = None,
    effective_from: datetime.date | None = None,
    effective_to: datetime.date | None = None,
    is_active: bool | None = None,
    notes: str | None = None,
    clear_effective_from: bool = False,
    clear_effective_to: bool = False,
) -> ChecklistApplicabilityRule:
    """Update a rule definition. Does not rewrite historical ChecklistTask pins."""
    user = _require_authenticated_actor(actor)
    rule = lock_queryset(
        ChecklistApplicabilityRule.objects.select_related(
            "organization", "checklist_template", "checklist_version"
        ).filter(pk=rule_id)
    ).first()
    if rule is None:
        raise ValidationError({"rule": "Checklist applicability rule not found."})
    require_permission(user, MANAGE_APPLICABILITY, scope=applicability_authorization_scope(rule))

    if code is not None:
        rule.code = code.strip()
    if name is not None:
        rule.name = name.strip()
    if process_reference is not None:
        rule.process_reference = process_reference.strip()
    if notes is not None:
        rule.notes = notes.strip()
    if is_active is not None:
        rule.is_active = is_active
    if checklist_template_id is not None:
        template = ChecklistTemplate.objects.filter(pk=checklist_template_id).first()
        if template is None:
            raise ValidationError({"checklist_template": "Checklist template not found."})
        rule.checklist_template = template
    if checklist_version_id is not None:
        version = ChecklistVersion.objects.filter(pk=checklist_version_id).first()
        if version is None:
            raise ValidationError({"checklist_version": "Checklist version not found."})
        rule.checklist_version = version
    if product is not None:
        rule.product = _optional_fk(model=FGProduct, value=product, field="product")
    if site is not None:
        rule.site = _optional_fk(model=Site, value=site, field="site")
    if department is not None:
        rule.department = _optional_fk(model=Department, value=department, field="department")
    if shift is not None:
        rule.shift = _optional_fk(model=Shift, value=shift, field="shift")
    if clear_effective_from:
        rule.effective_from = None
    elif effective_from is not None:
        rule.effective_from = effective_from
    if clear_effective_to:
        rule.effective_to = None
    elif effective_to is not None:
        rule.effective_to = effective_to

    rule.full_clean()
    rule.save()
    record_event(
        event_type="CHECKLIST_APPLICABILITY_RULE_UPDATED",
        actor=user,
        metadata=_rule_metadata(rule),
    )
    return rule


@atomic_fn
def deactivate_checklist_applicability_rule(
    *,
    actor: User | None,
    rule_id: uuid.UUID,
) -> ChecklistApplicabilityRule:
    """Deactivate a rule. Does not rewrite historical ChecklistTask version pins."""
    user = _require_authenticated_actor(actor)
    rule = lock_queryset(
        ChecklistApplicabilityRule.objects.select_related(
            "organization", "checklist_template", "checklist_version"
        ).filter(pk=rule_id)
    ).first()
    if rule is None:
        raise ValidationError({"rule": "Checklist applicability rule not found."})
    require_permission(user, MANAGE_APPLICABILITY, scope=applicability_authorization_scope(rule))
    if not rule.is_active:
        return rule
    rule.is_active = False
    rule.save(update_fields=["is_active", "updated_at"])
    record_event(
        event_type="CHECKLIST_APPLICABILITY_RULE_DEACTIVATED",
        actor=user,
        metadata=_rule_metadata(rule),
    )
    return rule


def delete_checklist_applicability_rule(rule: ChecklistApplicabilityRule) -> None:
    """Hard delete refused — deactivate instead to preserve auditability."""
    raise ValidationError(
        {
            "delete": (
                "Hard delete of ChecklistApplicabilityRule is not permitted. "
                "Deactivate the rule instead. Historical ChecklistTask pins are unaffected."
            )
        }
    )


def preview_checklist_applicability(
    *,
    actor: User | None,
    organization_id: uuid.UUID,
    product_id: uuid.UUID | None = None,
    site_id: uuid.UUID | None = None,
    department_id: uuid.UUID | None = None,
    shift_id: uuid.UUID | None = None,
    process_reference: str = "",
    as_of: datetime.date | None = None,
) -> ApplicabilityResolution:
    user = _require_authenticated_actor(actor)
    require_permission(user, VIEW_APPLICABILITY, scope=Scope(organization_id=organization_id))
    resolution = resolve_checklist_applicability(
        organization_id=organization_id,
        product_id=product_id,
        site_id=site_id,
        department_id=department_id,
        shift_id=shift_id,
        process_reference=process_reference,
        as_of=as_of,
    )
    record_event(
        event_type="CHECKLIST_APPLICABILITY_PREVIEWED",
        actor=user,
        metadata={
            "organization_id": str(organization_id),
            "product_id": str(product_id) if product_id else None,
            "site_id": str(site_id) if site_id else None,
            "department_id": str(department_id) if department_id else None,
            "shift_id": str(shift_id) if shift_id else None,
            "process_reference": (process_reference or "").strip(),
            "as_of": (as_of or datetime.date.today()).isoformat(),
            "outcome": resolution.outcome,
            "match_count": len(resolution.matches),
        },
    )
    return resolution
