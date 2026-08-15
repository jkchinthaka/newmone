"""Permission-aware FG Product selectors — query-level organization scoping."""

from __future__ import annotations

import uuid
from typing import Literal

from django.core.exceptions import PermissionDenied
from django.db.models import Q, QuerySet

from apps.access_control.services import (
    organization_ids_with_permission,
    user_has_permission,
)
from apps.accounts.models import User
from apps.master_data.models import (
    FGProduct,
    ProductSpecification,
    SpecificationParameter,
    SpecificationVersion,
)
from apps.master_data.services import (
    MANAGE_FG_PRODUCT,
    VIEW_FG_PRODUCT,
    product_authorization_scope,
)
from apps.master_data.specification_services import (
    MANAGE_PRODUCT_SPECIFICATION,
    VIEW_PRODUCT_SPECIFICATION,
    specification_authorization_scope,
    version_authorization_scope,
)
from apps.organizations.models import Organization

StatusFilter = Literal["all", "active", "inactive"]


def actor_can_view_fg_products(actor: User | None) -> bool:
    """True when actor has org-level view scope for at least one Organization."""
    return bool(organization_ids_with_permission(actor, VIEW_FG_PRODUCT))


def actor_can_manage_fg_products(actor: User | None) -> bool:
    """True when actor has org-level manage scope for at least one Organization."""
    return bool(organization_ids_with_permission(actor, MANAGE_FG_PRODUCT))


def actor_can_manage_fg_product(actor: User | None, product: FGProduct) -> bool:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        return False
    return user_has_permission(actor, MANAGE_FG_PRODUCT, scope=product_authorization_scope(product))


def _actor_may_view_product(actor: User | None, product: FGProduct) -> bool:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        return False
    return user_has_permission(actor, VIEW_FG_PRODUCT, scope=product_authorization_scope(product))


def get_fg_product(actor: User | None, product_id: uuid.UUID) -> FGProduct | None:
    product = FGProduct.objects.select_related("organization").filter(pk=product_id).first()
    if product is None:
        return None
    if not _actor_may_view_product(actor, product):
        raise PermissionDenied("Permission denied.")
    return product


def list_fg_products(
    actor: User | None,
    *,
    organization: Organization | None = None,
    status: StatusFilter = "all",
    search: str | None = None,
    category: str | None = None,
) -> QuerySet[FGProduct]:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        return FGProduct.objects.none()

    allowed_org_ids = organization_ids_with_permission(actor, VIEW_FG_PRODUCT)
    if not allowed_org_ids:
        return FGProduct.objects.none()

    qs = FGProduct.objects.select_related("organization").filter(
        organization_id__in=allowed_org_ids
    )
    if organization is not None:
        if organization.id not in allowed_org_ids:
            return FGProduct.objects.none()
        qs = qs.filter(organization=organization)

    if status == "active":
        qs = qs.filter(is_active=True)
    elif status == "inactive":
        qs = qs.filter(is_active=False)

    if category:
        cat = category.strip()
        if cat:
            qs = qs.filter(category__iexact=cat)

    if search:
        term = search.strip()
        if term:
            qs = qs.filter(
                Q(code__icontains=term)
                | Q(name__icontains=term)
                | Q(erp_item_code__icontains=term)
                | Q(barcode__icontains=term)
                | Q(category__icontains=term)
                | Q(brand__icontains=term)
            )

    return qs.order_by("organization__code", "code")


def list_active_fg_products(
    actor: User | None,
    *,
    organization: Organization | None = None,
) -> QuerySet[FGProduct]:
    return list_fg_products(actor, organization=organization, status="active")


def organizations_for_fg_product_actor(actor: User | None) -> QuerySet[Organization]:
    """Organizations the actor may use for Product list/filter (view scope only)."""
    org_ids = organization_ids_with_permission(actor, VIEW_FG_PRODUCT)
    if not org_ids:
        return Organization.objects.none()
    return Organization.objects.filter(pk__in=org_ids).order_by("code")


def organizations_for_fg_product_manage(actor: User | None) -> QuerySet[Organization]:
    """Organizations where the actor may create/manage FG Products."""
    org_ids = organization_ids_with_permission(actor, MANAGE_FG_PRODUCT)
    if not org_ids:
        return Organization.objects.none()
    return Organization.objects.filter(pk__in=org_ids).order_by("code")


def manageable_organization_ids(actor: User | None) -> frozenset[uuid.UUID]:
    """
    Precomputed Organization IDs where actor has manage_fgproduct at org Scope.

    Intended for list/detail UI affordances without per-row permission queries.
    Server-side services remain authoritative for mutations.
    """
    return frozenset(organization_ids_with_permission(actor, MANAGE_FG_PRODUCT))


def get_product_specification(
    actor: User | None, specification_id: uuid.UUID
) -> ProductSpecification | None:
    spec = (
        ProductSpecification.objects.select_related("organization", "product")
        .filter(pk=specification_id)
        .first()
    )
    if spec is None:
        return None
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Permission denied.")
    if not user_has_permission(
        actor, VIEW_PRODUCT_SPECIFICATION, scope=specification_authorization_scope(spec)
    ):
        raise PermissionDenied("Permission denied.")
    return spec


def list_product_specifications(
    actor: User | None,
    *,
    organization: Organization | None = None,
    product: FGProduct | None = None,
) -> QuerySet[ProductSpecification]:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        return ProductSpecification.objects.none()
    allowed = organization_ids_with_permission(actor, VIEW_PRODUCT_SPECIFICATION)
    if not allowed:
        return ProductSpecification.objects.none()
    qs = ProductSpecification.objects.select_related("organization", "product").filter(
        organization_id__in=allowed
    )
    if organization is not None:
        if organization.id not in allowed:
            return ProductSpecification.objects.none()
        qs = qs.filter(organization=organization)
    if product is not None:
        qs = qs.filter(product=product)
    return qs.order_by("organization__code", "product__code", "code")


def get_specification_version(
    actor: User | None, version_id: uuid.UUID
) -> SpecificationVersion | None:
    version = (
        SpecificationVersion.objects.select_related(
            "specification",
            "specification__organization",
            "specification__product",
        )
        .filter(pk=version_id)
        .first()
    )
    if version is None:
        return None
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Permission denied.")
    if not user_has_permission(
        actor, VIEW_PRODUCT_SPECIFICATION, scope=version_authorization_scope(version)
    ):
        raise PermissionDenied("Permission denied.")
    return version


def list_specification_parameters(
    actor: User | None, version_id: uuid.UUID
) -> QuerySet[SpecificationParameter]:
    version = get_specification_version(actor, version_id)
    if version is None:
        return SpecificationParameter.objects.none()
    return version.parameters.all().order_by("code")


def actor_can_manage_product_specifications(actor: User | None) -> bool:
    return bool(organization_ids_with_permission(actor, MANAGE_PRODUCT_SPECIFICATION))
