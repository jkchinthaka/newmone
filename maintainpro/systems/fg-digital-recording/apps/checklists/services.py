"""Checklist definition services — writes, lifecycle, authorization; no seed content."""

from __future__ import annotations

import uuid
from decimal import Decimal, InvalidOperation
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError
from django.db.models import Max
from django.utils import timezone

from apps.access_control.services import Scope, require_permission
from apps.accounts.models import User
from apps.checklists.calculation import assert_known_operator, validate_calculation_definition
from apps.checklists.conditions import (
    detect_visibility_cycles,
    validate_rule_definition,
)
from apps.checklists.constants import REPEAT_SAMPLE_TECHNICAL_CEILING
from apps.checklists.control_point import (
    assert_known_control_point_class,
    assert_known_criticality,
)
from apps.checklists.measurement import (
    assert_known_unit,
    assert_precision_rounding_pair,
)
from apps.checklists.models import (
    ChecklistCalculationOperand,
    ChecklistControlPointClass,
    ChecklistItem,
    ChecklistItemEvaluationRule,
    ChecklistItemKind,
    ChecklistItemOption,
    ChecklistItemRule,
    ChecklistResponseType,
    ChecklistSection,
    ChecklistTemplate,
    ChecklistVersion,
    ChecklistVersionStatus,
    validate_item_response_definition,
)
from apps.core.persistence import (
    TransitionConflictError,
    atomic,
    atomic_fn,
    cas_status_transition,
    lock_queryset,
    locked_get,
    prefetch_related_compat,
)
from apps.master_data.models import FGProduct
from apps.organizations.models import Organization
from apps.organizations.services import normalize_code, normalize_name
from apps.security_audit.services import record_event

VIEW_CHECKLIST = "checklists.view_checklisttemplate"
MANAGE_CHECKLIST = "checklists.manage_checklist"

_UNSET: Any = object()

# Centralized lifecycle — only these transitions are supported.
ALLOWED_VERSION_TRANSITIONS: frozenset[tuple[str, str]] = frozenset(
    {
        (ChecklistVersionStatus.DRAFT, ChecklistVersionStatus.PUBLISHED),
        (ChecklistVersionStatus.PUBLISHED, ChecklistVersionStatus.RETIRED),
    }
)


def assert_version_transition_allowed(*, current: str, target: str) -> None:
    """Raise ValidationError when ``current`` → ``target`` is not an allowed transition."""
    if (current, target) not in ALLOWED_VERSION_TRANSITIONS:
        raise ValidationError(
            {
                "version": (
                    f"Illegal checklist version transition from {current} to {target}. "
                    "Allowed transitions: DRAFT→PUBLISHED, PUBLISHED→RETIRED."
                )
            }
        )


def _require_authenticated_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def template_authorization_scope(template: ChecklistTemplate) -> Scope:
    return Scope(organization_id=template.organization_id)


def version_authorization_scope(version: ChecklistVersion) -> Scope:
    return Scope(organization_id=version.template.organization_id)


def _template_metadata(
    template: ChecklistTemplate,
    *,
    changed_fields: list[str] | None = None,
) -> dict[str, Any]:
    meta: dict[str, Any] = {
        "checklist_template_id": str(template.id),
        "checklist_template_code": template.code,
        "organization_id": str(template.organization_id),
        "is_active": template.is_active,
        "product_id": str(template.product_id) if template.product_id else None,
    }
    if changed_fields:
        meta["changed_fields"] = changed_fields
    return meta


def _version_metadata(
    version: ChecklistVersion,
    *,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    meta: dict[str, Any] = {
        "checklist_version_id": str(version.id),
        "checklist_template_id": str(version.template_id),
        "checklist_template_code": version.template.code,
        "organization_id": str(version.template.organization_id),
        "version_number": version.version_number,
        "status": version.status,
        "effective_from": (version.effective_from.isoformat() if version.effective_from else None),
        "effective_to": (version.effective_to.isoformat() if version.effective_to else None),
        "published_at": (version.published_at.isoformat() if version.published_at else None),
    }
    if extra:
        meta.update(extra)
    return meta


def _prepare_template_fields(
    *,
    code: str,
    name: str,
    description: str | None,
) -> tuple[str, str, str]:
    normalized_code = normalize_code(code)
    normalized_name = normalize_name(name)
    if not normalized_code:
        raise ValidationError({"code": "Code cannot be blank."})
    if not normalized_name:
        raise ValidationError({"name": "Name cannot be blank."})
    return normalized_code, normalized_name, (description or "").strip()


def _validate_product_for_org(
    *,
    organization: Organization,
    product: FGProduct | None,
) -> FGProduct | None:
    if product is None:
        return None
    if product.organization_id != organization.id:
        raise ValidationError(
            {"product": "Product must belong to the same organization as the template."}
        )
    return product


def _reraise_template_persistence_error(exc: Exception) -> None:
    if isinstance(exc, ValidationError):
        messages = " ".join(str(m) for m in exc.messages)
        if "chk_template_org_code_ci_uniq" in messages or "unique" in messages.lower():
            raise ValidationError(
                {
                    "code": (
                        "A checklist template with this code already exists "
                        "in the selected organization."
                    )
                }
            ) from exc
        raise
    if isinstance(exc, IntegrityError):
        raise ValidationError(
            {
                "code": (
                    "A checklist template with this code already exists "
                    "in the selected organization."
                )
            }
        ) from exc
    raise


def _require_draft(version: ChecklistVersion) -> None:
    if not version.is_draft:
        raise ValidationError(
            {
                "version": (
                    "Published or retired checklist versions cannot be modified. "
                    "Create a new draft version instead."
                )
            }
        )
    matched = ChecklistVersion.objects.filter(
        pk=version.pk, status=ChecklistVersionStatus.DRAFT
    ).update(updated_at=timezone.now())
    if matched != 1:
        raise ValidationError(
            {
                "version": (
                    "Published or retired checklist versions cannot be modified. "
                    "Create a new draft version instead."
                )
            }
        )


def _lock_version(version_id: uuid.UUID) -> ChecklistVersion:
    version = lock_queryset(
        ChecklistVersion.objects.select_related(
            "template", "template__organization", "template__product"
        ).filter(pk=version_id)
    ).first()
    if version is None:
        raise ValidationError({"version": "Checklist version not found."})
    return version


def _next_section_position(version: ChecklistVersion) -> int:
    current = version.sections.aggregate(m=Max("position"))["m"]
    return int(current or 0) + 1


def _next_item_position(
    section: ChecklistSection,
    *,
    parent_item: ChecklistItem | None = None,
) -> int:
    # Positions remain unique per section (existing constraint); allocate from section max.
    _ = parent_item
    current = section.items.aggregate(m=Max("position"))["m"]
    return int(current or 0) + 1


def _parse_optional_positive_int(value: Any, *, field: str) -> int | None:
    if value is None or value == "":
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError({field: f"Invalid integer for {field}."}) from exc
    if parsed < 0:
        raise ValidationError({field: f"{field} cannot be negative."})
    return parsed


def _normalize_item_kind_fields(
    *,
    item_kind: str,
    parent_item: ChecklistItem | None,
    response_type: str | None,
    unit: str,
    minimum_value: Any,
    maximum_value: Any,
    repeat_min: Any,
    repeat_max: Any,
    repeat_default: Any,
    calculation_operator: str = "",
    decimal_precision: Any = None,
    rounding_mode: str = "",
    min_inclusive: Any = True,
    max_inclusive: Any = True,
) -> tuple[
    str,
    ChecklistItem | None,
    str,
    str,
    Decimal | None,
    Decimal | None,
    int | None,
    int | None,
    int | None,
    str,
    int | None,
    str,
    bool,
    bool,
]:
    kind = (item_kind or ChecklistItemKind.SIMPLE).strip()
    if kind not in ChecklistItemKind.values:
        raise ValidationError({"item_kind": "Unknown item kind."})

    r_min = _parse_optional_positive_int(repeat_min, field="repeat_min")
    r_max = _parse_optional_positive_int(repeat_max, field="repeat_max")
    r_default = _parse_optional_positive_int(repeat_default, field="repeat_default")
    operator = (calculation_operator or "").strip().upper()

    if kind == ChecklistItemKind.REPEATING_GROUP:
        if parent_item is not None:
            raise ValidationError(
                {"parent_item": "A REPEATING_GROUP cannot be nested under another item."}
            )
        if operator:
            raise ValidationError(
                {
                    "calculation_operator": (
                        "REPEATING_GROUP items cannot have a calculation operator."
                    )
                }
            )
        for field_name, value in (
            ("repeat_min", r_min),
            ("repeat_max", r_max),
            ("repeat_default", r_default),
        ):
            if value is not None and value > REPEAT_SAMPLE_TECHNICAL_CEILING:
                raise ValidationError(
                    {
                        field_name: (
                            f"Cannot exceed technical sample ceiling "
                            f"({REPEAT_SAMPLE_TECHNICAL_CEILING})."
                        )
                    }
                )
        return kind, None, "", "", None, None, r_min, r_max, r_default, "", None, "", True, True

    if any(value is not None for value in (r_min, r_max, r_default)):
        raise ValidationError(
            {"repeat_min": "Repeat configuration is only allowed on REPEATING_GROUP items."}
        )

    if kind == ChecklistItemKind.CALCULATED:
        if operator:
            operator = assert_known_operator(operator)
        if parent_item is not None and parent_item.item_kind != ChecklistItemKind.REPEATING_GROUP:
            raise ValidationError({"parent_item": "Parent item must be a REPEATING_GROUP."})
        # Reject formula-like payloads early (security).
        if any(token in operator for token in ("(", ")", ";", "=", "import", "eval")):
            raise ValidationError({"calculation_operator": "Malformed calculation operator."})
        unit_text = assert_known_unit(unit) if (unit or "").strip() else ""
        precision, mode = assert_precision_rounding_pair(
            decimal_precision=decimal_precision,
            rounding_mode=rounding_mode,
        )
        return (
            kind,
            parent_item,
            ChecklistResponseType.NUMBER,
            unit_text,
            None,
            None,
            None,
            None,
            None,
            operator,
            precision,
            mode,
            True,
            True,
        )

    if operator:
        raise ValidationError(
            {"calculation_operator": "calculation_operator is only allowed on CALCULATED items."}
        )
    (
        resp_type,
        unit_text,
        min_value,
        max_value,
        precision,
        mode,
        min_inc,
        max_inc,
    ) = _normalize_response_fields(
        response_type=response_type,
        unit=unit,
        minimum_value=minimum_value,
        maximum_value=maximum_value,
        decimal_precision=decimal_precision,
        rounding_mode=rounding_mode,
        min_inclusive=min_inclusive,
        max_inclusive=max_inclusive,
    )
    return (
        kind,
        parent_item,
        resp_type,
        unit_text,
        min_value,
        max_value,
        None,
        None,
        None,
        "",
        precision,
        mode,
        min_inc,
        max_inc,
    )


@atomic_fn
def set_checklist_item_rule(
    *,
    actor: User | None,
    target_item_id: uuid.UUID,
    rule_kind: str,
    operand_item_id: uuid.UUID,
    comparator: str,
    expected_text: str = "",
    expected_number: Decimal | None = None,
    expected_boolean: bool | None = None,
    expected_option_id: uuid.UUID | None = None,
    expected_list: list[Any] | None = None,
) -> ChecklistItemRule:
    """Create or replace one conditional rule (kind) on a draft item."""
    from apps.checklists.conditions import (
        assert_known_comparator,
        assert_known_rule_kind,
        detect_visibility_cycles,
        validate_rule_definition,
    )

    user = _require_authenticated_actor(actor)
    item = _lock_item(target_item_id)
    require_permission(
        user, MANAGE_CHECKLIST, scope=version_authorization_scope(item.section.version)
    )
    _require_draft(item.section.version)
    kind = assert_known_rule_kind(rule_kind)
    comp = assert_known_comparator(comparator)

    version_id = item.section.version_id
    version_items = {
        row.id: row
        for row in ChecklistItem.objects.select_related("section", "parent_item").filter(
            section__version_id=version_id
        )
    }
    operand = version_items.get(operand_item_id)
    if operand is None:
        raise ValidationError(
            {"operand_item": f"Operand {operand_item_id} is not in this checklist version."}
        )

    ChecklistItemRule.objects.filter(target_item_id=item.id, rule_kind=kind).delete()
    rule = ChecklistItemRule(
        target_item=item,
        rule_kind=kind,
        operand_item=operand,
        comparator=comp,
        expected_text=(expected_text or "").strip(),
        expected_number=expected_number,
        expected_boolean=expected_boolean,
        expected_option_id=expected_option_id,
        expected_list=list(expected_list or []),
    )
    validate_rule_definition(rule=rule, items_by_id=version_items)
    rule.full_clean()
    rule.save()

    all_rules = list(ChecklistItemRule.objects.filter(target_item__section__version_id=version_id))
    detect_visibility_cycles(rules=all_rules)
    return rule


@atomic_fn
def clear_checklist_item_rule(
    *,
    actor: User | None,
    target_item_id: uuid.UUID,
    rule_kind: str,
) -> None:
    from apps.checklists.conditions import assert_known_rule_kind

    user = _require_authenticated_actor(actor)
    item = _lock_item(target_item_id)
    require_permission(
        user, MANAGE_CHECKLIST, scope=version_authorization_scope(item.section.version)
    )
    _require_draft(item.section.version)
    kind = assert_known_rule_kind(rule_kind)
    ChecklistItemRule.objects.filter(target_item_id=item.id, rule_kind=kind).delete()


@atomic_fn
def set_checklist_item_evaluation_rule(
    *,
    actor: User | None,
    item_id: uuid.UUID,
    rule_kind: str,
    bound_min: Decimal | None = None,
    bound_max: Decimal | None = None,
    min_inclusive: bool | None = None,
    max_inclusive: bool | None = None,
    warn_min: Decimal | None = None,
    warn_max: Decimal | None = None,
    warn_min_inclusive: bool | None = None,
    warn_max_inclusive: bool | None = None,
    expected_choice: str = "",
    expected_option_id: uuid.UUID | None = None,
    treat_na_as_not_evaluated: bool = True,
    specification_version_id: uuid.UUID | None = None,
    specification_parameter_id: uuid.UUID | None = None,
) -> ChecklistItemEvaluationRule:
    """Create or replace the explicit evaluation rule for a draft item."""
    from apps.checklists.models import ChecklistEvaluationRuleKind

    user = _require_authenticated_actor(actor)
    item = _lock_item(item_id)
    require_permission(
        user, MANAGE_CHECKLIST, scope=version_authorization_scope(item.section.version)
    )
    _require_draft(item.section.version)
    kind = (rule_kind or "").strip().upper()
    if kind not in ChecklistEvaluationRuleKind.values:
        raise ValidationError(
            {
                "rule_kind": (
                    f"Unknown evaluation rule kind {rule_kind!r}. "
                    f"Allowed: {', '.join(sorted(ChecklistEvaluationRuleKind.values))}."
                )
            }
        )

    ChecklistItemEvaluationRule.objects.filter(item_id=item.id).delete()
    rule = ChecklistItemEvaluationRule(
        item=item,
        rule_kind=kind,
        bound_min=bound_min,
        bound_max=bound_max,
        min_inclusive=min_inclusive,
        max_inclusive=max_inclusive,
        warn_min=warn_min,
        warn_max=warn_max,
        warn_min_inclusive=warn_min_inclusive,
        warn_max_inclusive=warn_max_inclusive,
        expected_choice=(expected_choice or "").strip().upper(),
        expected_option_id=expected_option_id,
        treat_na_as_not_evaluated=bool(treat_na_as_not_evaluated),
        specification_version_id=specification_version_id,
        specification_parameter_id=specification_parameter_id,
    )
    rule.full_clean()
    rule.save()
    record_event(
        event_type="CHECKLIST_ITEM_EVALUATION_RULE_SET",
        actor=user,
        metadata=_version_metadata(
            item.section.version,
            extra={
                "checklist_item_id": str(item.id),
                "checklist_item_code": item.code,
                "evaluation_rule_id": str(rule.id),
                "rule_kind": rule.rule_kind,
                "specification_version_id": (
                    str(specification_version_id) if specification_version_id else None
                ),
                "specification_parameter_id": (
                    str(specification_parameter_id) if specification_parameter_id else None
                ),
            },
        ),
    )
    return rule


@atomic_fn
def clear_checklist_item_evaluation_rule(
    *,
    actor: User | None,
    item_id: uuid.UUID,
) -> None:
    user = _require_authenticated_actor(actor)
    item = _lock_item(item_id)
    require_permission(
        user, MANAGE_CHECKLIST, scope=version_authorization_scope(item.section.version)
    )
    _require_draft(item.section.version)
    deleted, _ = ChecklistItemEvaluationRule.objects.filter(item_id=item.id).delete()
    if deleted:
        record_event(
            event_type="CHECKLIST_ITEM_EVALUATION_RULE_CLEARED",
            actor=user,
            metadata=_version_metadata(
                item.section.version,
                extra={
                    "checklist_item_id": str(item.id),
                    "checklist_item_code": item.code,
                },
            ),
        )


@atomic_fn
def set_checklist_calculation_operands(
    *,
    actor: User | None,
    item_id: uuid.UUID,
    source_item_ids: list[uuid.UUID],
) -> ChecklistItem:
    """Replace ordered operands for a CALCULATED draft item (same version only)."""
    user = _require_authenticated_actor(actor)
    item = _lock_item(item_id)
    require_permission(
        user, MANAGE_CHECKLIST, scope=version_authorization_scope(item.section.version)
    )
    _require_draft(item.section.version)
    if item.item_kind != ChecklistItemKind.CALCULATED:
        raise ValidationError({"item": "Only CALCULATED items accept calculation operands."})

    version_id = item.section.version_id
    version_items = {
        row.id: row
        for row in prefetch_related_compat(
            ChecklistItem.objects.select_related("section", "parent_item").filter(
                section__version_id=version_id
            ),
            "calculation_operand_links",
        )
    }
    operands: list[ChecklistItem] = []
    for source_id in source_item_ids:
        source = version_items.get(source_id)
        if source is None:
            raise ValidationError(
                {"calculation_operands": f"Operand {source_id} is not in this checklist version."}
            )
        operands.append(source)

    # Temporarily apply intended links on a copy-like validation using in-memory links.
    ChecklistCalculationOperand.objects.filter(calculated_item_id=item.id).delete()
    for position, source in enumerate(operands, start=1):
        ChecklistCalculationOperand.objects.create(
            calculated_item=item,
            source_item=source,
            position=position,
        )
    item = prefetch_related_compat(
        ChecklistItem.objects.select_related("section", "parent_item"),
        "calculation_operand_links__source_item__section",
    ).get(pk=item.id)
    version_items[item.id] = item
    validate_calculation_definition(
        calculated=item,
        operands=ordered_operands_for_item(item),
        items_by_id=version_items,
    )
    return item


def ordered_operands_for_item(item: ChecklistItem) -> list[ChecklistItem]:
    return [
        link.source_item
        for link in item.calculation_operand_links.select_related(
            "source_item", "source_item__section"
        ).order_by("position", "pk")
    ]


def _swap_positions(
    *,
    queryset_model: type[ChecklistSection] | type[ChecklistItem] | type[ChecklistItemOption],
    parent_filter: dict[str, Any],
    current: ChecklistSection | ChecklistItem | ChecklistItemOption,
    direction: str,
) -> None:
    if direction not in {"up", "down"}:
        raise ValidationError({"direction": "Direction must be up or down."})
    siblings: list[ChecklistSection | ChecklistItem | ChecklistItemOption] = list(
        lock_queryset(queryset_model.objects.filter(**parent_filter)).order_by("position", "pk")
    )
    ids = [row.pk for row in siblings]
    try:
        index = ids.index(current.pk)
    except ValueError as exc:
        raise ValidationError({"object": "Row not found in parent."}) from exc
    target_index = index - 1 if direction == "up" else index + 1
    if target_index < 0 or target_index >= len(siblings):
        return
    other = siblings[target_index]
    current_pos, other_pos = current.position, other.position
    # Temporary unique-safe swap using a high sentinel.
    sentinel = max((row.position for row in siblings), default=0) + 1000
    other.position = sentinel
    other.save(update_fields=["position"])
    current.position = other_pos
    current.save(update_fields=["position"])
    other.position = current_pos
    other.save(update_fields=["position"])


@atomic_fn
def create_checklist_template(
    *,
    actor: User | None,
    organization: Organization,
    code: str,
    name: str,
    description: str = "",
    product: FGProduct | None = None,
    is_active: bool = True,
) -> ChecklistTemplate:
    user = _require_authenticated_actor(actor)
    require_permission(user, MANAGE_CHECKLIST, scope=Scope(organization_id=organization.id))
    normalized_code, normalized_name, normalized_description = _prepare_template_fields(
        code=code,
        name=name,
        description=description,
    )
    product = _validate_product_for_org(organization=organization, product=product)
    template = ChecklistTemplate(
        organization=organization,
        product=product,
        code=normalized_code,
        name=normalized_name,
        description=normalized_description,
        is_active=is_active,
    )
    try:
        template.full_clean()
        template.save()
    except (ValidationError, IntegrityError) as exc:
        _reraise_template_persistence_error(exc)

    record_event(
        event_type="CHECKLIST_TEMPLATE_CREATED",
        actor=user,
        metadata=_template_metadata(template),
    )
    return template


@atomic_fn
def update_checklist_template(
    *,
    actor: User | None,
    template_id: uuid.UUID,
    code: str | None = None,
    name: str | None = None,
    description: Any = _UNSET,
    product: Any = _UNSET,
) -> ChecklistTemplate:
    user = _require_authenticated_actor(actor)
    template = lock_queryset(
        ChecklistTemplate.objects.select_related("organization", "product").filter(pk=template_id)
    ).first()
    if template is None:
        raise ValidationError({"template": "Checklist template not found."})
    require_permission(user, MANAGE_CHECKLIST, scope=template_authorization_scope(template))

    next_code = template.code if code is None else code
    next_name = template.name if name is None else name
    next_description = template.description if description is _UNSET else str(description or "")
    normalized_code, normalized_name, normalized_description = _prepare_template_fields(
        code=next_code,
        name=next_name,
        description=next_description,
    )
    next_product: FGProduct | None
    if product is _UNSET:
        next_product = template.product
    else:
        next_product = _validate_product_for_org(
            organization=template.organization,
            product=product,
        )

    field_map: dict[str, Any] = {
        "code": normalized_code,
        "name": normalized_name,
        "description": normalized_description,
        "product": next_product,
    }
    changed: list[str] = []
    for field, value in field_map.items():
        if getattr(template, field) != value:
            setattr(template, field, value)
            changed.append(field)
    if not changed:
        return template
    try:
        template.full_clean()
        template.save()
    except (ValidationError, IntegrityError) as exc:
        _reraise_template_persistence_error(exc)

    record_event(
        event_type="CHECKLIST_TEMPLATE_UPDATED",
        actor=user,
        metadata=_template_metadata(template, changed_fields=changed),
    )
    return template


@atomic_fn
def activate_checklist_template(*, actor: User | None, template_id: uuid.UUID) -> ChecklistTemplate:
    user = _require_authenticated_actor(actor)
    template = locked_get(ChecklistTemplate, pk=template_id)
    if template is None:
        raise ValidationError({"template": "Checklist template not found."})
    require_permission(user, MANAGE_CHECKLIST, scope=template_authorization_scope(template))
    if template.is_active:
        return template
    template.is_active = True
    template.save(update_fields=["is_active", "updated_at"])
    record_event(
        event_type="CHECKLIST_TEMPLATE_ACTIVATED",
        actor=user,
        metadata=_template_metadata(template),
    )
    return template


@atomic_fn
def deactivate_checklist_template(
    *, actor: User | None, template_id: uuid.UUID
) -> ChecklistTemplate:
    user = _require_authenticated_actor(actor)
    template = locked_get(ChecklistTemplate, pk=template_id)
    if template is None:
        raise ValidationError({"template": "Checklist template not found."})
    require_permission(user, MANAGE_CHECKLIST, scope=template_authorization_scope(template))
    if not template.is_active:
        return template
    template.is_active = False
    template.save(update_fields=["is_active", "updated_at"])
    record_event(
        event_type="CHECKLIST_TEMPLATE_DEACTIVATED",
        actor=user,
        metadata=_template_metadata(template),
    )
    return template


def _allocate_next_version_number(template: ChecklistTemplate) -> int:
    locked = locked_get(ChecklistTemplate, pk=template.pk)
    if locked is None:
        raise ValidationError({"template": "Checklist template not found."})
    # Prefer order_by over Max() — more portable across PostgreSQL and Mongo.
    current = (
        locked.versions.order_by("-version_number").values_list("version_number", flat=True).first()
    )
    return int(current or 0) + 1


def _parse_optional_decimal(value: Any, *, field: str) -> Decimal | None:
    if value is None or value == "":
        return None
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value).strip())
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValidationError({field: f"Invalid decimal for {field}."}) from exc


def _normalize_response_fields(
    *,
    response_type: str | None,
    unit: str = "",
    minimum_value: Any = None,
    maximum_value: Any = None,
    decimal_precision: Any = None,
    rounding_mode: str = "",
    min_inclusive: Any = True,
    max_inclusive: Any = True,
) -> tuple[str, str, Decimal | None, Decimal | None, int | None, str, bool, bool]:
    normalized_type = (response_type or "").strip()
    unit_text = (unit or "").strip()
    min_value = _parse_optional_decimal(minimum_value, field="minimum_value")
    max_value = _parse_optional_decimal(maximum_value, field="maximum_value")
    precision, mode = assert_precision_rounding_pair(
        decimal_precision=decimal_precision,
        rounding_mode=rounding_mode,
    )
    min_inc = True if min_inclusive is None else bool(min_inclusive)
    max_inc = True if max_inclusive is None else bool(max_inclusive)
    errors = validate_item_response_definition(
        response_type=normalized_type,
        unit=unit_text,
        minimum_value=min_value,
        maximum_value=max_value,
        decimal_precision=precision,
        rounding_mode=mode,
        require_response_type=False,
    )
    if errors:
        raise ValidationError(errors)
    if normalized_type != ChecklistResponseType.NUMBER:
        unit_text = ""
        min_value = None
        max_value = None
        precision = None
        mode = ""
        min_inc = True
        max_inc = True
    else:
        if unit_text:
            unit_text = assert_known_unit(unit_text)
    return (
        normalized_type,
        unit_text,
        min_value,
        max_value,
        precision,
        mode,
        min_inc,
        max_inc,
    )


def _next_option_position(item: ChecklistItem) -> int:
    current = item.options.aggregate(m=Max("position"))["m"]
    return int(current or 0) + 1


def _lock_item(item_id: uuid.UUID) -> ChecklistItem:
    item = lock_queryset(
        ChecklistItem.objects.select_related(
            "section",
            "section__version",
            "section__version__template",
            "parent_item",
        ).filter(pk=item_id)
    ).first()
    if item is None:
        raise ValidationError({"item": "Checklist item not found."})
    return item


def _clone_structure(*, source: ChecklistVersion, target: ChecklistVersion) -> None:
    for section in prefetch_related_compat(
        source.sections.order_by("position", "pk"),
        "items__options",
        "items__calculation_operand_links",
        "items__condition_rules",
    ):
        new_section = ChecklistSection.objects.create(
            version=target,
            title=section.title,
            description=section.description,
            position=section.position,
        )
        item_map: dict[uuid.UUID, ChecklistItem] = {}
        ordered_items = list(section.items.order_by("position", "pk"))
        # Pass 1: create rows without parent links so FK remapping is safe.
        for item in ordered_items:
            new_item = ChecklistItem.objects.create(
                section=new_section,
                parent_item=None,
                item_kind=item.item_kind,
                code=item.code,
                label=item.label,
                help_text=item.help_text,
                position=item.position,
                is_required=item.is_required,
                response_type=item.response_type,
                unit=item.unit,
                minimum_value=item.minimum_value,
                maximum_value=item.maximum_value,
                decimal_precision=item.decimal_precision,
                rounding_mode=item.rounding_mode,
                min_inclusive=item.min_inclusive,
                max_inclusive=item.max_inclusive,
                repeat_min=item.repeat_min,
                repeat_max=item.repeat_max,
                repeat_default=item.repeat_default,
                calculation_operator=item.calculation_operator,
                control_point_class=item.control_point_class,
                criticality=item.criticality,
            )
            item_map[item.id] = new_item
            for option in item.options.order_by("position", "pk"):
                ChecklistItemOption.objects.create(
                    item=new_item,
                    value=option.value,
                    label=option.label,
                    position=option.position,
                )
        # Pass 2: remap parent_item within the cloned section.
        for item in ordered_items:
            if item.parent_item_id is None:
                continue
            parent = item_map.get(item.parent_item_id)
            child = item_map[item.id]
            if parent is None:
                raise ValidationError(
                    {"version": f"Unable to clone parent link for item {item.code}."}
                )
            child.parent_item = parent
            child.save(update_fields=["parent_item"])
        # Pass 3: remap calculation operands.
        for item in ordered_items:
            if item.item_kind != ChecklistItemKind.CALCULATED:
                continue
            new_calc = item_map[item.id]
            for link in item.calculation_operand_links.order_by("position", "pk"):
                source_mapped = item_map.get(link.source_item_id)
                if source_mapped is None:
                    raise ValidationError(
                        {"version": (f"Unable to clone calculation operand for item {item.code}.")}
                    )
                ChecklistCalculationOperand.objects.create(
                    calculated_item=new_calc,
                    source_item=source_mapped,
                    position=link.position,
                )

    # Remap conditional rules across the full cloned version (codes + section position).
    full_source_items = list(
        prefetch_related_compat(
            ChecklistItem.objects.filter(section__version=source).select_related("section"),
            "condition_rules__expected_option",
            "condition_rules__operand_item__section",
            "evaluation_rule__expected_option",
            "options",
        )
    )
    full_target_by_code_section: dict[tuple[str, int], ChecklistItem] = {}
    for item in ChecklistItem.objects.filter(section__version=target).select_related("section"):
        full_target_by_code_section[(item.code, item.section.position)] = item
    option_map: dict[uuid.UUID, uuid.UUID] = {}
    for source_item in full_source_items:
        target_item = full_target_by_code_section.get(
            (source_item.code, source_item.section.position)
        )
        if target_item is None:
            continue
        source_opts = list(source_item.options.order_by("position", "pk"))
        target_opts = list(target_item.options.order_by("position", "pk"))
        for src_opt, tgt_opt in zip(source_opts, target_opts, strict=False):
            option_map[src_opt.id] = tgt_opt.id

    for source_item in full_source_items:
        target_item = full_target_by_code_section.get(
            (source_item.code, source_item.section.position)
        )
        if target_item is None:
            continue
        for rule in source_item.condition_rules.all():
            operand_source = rule.operand_item
            operand_target = full_target_by_code_section.get(
                (operand_source.code, operand_source.section.position)
            )
            if operand_target is None:
                raise ValidationError(
                    {"version": f"Unable to clone condition rule for item {source_item.code}."}
                )
            expected_option_id = None
            if rule.expected_option_id:
                expected_option_id = option_map.get(rule.expected_option_id)
            ChecklistItemRule.objects.create(
                target_item=target_item,
                rule_kind=rule.rule_kind,
                operand_item=operand_target,
                comparator=rule.comparator,
                expected_text=rule.expected_text,
                expected_number=rule.expected_number,
                expected_boolean=rule.expected_boolean,
                expected_option_id=expected_option_id,
                expected_list=list(rule.expected_list or []),
            )
        if hasattr(source_item, "evaluation_rule"):
            try:
                src_eval = source_item.evaluation_rule
            except ChecklistItemEvaluationRule.DoesNotExist:
                src_eval = None
            if src_eval is not None:
                expected_option_id = None
                if src_eval.expected_option_id:
                    expected_option_id = option_map.get(src_eval.expected_option_id)
                ChecklistItemEvaluationRule.objects.create(
                    item=target_item,
                    rule_kind=src_eval.rule_kind,
                    bound_min=src_eval.bound_min,
                    bound_max=src_eval.bound_max,
                    min_inclusive=src_eval.min_inclusive,
                    max_inclusive=src_eval.max_inclusive,
                    warn_min=src_eval.warn_min,
                    warn_max=src_eval.warn_max,
                    warn_min_inclusive=src_eval.warn_min_inclusive,
                    warn_max_inclusive=src_eval.warn_max_inclusive,
                    expected_choice=src_eval.expected_choice,
                    expected_option_id=expected_option_id,
                    treat_na_as_not_evaluated=src_eval.treat_na_as_not_evaluated,
                    specification_version_id=src_eval.specification_version_id,
                    specification_parameter_id=src_eval.specification_parameter_id,
                )


@atomic_fn
def create_checklist_version(
    *,
    actor: User | None,
    template_id: uuid.UUID,
    source_version_id: uuid.UUID | None = None,
) -> ChecklistVersion:
    """
    Create a new DRAFT version.

    When ``source_version_id`` is provided, clone section/item rows into new rows
    (never share mutable structure across versions).
    """
    user = _require_authenticated_actor(actor)
    template = lock_queryset(
        ChecklistTemplate.objects.select_related("organization").filter(pk=template_id)
    ).first()
    if template is None:
        raise ValidationError({"template": "Checklist template not found."})
    require_permission(user, MANAGE_CHECKLIST, scope=template_authorization_scope(template))

    source: ChecklistVersion | None = None
    if source_version_id is not None:
        source = (
            ChecklistVersion.objects.select_related("template")
            .filter(pk=source_version_id, template_id=template.id)
            .first()
        )
        if source is None:
            raise ValidationError({"source_version": "Source version not found for this template."})

    version: ChecklistVersion | None = None
    last_error: Exception | None = None
    # Template row lock serializes allocation; unique constraint retry
    # covers residual races if another writer sneaks between max() and insert.
    # No nested atomic() — already inside atomic_fn, Mongo has no savepoints.
    for _attempt in range(16):
        version_number = _allocate_next_version_number(template)
        candidate = ChecklistVersion(
            template=template,
            version_number=version_number,
            status=ChecklistVersionStatus.DRAFT,
        )
        try:
            candidate.full_clean()
            candidate.save()
            version = candidate
            break
        except IntegrityError as exc:
            last_error = exc
            continue
        except ValidationError as exc:
            # full_clean unique validation races the same as IntegrityError —
            # retry with a freshly allocated number.
            messages = " ".join(str(m) for m in getattr(exc, "messages", ()) or ())
            err_dict = getattr(exc, "message_dict", None) or getattr(exc, "error_dict", None) or {}
            text = f"{messages} {err_dict} {exc}".lower()
            if "already exists" in text or "version_number" in text or "unique" in text:
                last_error = exc
                continue
            raise
    if version is None:
        raise ValidationError(
            {"version_number": "Unable to allocate the next checklist version number."}
        ) from last_error

    if source is not None:
        _clone_structure(source=source, target=version)
        record_event(
            event_type="CHECKLIST_VERSION_CLONED",
            actor=user,
            metadata=_version_metadata(
                version,
                extra={
                    "source_version_id": str(source.id),
                    "source_version_number": source.version_number,
                },
            ),
        )
    else:
        record_event(
            event_type="CHECKLIST_VERSION_CREATED",
            actor=user,
            metadata=_version_metadata(version),
        )
    return version


@atomic_fn
def add_checklist_section(
    *,
    actor: User | None,
    version_id: uuid.UUID,
    title: str,
    description: str = "",
) -> ChecklistSection:
    user = _require_authenticated_actor(actor)
    version = _lock_version(version_id)
    require_permission(user, MANAGE_CHECKLIST, scope=version_authorization_scope(version))
    _require_draft(version)
    normalized_title = normalize_name(title)
    if not normalized_title:
        raise ValidationError({"title": "Title cannot be blank."})
    section = ChecklistSection(
        version=version,
        title=normalized_title,
        description=(description or "").strip(),
        position=_next_section_position(version),
    )
    try:
        section.full_clean()
        section.save()
    except (ValidationError, IntegrityError) as exc:
        raise ValidationError({"section": "Unable to add checklist section."}) from exc
    return section


@atomic_fn
def update_checklist_section(
    *,
    actor: User | None,
    section_id: uuid.UUID,
    title: str | None = None,
    description: Any = _UNSET,
) -> ChecklistSection:
    user = _require_authenticated_actor(actor)
    section = lock_queryset(
        ChecklistSection.objects.select_related("version", "version__template").filter(
            pk=section_id
        )
    ).first()
    if section is None:
        raise ValidationError({"section": "Checklist section not found."})
    require_permission(user, MANAGE_CHECKLIST, scope=version_authorization_scope(section.version))
    _require_draft(section.version)
    if title is not None:
        normalized_title = normalize_name(title)
        if not normalized_title:
            raise ValidationError({"title": "Title cannot be blank."})
        section.title = normalized_title
    if description is not _UNSET:
        section.description = str(description or "").strip()
    try:
        section.full_clean()
        section.save()
    except (ValidationError, IntegrityError) as exc:
        raise ValidationError({"section": "Unable to update checklist section."}) from exc
    return section


@atomic_fn
def remove_checklist_section(*, actor: User | None, section_id: uuid.UUID) -> None:
    user = _require_authenticated_actor(actor)
    section = lock_queryset(
        ChecklistSection.objects.select_related("version", "version__template").filter(
            pk=section_id
        )
    ).first()
    if section is None:
        raise ValidationError({"section": "Checklist section not found."})
    require_permission(user, MANAGE_CHECKLIST, scope=version_authorization_scope(section.version))
    _require_draft(section.version)
    version = section.version
    section.delete()
    # Compact positions sequentially.
    for index, sibling in enumerate(
        version.sections.order_by("position", "pk"),
        start=1,
    ):
        if sibling.position != index:
            sibling.position = index
            sibling.save(update_fields=["position"])


@atomic_fn
def move_checklist_section(
    *,
    actor: User | None,
    section_id: uuid.UUID,
    direction: str,
) -> ChecklistSection:
    user = _require_authenticated_actor(actor)
    section = lock_queryset(
        ChecklistSection.objects.select_related("version", "version__template").filter(
            pk=section_id
        )
    ).first()
    if section is None:
        raise ValidationError({"section": "Checklist section not found."})
    require_permission(user, MANAGE_CHECKLIST, scope=version_authorization_scope(section.version))
    _require_draft(section.version)
    _swap_positions(
        queryset_model=ChecklistSection,
        parent_filter={"version_id": section.version_id},
        current=section,
        direction=direction,
    )
    section.refresh_from_db()
    return section


@atomic_fn
def add_checklist_item(
    *,
    actor: User | None,
    section_id: uuid.UUID,
    code: str,
    label: str,
    help_text: str = "",
    is_required: bool = True,
    response_type: str = "",
    unit: str = "",
    minimum_value: Any = None,
    maximum_value: Any = None,
    item_kind: str = ChecklistItemKind.SIMPLE,
    parent_item_id: uuid.UUID | None = None,
    repeat_min: Any = None,
    repeat_max: Any = None,
    repeat_default: Any = None,
    calculation_operator: str = "",
    calculation_operand_ids: list[uuid.UUID] | None = None,
    control_point_class: str = ChecklistControlPointClass.NONE,
    criticality: str = "",
    decimal_precision: Any = None,
    rounding_mode: str = "",
    min_inclusive: bool = True,
    max_inclusive: bool = True,
    requires_equipment_reference: bool = False,
    required_equipment_type: str = "",
) -> ChecklistItem:
    user = _require_authenticated_actor(actor)
    section = lock_queryset(
        ChecklistSection.objects.select_related("version", "version__template").filter(
            pk=section_id
        )
    ).first()
    if section is None:
        raise ValidationError({"section": "Checklist section not found."})
    require_permission(user, MANAGE_CHECKLIST, scope=version_authorization_scope(section.version))
    _require_draft(section.version)
    normalized_code = normalize_code(code)
    normalized_label = normalize_name(label)
    if not normalized_code:
        raise ValidationError({"code": "Code cannot be blank."})
    if not normalized_label:
        raise ValidationError({"label": "Label cannot be blank."})

    parent_item: ChecklistItem | None = None
    if parent_item_id is not None:
        parent_item = lock_queryset(
            ChecklistItem.objects.filter(pk=parent_item_id, section_id=section.id)
        ).first()
        if parent_item is None:
            raise ValidationError({"parent_item": "Parent item not found in this section."})

    (
        kind,
        parent_item,
        resp_type,
        unit_text,
        min_value,
        max_value,
        r_min,
        r_max,
        r_default,
        operator,
        precision,
        mode,
        min_inc,
        max_inc,
    ) = _normalize_item_kind_fields(
        item_kind=item_kind,
        parent_item=parent_item,
        response_type=response_type,
        unit=unit,
        minimum_value=minimum_value,
        maximum_value=maximum_value,
        repeat_min=repeat_min,
        repeat_max=repeat_max,
        repeat_default=repeat_default,
        calculation_operator=calculation_operator,
        decimal_precision=decimal_precision,
        rounding_mode=rounding_mode,
        min_inclusive=min_inclusive,
        max_inclusive=max_inclusive,
    )
    required_flag = bool(is_required)
    if kind == ChecklistItemKind.REPEATING_GROUP:
        required_flag = False
    item = ChecklistItem(
        section=section,
        parent_item=parent_item,
        item_kind=kind,
        code=normalized_code,
        label=normalized_label,
        help_text=(help_text or "").strip(),
        position=_next_item_position(section, parent_item=parent_item),
        is_required=required_flag,
        response_type=resp_type,
        unit=unit_text,
        minimum_value=min_value,
        maximum_value=max_value,
        decimal_precision=precision,
        rounding_mode=mode,
        min_inclusive=min_inc,
        max_inclusive=max_inc,
        requires_equipment_reference=bool(requires_equipment_reference),
        required_equipment_type=(required_equipment_type or "").strip().upper(),
        repeat_min=r_min,
        repeat_max=r_max,
        repeat_default=r_default,
        calculation_operator=operator,
        control_point_class=assert_known_control_point_class(control_point_class),
        criticality=assert_known_criticality(criticality),
    )
    try:
        item.full_clean()
        item.save()
    except (ValidationError, IntegrityError) as exc:
        if isinstance(exc, ValidationError) and getattr(exc, "message_dict", None):
            raise
        messages = " ".join(str(m) for m in getattr(exc, "messages", [str(exc)]))
        if "chk_item_section_code_ci_uniq" in messages or "unique" in messages.lower():
            raise ValidationError(
                {"code": "An item with this code already exists in the section."}
            ) from exc
        raise ValidationError({"item": "Unable to add checklist item."}) from exc

    if kind == ChecklistItemKind.CALCULATED and calculation_operand_ids is not None:
        return set_checklist_calculation_operands(
            actor=actor,
            item_id=item.id,
            source_item_ids=list(calculation_operand_ids),
        )
    return item


@atomic_fn
def update_checklist_item(
    *,
    actor: User | None,
    item_id: uuid.UUID,
    code: str | None = None,
    label: str | None = None,
    help_text: Any = _UNSET,
    is_required: bool | None = None,
    response_type: Any = _UNSET,
    unit: Any = _UNSET,
    minimum_value: Any = _UNSET,
    maximum_value: Any = _UNSET,
    item_kind: Any = _UNSET,
    parent_item_id: Any = _UNSET,
    repeat_min: Any = _UNSET,
    repeat_max: Any = _UNSET,
    repeat_default: Any = _UNSET,
    calculation_operator: Any = _UNSET,
    calculation_operand_ids: Any = _UNSET,
    control_point_class: Any = _UNSET,
    criticality: Any = _UNSET,
    decimal_precision: Any = _UNSET,
    rounding_mode: Any = _UNSET,
    min_inclusive: Any = _UNSET,
    max_inclusive: Any = _UNSET,
    requires_equipment_reference: Any = _UNSET,
    required_equipment_type: Any = _UNSET,
) -> ChecklistItem:
    user = _require_authenticated_actor(actor)
    item = _lock_item(item_id)
    require_permission(
        user, MANAGE_CHECKLIST, scope=version_authorization_scope(item.section.version)
    )
    _require_draft(item.section.version)
    if code is not None:
        normalized_code = normalize_code(code)
        if not normalized_code:
            raise ValidationError({"code": "Code cannot be blank."})
        item.code = normalized_code
    if label is not None:
        normalized_label = normalize_name(label)
        if not normalized_label:
            raise ValidationError({"label": "Label cannot be blank."})
        item.label = normalized_label
    if help_text is not _UNSET:
        item.help_text = str(help_text or "").strip()
    if is_required is not None:
        item.is_required = is_required

    next_kind = item.item_kind if item_kind is _UNSET else str(item_kind or "")
    next_parent = item.parent_item
    if parent_item_id is not _UNSET:
        if parent_item_id in (None, ""):
            next_parent = None
        else:
            next_parent = (
                ChecklistItem.objects.filter(pk=parent_item_id, section_id=item.section_id)
                .exclude(pk=item.id)
                .first()
            )
            if next_parent is None:
                raise ValidationError({"parent_item": "Parent item not found in this section."})

    next_type = item.response_type if response_type is _UNSET else response_type
    next_unit = item.unit if unit is _UNSET else unit
    next_min = item.minimum_value if minimum_value is _UNSET else minimum_value
    next_max = item.maximum_value if maximum_value is _UNSET else maximum_value
    next_r_min = item.repeat_min if repeat_min is _UNSET else repeat_min
    next_r_max = item.repeat_max if repeat_max is _UNSET else repeat_max
    next_r_default = item.repeat_default if repeat_default is _UNSET else repeat_default
    next_operator = (
        item.calculation_operator
        if calculation_operator is _UNSET
        else str(calculation_operator or "")
    )
    next_precision = item.decimal_precision if decimal_precision is _UNSET else decimal_precision
    next_mode = item.rounding_mode if rounding_mode is _UNSET else rounding_mode
    next_min_inc = item.min_inclusive if min_inclusive is _UNSET else min_inclusive
    next_max_inc = item.max_inclusive if max_inclusive is _UNSET else max_inclusive

    before_meas = {
        "unit": item.unit,
        "decimal_precision": item.decimal_precision,
        "rounding_mode": item.rounding_mode,
        "min_inclusive": item.min_inclusive,
        "max_inclusive": item.max_inclusive,
        "minimum_value": (
            format(item.minimum_value, "f") if item.minimum_value is not None else None
        ),
        "maximum_value": (
            format(item.maximum_value, "f") if item.maximum_value is not None else None
        ),
    }

    (
        kind,
        parent_item,
        resp_type,
        unit_text,
        min_value,
        max_value,
        r_min,
        r_max,
        r_default,
        operator,
        precision,
        mode,
        min_inc,
        max_inc,
    ) = _normalize_item_kind_fields(
        item_kind=next_kind,
        parent_item=next_parent,
        response_type=str(next_type or ""),
        unit=str(next_unit or ""),
        minimum_value=next_min,
        maximum_value=next_max,
        repeat_min=next_r_min,
        repeat_max=next_r_max,
        repeat_default=next_r_default,
        calculation_operator=next_operator,
        decimal_precision=next_precision,
        rounding_mode=str(next_mode or ""),
        min_inclusive=next_min_inc,
        max_inclusive=next_max_inc,
    )
    item.item_kind = kind
    item.parent_item = parent_item
    item.response_type = resp_type
    item.unit = unit_text
    item.minimum_value = min_value
    item.maximum_value = max_value
    item.decimal_precision = precision
    item.rounding_mode = mode
    item.min_inclusive = min_inc
    item.max_inclusive = max_inc
    item.repeat_min = r_min
    item.repeat_max = r_max
    item.repeat_default = r_default
    item.calculation_operator = operator
    if kind == ChecklistItemKind.REPEATING_GROUP:
        item.is_required = False
        item.calculation_operator = ""
        ChecklistCalculationOperand.objects.filter(calculated_item_id=item.id).delete()
    elif kind == ChecklistItemKind.SIMPLE:
        item.calculation_operator = ""
        ChecklistCalculationOperand.objects.filter(calculated_item_id=item.id).delete()

    before_cp = item.control_point_class
    before_crit = item.criticality
    if control_point_class is not _UNSET:
        item.control_point_class = assert_known_control_point_class(str(control_point_class or ""))
    if criticality is not _UNSET:
        item.criticality = assert_known_criticality(str(criticality or ""))
    if requires_equipment_reference is not _UNSET:
        item.requires_equipment_reference = bool(requires_equipment_reference)
    if required_equipment_type is not _UNSET:
        item.required_equipment_type = str(required_equipment_type or "").strip().upper()

    try:
        item.full_clean()
        item.save()
    except (ValidationError, IntegrityError) as exc:
        if isinstance(exc, ValidationError) and getattr(exc, "message_dict", None):
            raise
        messages = " ".join(str(m) for m in getattr(exc, "messages", [str(exc)]))
        if "chk_item_section_code_ci_uniq" in messages or "unique" in messages.lower():
            raise ValidationError(
                {"code": "An item with this code already exists in the section."}
            ) from exc
        raise ValidationError({"item": "Unable to update checklist item."}) from exc

    if item.control_point_class != before_cp or item.criticality != before_crit:
        record_event(
            event_type="CHECKLIST_ITEM_CONTROL_POINT_METADATA_UPDATED",
            actor=user,
            metadata=_version_metadata(
                item.section.version,
                extra={
                    "checklist_item_id": str(item.id),
                    "checklist_item_code": item.code,
                    "before": {
                        "control_point_class": before_cp,
                        "criticality": before_crit,
                    },
                    "after": {
                        "control_point_class": item.control_point_class,
                        "criticality": item.criticality,
                    },
                },
            ),
        )

    after_meas = {
        "unit": item.unit,
        "decimal_precision": item.decimal_precision,
        "rounding_mode": item.rounding_mode,
        "min_inclusive": item.min_inclusive,
        "max_inclusive": item.max_inclusive,
        "minimum_value": (
            format(item.minimum_value, "f") if item.minimum_value is not None else None
        ),
        "maximum_value": (
            format(item.maximum_value, "f") if item.maximum_value is not None else None
        ),
    }
    if before_meas != after_meas:
        record_event(
            event_type="CHECKLIST_ITEM_MEASUREMENT_SEMANTICS_UPDATED",
            actor=user,
            metadata=_version_metadata(
                item.section.version,
                extra={
                    "checklist_item_id": str(item.id),
                    "checklist_item_code": item.code,
                    "before": before_meas,
                    "after": after_meas,
                },
            ),
        )

    if calculation_operand_ids is not _UNSET:
        if kind != ChecklistItemKind.CALCULATED:
            raise ValidationError(
                {"calculation_operands": "Operands are only allowed on CALCULATED items."}
            )
        return set_checklist_calculation_operands(
            actor=actor,
            item_id=item.id,
            source_item_ids=list(calculation_operand_ids or []),
        )
    return item


@atomic_fn
def remove_checklist_item(*, actor: User | None, item_id: uuid.UUID) -> None:
    user = _require_authenticated_actor(actor)
    item = _lock_item(item_id)
    require_permission(
        user, MANAGE_CHECKLIST, scope=version_authorization_scope(item.section.version)
    )
    _require_draft(item.section.version)
    section = item.section
    item.delete()
    for index, sibling in enumerate(section.items.order_by("position", "pk"), start=1):
        if sibling.position != index:
            sibling.position = index
            sibling.save(update_fields=["position"])


@atomic_fn
def move_checklist_item(
    *,
    actor: User | None,
    item_id: uuid.UUID,
    direction: str,
) -> ChecklistItem:
    user = _require_authenticated_actor(actor)
    item = _lock_item(item_id)
    require_permission(
        user, MANAGE_CHECKLIST, scope=version_authorization_scope(item.section.version)
    )
    _require_draft(item.section.version)
    _swap_positions(
        queryset_model=ChecklistItem,
        parent_filter={
            "section_id": item.section_id,
            "parent_item_id": item.parent_item_id,
        },
        current=item,
        direction=direction,
    )
    item.refresh_from_db()
    return item


@atomic_fn
def add_checklist_item_option(
    *,
    actor: User | None,
    item_id: uuid.UUID,
    value: str,
    label: str,
) -> ChecklistItemOption:
    user = _require_authenticated_actor(actor)
    item = _lock_item(item_id)
    require_permission(
        user, MANAGE_CHECKLIST, scope=version_authorization_scope(item.section.version)
    )
    _require_draft(item.section.version)
    if item.response_type != ChecklistResponseType.SELECT:
        raise ValidationError({"item": "Options are only allowed for SELECT response types."})
    normalized_value = normalize_code(value)
    normalized_label = normalize_name(label)
    if not normalized_value:
        raise ValidationError({"value": "Option value cannot be blank."})
    if not normalized_label:
        raise ValidationError({"label": "Option label cannot be blank."})
    option = ChecklistItemOption(
        item=item,
        value=normalized_value,
        label=normalized_label,
        position=_next_option_position(item),
    )
    try:
        option.full_clean()
        option.save()
    except (ValidationError, IntegrityError) as exc:
        messages = " ".join(str(m) for m in getattr(exc, "messages", [str(exc)]))
        if "chk_option_item_value_ci_uniq" in messages or "unique" in messages.lower():
            raise ValidationError(
                {"value": "An option with this value already exists for the item."}
            ) from exc
        raise ValidationError({"option": "Unable to add checklist item option."}) from exc
    return option


@atomic_fn
def update_checklist_item_option(
    *,
    actor: User | None,
    option_id: uuid.UUID,
    value: str | None = None,
    label: str | None = None,
) -> ChecklistItemOption:
    user = _require_authenticated_actor(actor)
    option = lock_queryset(
        ChecklistItemOption.objects.select_related(
            "item",
            "item__section",
            "item__section__version",
            "item__section__version__template",
        ).filter(pk=option_id)
    ).first()
    if option is None:
        raise ValidationError({"option": "Checklist item option not found."})
    require_permission(
        user,
        MANAGE_CHECKLIST,
        scope=version_authorization_scope(option.item.section.version),
    )
    _require_draft(option.item.section.version)
    if value is not None:
        normalized_value = normalize_code(value)
        if not normalized_value:
            raise ValidationError({"value": "Option value cannot be blank."})
        option.value = normalized_value
    if label is not None:
        normalized_label = normalize_name(label)
        if not normalized_label:
            raise ValidationError({"label": "Option label cannot be blank."})
        option.label = normalized_label
    try:
        option.full_clean()
        option.save()
    except (ValidationError, IntegrityError) as exc:
        messages = " ".join(str(m) for m in getattr(exc, "messages", [str(exc)]))
        if "chk_option_item_value_ci_uniq" in messages or "unique" in messages.lower():
            raise ValidationError(
                {"value": "An option with this value already exists for the item."}
            ) from exc
        raise ValidationError({"option": "Unable to update checklist item option."}) from exc
    return option


@atomic_fn
def remove_checklist_item_option(*, actor: User | None, option_id: uuid.UUID) -> None:
    user = _require_authenticated_actor(actor)
    option = lock_queryset(
        ChecklistItemOption.objects.select_related(
            "item",
            "item__section",
            "item__section__version",
            "item__section__version__template",
        ).filter(pk=option_id)
    ).first()
    if option is None:
        raise ValidationError({"option": "Checklist item option not found."})
    require_permission(
        user,
        MANAGE_CHECKLIST,
        scope=version_authorization_scope(option.item.section.version),
    )
    _require_draft(option.item.section.version)
    item = option.item
    option.delete()
    for index, sibling in enumerate(item.options.order_by("position", "pk"), start=1):
        if sibling.position != index:
            sibling.position = index
            sibling.save(update_fields=["position"])


@atomic_fn
def move_checklist_item_option(
    *,
    actor: User | None,
    option_id: uuid.UUID,
    direction: str,
) -> ChecklistItemOption:
    user = _require_authenticated_actor(actor)
    option = lock_queryset(
        ChecklistItemOption.objects.select_related(
            "item",
            "item__section",
            "item__section__version",
            "item__section__version__template",
        ).filter(pk=option_id)
    ).first()
    if option is None:
        raise ValidationError({"option": "Checklist item option not found."})
    require_permission(
        user,
        MANAGE_CHECKLIST,
        scope=version_authorization_scope(option.item.section.version),
    )
    _require_draft(option.item.section.version)
    _swap_positions(
        queryset_model=ChecklistItemOption,
        parent_filter={"item_id": option.item_id},
        current=option,
        direction=direction,
    )
    option.refresh_from_db()
    return option


def _validate_publish_structure(version: ChecklistVersion) -> None:
    """
    Technical structural checks only — not business completeness rules.

    Empty definitions cannot be published because a published version must be a
    coherent, non-empty definition graph. Product thresholds / temperature ranges
    remain EVIDENCE REQUIRED and are not enforced here.
    """
    sections = list(
        prefetch_related_compat(
            version.sections.order_by("position"),
            "items__options",
            "items__child_items",
            "items__calculation_operand_links__source_item__section",
            "items__calculation_operand_links__source_item__parent_item",
            "items__condition_rules__operand_item__section",
            "items__condition_rules__operand_item__parent_item",
            "items__condition_rules__expected_option",
            "items__evaluation_rule__expected_option",
        )
    )
    if not sections:
        raise ValidationError({"version": "A checklist version must have at least one section."})
    if not any(section.items.exists() for section in sections):
        raise ValidationError(
            {"version": "A checklist version must have at least one item before publishing."}
        )

    all_items: list[ChecklistItem] = []
    for section in sections:
        all_items.extend(list(section.items.all()))
    items_by_id = {item.id: item for item in all_items}

    for section in sections:
        if not section.title.strip():
            raise ValidationError({"version": "All sections must have a title."})
        for item in section.items.all():
            if not item.code.strip() or not item.label.strip():
                raise ValidationError({"version": "All items must have a code and label."})
            if item.item_kind == ChecklistItemKind.REPEATING_GROUP:
                if item.parent_item_id is not None:
                    raise ValidationError(
                        {"version": f"Repeating group {item.code} cannot be nested."}
                    )
                if (item.response_type or "").strip():
                    raise ValidationError(
                        {"version": (f"Repeating group {item.code} must not have a response type.")}
                    )
                children = [child for child in item.child_items.all()]
                if not children:
                    raise ValidationError(
                        {
                            "version": (
                                f"Repeating group {item.code} must have at least one "
                                "SIMPLE or CALCULATED child item before publishing."
                            )
                        }
                    )
                if any(
                    child.item_kind not in {ChecklistItemKind.SIMPLE, ChecklistItemKind.CALCULATED}
                    for child in children
                ):
                    raise ValidationError(
                        {
                            "version": (
                                f"Repeating group {item.code} may only contain SIMPLE or "
                                "CALCULATED children."
                            )
                        }
                    )
                if not any(child.item_kind == ChecklistItemKind.SIMPLE for child in children):
                    raise ValidationError(
                        {
                            "version": (
                                f"Repeating group {item.code} must include at least one "
                                "SIMPLE child (operands need numeric inputs)."
                            )
                        }
                    )
                for field_name in ("repeat_min", "repeat_max", "repeat_default"):
                    value = getattr(item, field_name)
                    if value is not None and value > REPEAT_SAMPLE_TECHNICAL_CEILING:
                        raise ValidationError(
                            {
                                "version": (
                                    f"Repeating group {item.code} {field_name} exceeds "
                                    f"technical ceiling ({REPEAT_SAMPLE_TECHNICAL_CEILING})."
                                )
                            }
                        )
                if (
                    item.repeat_min is not None
                    and item.repeat_max is not None
                    and item.repeat_min > item.repeat_max
                ):
                    raise ValidationError(
                        {
                            "version": (
                                f"Repeating group {item.code} has repeat_min greater than "
                                "repeat_max."
                            )
                        }
                    )
                continue

            if item.parent_item_id is not None:
                parent = item.parent_item
                if parent is None or parent.item_kind != ChecklistItemKind.REPEATING_GROUP:
                    raise ValidationError(
                        {
                            "version": (
                                f"Item {item.code} parent must be a REPEATING_GROUP "
                                "in the same section."
                            )
                        }
                    )
                if parent.section_id != item.section_id:
                    raise ValidationError(
                        {"version": f"Item {item.code} parent must be in the same section."}
                    )

            if item.item_kind == ChecklistItemKind.CALCULATED:
                try:
                    validate_calculation_definition(
                        calculated=item,
                        operands=ordered_operands_for_item(item),
                        items_by_id=items_by_id,
                    )
                except ValidationError as exc:
                    detail = "; ".join(
                        str(m)
                        for msgs in getattr(exc, "message_dict", {"error": exc.messages}).values()
                        for m in (msgs if isinstance(msgs, list) else [msgs])
                    )
                    raise ValidationError(
                        {"version": f"Item {item.code} has invalid calculation: {detail}"}
                    ) from exc
                if item.options.exists():
                    raise ValidationError(
                        {"version": f"CALCULATED item {item.code} must not have SELECT options."}
                    )
                continue

            errors = validate_item_response_definition(
                response_type=item.response_type,
                unit=item.unit,
                minimum_value=item.minimum_value,
                maximum_value=item.maximum_value,
                decimal_precision=item.decimal_precision,
                rounding_mode=item.rounding_mode,
                require_response_type=True,
            )
            if errors:
                raise ValidationError(
                    {
                        "version": (
                            f"Item {item.code} has invalid response definition: "
                            + "; ".join(errors.values())
                        )
                    }
                )
            if item.response_type == ChecklistResponseType.SELECT and not item.options.exists():
                raise ValidationError(
                    {
                        "version": (
                            f"SELECT item {item.code} must have at least one option "
                            "before publishing."
                        )
                    }
                )
            if item.response_type != ChecklistResponseType.SELECT and item.options.exists():
                raise ValidationError(
                    {"version": (f"Item {item.code} is not SELECT and must not have options.")}
                )

    # Conditional rules (Phase 06J) — validate after items_by_id is complete.
    all_rules: list[ChecklistItemRule] = []
    for item in items_by_id.values():
        for rule in item.condition_rules.all():
            all_rules.append(rule)
            try:
                validate_rule_definition(rule=rule, items_by_id=items_by_id)
            except ValidationError as exc:
                detail = "; ".join(
                    str(m)
                    for msgs in getattr(exc, "message_dict", {"error": exc.messages}).values()
                    for m in (msgs if isinstance(msgs, list) else [msgs])
                )
                raise ValidationError(
                    {"version": f"Item {item.code} has invalid condition rule: {detail}"}
                ) from exc
    try:
        detect_visibility_cycles(rules=all_rules)
    except ValidationError as exc:
        raise ValidationError({"version": f"Conditional rules invalid: {exc.messages[0]}"}) from exc

    # Evaluation rules (Phase 06K) — structural validity only; no invented limits.
    for item in items_by_id.values():
        try:
            eval_rule = item.evaluation_rule
        except ChecklistItemEvaluationRule.DoesNotExist:
            continue
        try:
            eval_rule.full_clean()
        except ValidationError as exc:
            detail = "; ".join(
                str(m)
                for msgs in getattr(exc, "message_dict", {"error": exc.messages}).values()
                for m in (msgs if isinstance(msgs, list) else [msgs])
            )
            raise ValidationError(
                {"version": f"Item {item.code} has invalid evaluation rule: {detail}"}
            ) from exc


@atomic_fn
def publish_checklist_version(*, actor: User | None, version_id: uuid.UUID) -> ChecklistVersion:
    user = _require_authenticated_actor(actor)
    version = _lock_version(version_id)
    require_permission(user, MANAGE_CHECKLIST, scope=version_authorization_scope(version))
    assert_version_transition_allowed(
        current=version.status,
        target=ChecklistVersionStatus.PUBLISHED,
    )
    _validate_publish_structure(version)
    # Phase 07D: overlapping PUBLISHED windows are blocked at selection / effectivity
    # update — not at publish — so 07A explicit multi-publish + UUID bind remains valid.

    now = timezone.now()
    try:
        cas_status_transition(
            ChecklistVersion,
            pk=version.pk,
            from_status=version.status,
            to_status=ChecklistVersionStatus.PUBLISHED,
            extra_updates={"published_at": now, "updated_at": now},
        )
    except TransitionConflictError as exc:
        raise ValidationError(
            {"version": "Checklist version was updated concurrently and cannot be published."}
        ) from exc
    version.refresh_from_db()
    record_event(
        event_type="CHECKLIST_VERSION_PUBLISHED",
        actor=user,
        metadata=_version_metadata(version),
    )
    return version


@atomic_fn
def retire_checklist_version(*, actor: User | None, version_id: uuid.UUID) -> ChecklistVersion:
    user = _require_authenticated_actor(actor)
    version = _lock_version(version_id)
    require_permission(user, MANAGE_CHECKLIST, scope=version_authorization_scope(version))
    assert_version_transition_allowed(
        current=version.status,
        target=ChecklistVersionStatus.RETIRED,
    )
    try:
        cas_status_transition(
            ChecklistVersion,
            pk=version.pk,
            from_status=version.status,
            to_status=ChecklistVersionStatus.RETIRED,
            extra_updates={"updated_at": timezone.now()},
        )
    except TransitionConflictError as exc:
        raise ValidationError(
            {"version": "Checklist version was updated concurrently and cannot be retired."}
        ) from exc
    version.refresh_from_db()
    record_event(
        event_type="CHECKLIST_VERSION_RETIRED",
        actor=user,
        metadata=_version_metadata(version),
    )
    return version
