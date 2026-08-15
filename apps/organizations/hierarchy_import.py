"""Controlled Organization / Site / Department / Shift hierarchy import.

No sample Nelna company data. Operators supply evidence-backed CSV only.
Supports dry-run preview, duplicate reporting, validation, atomic write, and audit.
"""

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
from apps.organizations.models import Department, Organization, Shift, Site
from apps.organizations.services import (
    MANAGE_DEPARTMENT,
    MANAGE_ORGANIZATION,
    MANAGE_SHIFT,
    MANAGE_SITE,
    create_department,
    create_organization,
    create_shift,
    create_site,
    normalize_code,
    normalize_name,
)
from apps.security_audit.services import record_event

REQUIRED_HEADERS = (
    "entity_type",
    "organization_code",
    "site_code",
    "department_code",
    "code",
    "name",
    "is_active",
    "start_time",
    "end_time",
    "effective_from",
    "effective_to",
)

ENTITY_ORGANIZATION = "organization"
ENTITY_SITE = "site"
ENTITY_DEPARTMENT = "department"
ENTITY_SHIFT = "shift"
VALID_ENTITY_TYPES = frozenset({ENTITY_ORGANIZATION, ENTITY_SITE, ENTITY_DEPARTMENT, ENTITY_SHIFT})


@dataclass(frozen=True)
class ImportRowError:
    row_number: int
    field: str
    message: str


@dataclass
class HierarchyImportPreview:
    dry_run: bool
    row_count: int = 0
    organizations_to_create: int = 0
    sites_to_create: int = 0
    departments_to_create: int = 0
    shifts_to_create: int = 0
    duplicate_codes: list[str] = field(default_factory=list)
    errors: list[ImportRowError] = field(default_factory=list)
    created_ids: dict[str, list[str]] = field(default_factory=dict)
    message: str = ""

    @property
    def ok(self) -> bool:
        return not self.errors


@dataclass(frozen=True)
class _ParsedRow:
    row_number: int
    entity_type: str
    organization_code: str
    site_code: str
    department_code: str
    code: str
    name: str
    is_active: bool
    start_time: datetime.time | None
    end_time: datetime.time | None
    effective_from: datetime.date | None
    effective_to: datetime.date | None


def empty_template_csv() -> str:
    """Header-only template — no invented company values."""
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


def _parse_time(raw: str, *, field_name: str, row_number: int) -> datetime.time | None:
    text = (raw or "").strip()
    if not text:
        return None
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.datetime.strptime(text, fmt).time()
        except ValueError:
            continue
    raise ValidationError(
        {field_name: f"Row {row_number}: {field_name} must be HH:MM or HH:MM:SS."}
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


def parse_hierarchy_csv(source: str | Path | TextIO) -> list[_ParsedRow]:
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
        entity_type = normalized.get("entity_type", "").strip().lower()
        rows.append(
            _ParsedRow(
                row_number=index,
                entity_type=entity_type,
                organization_code=normalize_code(normalized.get("organization_code", "")),
                site_code=normalize_code(normalized.get("site_code", "")),
                department_code=normalize_code(normalized.get("department_code", "")),
                code=normalize_code(normalized.get("code", "")),
                name=normalize_name(normalized.get("name", "")),
                is_active=_parse_bool(normalized.get("is_active", ""), row_number=index),
                start_time=_parse_time(
                    normalized.get("start_time", ""), field_name="start_time", row_number=index
                ),
                end_time=_parse_time(
                    normalized.get("end_time", ""), field_name="end_time", row_number=index
                ),
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
            )
        )
    return rows


def _append_error(
    errors: list[ImportRowError],
    *,
    row_number: int,
    field: str,
    message: str,
) -> None:
    errors.append(ImportRowError(row_number=row_number, field=field, message=message))


def _row_key(row: _ParsedRow) -> str:
    if row.entity_type == ENTITY_ORGANIZATION:
        return f"organization:{row.code}"
    if row.entity_type == ENTITY_SITE:
        return f"site:{row.organization_code}/{row.code}"
    if row.entity_type == ENTITY_DEPARTMENT:
        return f"department:{row.organization_code}/{row.site_code or '-'}/{row.code}"
    return (
        f"shift:{row.organization_code}/"
        f"{row.site_code or '-'}/{row.department_code or '-'}/{row.code}"
    )


def _pending_org_codes(rows: list[_ParsedRow]) -> set[str]:
    return {r.code for r in rows if r.entity_type == ENTITY_ORGANIZATION and r.code}


def _pending_site_keys(rows: list[_ParsedRow]) -> set[str]:
    return {
        f"{r.organization_code}:{r.code}"
        for r in rows
        if r.entity_type == ENTITY_SITE and r.code and r.organization_code
    }


def _pending_dept_keys(rows: list[_ParsedRow]) -> set[str]:
    return {
        f"{r.organization_code}:{r.site_code}:{r.code}"
        for r in rows
        if r.entity_type == ENTITY_DEPARTMENT and r.code and r.organization_code
    }


def _validate_rows(rows: list[_ParsedRow]) -> tuple[list[ImportRowError], list[str]]:
    errors: list[ImportRowError] = []
    duplicates: list[str] = []
    seen_keys: set[str] = set()
    pending_orgs = _pending_org_codes(rows)
    pending_sites = _pending_site_keys(rows)
    pending_depts = _pending_dept_keys(rows)

    for row in rows:
        if row.entity_type not in VALID_ENTITY_TYPES:
            _append_error(
                errors,
                row_number=row.row_number,
                field="entity_type",
                message=(
                    f"entity_type must be one of {sorted(VALID_ENTITY_TYPES)}; "
                    f"got '{row.entity_type}'."
                ),
            )
            continue
        if not row.code:
            _append_error(errors, row_number=row.row_number, field="code", message="code required.")
        if not row.name:
            _append_error(errors, row_number=row.row_number, field="name", message="name required.")

        key = _row_key(row)
        if key in seen_keys:
            duplicates.append(key)
            _append_error(
                errors,
                row_number=row.row_number,
                field="code",
                message=f"Duplicate row in file for key {key}.",
            )
        else:
            seen_keys.add(key)

        if row.entity_type == ENTITY_ORGANIZATION:
            if row.code and Organization.objects.filter(code__iexact=row.code).exists():
                duplicates.append(key)
                _append_error(
                    errors,
                    row_number=row.row_number,
                    field="code",
                    message=f"Organization code already exists: {row.code}.",
                )
            continue

        if not row.organization_code:
            _append_error(
                errors,
                row_number=row.row_number,
                field="organization_code",
                message="organization_code required.",
            )
            continue

        org = Organization.objects.filter(code__iexact=row.organization_code).first()
        org_known = org is not None or row.organization_code in pending_orgs
        if not org_known:
            _append_error(
                errors,
                row_number=row.row_number,
                field="organization_code",
                message=f"Unknown organization_code: {row.organization_code}.",
            )
            continue

        if row.entity_type == ENTITY_SITE:
            if (
                org is not None
                and Site.objects.filter(organization=org, code__iexact=row.code).exists()
            ):
                duplicates.append(key)
                _append_error(
                    errors,
                    row_number=row.row_number,
                    field="code",
                    message=f"Site code already exists in organization: {row.code}.",
                )
            continue

        site = None
        site_known = True
        if row.site_code:
            site_key = f"{row.organization_code}:{row.site_code}"
            if org is not None:
                site = Site.objects.filter(organization=org, code__iexact=row.site_code).first()
            site_known = site is not None or site_key in pending_sites
            if not site_known:
                _append_error(
                    errors,
                    row_number=row.row_number,
                    field="site_code",
                    message=(
                        f"Site {row.site_code} not found under organization "
                        f"{row.organization_code}."
                    ),
                )

        if row.entity_type == ENTITY_DEPARTMENT:
            if org is not None:
                if row.site_code and site is not None:
                    if Department.objects.filter(
                        organization=org, site=site, code__iexact=row.code
                    ).exists():
                        duplicates.append(key)
                        _append_error(
                            errors,
                            row_number=row.row_number,
                            field="code",
                            message="Department code already exists for this site.",
                        )
                elif not row.site_code:
                    if Department.objects.filter(
                        organization=org, site__isnull=True, code__iexact=row.code
                    ).exists():
                        duplicates.append(key)
                        _append_error(
                            errors,
                            row_number=row.row_number,
                            field="code",
                            message="Department code already exists for this organization.",
                        )
            continue

        # shift
        if row.start_time is None or row.end_time is None:
            _append_error(
                errors,
                row_number=row.row_number,
                field="start_time",
                message="start_time and end_time required for shift.",
            )
        if row.effective_from is None:
            _append_error(
                errors,
                row_number=row.row_number,
                field="effective_from",
                message="effective_from required for shift.",
            )
        elif row.effective_to is not None and row.effective_to < row.effective_from:
            _append_error(
                errors,
                row_number=row.row_number,
                field="effective_to",
                message="effective_to cannot be earlier than effective_from.",
            )
        if row.department_code and not row.site_code:
            _append_error(
                errors,
                row_number=row.row_number,
                field="department_code",
                message="department_code requires site_code for shift.",
            )

        dept = None
        if row.department_code and row.site_code:
            dept_key = f"{row.organization_code}:{row.site_code}:{row.department_code}"
            if org is not None and site is not None:
                dept = Department.objects.filter(
                    organization=org, site=site, code__iexact=row.department_code
                ).first()
            if dept is None and dept_key not in pending_depts:
                _append_error(
                    errors,
                    row_number=row.row_number,
                    field="department_code",
                    message=f"Unknown department_code: {row.department_code}.",
                )

        if org is not None and row.code:
            shift_qs = Shift.objects.filter(organization=org, code__iexact=row.code)
            if site is None:
                shift_qs = shift_qs.filter(site__isnull=True)
            else:
                shift_qs = shift_qs.filter(site=site)
            if dept is None:
                shift_qs = shift_qs.filter(department__isnull=True)
            else:
                shift_qs = shift_qs.filter(department=dept)
            if shift_qs.exists():
                duplicates.append(key)
                _append_error(
                    errors,
                    row_number=row.row_number,
                    field="code",
                    message="Shift code already exists in the selected scope.",
                )

    return errors, duplicates


def _actor_may_import(actor: User) -> None:
    if not (
        user_has_permission_any_scope(actor, MANAGE_ORGANIZATION)
        or user_has_permission_any_scope(actor, MANAGE_SITE)
        or user_has_permission_any_scope(actor, MANAGE_DEPARTMENT)
        or user_has_permission_any_scope(actor, MANAGE_SHIFT)
    ):
        raise PermissionDenied(
            "Permission denied. Hierarchy import requires manage_organization, "
            "manage_site, manage_department, or manage_shift in some scope."
        )


def import_organization_hierarchy(
    *,
    actor: User | None,
    source: str | Path | TextIO,
    dry_run: bool = True,
) -> HierarchyImportPreview:
    """
    Validate and optionally write hierarchy rows from CSV.

    dry_run=True (default): preview only — no writes.
    dry_run=False: atomic write of all rows or none.
    """
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    _actor_may_import(actor)

    try:
        rows = parse_hierarchy_csv(source)
    except ValidationError as exc:
        preview = HierarchyImportPreview(dry_run=dry_run, message="CSV parse failed.")
        message_dict = getattr(exc, "message_dict", None) or {"csv": [str(exc)]}
        for field_name, messages in message_dict.items():
            for msg in messages if isinstance(messages, list) else [messages]:
                preview.errors.append(
                    ImportRowError(row_number=0, field=field_name, message=str(msg))
                )
        return preview

    preview = HierarchyImportPreview(dry_run=dry_run, row_count=len(rows))
    errors, duplicates = _validate_rows(rows)
    preview.errors.extend(errors)
    preview.duplicate_codes = sorted(set(duplicates))

    for row in rows:
        if row.entity_type == ENTITY_ORGANIZATION:
            preview.organizations_to_create += 1
        elif row.entity_type == ENTITY_SITE:
            preview.sites_to_create += 1
        elif row.entity_type == ENTITY_DEPARTMENT:
            preview.departments_to_create += 1
        elif row.entity_type == ENTITY_SHIFT:
            preview.shifts_to_create += 1

    if preview.errors:
        preview.message = f"Validation failed with {len(preview.errors)} error(s)."
        record_event(
            event_type="ORGANIZATION_HIERARCHY_IMPORT_FAILED",
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
            },
        )
        return preview

    if dry_run:
        preview.message = (
            f"Dry-run OK: {preview.organizations_to_create} org(s), "
            f"{preview.sites_to_create} site(s), "
            f"{preview.departments_to_create} department(s), "
            f"{preview.shifts_to_create} shift(s)."
        )
        record_event(
            event_type="ORGANIZATION_HIERARCHY_IMPORT_PREVIEWED",
            actor=actor,
            metadata={
                "dry_run": True,
                "row_count": preview.row_count,
                "organizations_to_create": preview.organizations_to_create,
                "sites_to_create": preview.sites_to_create,
                "departments_to_create": preview.departments_to_create,
                "shifts_to_create": preview.shifts_to_create,
            },
        )
        return preview

    created: dict[str, list[str]] = {
        "organizations": [],
        "sites": [],
        "departments": [],
        "shifts": [],
    }
    try:
        with transaction.atomic():
            # Codes are stored uppercase; keys use normalize_code for case-safe lookup.
            org_by_code: dict[str, Organization] = {
                normalize_code(o.code): o for o in Organization.objects.all()
            }
            site_by_key: dict[str, Site] = {
                f"{normalize_code(s.organization.code)}:{normalize_code(s.code)}": s
                for s in Site.objects.select_related("organization")
            }
            dept_by_key: dict[str, Department] = {}
            for d in Department.objects.select_related("organization", "site"):
                site_part = normalize_code(d.site.code) if d.site is not None else ""
                dept_by_key[
                    f"{normalize_code(d.organization.code)}:{site_part}:{normalize_code(d.code)}"
                ] = d

            for row in rows:
                if row.entity_type == ENTITY_ORGANIZATION:
                    require_permission(actor, MANAGE_ORGANIZATION, scope=Scope())
                    org = create_organization(
                        actor=actor,
                        code=row.code,
                        name=row.name,
                        is_active=row.is_active,
                    )
                    org_by_code[normalize_code(org.code)] = org
                    created["organizations"].append(str(org.id))
                elif row.entity_type == ENTITY_SITE:
                    org = org_by_code[normalize_code(row.organization_code)]
                    require_permission(actor, MANAGE_SITE, scope=Scope(organization_id=org.id))
                    site = create_site(
                        actor=actor,
                        organization=org,
                        code=row.code,
                        name=row.name,
                        is_active=row.is_active,
                    )
                    site_by_key[f"{normalize_code(org.code)}:{normalize_code(site.code)}"] = site
                    created["sites"].append(str(site.id))
                elif row.entity_type == ENTITY_DEPARTMENT:
                    org = org_by_code[normalize_code(row.organization_code)]
                    dept_site: Site | None = (
                        site_by_key.get(
                            f"{normalize_code(org.code)}:{normalize_code(row.site_code)}"
                        )
                        if row.site_code
                        else None
                    )
                    require_permission(
                        actor,
                        MANAGE_DEPARTMENT,
                        scope=Scope(
                            organization_id=org.id,
                            site_id=dept_site.id if dept_site is not None else None,
                        ),
                    )
                    dept = create_department(
                        actor=actor,
                        organization=org,
                        code=row.code,
                        name=row.name,
                        site=dept_site,
                        is_active=row.is_active,
                    )
                    site_part = normalize_code(dept_site.code) if dept_site is not None else ""
                    dept_by_key[
                        f"{normalize_code(org.code)}:{site_part}:{normalize_code(dept.code)}"
                    ] = dept
                    created["departments"].append(str(dept.id))
                else:
                    org = org_by_code[normalize_code(row.organization_code)]
                    lookup_site: Site | None = (
                        site_by_key.get(
                            f"{normalize_code(org.code)}:{normalize_code(row.site_code)}"
                        )
                        if row.site_code
                        else None
                    )
                    dept = None
                    if row.department_code and row.site_code:
                        dept = dept_by_key.get(
                            f"{normalize_code(org.code)}:"
                            f"{normalize_code(row.site_code)}:"
                            f"{normalize_code(row.department_code)}"
                        )
                    if row.start_time is None or row.end_time is None:
                        raise ValidationError(
                            {"shift": "Shift start_time and end_time are required."}
                        )
                    if row.effective_from is None:
                        raise ValidationError({"shift": "Shift effective_from is required."})
                    shift = create_shift(
                        actor=actor,
                        organization=org,
                        code=row.code,
                        name=row.name,
                        start_time=row.start_time,
                        end_time=row.end_time,
                        effective_from=row.effective_from,
                        effective_to=row.effective_to,
                        site=lookup_site,
                        department=dept,
                        is_active=row.is_active,
                    )
                    created["shifts"].append(str(shift.id))
    except (ValidationError, PermissionDenied) as exc:
        preview.errors.append(ImportRowError(row_number=0, field="import", message=str(exc)))
        preview.message = "Atomic write aborted."
        record_event(
            event_type="ORGANIZATION_HIERARCHY_IMPORT_FAILED",
            actor=actor,
            metadata={"dry_run": False, "error": str(exc)[:500]},
        )
        return preview

    preview.created_ids = created
    preview.message = (
        f"Import committed: {len(created['organizations'])} org(s), "
        f"{len(created['sites'])} site(s), "
        f"{len(created['departments'])} department(s), "
        f"{len(created['shifts'])} shift(s)."
    )
    record_event(
        event_type="ORGANIZATION_HIERARCHY_IMPORT_COMPLETED",
        actor=actor,
        metadata={
            "dry_run": False,
            "row_count": preview.row_count,
            "created_counts": {k: len(v) for k, v in created.items()},
            "created_ids": created,
        },
    )
    return preview


def format_error_report(preview: HierarchyImportPreview) -> str:
    lines = ["row_number,field,message"]
    for err in preview.errors:
        msg = err.message.replace('"', "'")
        lines.append(f'{err.row_number},{err.field},"{msg}"')
    return "\n".join(lines) + "\n"
