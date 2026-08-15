"""Applicability preview form — management tool only (Phase 07C)."""

from __future__ import annotations

from typing import Any

from django import forms

from apps.access_control.services import organization_ids_with_permission
from apps.accounts.models import User
from apps.core.type_guards import require_model_choice_field
from apps.master_data.models import FGProduct
from apps.organizations.models import Department, Organization, Shift, Site
from apps.scheduling.applicability import VIEW_APPLICABILITY


class ApplicabilityPreviewForm(forms.Form):
    organization = forms.ModelChoiceField(queryset=Organization.objects.none())
    product = forms.ModelChoiceField(queryset=FGProduct.objects.none(), required=False)
    site = forms.ModelChoiceField(queryset=Site.objects.none(), required=False)
    department = forms.ModelChoiceField(queryset=Department.objects.none(), required=False)
    shift = forms.ModelChoiceField(queryset=Shift.objects.none(), required=False)
    process_reference = forms.CharField(required=False, max_length=128)
    as_of = forms.DateField(required=False, input_formats=["%Y-%m-%d"])

    def __init__(
        self,
        *args: Any,
        actor: User | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(*args, **kwargs)
        organization_field = require_model_choice_field(
            self.fields["organization"], name="organization"
        )
        allowed = organization_ids_with_permission(actor, VIEW_APPLICABILITY) if actor else []
        organization_field.queryset = Organization.objects.filter(pk__in=allowed).order_by("code")
        org = None
        if self.is_bound:
            org_id = self.data.get("organization")
            if org_id:
                org = organization_field.queryset.filter(pk=str(org_id)).first()
        elif self.initial.get("organization"):
            org = organization_field.queryset.filter(pk=self.initial["organization"]).first()
        if org is not None:
            product_field = require_model_choice_field(self.fields["product"], name="product")
            site_field = require_model_choice_field(self.fields["site"], name="site")
            department_field = require_model_choice_field(
                self.fields["department"], name="department"
            )
            shift_field = require_model_choice_field(self.fields["shift"], name="shift")
            product_field.queryset = FGProduct.objects.filter(
                organization=org, is_active=True
            ).order_by("code")
            site_field.queryset = Site.objects.filter(organization=org, is_active=True).order_by(
                "code"
            )
            department_field.queryset = Department.objects.filter(
                organization=org, is_active=True
            ).order_by("code")
            shift_field.queryset = Shift.objects.filter(organization=org, is_active=True).order_by(
                "code"
            )
