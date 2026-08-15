"""Product specification domain services — versioned, audited; no seeded limits."""

from __future__ import annotations

import datetime
import uuid
from decimal import Decimal
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError
from django.utils import timezone

from apps.access_control.services import Scope, require_permission
from apps.accounts.models import User
from apps.core.persistence import atomic_fn, lock_queryset
from apps.master_data.historical_safety import (
    refuse_hard_delete_product_specification,
    refuse_hard_delete_specification_version,
)
from apps.master_data.models import (
    FGProduct,
    ProductSpecification,
    SpecificationParameter,
    SpecificationVersion,
    SpecificationVersionStatus,
)
from apps.organizations.models import Organization
from apps.organizations.services import normalize_code, normalize_name
from apps.security_audit.services import record_event

VIEW_PRODUCT_SPECIFICATION = "master_data.view_productspecification"
MANAGE_PRODUCT_SPECIFICATION = "master_data.manage_productspecification"

_UNSET: Any = object()


def _require_authenticated_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def specification_authorization_scope(spec: ProductSpecification) -> Scope:
    return Scope(organization_id=spec.organization_id)


def version_authorization_scope(version: SpecificationVersion) -> Scope:
    return Scope(organization_id=version.specification.organization_id)


def _normalize_optional_text(value: str | None, *, uppercase: bool = False) -> str:
    text = (value or "").strip()
    if uppercase and text:
        return text.upper()
    return text


def _spec_metadata(
    spec: ProductSpecification,
    *,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    meta: dict[str, Any] = {
        "product_specification_id": str(spec.id),
        "product_specification_code": spec.code,
        "organization_id": str(spec.organization_id),
        "fg_product_id": str(spec.product_id),
        "is_active": spec.is_active,
    }
    if extra:
        meta.update(extra)
    return meta


def _version_metadata(
    version: SpecificationVersion,
    *,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    meta = _spec_metadata(
        version.specification,
        extra={
            "specification_version_id": str(version.id),
            "version_number": version.version_number,
            "status": version.status,
            "effective_from": (
                version.effective_from.isoformat() if version.effective_from else None
            ),
            "effective_to": version.effective_to.isoformat() if version.effective_to else None,
            "approval_reference": version.approval_reference or "",
        },
    )
    if extra:
        meta.update(extra)
    return meta


def _require_draft(version: SpecificationVersion) -> None:
    if version.status != SpecificationVersionStatus.DRAFT:
        raise ValidationError(
            {
                "status": (
                    "Only DRAFT specification versions may be edited. "
                    "Approved history is immutable — create a new version."
                )
            }
        )


def _ranges_overlap(
    a_from: datetime.date | None,
    a_to: datetime.date | None,
    b_from: datetime.date | None,
    b_to: datetime.date | None,
) -> bool:
    """
    Open-ended nulls treated as unbounded for APPROVED effectivity conflict checks.

    Policy: ambiguous overlapping APPROVED windows are disallowed.
    """
    start_a = a_from or datetime.date.min
    end_a = a_to or datetime.date.max
    start_b = b_from or datetime.date.min
    end_b = b_to or datetime.date.max
    return start_a <= end_b and start_b <= end_a


def assert_no_approved_effectivity_overlap(
    *,
    specification: ProductSpecification,
    candidate: SpecificationVersion,
) -> None:
    siblings = SpecificationVersion.objects.filter(
        specification_id=specification.id,
        status=SpecificationVersionStatus.APPROVED,
    ).exclude(pk=candidate.pk)
    for other in siblings:
        if _ranges_overlap(
            candidate.effective_from,
            candidate.effective_to,
            other.effective_from,
            other.effective_to,
        ):
            raise ValidationError(
                {
                    "effective_from": (
                        "APPROVED specification versions for the same product "
                        "specification must not have ambiguous overlapping "
                        f"effective windows (conflicts with version "
                        f"{other.version_number})."
                    )
                }
            )


def _next_version_number(specification: ProductSpecification) -> int:
    latest = (
        SpecificationVersion.objects.filter(specification_id=specification.id)
        .order_by("-version_number")
        .values_list("version_number", flat=True)
        .first()
    )
    return int(latest or 0) + 1


@atomic_fn
def create_product_specification(
    *,
    actor: User | None,
    organization: Organization,
    product: FGProduct,
    code: str,
    name: str,
    description: str = "",
    is_active: bool = True,
    create_initial_draft: bool = True,
) -> ProductSpecification:
    user = _require_authenticated_actor(actor)
    require_permission(
        user,
        MANAGE_PRODUCT_SPECIFICATION,
        scope=Scope(organization_id=organization.id),
    )
    if product.organization_id != organization.id:
        raise ValidationError({"product": "Product must belong to the same organization."})
    normalized_code = normalize_code(code)
    normalized_name = normalize_name(name)
    if not normalized_code:
        raise ValidationError({"code": "Code cannot be blank."})
    if not normalized_name:
        raise ValidationError({"name": "Name cannot be blank."})

    spec = ProductSpecification(
        organization=organization,
        product=product,
        code=normalized_code,
        name=normalized_name,
        description=_normalize_optional_text(description),
        is_active=is_active,
    )
    try:
        spec.full_clean()
        spec.save()
    except (ValidationError, IntegrityError) as exc:
        if isinstance(exc, IntegrityError) or "unique" in str(exc).lower():
            raise ValidationError(
                {
                    "code": (
                        "A product specification with this code already exists "
                        "for the selected product."
                    )
                }
            ) from exc
        raise

    record_event(
        event_type="PRODUCT_SPECIFICATION_CREATED",
        actor=user,
        metadata=_spec_metadata(spec),
    )
    if create_initial_draft:
        create_specification_version(
            actor=user,
            specification_id=spec.id,
            approval_reference="",
            notes="",
        )
    return spec


@atomic_fn
def create_specification_version(
    *,
    actor: User | None,
    specification_id: uuid.UUID,
    effective_from: datetime.date | None = None,
    effective_to: datetime.date | None = None,
    approval_reference: str = "",
    notes: str = "",
) -> SpecificationVersion:
    user = _require_authenticated_actor(actor)
    spec = lock_queryset(
        ProductSpecification.objects.select_related("organization", "product").filter(
            pk=specification_id
        )
    ).first()
    if spec is None:
        raise ValidationError({"specification": "Product specification not found."})
    require_permission(
        user, MANAGE_PRODUCT_SPECIFICATION, scope=specification_authorization_scope(spec)
    )

    if effective_to is not None and effective_from is not None and effective_to < effective_from:
        raise ValidationError(
            {"effective_to": "effective_to cannot be earlier than effective_from."}
        )

    version = SpecificationVersion(
        specification=spec,
        version_number=_next_version_number(spec),
        status=SpecificationVersionStatus.DRAFT,
        effective_from=effective_from,
        effective_to=effective_to,
        approval_reference=_normalize_optional_text(approval_reference),
        notes=_normalize_optional_text(notes),
    )
    version.full_clean()
    version.save()
    record_event(
        event_type="SPECIFICATION_VERSION_CREATED",
        actor=user,
        metadata=_version_metadata(version),
    )
    return version


@atomic_fn
def update_draft_specification_version(
    *,
    actor: User | None,
    version_id: uuid.UUID,
    effective_from: Any = _UNSET,
    effective_to: Any = _UNSET,
    approval_reference: Any = _UNSET,
    notes: Any = _UNSET,
) -> SpecificationVersion:
    user = _require_authenticated_actor(actor)
    version = lock_queryset(
        SpecificationVersion.objects.select_related(
            "specification", "specification__organization"
        ).filter(pk=version_id)
    ).first()
    if version is None:
        raise ValidationError({"version": "Specification version not found."})
    require_permission(
        user, MANAGE_PRODUCT_SPECIFICATION, scope=version_authorization_scope(version)
    )
    _require_draft(version)

    if effective_from is not _UNSET:
        version.effective_from = effective_from
    if effective_to is not _UNSET:
        version.effective_to = effective_to
    if approval_reference is not _UNSET:
        version.approval_reference = _normalize_optional_text(approval_reference)
    if notes is not _UNSET:
        version.notes = _normalize_optional_text(notes)

    if (
        version.effective_to is not None
        and version.effective_from is not None
        and version.effective_to < version.effective_from
    ):
        raise ValidationError(
            {"effective_to": "effective_to cannot be earlier than effective_from."}
        )
    version.full_clean()
    version.save()
    record_event(
        event_type="SPECIFICATION_VERSION_UPDATED",
        actor=user,
        metadata=_version_metadata(version),
    )
    return version


@atomic_fn
def upsert_specification_parameter(
    *,
    actor: User | None,
    version_id: uuid.UUID,
    code: str,
    name: str,
    unit: str = "",
    precision: int | None = None,
    bound_min: Decimal | None = None,
    bound_max: Decimal | None = None,
    min_inclusive: bool | None = None,
    max_inclusive: bool | None = None,
    warn_min: Decimal | None = None,
    warn_max: Decimal | None = None,
    warn_min_inclusive: bool | None = None,
    warn_max_inclusive: bool | None = None,
    test_method_reference: str = "",
    notes: str = "",
) -> SpecificationParameter:
    """
    Create or replace a parameter on a DRAFT version.

    Bounds may be left empty (pending APR-006). Do not invent Nelna limits.
    """
    user = _require_authenticated_actor(actor)
    version = lock_queryset(
        SpecificationVersion.objects.select_related(
            "specification", "specification__organization"
        ).filter(pk=version_id)
    ).first()
    if version is None:
        raise ValidationError({"version": "Specification version not found."})
    require_permission(
        user, MANAGE_PRODUCT_SPECIFICATION, scope=version_authorization_scope(version)
    )
    _require_draft(version)

    normalized_code = normalize_code(code)
    normalized_name = normalize_name(name)
    if not normalized_code:
        raise ValidationError({"code": "Code cannot be blank."})
    if not normalized_name:
        raise ValidationError({"name": "Name cannot be blank."})

    param = lock_queryset(
        SpecificationParameter.objects.filter(version_id=version.id, code__iexact=normalized_code)
    ).first()
    created = param is None
    if param is None:
        param = SpecificationParameter(version=version, code=normalized_code)
    else:
        param.code = normalized_code

    param.name = normalized_name
    param.unit = _normalize_optional_text(unit)
    param.precision = precision
    param.bound_min = bound_min
    param.bound_max = bound_max
    # Explicit True/False required when a bound is set; leave None when bound unset.
    if bound_min is None:
        param.min_inclusive = None
    else:
        param.min_inclusive = True if min_inclusive is None else bool(min_inclusive)
    if bound_max is None:
        param.max_inclusive = None
    else:
        param.max_inclusive = True if max_inclusive is None else bool(max_inclusive)
    param.warn_min = warn_min
    param.warn_max = warn_max
    if warn_min is None:
        param.warn_min_inclusive = None
    else:
        param.warn_min_inclusive = True if warn_min_inclusive is None else bool(warn_min_inclusive)
    if warn_max is None:
        param.warn_max_inclusive = None
    else:
        param.warn_max_inclusive = True if warn_max_inclusive is None else bool(warn_max_inclusive)
    param.test_method_reference = _normalize_optional_text(test_method_reference)
    param.notes = _normalize_optional_text(notes)
    param.full_clean()
    param.save()

    record_event(
        event_type=(
            "SPECIFICATION_PARAMETER_CREATED" if created else "SPECIFICATION_PARAMETER_UPDATED"
        ),
        actor=user,
        metadata=_version_metadata(
            version,
            extra={
                "specification_parameter_id": str(param.id),
                "parameter_code": param.code,
                "has_bound_min": param.bound_min is not None,
                "has_bound_max": param.bound_max is not None,
            },
        ),
    )
    return param


@atomic_fn
def remove_specification_parameter(
    *,
    actor: User | None,
    parameter_id: uuid.UUID,
) -> None:
    user = _require_authenticated_actor(actor)
    param = lock_queryset(
        SpecificationParameter.objects.select_related(
            "version", "version__specification", "version__specification__organization"
        ).filter(pk=parameter_id)
    ).first()
    if param is None:
        raise ValidationError({"parameter": "Specification parameter not found."})
    version = param.version
    require_permission(
        user, MANAGE_PRODUCT_SPECIFICATION, scope=version_authorization_scope(version)
    )
    _require_draft(version)
    code = param.code
    param.delete()
    record_event(
        event_type="SPECIFICATION_PARAMETER_REMOVED",
        actor=user,
        metadata=_version_metadata(version, extra={"parameter_code": code}),
    )


@atomic_fn
def approve_specification_version(
    *,
    actor: User | None,
    version_id: uuid.UUID,
    approval_reference: str | None = None,
) -> SpecificationVersion:
    """
    Approve a DRAFT version. Parameters become immutable.

    Does not invent limits. Empty parameter bounds remain empty after approval.
    """
    user = _require_authenticated_actor(actor)
    version = lock_queryset(
        SpecificationVersion.objects.select_related(
            "specification", "specification__organization"
        ).filter(pk=version_id)
    ).first()
    if version is None:
        raise ValidationError({"version": "Specification version not found."})
    require_permission(
        user, MANAGE_PRODUCT_SPECIFICATION, scope=version_authorization_scope(version)
    )
    _require_draft(version)

    if approval_reference is not None:
        version.approval_reference = _normalize_optional_text(approval_reference)

    assert_no_approved_effectivity_overlap(
        specification=version.specification,
        candidate=version,
    )

    version.status = SpecificationVersionStatus.APPROVED
    version.approved_at = timezone.now()
    version.approved_by = user
    version.full_clean()
    version.save()
    record_event(
        event_type="SPECIFICATION_VERSION_APPROVED",
        actor=user,
        metadata=_version_metadata(version),
    )
    return version


@atomic_fn
def retire_specification_version(
    *,
    actor: User | None,
    version_id: uuid.UUID,
) -> SpecificationVersion:
    user = _require_authenticated_actor(actor)
    version = lock_queryset(
        SpecificationVersion.objects.select_related(
            "specification", "specification__organization"
        ).filter(pk=version_id)
    ).first()
    if version is None:
        raise ValidationError({"version": "Specification version not found."})
    require_permission(
        user, MANAGE_PRODUCT_SPECIFICATION, scope=version_authorization_scope(version)
    )
    if version.status != SpecificationVersionStatus.APPROVED:
        raise ValidationError({"status": "Only APPROVED versions may be retired."})
    version.status = SpecificationVersionStatus.RETIRED
    version.save(update_fields=["status", "updated_at"])
    record_event(
        event_type="SPECIFICATION_VERSION_RETIRED",
        actor=user,
        metadata=_version_metadata(version),
    )
    return version


@atomic_fn
def clone_specification_version_as_draft(
    *,
    actor: User | None,
    source_version_id: uuid.UUID,
    effective_from: datetime.date | None = None,
    effective_to: datetime.date | None = None,
    notes: str = "",
) -> SpecificationVersion:
    """Clone parameters into a new DRAFT — historical source remains unchanged."""
    user = _require_authenticated_actor(actor)
    source = (
        SpecificationVersion.objects.select_related("specification", "specification__organization")
        .filter(pk=source_version_id)
        .first()
    )
    if source is None:
        raise ValidationError({"version": "Specification version not found."})
    require_permission(
        user, MANAGE_PRODUCT_SPECIFICATION, scope=version_authorization_scope(source)
    )

    draft = create_specification_version(
        actor=user,
        specification_id=source.specification_id,
        effective_from=effective_from if effective_from is not None else source.effective_from,
        effective_to=effective_to if effective_to is not None else source.effective_to,
        approval_reference="",
        notes=notes or f"Cloned from version {source.version_number}",
    )
    for param in source.parameters.all():
        SpecificationParameter.objects.create(
            version=draft,
            code=param.code,
            name=param.name,
            unit=param.unit,
            precision=param.precision,
            bound_min=param.bound_min,
            bound_max=param.bound_max,
            min_inclusive=param.min_inclusive,
            max_inclusive=param.max_inclusive,
            warn_min=param.warn_min,
            warn_max=param.warn_max,
            warn_min_inclusive=param.warn_min_inclusive,
            warn_max_inclusive=param.warn_max_inclusive,
            test_method_reference=param.test_method_reference,
            notes=param.notes,
        )
    record_event(
        event_type="SPECIFICATION_VERSION_CLONED",
        actor=user,
        metadata=_version_metadata(
            draft,
            extra={
                "source_specification_version_id": str(source.id),
                "source_version_number": source.version_number,
            },
        ),
    )
    return draft


def delete_product_specification(spec: ProductSpecification) -> None:
    refuse_hard_delete_product_specification(spec)


def delete_specification_version(version: SpecificationVersion) -> None:
    refuse_hard_delete_specification_version(version)
