"""Organization domain services — soft deactivate/reactivate only; no hard delete."""

from __future__ import annotations

import datetime
import uuid
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError
from apps.core.persistence import atomic_fn, lock_queryset, locked_get

from apps.access_control.services import Scope, require_permission
from apps.accounts.models import User
from apps.organizations.models import Department, Organization, Shift, Site
from apps.security_audit.services import record_event

VIEW_SHIFT = "organizations.view_shift"
MANAGE_SHIFT = "organizations.manage_shift"
MANAGE_ORGANIZATION = "organizations.manage_organization"
MANAGE_SITE = "organizations.manage_site"
MANAGE_DEPARTMENT = "organizations.manage_department"

_UNSET: Any = object()


def normalize_code(value: str) -> str:
    """Strip surrounding whitespace and uppercase for consistent code storage."""
    return value.strip().upper()


def normalize_name(value: str) -> str:
    """Strip surrounding whitespace only; do not alter display-name casing."""
    return value.strip()


def _require_authenticated_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def shift_authorization_scope(shift: Shift) -> Scope:
    return Scope(
        organization_id=shift.organization_id,
        site_id=shift.site_id,
        department_id=shift.department_id,
    )


def _org_metadata(
    organization: Organization,
    *,
    changed_fields: list[str] | None = None,
) -> dict[str, Any]:
    meta: dict[str, Any] = {
        "organization_id": str(organization.id),
        "organization_code": organization.code,
        "is_active": organization.is_active,
    }
    if changed_fields:
        meta["changed_fields"] = changed_fields
    return meta


def _site_metadata(site: Site, *, changed_fields: list[str] | None = None) -> dict[str, Any]:
    meta: dict[str, Any] = {
        "site_id": str(site.id),
        "site_code": site.code,
        "organization_id": str(site.organization_id),
        "is_active": site.is_active,
    }
    if changed_fields:
        meta["changed_fields"] = changed_fields
    return meta


def _department_metadata(
    department: Department,
    *,
    changed_fields: list[str] | None = None,
) -> dict[str, Any]:
    meta: dict[str, Any] = {
        "department_id": str(department.id),
        "department_code": department.code,
        "organization_id": str(department.organization_id),
        "is_active": department.is_active,
    }
    if department.site_id:
        meta["site_id"] = str(department.site_id)
    if changed_fields:
        meta["changed_fields"] = changed_fields
    return meta


def _shift_metadata(shift: Shift, *, changed_fields: list[str] | None = None) -> dict[str, Any]:
    meta: dict[str, Any] = {
        "shift_id": str(shift.id),
        "shift_code": shift.code,
        "organization_id": str(shift.organization_id),
        "is_active": shift.is_active,
        "is_overnight": shift.is_overnight,
    }
    if shift.site_id:
        meta["site_id"] = str(shift.site_id)
    if shift.department_id:
        meta["department_id"] = str(shift.department_id)
    if changed_fields:
        meta["changed_fields"] = changed_fields
    return meta


def _validate_shift_scope(
    *,
    organization: Organization,
    site: Site | None,
    department: Department | None,
) -> None:
    if department is not None and site is None:
        raise ValidationError({"department": "Department requires a site."})
    if site is not None and site.organization_id != organization.id:
        raise ValidationError({"site": "Site must belong to the selected organization."})
    if department is not None and department.organization_id != organization.id:
        raise ValidationError(
            {"department": "Department must belong to the selected organization."}
        )
    if department is not None and site is not None and department.site_id != site.id:
        raise ValidationError({"department": "Department must belong to the selected site."})


def _prepare_named_code(*, code: str, name: str) -> tuple[str, str]:
    normalized_code = normalize_code(code)
    normalized_name = normalize_name(name)
    if not normalized_code:
        raise ValidationError({"code": "Code is required."})
    if not normalized_name:
        raise ValidationError({"name": "Name is required."})
    return normalized_code, normalized_name


def _prepare_shift_fields(
    *,
    code: str,
    name: str,
    effective_from: datetime.date,
    effective_to: datetime.date | None,
) -> tuple[str, str]:
    normalized_code, normalized_name = _prepare_named_code(code=code, name=name)
    if effective_to is not None and effective_to < effective_from:
        raise ValidationError(
            {"effective_to": "effective_to cannot be earlier than effective_from."}
        )
    return normalized_code, normalized_name


def _reraise_unique(exc: Exception, *, field_message: str) -> None:
    if isinstance(exc, ValidationError):
        messages = " ".join(str(m) for m in exc.messages)
        if "unique" in messages.lower() or "_ci_uniq" in messages:
            raise ValidationError({"code": field_message}) from exc
        raise
    if isinstance(exc, IntegrityError):
        raise ValidationError({"code": field_message}) from exc
    raise


# --- Organization lifecycle -------------------------------------------------


@atomic_fn
def create_organization(
    *,
    code: str,
    name: str,
    is_active: bool = True,
    actor: User | None = None,
) -> Organization:
    """
    Create an Organization.

    When ``actor`` is provided, require ``manage_organization`` (system-wide Scope)
    and emit ORGANIZATION_CREATED. Factories may omit ``actor`` for synthetic rows.
    """
    normalized_code, normalized_name = _prepare_named_code(code=code, name=name)
    user: User | None = None
    if actor is not None:
        user = _require_authenticated_actor(actor)
        require_permission(user, MANAGE_ORGANIZATION, scope=Scope())

    organization = Organization(
        code=normalized_code,
        name=normalized_name,
        is_active=is_active,
    )
    try:
        organization.full_clean()
        organization.save()
    except (ValidationError, IntegrityError) as exc:
        _reraise_unique(
            exc,
            field_message="An Organization with this code already exists.",
        )

    if user is not None:
        record_event(
            event_type="ORGANIZATION_CREATED",
            actor=user,
            metadata=_org_metadata(organization),
        )
    return organization


@atomic_fn
def update_organization(
    *,
    actor: User | None,
    organization_id: uuid.UUID,
    code: str | None = None,
    name: str | None = None,
) -> Organization:
    user = _require_authenticated_actor(actor)
    organization = locked_get(Organization, pk=organization_id)
    if organization is None:
        raise ValidationError({"organization": "Organization not found."})
    require_permission(user, MANAGE_ORGANIZATION, scope=Scope())

    next_code = organization.code if code is None else code
    next_name = organization.name if name is None else name
    normalized_code, normalized_name = _prepare_named_code(code=next_code, name=next_name)
    changed: list[str] = []
    if organization.code != normalized_code:
        organization.code = normalized_code
        changed.append("code")
    if organization.name != normalized_name:
        organization.name = normalized_name
        changed.append("name")
    if not changed:
        return organization
    try:
        organization.full_clean()
        organization.save()
    except (ValidationError, IntegrityError) as exc:
        _reraise_unique(
            exc,
            field_message="An Organization with this code already exists.",
        )
    record_event(
        event_type="ORGANIZATION_UPDATED",
        actor=user,
        metadata=_org_metadata(organization, changed_fields=changed),
    )
    return organization


@atomic_fn
def deactivate_organization(
    organization: Organization,
    *,
    actor: User | None = None,
) -> Organization:
    user: User | None = None
    if actor is not None:
        user = _require_authenticated_actor(actor)
        require_permission(user, MANAGE_ORGANIZATION, scope=Scope())
    if not organization.is_active:
        return organization
    organization.is_active = False
    organization.save(update_fields=["is_active", "updated_at"])
    if user is not None:
        record_event(
            event_type="ORGANIZATION_DEACTIVATED",
            actor=user,
            metadata=_org_metadata(organization),
        )
    return organization


@atomic_fn
def reactivate_organization(
    organization: Organization,
    *,
    actor: User | None = None,
) -> Organization:
    user: User | None = None
    if actor is not None:
        user = _require_authenticated_actor(actor)
        require_permission(user, MANAGE_ORGANIZATION, scope=Scope())
    if organization.is_active:
        return organization
    organization.is_active = True
    organization.save(update_fields=["is_active", "updated_at"])
    if user is not None:
        record_event(
            event_type="ORGANIZATION_ACTIVATED",
            actor=user,
            metadata=_org_metadata(organization),
        )
    return organization


# --- Site lifecycle ---------------------------------------------------------


@atomic_fn
def create_site(
    *,
    organization: Organization,
    code: str,
    name: str,
    is_active: bool = True,
    actor: User | None = None,
) -> Site:
    normalized_code, normalized_name = _prepare_named_code(code=code, name=name)
    user: User | None = None
    if actor is not None:
        user = _require_authenticated_actor(actor)
        require_permission(user, MANAGE_SITE, scope=Scope(organization_id=organization.id))

    site = Site(
        organization=organization,
        code=normalized_code,
        name=normalized_name,
        is_active=is_active,
    )
    try:
        site.full_clean()
        site.save()
    except (ValidationError, IntegrityError) as exc:
        _reraise_unique(
            exc,
            field_message="A Site with this code already exists in the selected organization.",
        )
    if user is not None:
        record_event(event_type="SITE_CREATED", actor=user, metadata=_site_metadata(site))
    return site


@atomic_fn
def update_site(
    *,
    actor: User | None,
    site_id: uuid.UUID,
    code: str | None = None,
    name: str | None = None,
) -> Site:
    user = _require_authenticated_actor(actor)
    site = (
        lock_queryset(
        Site.objects.select_related("organization").filter(pk=site_id)
        ).first()
    )
    if site is None:
        raise ValidationError({"site": "Site not found."})
    require_permission(user, MANAGE_SITE, scope=Scope(organization_id=site.organization_id))

    next_code = site.code if code is None else code
    next_name = site.name if name is None else name
    normalized_code, normalized_name = _prepare_named_code(code=next_code, name=next_name)
    changed: list[str] = []
    if site.code != normalized_code:
        site.code = normalized_code
        changed.append("code")
    if site.name != normalized_name:
        site.name = normalized_name
        changed.append("name")
    if not changed:
        return site
    try:
        site.full_clean()
        site.save()
    except (ValidationError, IntegrityError) as exc:
        _reraise_unique(
            exc,
            field_message="A Site with this code already exists in the selected organization.",
        )
    record_event(
        event_type="SITE_UPDATED",
        actor=user,
        metadata=_site_metadata(site, changed_fields=changed),
    )
    return site


@atomic_fn
def deactivate_site(site: Site, *, actor: User | None = None) -> Site:
    user: User | None = None
    if actor is not None:
        user = _require_authenticated_actor(actor)
        require_permission(user, MANAGE_SITE, scope=Scope(organization_id=site.organization_id))
    if not site.is_active:
        return site
    site.is_active = False
    site.save(update_fields=["is_active", "updated_at"])
    if user is not None:
        record_event(event_type="SITE_DEACTIVATED", actor=user, metadata=_site_metadata(site))
    return site


@atomic_fn
def reactivate_site(site: Site, *, actor: User | None = None) -> Site:
    user: User | None = None
    if actor is not None:
        user = _require_authenticated_actor(actor)
        require_permission(user, MANAGE_SITE, scope=Scope(organization_id=site.organization_id))
    if not site.organization.is_active:
        raise ValidationError("Cannot reactivate a site whose organization is inactive.")
    if site.is_active:
        return site
    site.is_active = True
    site.save(update_fields=["is_active", "updated_at"])
    if user is not None:
        record_event(event_type="SITE_ACTIVATED", actor=user, metadata=_site_metadata(site))
    return site


# --- Department lifecycle ---------------------------------------------------


@atomic_fn
def create_department(
    *,
    organization: Organization,
    code: str,
    name: str,
    site: Site | None = None,
    is_active: bool = True,
    actor: User | None = None,
) -> Department:
    normalized_code, normalized_name = _prepare_named_code(code=code, name=name)
    user: User | None = None
    if actor is not None:
        user = _require_authenticated_actor(actor)
        require_permission(
            user,
            MANAGE_DEPARTMENT,
            scope=Scope(
                organization_id=organization.id,
                site_id=site.id if site is not None else None,
            ),
        )

    department = Department(
        organization=organization,
        site=site,
        code=normalized_code,
        name=normalized_name,
        is_active=is_active,
    )
    try:
        department.full_clean()
        department.save()
    except (ValidationError, IntegrityError) as exc:
        _reraise_unique(
            exc,
            field_message="A Department with this code already exists in the selected scope.",
        )
    if user is not None:
        record_event(
            event_type="DEPARTMENT_CREATED",
            actor=user,
            metadata=_department_metadata(department),
        )
    return department


@atomic_fn
def update_department(
    *,
    actor: User | None,
    department_id: uuid.UUID,
    code: str | None = None,
    name: str | None = None,
    site: Any = _UNSET,
) -> Department:
    user = _require_authenticated_actor(actor)
    department = (
        lock_queryset(
        Department.objects.select_related("organization", "site").filter(pk=department_id)
        ).first()
    )
    if department is None:
        raise ValidationError({"department": "Department not found."})
    next_site: Site | None = department.site if site is _UNSET else site
    require_permission(
        user,
        MANAGE_DEPARTMENT,
        scope=Scope(
            organization_id=department.organization_id,
            site_id=next_site.id if next_site is not None else None,
        ),
    )
    if next_site is not None and next_site.organization_id != department.organization_id:
        raise ValidationError(
            {"site": "Site must belong to the same organization as the department."}
        )

    next_code = department.code if code is None else code
    next_name = department.name if name is None else name
    normalized_code, normalized_name = _prepare_named_code(code=next_code, name=next_name)
    changed: list[str] = []
    if department.code != normalized_code:
        department.code = normalized_code
        changed.append("code")
    if department.name != normalized_name:
        department.name = normalized_name
        changed.append("name")
    if department.site_id != (next_site.id if next_site is not None else None):
        department.site = next_site
        changed.append("site")
    if not changed:
        return department
    try:
        department.full_clean()
        department.save()
    except (ValidationError, IntegrityError) as exc:
        _reraise_unique(
            exc,
            field_message="A Department with this code already exists in the selected scope.",
        )
    record_event(
        event_type="DEPARTMENT_UPDATED",
        actor=user,
        metadata=_department_metadata(department, changed_fields=changed),
    )
    return department


@atomic_fn
def deactivate_department(
    department: Department,
    *,
    actor: User | None = None,
) -> Department:
    user: User | None = None
    if actor is not None:
        user = _require_authenticated_actor(actor)
        require_permission(
            user,
            MANAGE_DEPARTMENT,
            scope=Scope(
                organization_id=department.organization_id,
                site_id=department.site_id,
            ),
        )
    if not department.is_active:
        return department
    department.is_active = False
    department.save(update_fields=["is_active", "updated_at"])
    if user is not None:
        record_event(
            event_type="DEPARTMENT_DEACTIVATED",
            actor=user,
            metadata=_department_metadata(department),
        )
    return department


@atomic_fn
def reactivate_department(
    department: Department,
    *,
    actor: User | None = None,
) -> Department:
    user: User | None = None
    if actor is not None:
        user = _require_authenticated_actor(actor)
        require_permission(
            user,
            MANAGE_DEPARTMENT,
            scope=Scope(
                organization_id=department.organization_id,
                site_id=department.site_id,
            ),
        )
    if not department.organization.is_active:
        raise ValidationError("Cannot reactivate a department whose organization is inactive.")
    site = department.site
    if site is not None and not site.is_active:
        raise ValidationError("Cannot reactivate a department whose site is inactive.")
    if department.is_active:
        return department
    department.is_active = True
    department.save(update_fields=["is_active", "updated_at"])
    if user is not None:
        record_event(
            event_type="DEPARTMENT_ACTIVATED",
            actor=user,
            metadata=_department_metadata(department),
        )
    return department


# --- Shift lifecycle (Phase 04A) --------------------------------------------


def _reraise_shift_persistence_error(exc: Exception) -> None:
    """Map DB/unique failures to a stable field error for forms and APIs."""
    if isinstance(exc, ValidationError):
        messages = " ".join(str(m) for m in exc.messages)
        if "org_shift_scope_code_ci_uniq" in messages or "unique" in messages.lower():
            raise ValidationError(
                {"code": "A Shift with this code already exists in the selected scope."}
            ) from exc
        raise
    if isinstance(exc, IntegrityError):
        raise ValidationError(
            {"code": "A Shift with this code already exists in the selected scope."}
        ) from exc
    raise


@atomic_fn
def create_shift(
    *,
    actor: User | None,
    organization: Organization,
    code: str,
    name: str,
    start_time: datetime.time,
    end_time: datetime.time,
    effective_from: datetime.date,
    site: Site | None = None,
    department: Department | None = None,
    effective_to: datetime.date | None = None,
    is_active: bool = True,
) -> Shift:
    user = _require_authenticated_actor(actor)
    scope = Scope(
        organization_id=organization.id,
        site_id=site.id if site is not None else None,
        department_id=department.id if department is not None else None,
    )
    require_permission(user, MANAGE_SHIFT, scope=scope)
    _validate_shift_scope(organization=organization, site=site, department=department)
    normalized_code, normalized_name = _prepare_shift_fields(
        code=code,
        name=name,
        effective_from=effective_from,
        effective_to=effective_to,
    )

    shift = Shift(
        organization=organization,
        site=site,
        department=department,
        code=normalized_code,
        name=normalized_name,
        start_time=start_time,
        end_time=end_time,
        effective_from=effective_from,
        effective_to=effective_to,
        is_active=is_active,
    )
    try:
        shift.full_clean()
        shift.save()
    except (ValidationError, IntegrityError) as exc:
        _reraise_shift_persistence_error(exc)

    record_event(
        event_type="SHIFT_CREATED",
        actor=user,
        metadata=_shift_metadata(shift),
    )
    return shift


@atomic_fn
def update_shift(
    *,
    actor: User | None,
    shift_id: uuid.UUID,
    code: str | None = None,
    name: str | None = None,
    start_time: datetime.time | None = None,
    end_time: datetime.time | None = None,
    effective_from: datetime.date | None = None,
    effective_to: Any = _UNSET,
    site: Any = _UNSET,
    department: Any = _UNSET,
) -> Shift:
    user = _require_authenticated_actor(actor)
    shift = (
        lock_queryset(
        Shift.objects.select_related("organization", "site", "department").filter(pk=shift_id)
        ).first()
    )
    if shift is None:
        raise ValidationError({"shift": "Shift not found."})

    require_permission(user, MANAGE_SHIFT, scope=shift_authorization_scope(shift))

    next_site: Site | None = shift.site if site is _UNSET else site
    next_department: Department | None = shift.department if department is _UNSET else department
    next_code = shift.code if code is None else code
    next_name = shift.name if name is None else name
    next_start = shift.start_time if start_time is None else start_time
    next_end = shift.end_time if end_time is None else end_time
    next_from = shift.effective_from if effective_from is None else effective_from
    next_to: datetime.date | None = shift.effective_to if effective_to is _UNSET else effective_to

    _validate_shift_scope(
        organization=shift.organization,
        site=next_site,
        department=next_department,
    )
    normalized_code, normalized_name = _prepare_shift_fields(
        code=next_code,
        name=next_name,
        effective_from=next_from,
        effective_to=next_to,
    )

    field_map: dict[str, Any] = {
        "code": normalized_code,
        "name": normalized_name,
        "start_time": next_start,
        "end_time": next_end,
        "effective_from": next_from,
        "effective_to": next_to,
        "site": next_site,
        "department": next_department,
    }
    changed: list[str] = []
    for field, value in field_map.items():
        if getattr(shift, field) != value:
            setattr(shift, field, value)
            changed.append(field)

    if not changed:
        return shift

    try:
        shift.full_clean()
        shift.save()
    except (ValidationError, IntegrityError) as exc:
        _reraise_shift_persistence_error(exc)

    record_event(
        event_type="SHIFT_UPDATED",
        actor=user,
        metadata=_shift_metadata(shift, changed_fields=changed),
    )
    return shift


@atomic_fn
def activate_shift(*, actor: User | None, shift_id: uuid.UUID) -> Shift:
    user = _require_authenticated_actor(actor)
    shift = locked_get(Shift, pk=shift_id)
    if shift is None:
        raise ValidationError({"shift": "Shift not found."})
    require_permission(user, MANAGE_SHIFT, scope=shift_authorization_scope(shift))
    if shift.is_active:
        return shift
    shift.is_active = True
    shift.save(update_fields=["is_active", "updated_at"])
    record_event(
        event_type="SHIFT_ACTIVATED",
        actor=user,
        metadata=_shift_metadata(shift),
    )
    return shift


@atomic_fn
def deactivate_shift(*, actor: User | None, shift_id: uuid.UUID) -> Shift:
    user = _require_authenticated_actor(actor)
    shift = locked_get(Shift, pk=shift_id)
    if shift is None:
        raise ValidationError({"shift": "Shift not found."})
    require_permission(user, MANAGE_SHIFT, scope=shift_authorization_scope(shift))
    if not shift.is_active:
        return shift
    shift.is_active = False
    shift.save(update_fields=["is_active", "updated_at"])
    record_event(
        event_type="SHIFT_DEACTIVATED",
        actor=user,
        metadata=_shift_metadata(shift),
    )
    return shift
