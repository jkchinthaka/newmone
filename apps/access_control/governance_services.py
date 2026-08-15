"""Audited role / role-template governance services (Phase 03C).

Technical only: does not seed Nelna job titles, does not auto-assign users,
and does not invent SoD enforcement. RoleTemplate is not business approval.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterable, Sequence

from django.contrib.auth.models import Permission
from django.core.exceptions import ValidationError

from apps.access_control.models import Role, RoleTemplate, ScopedRoleAssignment
from apps.accounts.models import User
from apps.core.persistence import atomic_fn, lock_queryset, prefetch_related_compat

SOD_PENDING = "PENDING"


def _request_meta(request: object | None) -> tuple[str | None, str | None, str]:
    request_id = getattr(request, "correlation_id", None) if request else None
    ip = None
    ua = ""
    if request is not None and hasattr(request, "META"):
        meta = request.META
        ip = meta.get("REMOTE_ADDR")
        ua = (meta.get("HTTP_USER_AGENT") or "")[:512]
    return request_id, ip, ua


def normalize_template_code(value: str) -> str:
    return value.strip().upper()


def _resolve_permission_codenames(permission_codenames: Iterable[str]) -> list[Permission]:
    """Resolve app_label.codename strings to Permission rows (fail closed on unknown)."""
    resolved: list[Permission] = []
    missing: list[str] = []
    seen: set[str] = set()
    for raw in permission_codenames:
        key = (raw or "").strip()
        if not key:
            continue
        if key in seen:
            continue
        seen.add(key)
        if "." not in key:
            missing.append(key)
            continue
        app_label, codename = key.split(".", 1)
        perm = (
            Permission.objects.filter(content_type__app_label=app_label, codename=codename)
            .select_related("content_type")
            .first()
        )
        if perm is None:
            missing.append(key)
        else:
            resolved.append(perm)
    if missing:
        raise ValidationError(f"Unknown or invalid permission codenames: {sorted(missing)}")
    return resolved


def list_sod_open_questions() -> list[dict[str, str]]:
    """Pure documentation helper â€” all segregation questions remain PENDING."""
    questions = (
        "Can a recorder review their own submission?",
        "Can a Supervisor act as QA for the same submission?",
        "Can QA record production checks?",
        "Can System Admin make QA disposition?",
        "Can a user publish checklist definitions and approve their own content?",
        "Can specification editor approve their own change?",
    )
    return [{"question": q, "status": SOD_PENDING, "response": ""} for q in questions]


@atomic_fn
def set_role_permissions(
    actor: User | None,
    role_id: uuid.UUID,
    permission_codenames: Sequence[str],
    *,
    request: object | None = None,
) -> Role:
    """Replace Role.permissions from codenames; audit ROLE_PERMISSIONS_UPDATED."""
    from apps.security_audit.services import record_event

    role = lock_queryset(Role.objects.filter(pk=role_id)).first()
    if role is None:
        raise ValidationError("Role not found.")

    perms = _resolve_permission_codenames(permission_codenames)
    before = sorted(
        f"{p.content_type.app_label}.{p.codename}"
        for p in role.permissions.select_related("content_type")
    )
    role.permissions.set(perms)
    after = sorted(f"{p.content_type.app_label}.{p.codename}" for p in perms)

    request_id, ip, ua = _request_meta(request)
    record_event(
        event_type="ROLE_PERMISSIONS_UPDATED",
        actor=actor,
        request_id=request_id,
        ip_address=ip,
        user_agent_summary=ua,
        metadata={
            "role_id": str(role.id),
            "role_code": role.code,
            "permissions_before": before,
            "permissions_after": after,
        },
    )
    return role


@atomic_fn
def create_role_template(
    actor: User | None,
    *,
    code: str,
    name: str,
    description: str = "",
    permission_codenames: Sequence[str] | None = None,
    business_category_hint: str = "",
    is_active: bool = True,
    request: object | None = None,
) -> RoleTemplate:
    """Create a technical RoleTemplate. Not business-approved. No user assignment."""
    from apps.security_audit.services import record_event

    template = RoleTemplate(
        code=normalize_template_code(code),
        name=name.strip(),
        description=description,
        is_active=is_active,
        business_category_hint=(business_category_hint or "").strip(),
    )
    template.full_clean()
    template.save()
    codenames = list(permission_codenames or [])
    if codenames:
        template.permissions.set(_resolve_permission_codenames(codenames))

    request_id, ip, ua = _request_meta(request)
    record_event(
        event_type="ROLE_TEMPLATE_CREATED",
        actor=actor,
        request_id=request_id,
        ip_address=ip,
        user_agent_summary=ua,
        metadata={
            "template_id": str(template.id),
            "template_code": template.code,
            "permission_codenames": sorted(codenames),
            "business_category_hint": template.business_category_hint or None,
            "business_approved": False,
        },
    )
    return template


@atomic_fn
def update_role_template_permissions(
    actor: User | None,
    template_id: uuid.UUID,
    permission_codenames: Sequence[str],
    *,
    request: object | None = None,
) -> RoleTemplate:
    """Replace template permissions; audit ROLE_TEMPLATE_UPDATED."""
    from apps.security_audit.services import record_event

    template = lock_queryset(RoleTemplate.objects.filter(pk=template_id)).first()
    if template is None:
        raise ValidationError("Role template not found.")

    perms = _resolve_permission_codenames(permission_codenames)
    before = sorted(
        f"{p.content_type.app_label}.{p.codename}"
        for p in template.permissions.select_related("content_type")
    )
    template.permissions.set(perms)
    after = sorted(f"{p.content_type.app_label}.{p.codename}" for p in perms)
    template.save(update_fields=["updated_at"])

    request_id, ip, ua = _request_meta(request)
    record_event(
        event_type="ROLE_TEMPLATE_UPDATED",
        actor=actor,
        request_id=request_id,
        ip_address=ip,
        user_agent_summary=ua,
        metadata={
            "template_id": str(template.id),
            "template_code": template.code,
            "permissions_before": before,
            "permissions_after": after,
            "business_approved": False,
        },
    )
    return template


@atomic_fn
def apply_role_template_to_role(
    actor: User | None,
    template_id: uuid.UUID,
    role_id: uuid.UUID,
    *,
    request: object | None = None,
) -> Role:
    """
    Explicitly copy template permissions onto an existing Role.

    Does **not** create ScopedRoleAssignment. Does **not** assign users.
    """
    from apps.security_audit.services import record_event

    template = prefetch_related_compat(
        RoleTemplate.objects.filter(pk=template_id),
        "permissions__content_type",
    ).first()
    if template is None:
        raise ValidationError("Role template not found.")
    if not template.is_active:
        raise ValidationError("Cannot apply an inactive role template.")

    role = lock_queryset(Role.objects.filter(pk=role_id)).first()
    if role is None:
        raise ValidationError("Role not found.")

    perms = list(template.permissions.all())
    before = sorted(
        f"{p.content_type.app_label}.{p.codename}"
        for p in role.permissions.select_related("content_type")
    )
    role.permissions.set(perms)
    after = sorted(f"{p.content_type.app_label}.{p.codename}" for p in perms)

    assignment_count_before = ScopedRoleAssignment.objects.filter(role=role).count()

    request_id, ip, ua = _request_meta(request)
    record_event(
        event_type="ROLE_TEMPLATE_APPLIED",
        actor=actor,
        request_id=request_id,
        ip_address=ip,
        user_agent_summary=ua,
        metadata={
            "template_id": str(template.id),
            "template_code": template.code,
            "role_id": str(role.id),
            "role_code": role.code,
            "permissions_before": before,
            "permissions_after": after,
            "scoped_role_assignments_created": 0,
            "role_assignment_count_unchanged": assignment_count_before
            == ScopedRoleAssignment.objects.filter(role=role).count(),
            "business_approved": False,
        },
    )
    return role
