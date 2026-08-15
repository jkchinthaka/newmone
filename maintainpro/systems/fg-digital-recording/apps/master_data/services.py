"""FG Product domain services — writes and authorization; no seed data."""

from __future__ import annotations

import datetime
import uuid
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError, transaction

from apps.access_control.services import Scope, require_permission
from apps.accounts.models import User
from apps.core.persistence import lock_queryset, locked_get
from apps.master_data.historical_safety import refuse_hard_delete_fg_product
from apps.master_data.models import FGProduct
from apps.organizations.models import Organization
from apps.organizations.services import normalize_code, normalize_name
from apps.security_audit.services import record_event

VIEW_FG_PRODUCT = "master_data.view_fgproduct"
MANAGE_FG_PRODUCT = "master_data.manage_fgproduct"

_UNSET: Any = object()


def _require_authenticated_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def product_authorization_scope(product: FGProduct) -> Scope:
    return Scope(organization_id=product.organization_id)


def _product_metadata(
    product: FGProduct,
    *,
    changed_fields: list[str] | None = None,
) -> dict[str, Any]:
    meta: dict[str, Any] = {
        "fg_product_id": str(product.id),
        "fg_product_code": product.code,
        "organization_id": str(product.organization_id),
        "is_active": product.is_active,
    }
    if product.erp_item_code:
        meta["erp_item_code"] = product.erp_item_code
    if changed_fields:
        meta["changed_fields"] = changed_fields
    return meta


def _normalize_optional_text(value: str | None, *, uppercase: bool = False) -> str:
    text = (value or "").strip()
    if uppercase and text:
        return text.upper()
    return text


def _prepare_product_fields(
    *,
    code: str,
    name: str,
    description: str | None = "",
    erp_item_code: str | None = "",
    category: str | None = "",
    brand: str | None = "",
    pack_size: str | None = "",
    uom: str | None = "",
    barcode: str | None = "",
    storage_category: str | None = "",
    shelf_life_reference: str | None = "",
    label_artwork_reference: str | None = "",
    effective_from: datetime.date | None = None,
    effective_to: datetime.date | None = None,
) -> dict[str, Any]:
    normalized_code = normalize_code(code)
    normalized_name = normalize_name(name)
    if not normalized_code:
        raise ValidationError({"code": "Code cannot be blank."})
    if not normalized_name:
        raise ValidationError({"name": "Name cannot be blank."})
    if effective_to is not None and effective_from is not None and effective_to < effective_from:
        raise ValidationError(
            {"effective_to": "effective_to cannot be earlier than effective_from."}
        )
    return {
        "code": normalized_code,
        "name": normalized_name,
        "description": _normalize_optional_text(description),
        "erp_item_code": _normalize_optional_text(erp_item_code, uppercase=True),
        "category": _normalize_optional_text(category),
        "brand": _normalize_optional_text(brand),
        "pack_size": _normalize_optional_text(pack_size),
        "uom": _normalize_optional_text(uom, uppercase=True),
        "barcode": _normalize_optional_text(barcode),
        "storage_category": _normalize_optional_text(storage_category),
        "shelf_life_reference": _normalize_optional_text(shelf_life_reference),
        "label_artwork_reference": _normalize_optional_text(label_artwork_reference),
        "effective_from": effective_from,
        "effective_to": effective_to,
    }


def _reraise_product_persistence_error(exc: Exception) -> None:
    if isinstance(exc, ValidationError):
        messages = " ".join(str(m) for m in exc.messages)
        if "md_fgproduct_org_erp_ci_uniq" in messages:
            raise ValidationError(
                {
                    "erp_item_code": (
                        "An FG Product with this ERP item code already exists "
                        "in the selected organization."
                    )
                }
            ) from exc
        if "md_fgproduct_org_code_ci_uniq" in messages or "unique" in messages.lower():
            raise ValidationError(
                {
                    "code": (
                        "An FG Product with this code already exists in the selected organization."
                    )
                }
            ) from exc
        raise
    if isinstance(exc, IntegrityError):
        text = str(exc).lower()
        if "md_fgproduct_org_erp_ci_uniq" in text or "erp" in text:
            raise ValidationError(
                {
                    "erp_item_code": (
                        "An FG Product with this ERP item code already exists "
                        "in the selected organization."
                    )
                }
            ) from exc
        raise ValidationError(
            {"code": "An FG Product with this code already exists in the selected organization."}
        ) from exc
    raise


@transaction.atomic
def create_fg_product(
    *,
    actor: User | None,
    organization: Organization,
    code: str,
    name: str,
    description: str = "",
    erp_item_code: str = "",
    category: str = "",
    brand: str = "",
    pack_size: str = "",
    uom: str = "",
    barcode: str = "",
    storage_category: str = "",
    shelf_life_reference: str = "",
    label_artwork_reference: str = "",
    effective_from: datetime.date | None = None,
    effective_to: datetime.date | None = None,
    is_active: bool = True,
) -> FGProduct:
    user = _require_authenticated_actor(actor)
    require_permission(
        user,
        MANAGE_FG_PRODUCT,
        scope=Scope(organization_id=organization.id),
    )
    prepared = _prepare_product_fields(
        code=code,
        name=name,
        description=description,
        erp_item_code=erp_item_code,
        category=category,
        brand=brand,
        pack_size=pack_size,
        uom=uom,
        barcode=barcode,
        storage_category=storage_category,
        shelf_life_reference=shelf_life_reference,
        label_artwork_reference=label_artwork_reference,
        effective_from=effective_from,
        effective_to=effective_to,
    )
    product = FGProduct(organization=organization, is_active=is_active, **prepared)
    try:
        product.full_clean()
        product.save()
    except (ValidationError, IntegrityError) as exc:
        _reraise_product_persistence_error(exc)

    record_event(
        event_type="FG_PRODUCT_CREATED",
        actor=user,
        metadata=_product_metadata(product),
    )
    return product


@transaction.atomic
def update_fg_product(
    *,
    actor: User | None,
    product_id: uuid.UUID,
    code: str | None = None,
    name: str | None = None,
    description: Any = _UNSET,
    erp_item_code: Any = _UNSET,
    category: Any = _UNSET,
    brand: Any = _UNSET,
    pack_size: Any = _UNSET,
    uom: Any = _UNSET,
    barcode: Any = _UNSET,
    storage_category: Any = _UNSET,
    shelf_life_reference: Any = _UNSET,
    label_artwork_reference: Any = _UNSET,
    effective_from: Any = _UNSET,
    effective_to: Any = _UNSET,
) -> FGProduct:
    user = _require_authenticated_actor(actor)
    product = lock_queryset(
        FGProduct.objects.select_related("organization").filter(pk=product_id)
    ).first()
    if product is None:
        raise ValidationError({"product": "FG Product not found."})

    require_permission(user, MANAGE_FG_PRODUCT, scope=product_authorization_scope(product))

    prepared = _prepare_product_fields(
        code=product.code if code is None else code,
        name=product.name if name is None else name,
        description=product.description if description is _UNSET else description,
        erp_item_code=product.erp_item_code if erp_item_code is _UNSET else erp_item_code,
        category=product.category if category is _UNSET else category,
        brand=product.brand if brand is _UNSET else brand,
        pack_size=product.pack_size if pack_size is _UNSET else pack_size,
        uom=product.uom if uom is _UNSET else uom,
        barcode=product.barcode if barcode is _UNSET else barcode,
        storage_category=(
            product.storage_category if storage_category is _UNSET else storage_category
        ),
        shelf_life_reference=(
            product.shelf_life_reference if shelf_life_reference is _UNSET else shelf_life_reference
        ),
        label_artwork_reference=(
            product.label_artwork_reference
            if label_artwork_reference is _UNSET
            else label_artwork_reference
        ),
        effective_from=(product.effective_from if effective_from is _UNSET else effective_from),
        effective_to=product.effective_to if effective_to is _UNSET else effective_to,
    )

    changed: list[str] = []
    for field, value in prepared.items():
        if getattr(product, field) != value:
            setattr(product, field, value)
            changed.append(field)

    if not changed:
        return product

    try:
        product.full_clean()
        product.save()
    except (ValidationError, IntegrityError) as exc:
        _reraise_product_persistence_error(exc)

    record_event(
        event_type="FG_PRODUCT_UPDATED",
        actor=user,
        metadata=_product_metadata(product, changed_fields=changed),
    )
    return product


@transaction.atomic
def activate_fg_product(*, actor: User | None, product_id: uuid.UUID) -> FGProduct:
    user = _require_authenticated_actor(actor)
    product = locked_get(FGProduct, pk=product_id)
    if product is None:
        raise ValidationError({"product": "FG Product not found."})
    require_permission(user, MANAGE_FG_PRODUCT, scope=product_authorization_scope(product))
    if product.is_active:
        return product
    product.is_active = True
    product.save(update_fields=["is_active", "updated_at"])
    record_event(
        event_type="FG_PRODUCT_ACTIVATED",
        actor=user,
        metadata=_product_metadata(product),
    )
    return product


@transaction.atomic
def deactivate_fg_product(*, actor: User | None, product_id: uuid.UUID) -> FGProduct:
    user = _require_authenticated_actor(actor)
    product = locked_get(FGProduct, pk=product_id)
    if product is None:
        raise ValidationError({"product": "FG Product not found."})
    require_permission(user, MANAGE_FG_PRODUCT, scope=product_authorization_scope(product))
    if not product.is_active:
        return product
    product.is_active = False
    product.save(update_fields=["is_active", "updated_at"])
    record_event(
        event_type="FG_PRODUCT_DEACTIVATED",
        actor=user,
        metadata=_product_metadata(product),
    )
    return product


def delete_fg_product(product: FGProduct) -> None:
    refuse_hard_delete_fg_product(product)
