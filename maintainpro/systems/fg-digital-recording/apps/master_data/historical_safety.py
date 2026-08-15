"""Historical safety for FG Product and product specifications — soft lifecycle only."""

from __future__ import annotations

from django.core.exceptions import ValidationError

from apps.master_data.models import FGProduct, ProductSpecification, SpecificationVersion


def refuse_hard_delete_fg_product(product: FGProduct) -> None:
    """
    Hard delete is never permitted for FG Product rows.

    Checklist / recording historical references use PROTECT FKs; deactivate
    (and set effective_to when applicable) instead of deleting.
    """
    raise ValidationError(
        {
            "delete": (
                "Hard delete of FG Product is not permitted. "
                "Deactivate and/or set effective_to instead."
            )
        }
    )


def refuse_hard_delete_product_specification(spec: ProductSpecification) -> None:
    """Hard delete refused — deactivate specification / retire versions instead."""
    raise ValidationError(
        {
            "delete": (
                "Hard delete of ProductSpecification is not permitted. "
                "Deactivate the specification and/or retire versions instead."
            )
        }
    )


def refuse_hard_delete_specification_version(version: SpecificationVersion) -> None:
    """
    Hard delete refused for specification versions.

    APPROVED/RETIRED rows are historical evidence; DRAFT may be retired via
    superseding versions rather than destructive delete.
    """
    raise ValidationError(
        {
            "delete": (
                "Hard delete of SpecificationVersion is not permitted. "
                "Keep DRAFT for editing until approve, or retire APPROVED versions. "
                f"(version {version.version_number}, status={version.status})"
            )
        }
    )
