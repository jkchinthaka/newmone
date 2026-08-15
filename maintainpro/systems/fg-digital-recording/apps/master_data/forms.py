"""FG Product management forms."""

from __future__ import annotations

from typing import Any

from django import forms
from django.db.models import QuerySet

from apps.master_data.models import FGProduct
from apps.organizations.models import Organization

_INPUT = {"class": "form-input", "autocomplete": "off"}


class FGProductForm(forms.Form):
    organization = forms.ModelChoiceField(
        queryset=Organization.objects.none(),
        label="Organization",
        empty_label="Select organization",
        widget=forms.Select(attrs={"class": "form-input"}),
    )
    code = forms.CharField(
        max_length=64,
        label="Product code",
        widget=forms.TextInput(
            attrs={
                "class": "form-input",
                "autocomplete": "off",
                "autocapitalize": "characters",
            }
        ),
        help_text="Normalized to uppercase. Unique within the selected organization.",
    )
    name = forms.CharField(
        max_length=255,
        label="Product name",
        widget=forms.TextInput(attrs=_INPUT),
    )
    description = forms.CharField(
        required=False,
        label="Description",
        widget=forms.Textarea(attrs={"class": "form-input", "rows": 3}),
        help_text="Optional. Leave blank if not needed.",
    )
    erp_item_code = forms.CharField(
        required=False,
        max_length=128,
        label="ERP item code",
        widget=forms.TextInput(attrs=_INPUT),
        help_text=(
            "Optional mapping reference only (not primary identity). "
            "Unique within organization when set. No live ERP/Bileeta calls."
        ),
    )
    category = forms.CharField(
        required=False,
        max_length=128,
        label="Category",
        widget=forms.TextInput(attrs=_INPUT),
        help_text="Optional. No seeded category catalogue.",
    )
    brand = forms.CharField(
        required=False,
        max_length=128,
        label="Brand",
        widget=forms.TextInput(attrs=_INPUT),
        help_text="Optional.",
    )
    pack_size = forms.CharField(
        required=False,
        max_length=64,
        label="Pack size",
        widget=forms.TextInput(attrs=_INPUT),
        help_text="Optional free-text pack size.",
    )
    uom = forms.CharField(
        required=False,
        max_length=32,
        label="UOM",
        widget=forms.TextInput(attrs=_INPUT),
        help_text="Optional unit-of-measure label. No seeded UOM catalogue.",
    )
    barcode = forms.CharField(
        required=False,
        max_length=128,
        label="Barcode / SKU",
        widget=forms.TextInput(attrs=_INPUT),
        help_text="Optional barcode or SKU reference.",
    )
    storage_category = forms.CharField(
        required=False,
        max_length=128,
        label="Storage category",
        widget=forms.TextInput(attrs=_INPUT),
        help_text="Optional label only — not an approved CCP/temperature classification.",
    )
    shelf_life_reference = forms.CharField(
        required=False,
        max_length=255,
        label="Shelf-life reference",
        widget=forms.TextInput(attrs=_INPUT),
        help_text="Optional document/policy reference — not a computed limit.",
    )
    label_artwork_reference = forms.CharField(
        required=False,
        max_length=255,
        label="Label / artwork reference",
        widget=forms.TextInput(attrs=_INPUT),
        help_text="Optional document reference.",
    )
    effective_from = forms.DateField(
        required=False,
        label="Effective from",
        widget=forms.DateInput(attrs={"class": "form-input", "type": "date"}),
        help_text="Optional.",
    )
    effective_to = forms.DateField(
        required=False,
        label="Effective to",
        widget=forms.DateInput(attrs={"class": "form-input", "type": "date"}),
        help_text="Optional end date. Prefer over hard delete.",
    )
    is_active = forms.BooleanField(
        label="Active",
        required=False,
        initial=True,
        help_text=(
            "Inactive products remain available for history but are hidden from active lists."
        ),
    )

    def __init__(
        self,
        *args: Any,
        organizations: QuerySet[Organization] | None = None,
        instance: FGProduct | None = None,
        **kwargs: Any,
    ) -> None:
        self.instance = instance
        super().__init__(*args, **kwargs)
        from apps.core.type_guards import require_model_choice_field

        org_field = require_model_choice_field(self.fields["organization"], name="organization")
        org_field.queryset = (
            organizations if organizations is not None else Organization.objects.none()
        )

        if instance is not None:
            org_field.disabled = True
            org_field.initial = instance.organization_id
            org_field.help_text = "Organization cannot be changed after an FG Product is created."
            if not self.is_bound:
                for name in (
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
                ):
                    self.fields[name].initial = getattr(instance, name)

    def clean(self) -> dict[str, Any]:
        cleaned = super().clean() or {} or {}
        effective_from = cleaned.get("effective_from")
        effective_to = cleaned.get("effective_to")
        if effective_from and effective_to and effective_to < effective_from:
            self.add_error(
                "effective_to",
                "effective_to cannot be earlier than effective_from.",
            )
        return cleaned
