"""Controlled FG Product CSV import — no sample Nelna catalogue rows."""

from __future__ import annotations

import csv
import datetime
import io
from dataclasses import dataclass, field
from pathlib import Path
from typing import TextIO

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction

from apps.access_control.services import Scope, require_permission, user_has_permission_any_scope
from apps.accounts.models import User
from apps.master_data.models import FGProduct
from apps.master_data.services import MANAGE_FG_PRODUCT, create_fg_product
from apps.organizations.models import Organization
from apps.organizations.services import normalize_code, normalize_name
from apps.security_audit.services import record_event

REQUIRED_HEADERS = (
    "organization_code",
    "code",
    "name",
    "description",
    "erp_item_code",
    "category",
    "brand",
    "pack_size",
    "uom",
    "barcode",
    "storage_category",
    "shelf_life_reference",
    "label_artwork_reference",
    "effective_from",
    "effective_to",
    "is_active",
)


@dataclass(frozen=True)
class ImportRowError:
    row_number: int
    field: str
    message: str


@dataclass
class FGProductImportPreview:
    dry_run: bool
    row_count: int = 0
    products_to_create: int = 0
    duplicate_codes: list[str] = field(default_factory=list)
    duplicate_erp_codes: list[str] = field(default_factory=list)
    errors: list[ImportRowError] = field(default_factory=list)
    created_ids: list[str] = field(default_factory=list)
    message: str = ""

    @property
    def ok(self) -> bool:
        return not self.errors


@dataclass(frozen=True)
class _ParsedRow:
    row_number: int
    organization_code: str
    code: str
    name: str
    description: str
    erp_item_code: str
    category: str
    brand: str
    pack_size: str
    uom: str
    barcode: str
    storage_category: str
    shelf_life_reference: str
    label_artwork_reference: str
    effective_from: datetime.date | None
    effective_to: datetime.date | None
    is_active: bool


def empty_product_import_template_csv() -> str:
    return ",".join(REQUIRED_HEADERS) + "\n"


def _parse_bool(raw: str, *, row_number: int) -> bool:
    value = (raw or "").strip().lower()
    if value in {"", "1", "true", "yes", "y", "active"}:
        return True
    if value in {"0", "false", "no", "n", "inactive"}:
        return False
    raise ValidationError(
        {"is_active": f"Row {row_number}: is_active must be true/false (or blank for true)."}
    )


def _parse_date(raw: str, *, field_name: str, row_number: int) -> datetime.date | None:
    text = (raw or "").strip()
    if not text:
        return None
    try:
        return datetime.date.fromisoformat(text)
    except ValueError as exc:
        raise ValidationError(
            {field_name: f"Row {row_number}: {field_name} must be ISO date YYYY-MM-DD."}
        ) from exc


def parse_fg_product_csv(source: str | Path | TextIO) -> list[_ParsedRow]:
    if isinstance(source, (str, Path)):
        text = Path(source).read_text(encoding="utf-8-sig")
        handle: TextIO = io.StringIO(text)
    else:
        handle = source

    reader = csv.DictReader(handle)
    if reader.fieldnames is None:
        raise ValidationError({"csv": "CSV has no header row."})
    headers = [h.strip().lower() for h in reader.fieldnames if h is not None]
    missing = [h for h in REQUIRED_HEADERS if h not in headers]
    if missing:
        raise ValidationError({"csv": f"Missing required headers: {missing}"})

    rows: list[_ParsedRow] = []
    for index, raw in enumerate(reader, start=2):
        normalized = {(k or "").strip().lower(): (v or "").strip() for k, v in raw.items()}
        if not any(normalized.values()):
            continue
        rows.append(
            _ParsedRow(
                row_number=index,
                organization_code=normalize_code(normalized.get("organization_code", "")),
                code=normalize_code(normalized.get("code", "")),
                name=normalize_name(normalized.get("name", "")),
                description=(normalized.get("description") or "").strip(),
                erp_item_code=normalize_code(normalized.get("erp_item_code", "")),
                category=(normalized.get("category") or "").strip(),
                brand=(normalized.get("brand") or "").strip(),
                pack_size=(normalized.get("pack_size") or "").strip(),
                uom=normalize_code(normalized.get("uom", "")),
                barcode=(normalized.get("barcode") or "").strip(),
                storage_category=(normalized.get("storage_category") or "").strip(),
                shelf_life_reference=(normalized.get("shelf_life_reference") or "").strip(),
                label_artwork_reference=(normalized.get("label_artwork_reference") or "").strip(),
                effective_from=_parse_date(
                    normalized.get("effective_from", ""),
                    field_name="effective_from",
                    row_number=index,
                ),
                effective_to=_parse_date(
                    normalized.get("effective_to", ""),
                    field_name="effective_to",
                    row_number=index,
                ),
                is_active=_parse_bool(normalized.get("is_active", ""), row_number=index),
            )
        )
    return rows


def _validate_rows(rows: list[_ParsedRow]) -> tuple[list[ImportRowError], list[str], list[str]]:
    errors: list[ImportRowError] = []
    dup_codes: list[str] = []
    dup_erp: list[str] = []
    seen_codes: set[str] = set()
    seen_erp: set[str] = set()

    for row in rows:
        if not row.organization_code:
            errors.append(
                ImportRowError(row.row_number, "organization_code", "organization_code required.")
            )
            continue
        org = Organization.objects.filter(code__iexact=row.organization_code).first()
        if org is None:
            errors.append(
                ImportRowError(
                    row.row_number,
                    "organization_code",
                    f"Unknown organization_code: {row.organization_code}.",
                )
            )
            continue
        if not row.code:
            errors.append(ImportRowError(row.row_number, "code", "code required."))
        if not row.name:
            errors.append(ImportRowError(row.row_number, "name", "name required."))
        if (
            row.effective_to is not None
            and row.effective_from is not None
            and row.effective_to < row.effective_from
        ):
            errors.append(
                ImportRowError(
                    row.row_number,
                    "effective_to",
                    "effective_to cannot be earlier than effective_from.",
                )
            )

        code_key = f"{row.organization_code}:{row.code}"
        if row.code:
            if code_key in seen_codes:
                dup_codes.append(code_key)
                errors.append(
                    ImportRowError(
                        row.row_number, "code", f"Duplicate product code in file: {row.code}."
                    )
                )
            else:
                seen_codes.add(code_key)
            if FGProduct.objects.filter(organization=org, code__iexact=row.code).exists():
                dup_codes.append(code_key)
                errors.append(
                    ImportRowError(
                        row.row_number,
                        "code",
                        f"Product code already exists in organization: {row.code}.",
                    )
                )

        if row.erp_item_code:
            erp_key = f"{row.organization_code}:{row.erp_item_code}"
            if erp_key in seen_erp:
                dup_erp.append(erp_key)
                errors.append(
                    ImportRowError(
                        row.row_number,
                        "erp_item_code",
                        f"Duplicate ERP item code in file: {row.erp_item_code}.",
                    )
                )
            else:
                seen_erp.add(erp_key)
            if (
                FGProduct.objects.filter(organization=org, erp_item_code__iexact=row.erp_item_code)
                .exclude(erp_item_code="")
                .exists()
            ):
                dup_erp.append(erp_key)
                errors.append(
                    ImportRowError(
                        row.row_number,
                        "erp_item_code",
                        f"ERP item code already exists in organization: {row.erp_item_code}.",
                    )
                )

    return errors, sorted(set(dup_codes)), sorted(set(dup_erp))


def import_fg_products(
    *,
    actor: User | None,
    source: str | Path | TextIO,
    dry_run: bool = True,
) -> FGProductImportPreview:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    if not user_has_permission_any_scope(actor, MANAGE_FG_PRODUCT):
        raise PermissionDenied(
            "Permission denied. FG Product import requires manage_fgproduct "
            "at organization scope for target organizations."
        )

    try:
        rows = parse_fg_product_csv(source)
    except ValidationError as exc:
        preview = FGProductImportPreview(dry_run=dry_run, message="CSV parse failed.")
        message_dict = getattr(exc, "message_dict", None) or {"csv": [str(exc)]}
        for field_name, messages in message_dict.items():
            for msg in messages if isinstance(messages, list) else [messages]:
                preview.errors.append(ImportRowError(0, field_name, str(msg)))
        return preview

    preview = FGProductImportPreview(
        dry_run=dry_run, row_count=len(rows), products_to_create=len(rows)
    )
    errors, dup_codes, dup_erp = _validate_rows(rows)
    preview.errors.extend(errors)
    preview.duplicate_codes = dup_codes
    preview.duplicate_erp_codes = dup_erp

    if preview.errors:
        preview.message = f"Validation failed with {len(preview.errors)} error(s)."
        record_event(
            event_type="FG_PRODUCT_IMPORT_FAILED",
            actor=actor,
            metadata={
                "dry_run": dry_run,
                "row_count": preview.row_count,
                "error_count": len(preview.errors),
                "errors": [
                    {"row": e.row_number, "field": e.field, "message": e.message}
                    for e in preview.errors[:50]
                ],
                "duplicate_codes": preview.duplicate_codes[:50],
                "duplicate_erp_codes": preview.duplicate_erp_codes[:50],
            },
        )
        return preview

    if dry_run:
        preview.message = f"Dry-run OK: {preview.products_to_create} product(s)."
        record_event(
            event_type="FG_PRODUCT_IMPORT_PREVIEWED",
            actor=actor,
            metadata={
                "dry_run": True,
                "row_count": preview.row_count,
                "products_to_create": preview.products_to_create,
            },
        )
        return preview

    created: list[str] = []
    try:
        with transaction.atomic():
            org_by_code = {normalize_code(o.code): o for o in Organization.objects.all()}
            for row in rows:
                org = org_by_code[normalize_code(row.organization_code)]
                require_permission(actor, MANAGE_FG_PRODUCT, scope=Scope(organization_id=org.id))
                product = create_fg_product(
                    actor=actor,
                    organization=org,
                    code=row.code,
                    name=row.name,
                    description=row.description,
                    erp_item_code=row.erp_item_code,
                    category=row.category,
                    brand=row.brand,
                    pack_size=row.pack_size,
                    uom=row.uom,
                    barcode=row.barcode,
                    storage_category=row.storage_category,
                    shelf_life_reference=row.shelf_life_reference,
                    label_artwork_reference=row.label_artwork_reference,
                    effective_from=row.effective_from,
                    effective_to=row.effective_to,
                    is_active=row.is_active,
                )
                created.append(str(product.id))
    except (ValidationError, PermissionDenied) as exc:
        preview.errors.append(ImportRowError(0, "import", str(exc)))
        preview.message = "Atomic write aborted."
        record_event(
            event_type="FG_PRODUCT_IMPORT_FAILED",
            actor=actor,
            metadata={"dry_run": False, "error": str(exc)[:500]},
        )
        return preview

    preview.created_ids = created
    preview.message = f"Import committed: {len(created)} product(s)."
    record_event(
        event_type="FG_PRODUCT_IMPORT_COMPLETED",
        actor=actor,
        metadata={
            "dry_run": False,
            "row_count": preview.row_count,
            "created_count": len(created),
            "created_ids": created,
        },
    )
    return preview


def format_product_import_error_report(preview: FGProductImportPreview) -> str:
    lines = ["row_number,field,message"]
    for err in preview.errors:
        msg = err.message.replace('"', "'")
        lines.append(f'{err.row_number},{err.field},"{msg}"')
    return "\n".join(lines) + "\n"
