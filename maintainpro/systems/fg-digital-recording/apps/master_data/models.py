"""FG Product master — configurable, unseeded; MASTER-001 remains evidence-required."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower

from apps.organizations.models import Organization


class FGProduct(models.Model):
    """
    Organization-scoped Finished Goods Product definition.

    Codes and names are administrator-configured. No business Product rows are seeded.
    Optional mapping / attribute fields are TECHNICALLY SUPPORTED blanks until
    MASTER-001 evidence supplies official values. Do not invent Nelna catalogue data.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="fg_products",
    )
    # Primary identity (organization-scoped)
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    # ERP mapping reference — not primary identity; no live Bileeta calls
    erp_item_code = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Optional ERP / Bileeta item mapping reference. Not primary Product identity.",
    )
    # Optional generic attributes — empty until MASTER-001 evidence (no seeded catalogues)
    category = models.CharField(max_length=128, blank=True, default="")
    brand = models.CharField(max_length=128, blank=True, default="")
    pack_size = models.CharField(max_length=64, blank=True, default="")
    uom = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text="Unit of measure label (free text). No seeded UOM catalogue.",
    )
    barcode = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Optional barcode / SKU reference.",
    )
    storage_category = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text=("Optional storage-category label only. Not a CCP/temperature class approval."),
    )
    shelf_life_reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Optional shelf-life document / policy reference — not a computed limit.",
    )
    label_artwork_reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Optional label / artwork document reference.",
    )
    effective_from = models.DateField(
        null=True,
        blank=True,
        help_text="Optional effective-from date. Blank until business rules evidenced.",
    )
    effective_to = models.DateField(
        null=True,
        blank=True,
        help_text="Optional effective-to date. Prefer over hard delete.",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization__code", "code")
        verbose_name = "FG Product"
        verbose_name_plural = "FG Products"
        permissions = [
            ("manage_fgproduct", "Can manage FG product"),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="md_fgproduct_org_code_ci_uniq",
            ),
            models.UniqueConstraint(
                Lower("erp_item_code"),
                "organization",
                condition=~Q(erp_item_code=""),
                name="md_fgproduct_org_erp_ci_uniq",
            ),
            models.CheckConstraint(
                condition=(
                    Q(effective_to__isnull=True)
                    | Q(effective_from__isnull=True)
                    | Q(effective_to__gte=models.F("effective_from"))
                ),
                name="md_fgproduct_effective_window_valid",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization", "is_active"],
                name="md_fgproduct_org_act_idx",
            ),
            models.Index(Lower("code"), name="md_fgproduct_code_lower_idx"),
            models.Index(
                Lower("erp_item_code"),
                name="md_fgproduct_erp_lower_idx",
            ),
            models.Index(
                fields=["organization", "category"],
                name="md_fgproduct_org_cat_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.code}"

    def clean(self) -> None:
        super().clean()
        errors: dict[str, str] = {}
        if not (self.code or "").strip():
            errors["code"] = "Code cannot be blank."
        if not (self.name or "").strip():
            errors["name"] = "Name cannot be blank."
        if (
            self.effective_to is not None
            and self.effective_from is not None
            and self.effective_to < self.effective_from
        ):
            errors["effective_to"] = "effective_to cannot be earlier than effective_from."
        if errors:
            raise ValidationError(errors)


class SpecificationVersionStatus(models.TextChoices):
    """Lifecycle for product specification revisions."""

    DRAFT = "DRAFT", "Draft"
    APPROVED = "APPROVED", "Approved"
    RETIRED = "RETIRED", "Retired"


class ProductSpecification(models.Model):
    """
    Organization-scoped specification container for one FG Product.

    No Nelna limits are seeded. Parameter bounds remain empty until APR-006 evidence.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="product_specifications",
    )
    product = models.ForeignKey(
        FGProduct,
        on_delete=models.PROTECT,
        related_name="product_specifications",
    )
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization__code", "product__code", "code")
        verbose_name = "Product specification"
        verbose_name_plural = "Product specifications"
        permissions = [
            ("manage_productspecification", "Can manage product specifications"),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "product",
                name="md_productspec_product_code_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization", "is_active"],
                name="md_productspec_org_act_idx",
            ),
            models.Index(Lower("code"), name="md_productspec_code_lower_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.product.code}/{self.code}"

    def clean(self) -> None:
        super().clean()
        errors: dict[str, str] = {}
        if not (self.code or "").strip():
            errors["code"] = "Code cannot be blank."
        if not (self.name or "").strip():
            errors["name"] = "Name cannot be blank."
        if self.product_id is not None and self.organization_id is not None:
            product = self.product
            if product is not None and product.organization_id != self.organization_id:
                errors["product"] = (
                    "Product must belong to the same organization as the specification."
                )
        if errors:
            raise ValidationError(errors)


class SpecificationVersion(models.Model):
    """
    Immutable after APPROVED/RETIRED. Historical checklist pins use PROTECT FKs.

    Overlapping APPROVED effectivity windows for the same ProductSpecification
    are disallowed by service policy.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    specification = models.ForeignKey(
        ProductSpecification,
        on_delete=models.PROTECT,
        related_name="versions",
    )
    version_number = models.PositiveIntegerField()
    status = models.CharField(
        max_length=16,
        choices=SpecificationVersionStatus.choices,
        default=SpecificationVersionStatus.DRAFT,
    )
    effective_from = models.DateField(
        null=True,
        blank=True,
        help_text="Optional. Blank means unbounded start until business policy confirms.",
    )
    effective_to = models.DateField(
        null=True,
        blank=True,
        help_text="Optional. Blank means unbounded end until business policy confirms.",
    )
    approval_reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Document / approval reference — empty until owner evidence.",
    )
    notes = models.TextField(blank=True, default="")
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="approved_specification_versions",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("specification__code", "-version_number")
        verbose_name = "Specification version"
        verbose_name_plural = "Specification versions"
        constraints = [
            models.UniqueConstraint(
                fields=["specification", "version_number"],
                name="md_specversion_spec_number_uniq",
            ),
            models.CheckConstraint(
                condition=(
                    Q(effective_to__isnull=True)
                    | Q(effective_from__isnull=True)
                    | Q(effective_to__gte=models.F("effective_from"))
                ),
                name="md_specversion_effective_window_valid",
            ),
        ]
        indexes = [
            models.Index(
                fields=["specification", "status"],
                name="md_specversion_spec_status_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.specification.code} v{self.version_number} ({self.status})"

    @property
    def is_draft(self) -> bool:
        return self.status == SpecificationVersionStatus.DRAFT

    @property
    def is_immutable(self) -> bool:
        return self.status in {
            SpecificationVersionStatus.APPROVED,
            SpecificationVersionStatus.RETIRED,
        }

    def is_effective_on(self, as_of: datetime | date) -> bool:
        """Return True when as_of falls within optional effective window."""
        if self.effective_from is not None and as_of < self.effective_from:
            return False
        if self.effective_to is not None and as_of > self.effective_to:
            return False
        return True

    def clean(self) -> None:
        super().clean()
        if (
            self.effective_to is not None
            and self.effective_from is not None
            and self.effective_to < self.effective_from
        ):
            raise ValidationError(
                {"effective_to": "effective_to cannot be earlier than effective_from."}
            )


class SpecificationParameter(models.Model):
    """
    Named measurable parameter on one SpecificationVersion.

    min/max and warning bands are optional. Empty bounds mean pending evidence
    (NOT_EVALUATED) — never invent Nelna temperature/weight/micro limits.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    version = models.ForeignKey(
        SpecificationVersion,
        on_delete=models.CASCADE,
        related_name="parameters",
    )
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    unit = models.CharField(max_length=32, blank=True, default="")
    precision = models.PositiveSmallIntegerField(null=True, blank=True)
    bound_min = models.DecimalField(max_digits=26, decimal_places=12, null=True, blank=True)
    bound_max = models.DecimalField(max_digits=26, decimal_places=12, null=True, blank=True)
    min_inclusive = models.BooleanField(null=True, blank=True)
    max_inclusive = models.BooleanField(null=True, blank=True)
    warn_min = models.DecimalField(max_digits=26, decimal_places=12, null=True, blank=True)
    warn_max = models.DecimalField(max_digits=26, decimal_places=12, null=True, blank=True)
    warn_min_inclusive = models.BooleanField(null=True, blank=True)
    warn_max_inclusive = models.BooleanField(null=True, blank=True)
    test_method_reference = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("version_id", "code")
        verbose_name = "Specification parameter"
        verbose_name_plural = "Specification parameters"
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "version",
                name="md_specparam_version_code_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(Lower("code"), name="md_specparam_code_lower_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.version_id}/{self.code}"

    def clean(self) -> None:
        super().clean()
        errors: dict[str, str] = {}
        if not (self.code or "").strip():
            errors["code"] = "Code cannot be blank."
        if not (self.name or "").strip():
            errors["name"] = "Name cannot be blank."
        if (
            self.bound_min is not None
            and self.bound_max is not None
            and self.bound_min > self.bound_max
        ):
            errors["bound_max"] = "bound_max cannot be less than bound_min."
        if (
            self.warn_min is not None
            and self.warn_max is not None
            and self.warn_min > self.warn_max
        ):
            errors["warn_max"] = "warn_max cannot be less than warn_min."
        if self.bound_min is not None and self.min_inclusive is None:
            errors["min_inclusive"] = (
                "min_inclusive is required when bound_min is set (True/False)."
            )
        if self.bound_max is not None and self.max_inclusive is None:
            errors["max_inclusive"] = (
                "max_inclusive is required when bound_max is set (True/False)."
            )
        if self.warn_min is not None and self.warn_min_inclusive is None:
            errors["warn_min_inclusive"] = "warn_min_inclusive is required when warn_min is set."
        if self.warn_max is not None and self.warn_max_inclusive is None:
            errors["warn_max_inclusive"] = "warn_max_inclusive is required when warn_max is set."
        if errors:
            raise ValidationError(errors)
