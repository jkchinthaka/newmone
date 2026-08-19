"""FG-QA-001 proposal CSV parser and draft instantiation (no publish, no seed)."""

from __future__ import annotations

import csv
import hashlib
import json
import uuid
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from django.core.exceptions import ValidationError

from apps.accounts.models import User
from apps.checklists.compat_queries import load_sections_with_items_and_options
from apps.checklists.measurement import assert_known_unit
from apps.checklists.models import (
    ChecklistItem,
    ChecklistResponseType,
    ChecklistTemplate,
    ChecklistVersion,
    ChecklistVersionStatus,
    validate_item_response_definition,
)
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_item_option,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
)
from apps.core.persistence.backend import is_mongodb
from apps.core.persistence.transactions import atomic_fn, run_mongo_multi_doc_atomic
from apps.organizations.models import Organization
from apps.organizations.services import normalize_code, normalize_name

FG_QA_001_TEMPLATE_CODE = "FG-QA-001"
FG_QA_001_TEMPLATE_NAME = "Finished Goods Quality Release & Dispatch Checklist"
FG_QA_001_REVISION = "Draft v0.1 — Proposed"
FG_QA_001_DESCRIPTION = (
    "PROJECT-PROPOSED DRAFT — NOT APPROVED FOR PRODUCTION USE. "
    "Draft v0.1 pending QA / Production / IT validation. "
    "SELECT disposition labels (RELEASE/HOLD/REJECT) are definition choices only — "
    "not automatic release, HOLD, or REJECT."
)

REQUIRED_CSV_HEADERS = (
    "template_code",
    "template_name",
    "template_revision",
    "section_order",
    "section_title",
    "item_order",
    "item_code",
    "item_label",
    "required",
    "response_type",
    "unit",
    "minimum",
    "maximum",
    "select_options",
    "notes",
)

PROPOSAL_CSV_PATH = (
    Path(__file__).resolve().parents[2]
    / "docs"
    / "business"
    / "proposals"
    / "FG_QA_001_DRAFT_V0_1.csv"
)


@dataclass(frozen=True)
class ProposalOption:
    value: str
    label: str
    position: int


@dataclass(frozen=True)
class ProposalItem:
    section_order: int
    section_title: str
    item_order: int
    code: str
    label: str
    is_required: bool
    response_type: str
    unit: str
    minimum_value: Decimal | None
    maximum_value: Decimal | None
    options: tuple[ProposalOption, ...] = ()


@dataclass(frozen=True)
class ProposalDefinition:
    template_code: str
    template_name: str
    template_revision: str
    items: tuple[ProposalItem, ...]

    @property
    def section_titles(self) -> dict[int, str]:
        titles: dict[int, str] = {}
        for item in self.items:
            existing = titles.get(item.section_order)
            if existing is None:
                titles[item.section_order] = item.section_title
            elif existing != item.section_title:
                raise ValidationError(
                    {
                        "proposal": (
                            f"Section {item.section_order} has conflicting titles "
                            f"'{existing}' and '{item.section_title}'."
                        )
                    }
                )
        return titles


@dataclass
class LoadResult:
    status: str
    message: str
    template_id: uuid.UUID | None = None
    version_id: uuid.UUID | None = None
    section_count: int = 0
    item_count: int = 0
    dry_run: bool = False
    details: dict[str, Any] = field(default_factory=dict)


def default_proposal_csv_path() -> Path:
    return PROPOSAL_CSV_PATH


def _parse_optional_decimal(raw: str, *, field_name: str) -> Decimal | None:
    text = (raw or "").strip()
    if not text:
        return None
    try:
        return Decimal(text)
    except (InvalidOperation, ValueError) as exc:
        raise ValidationError({field_name: f"Invalid decimal value: {text!r}."}) from exc


def _parse_bool(raw: str) -> bool:
    text = (raw or "").strip().lower()
    if text in {"true", "1", "yes", "y"}:
        return True
    if text in {"false", "0", "no", "n"}:
        return False
    raise ValidationError({"required": f"Invalid required flag: {raw!r}."})


def _parse_select_options(raw: str) -> tuple[ProposalOption, ...]:
    text = (raw or "").strip()
    if not text:
        return ()
    options: list[ProposalOption] = []
    seen: set[str] = set()
    for index, part in enumerate(text.split("|"), start=1):
        value = normalize_code(part)
        if not value:
            raise ValidationError({"select_options": "SELECT option value cannot be blank."})
        if value in seen:
            raise ValidationError({"select_options": f"Duplicate SELECT option value: {value}."})
        seen.add(value)
        options.append(ProposalOption(value=value, label=value, position=index))
    return tuple(options)


def parse_fg_qa_001_csv(path: Path | None = None) -> ProposalDefinition:
    """Parse and validate the repository-controlled FG-QA-001 proposal CSV."""
    csv_path = path or default_proposal_csv_path()
    if not csv_path.is_file():
        raise ValidationError({"proposal": f"Proposal CSV not found: {csv_path}."})

    with csv_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            raise ValidationError({"proposal": "Proposal CSV has no header row."})
        headers = tuple(h.strip() for h in reader.fieldnames)
        if headers != REQUIRED_CSV_HEADERS:
            raise ValidationError(
                {
                    "proposal": (
                        "Proposal CSV headers do not match the required contract. "
                        f"Expected {REQUIRED_CSV_HEADERS}, got {headers}."
                    )
                }
            )

        items: list[ProposalItem] = []
        for row_number, row in enumerate(reader, start=2):
            if not any((value or "").strip() for value in row.values()):
                continue
            try:
                template_code = normalize_code(row.get("template_code") or "")
                template_name = normalize_name(row.get("template_name") or "")
                template_revision = (row.get("template_revision") or "").strip()
                if not template_revision:
                    raise ValidationError(
                        {"proposal": f"Row {row_number}: template_revision cannot be blank."}
                    )
                if template_name and template_name != FG_QA_001_TEMPLATE_NAME:
                    raise ValidationError(
                        {
                            "proposal": (
                                f"Row {row_number}: template_name must be "
                                f"{FG_QA_001_TEMPLATE_NAME!r}."
                            )
                        }
                    )
                section_order = int((row.get("section_order") or "").strip())
                section_title = normalize_name(row.get("section_title") or "")
                item_order = int((row.get("item_order") or "").strip())
                item_code = normalize_code(row.get("item_code") or "")
                item_label = normalize_name(row.get("item_label") or "")
                response_type = (row.get("response_type") or "").strip()
                unit = (row.get("unit") or "").strip()
                minimum_value = _parse_optional_decimal(
                    row.get("minimum") or "", field_name="minimum"
                )
                maximum_value = _parse_optional_decimal(
                    row.get("maximum") or "", field_name="maximum"
                )
                is_required = _parse_bool(row.get("required") or "")
                options = _parse_select_options(row.get("select_options") or "")
            except (TypeError, ValueError) as exc:
                raise ValidationError(
                    {"proposal": f"Malformed proposal row {row_number}: {exc}."}
                ) from exc

            if template_code != FG_QA_001_TEMPLATE_CODE:
                raise ValidationError(
                    {
                        "proposal": (
                            f"Row {row_number}: template_code must be {FG_QA_001_TEMPLATE_CODE}."
                        )
                    }
                )
            if not template_name or not section_title or not item_code or not item_label:
                raise ValidationError(
                    {"proposal": f"Row {row_number}: required text fields cannot be blank."}
                )
            if response_type not in ChecklistResponseType.values:
                raise ValidationError(
                    {
                        "proposal": (
                            f"Row {row_number}: unsupported response_type {response_type!r}."
                        )
                    }
                )
            errors = validate_item_response_definition(
                response_type=response_type,
                unit=unit,
                minimum_value=minimum_value,
                maximum_value=maximum_value,
                require_response_type=True,
            )
            if errors:
                raise ValidationError(
                    {"proposal": f"Row {row_number}: " + "; ".join(errors.values())}
                )
            if response_type == ChecklistResponseType.SELECT:
                if not options:
                    raise ValidationError(
                        {"proposal": f"Row {row_number}: SELECT item requires select_options."}
                    )
            elif options:
                raise ValidationError(
                    {
                        "proposal": (
                            f"Row {row_number}: select_options only allowed for SELECT items."
                        )
                    }
                )

            items.append(
                ProposalItem(
                    section_order=section_order,
                    section_title=section_title,
                    item_order=item_order,
                    code=item_code,
                    label=item_label,
                    is_required=is_required,
                    response_type=response_type,
                    unit=unit,
                    minimum_value=minimum_value,
                    maximum_value=maximum_value,
                    options=options,
                )
            )

    if not items:
        raise ValidationError({"proposal": "Proposal CSV contains no item rows."})

    definition = ProposalDefinition(
        template_code=FG_QA_001_TEMPLATE_CODE,
        template_name=FG_QA_001_TEMPLATE_NAME,
        template_revision=FG_QA_001_REVISION,
        items=tuple(items),
    )
    _assert_proposal_structure(definition)
    return definition


def _assert_proposal_structure(definition: ProposalDefinition) -> None:
    titles = definition.section_titles
    if sorted(titles.keys()) != list(range(1, len(titles) + 1)):
        raise ValidationError({"proposal": "Section orders must be contiguous starting at 1."})
    if len(titles) != 7:
        raise ValidationError({"proposal": "FG-QA-001 proposal must contain exactly 7 sections."})
    if len(definition.items) != 42:
        raise ValidationError({"proposal": "FG-QA-001 proposal must contain exactly 42 items."})

    seen_codes: set[str] = set()
    by_section: dict[int, list[int]] = {}
    for item in definition.items:
        if item.code in seen_codes:
            raise ValidationError({"proposal": f"Duplicate item code: {item.code}."})
        seen_codes.add(item.code)
        by_section.setdefault(item.section_order, []).append(item.item_order)
        if item.section_title != titles[item.section_order]:
            raise ValidationError({"proposal": f"Inconsistent section title for {item.code}."})

    for section_order, orders in by_section.items():
        if sorted(orders) != list(range(1, len(orders) + 1)):
            raise ValidationError(
                {
                    "proposal": (
                        f"Item orders in section {section_order} must be unique and contiguous."
                    )
                }
            )


def proposal_fingerprint(definition: ProposalDefinition) -> str:
    payload = _normalized_structure_payload_from_proposal(definition)
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def _normalized_structure_payload_from_proposal(definition: ProposalDefinition) -> dict[str, Any]:
    sections: list[dict[str, Any]] = []
    titles = definition.section_titles
    for section_order in sorted(titles.keys()):
        section_items = [item for item in definition.items if item.section_order == section_order]
        sections.append(
            {
                "position": section_order,
                "title": titles[section_order],
                "items": [
                    {
                        "position": item.item_order,
                        "code": item.code,
                        "label": item.label,
                        "is_required": item.is_required,
                        "response_type": item.response_type,
                        "unit": (
                            assert_known_unit(item.unit) if (item.unit or "").strip() else item.unit
                        ),
                        "minimum_value": (
                            str(item.minimum_value) if item.minimum_value is not None else None
                        ),
                        "maximum_value": (
                            str(item.maximum_value) if item.maximum_value is not None else None
                        ),
                        "options": [
                            {
                                "position": option.position,
                                "value": option.value,
                                "label": option.label,
                            }
                            for option in item.options
                        ],
                    }
                    for item in sorted(section_items, key=lambda row: row.item_order)
                ],
            }
        )
    return {
        "template_code": definition.template_code,
        "template_name": definition.template_name,
        "sections": sections,
    }


def version_structure_fingerprint(version: ChecklistVersion) -> str:
    sections_payload: list[dict[str, Any]] = []
    for section in load_sections_with_items_and_options(version.id):
        items_payload: list[dict[str, Any]] = []
        for item in section.items.all():
            items_payload.append(
                {
                    "position": item.position,
                    "code": item.code,
                    "label": item.label,
                    "is_required": item.is_required,
                    "response_type": item.response_type,
                    "unit": item.unit,
                    "minimum_value": (
                        str(item.minimum_value) if item.minimum_value is not None else None
                    ),
                    "maximum_value": (
                        str(item.maximum_value) if item.maximum_value is not None else None
                    ),
                    "options": [
                        {
                            "position": option.position,
                            "value": option.value,
                            "label": option.label,
                        }
                        for option in item.options.all()
                    ],
                }
            )
        sections_payload.append(
            {
                "position": section.position,
                "title": section.title,
                "items": items_payload,
            }
        )
    payload: dict[str, Any] = {
        "template_code": version.template.code,
        "template_name": version.template.name,
        "sections": sections_payload,
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def _get_org_template(*, organization_id: uuid.UUID) -> ChecklistTemplate | None:
    return (
        ChecklistTemplate.objects.filter(
            organization_id=organization_id,
            code__iexact=FG_QA_001_TEMPLATE_CODE,
        )
        .select_related("organization")
        .first()
    )


def _latest_draft(template: ChecklistTemplate) -> ChecklistVersion | None:
    return (
        ChecklistVersion.objects.filter(template=template, status=ChecklistVersionStatus.DRAFT)
        .order_by("-version_number")
        .select_related("template")
        .first()
    )


def _populate_version_from_proposal(
    *,
    actor: User,
    version: ChecklistVersion,
    definition: ProposalDefinition,
) -> None:
    titles = definition.section_titles
    section_ids: dict[int, uuid.UUID] = {}
    for section_order in sorted(titles.keys()):
        section = add_checklist_section(
            actor=actor,
            version_id=version.id,
            title=titles[section_order],
            description="",
        )
        section_ids[section_order] = section.id

    for item in sorted(definition.items, key=lambda row: (row.section_order, row.item_order)):
        created = add_checklist_item(
            actor=actor,
            section_id=section_ids[item.section_order],
            code=item.code,
            label=item.label,
            help_text="",
            is_required=item.is_required,
            response_type=item.response_type,
            unit=item.unit,
            minimum_value=item.minimum_value,
            maximum_value=item.maximum_value,
        )
        for option in item.options:
            add_checklist_item_option(
                actor=actor,
                item_id=created.id,
                value=option.value,
                label=option.label,
            )

    version.refresh_from_db()
    if version.status != ChecklistVersionStatus.DRAFT:
        raise ValidationError({"version": "Proposal loader must leave the version in DRAFT."})


@atomic_fn
def load_fg_qa_001_draft(
    *,
    actor: User | None,
    organization_id: uuid.UUID,
    dry_run: bool = False,
    proposal_path: Path | None = None,
) -> LoadResult:
    """
    Instantiate FG-QA-001 as a DRAFT checklist for one Organization.

    Never publishes. Never invents Product assignment. Idempotent for identical drafts.
    On MongoDB, create + populate runs inside an explicit multi-document transaction
    so forced failures leave zero partial template/version rows.
    """
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise ValidationError({"actor": "An active authenticated actor is required."})

    organization = Organization.objects.filter(pk=organization_id).first()
    if organization is None:
        raise ValidationError({"organization": "Organization not found."})

    definition = parse_fg_qa_001_csv(proposal_path)
    expected_fingerprint = proposal_fingerprint(definition)
    template = _get_org_template(organization_id=organization.id)

    if template is not None:
        draft = _latest_draft(template)
        if draft is not None:
            current_fingerprint = version_structure_fingerprint(draft)
            if current_fingerprint == expected_fingerprint:
                return LoadResult(
                    status="noop",
                    message=(
                        "FG-QA-001 DRAFT already matches the proposal fingerprint; no changes made."
                    ),
                    template_id=template.id,
                    version_id=draft.id,
                    section_count=draft.sections.count(),
                    item_count=ChecklistItem.objects.filter(section__version=draft).count(),
                    dry_run=dry_run,
                    details={"fingerprint": expected_fingerprint},
                )
            raise ValidationError(
                {
                    "draft": (
                        "An existing FG-QA-001 DRAFT differs from the proposal. "
                        "Manual review is required; the loader will not overwrite it. "
                        f"Existing version: {draft.version_number}."
                    )
                }
            )

    if dry_run:
        return LoadResult(
            status="dry_run",
            message=(
                "Dry-run OK: would create/update FG-QA-001 as DRAFT only "
                "(never publish) for the selected Organization."
            ),
            template_id=template.id if template else None,
            version_id=None,
            section_count=7,
            item_count=42,
            dry_run=True,
            details={"fingerprint": expected_fingerprint, "organization_id": str(organization.id)},
        )

    def _mutate() -> LoadResult:
        local_template = template
        if local_template is None:
            local_template = create_checklist_template(
                actor=actor,
                organization=organization,
                code=FG_QA_001_TEMPLATE_CODE,
                name=FG_QA_001_TEMPLATE_NAME,
                description=FG_QA_001_DESCRIPTION,
                product=None,
                is_active=True,
            )
        version = create_checklist_version(actor=actor, template_id=local_template.id)
        if version.status != ChecklistVersionStatus.DRAFT:
            raise ValidationError({"version": "Loader refused non-DRAFT version creation."})
        _populate_version_from_proposal(actor=actor, version=version, definition=definition)
        version.refresh_from_db()
        if version.status != ChecklistVersionStatus.DRAFT:
            raise ValidationError({"version": "Loader must not publish the proposal draft."})

        return LoadResult(
            status="created",
            message=(
                "Created FG-QA-001 DRAFT proposal for review. "
                "NOT APPROVED FOR PRODUCTION USE. Status remains DRAFT."
            ),
            template_id=local_template.id,
            version_id=version.id,
            section_count=7,
            item_count=42,
            dry_run=False,
            details={
                "fingerprint": expected_fingerprint,
                "organization_id": str(organization.id),
                "version_number": version.version_number,
            },
        )

    # PostgreSQL: @atomic_fn already wraps; Mongo atomic() is a no-op so use
    # explicit multi-doc transactions for all-or-nothing populate.
    if is_mongodb():
        return run_mongo_multi_doc_atomic(_mutate)  # type: ignore[no-any-return]
    return _mutate()


def is_fg_qa_001_proposal_template(template: ChecklistTemplate) -> bool:
    return normalize_code(template.code) == FG_QA_001_TEMPLATE_CODE
