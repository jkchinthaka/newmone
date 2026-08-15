"""Permission-aware checklist definition selectors."""

from __future__ import annotations

import uuid
from typing import Literal

from django.core.exceptions import PermissionDenied
from django.db.models import Count, Max, Q, QuerySet

from apps.access_control.services import (
    organization_ids_with_permission,
    user_has_permission,
)
from apps.accounts.models import User
from apps.checklists.compat_queries import load_sections_with_items_and_options
from apps.checklists.models import (
    ChecklistTemplate,
    ChecklistVersion,
)
from apps.checklists.services import (
    MANAGE_CHECKLIST,
    VIEW_CHECKLIST,
    template_authorization_scope,
    version_authorization_scope,
)
from apps.core.persistence import attach_reverse_relation
from apps.master_data.models import FGProduct
from apps.organizations.models import Organization

StatusFilter = Literal["all", "active", "inactive"]


def actor_can_view_checklists(actor: User | None) -> bool:
    return bool(organization_ids_with_permission(actor, VIEW_CHECKLIST))


def actor_can_manage_checklists(actor: User | None) -> bool:
    return bool(organization_ids_with_permission(actor, MANAGE_CHECKLIST))


def actor_can_manage_template(actor: User | None, template: ChecklistTemplate) -> bool:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        return False
    return user_has_permission(
        actor, MANAGE_CHECKLIST, scope=template_authorization_scope(template)
    )


def actor_can_manage_version(actor: User | None, version: ChecklistVersion) -> bool:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        return False
    return user_has_permission(actor, MANAGE_CHECKLIST, scope=version_authorization_scope(version))


def manageable_organization_ids(actor: User | None) -> frozenset[uuid.UUID]:
    return frozenset(organization_ids_with_permission(actor, MANAGE_CHECKLIST))


def organizations_for_checklist_view(actor: User | None) -> QuerySet[Organization]:
    org_ids = organization_ids_with_permission(actor, VIEW_CHECKLIST)
    if not org_ids:
        return Organization.objects.none()
    return Organization.objects.filter(pk__in=org_ids).order_by("code")


def organizations_for_checklist_manage(actor: User | None) -> QuerySet[Organization]:
    org_ids = organization_ids_with_permission(actor, MANAGE_CHECKLIST)
    if not org_ids:
        return Organization.objects.none()
    return Organization.objects.filter(pk__in=org_ids).order_by("code")


def products_for_checklist_manage(
    actor: User | None,
    *,
    organization: Organization | None = None,
) -> QuerySet[FGProduct]:
    org_ids = organization_ids_with_permission(actor, MANAGE_CHECKLIST)
    if not org_ids:
        return FGProduct.objects.none()
    qs = FGProduct.objects.filter(organization_id__in=org_ids, is_active=True).select_related(
        "organization"
    )
    if organization is not None:
        if organization.id not in org_ids:
            return FGProduct.objects.none()
        qs = qs.filter(organization=organization)
    return qs.order_by("organization__code", "code")


def list_checklist_templates(
    actor: User | None,
    *,
    organization: Organization | None = None,
    product: FGProduct | None = None,
    status: StatusFilter = "all",
    search: str | None = None,
) -> QuerySet[ChecklistTemplate]:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        return ChecklistTemplate.objects.none()
    allowed = organization_ids_with_permission(actor, VIEW_CHECKLIST)
    if not allowed:
        return ChecklistTemplate.objects.none()

    qs = (
        ChecklistTemplate.objects.select_related("organization", "product")
        .filter(organization_id__in=allowed)
        .annotate(
            version_count=Count("versions", distinct=True),
            latest_version_number=Max("versions__version_number"),
        )
    )
    if organization is not None:
        if organization.id not in allowed:
            return ChecklistTemplate.objects.none()
        qs = qs.filter(organization=organization)
    if product is not None:
        if product.organization_id not in allowed:
            return ChecklistTemplate.objects.none()
        qs = qs.filter(product=product)
    if status == "active":
        qs = qs.filter(is_active=True)
    elif status == "inactive":
        qs = qs.filter(is_active=False)
    if search:
        term = search.strip()
        if term:
            qs = qs.filter(Q(code__icontains=term) | Q(name__icontains=term))
    return qs.order_by("organization__code", "code")


def get_checklist_template(actor: User | None, template_id: uuid.UUID) -> ChecklistTemplate | None:
    template = (
        ChecklistTemplate.objects.select_related("organization", "product")
        .filter(pk=template_id)
        .first()
    )
    if template is None:
        return None
    if not user_has_permission(actor, VIEW_CHECKLIST, scope=template_authorization_scope(template)):
        raise PermissionDenied("Permission denied.")
    return template


def list_checklist_versions(
    actor: User | None, template: ChecklistTemplate
) -> QuerySet[ChecklistVersion]:
    if not user_has_permission(actor, VIEW_CHECKLIST, scope=template_authorization_scope(template)):
        raise PermissionDenied("Permission denied.")
    return (
        ChecklistVersion.objects.filter(template=template)
        .annotate(
            section_count=Count("sections", distinct=True),
            item_count=Count("sections__items", distinct=True),
        )
        .order_by("-version_number")
    )


def get_checklist_version(actor: User | None, version_id: uuid.UUID) -> ChecklistVersion | None:
    version = (
        ChecklistVersion.objects.select_related(
            "template", "template__organization", "template__product"
        )
        .filter(pk=version_id)
        .first()
    )
    if version is None:
        return None
    if not user_has_permission(actor, VIEW_CHECKLIST, scope=version_authorization_scope(version)):
        raise PermissionDenied("Permission denied.")
    return version


def get_version_with_structure(
    actor: User | None, version_id: uuid.UUID
) -> ChecklistVersion | None:
    version = get_checklist_version(actor, version_id)
    if version is None:
        return None
    sections = load_sections_with_items_and_options(version.id)
    attach_reverse_relation([version], sections, fk_attr="version_id", related_name="sections")
    return version
