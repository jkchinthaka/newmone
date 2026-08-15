"""Shift management forms — presentation validation only; domain rules stay in services."""

from __future__ import annotations

from typing import Any

from django import forms
from django.db.models import QuerySet

from apps.organizations.models import Department, Organization, Shift, Site


class ShiftForm(forms.Form):
    organization = forms.ModelChoiceField(
        queryset=Organization.objects.none(),
        label="Organization",
        empty_label="Select organization",
        widget=forms.Select(
            attrs={"class": "form-input", "data-shift-org": "true"},
        ),
    )
    site = forms.ModelChoiceField(
        queryset=Site.objects.none(),
        label="Site",
        required=False,
        empty_label="Organization-wide (no site)",
        widget=forms.Select(
            attrs={"class": "form-input", "data-shift-site": "true"},
        ),
        help_text="Leave blank for an organization-wide Shift.",
    )
    department = forms.ModelChoiceField(
        queryset=Department.objects.none(),
        label="Department",
        required=False,
        empty_label="Site-wide (no department)",
        widget=forms.Select(
            attrs={"class": "form-input", "data-shift-dept": "true"},
        ),
        help_text="Requires a site. Leave blank for a site-wide Shift.",
    )
    code = forms.CharField(
        max_length=64,
        label="Shift code",
        widget=forms.TextInput(
            attrs={
                "class": "form-input",
                "autocomplete": "off",
                "autocapitalize": "characters",
            }
        ),
        help_text="Normalized to uppercase. Unique within the selected scope.",
    )
    name = forms.CharField(
        max_length=255,
        label="Shift name",
        widget=forms.TextInput(attrs={"class": "form-input", "autocomplete": "off"}),
    )
    start_time = forms.TimeField(
        label="Start time",
        widget=forms.TimeInput(attrs={"class": "form-input", "type": "time"}),
    )
    end_time = forms.TimeField(
        label="End time",
        widget=forms.TimeInput(attrs={"class": "form-input", "type": "time"}),
        help_text=(
            "If end time is earlier than or equal to start time, "
            "the Shift is classified as overnight."
        ),
    )
    effective_from = forms.DateField(
        label="Effective from",
        widget=forms.DateInput(attrs={"class": "form-input", "type": "date"}),
    )
    effective_to = forms.DateField(
        label="Effective to",
        required=False,
        widget=forms.DateInput(attrs={"class": "form-input", "type": "date"}),
        help_text="Optional. Leave blank for no end date.",
    )
    is_active = forms.BooleanField(
        label="Active",
        required=False,
        initial=True,
        help_text="Inactive Shifts remain in history but are hidden from active lists.",
    )

    def __init__(
        self,
        *args: Any,
        organizations: QuerySet[Organization] | None = None,
        sites: QuerySet[Site] | None = None,
        departments: QuerySet[Department] | None = None,
        instance: Shift | None = None,
        **kwargs: Any,
    ) -> None:
        self.instance = instance
        super().__init__(*args, **kwargs)
        from apps.core.type_guards import require_model_choice_field

        org_field = require_model_choice_field(self.fields["organization"], name="organization")
        site_field = require_model_choice_field(self.fields["site"], name="site")
        dept_field = require_model_choice_field(self.fields["department"], name="department")
        org_field.queryset = (
            organizations if organizations is not None else Organization.objects.none()
        )
        site_field.queryset = sites if sites is not None else Site.objects.none()
        dept_field.queryset = departments if departments is not None else Department.objects.none()

        if instance is not None:
            # Organization is immutable after create; domain update_shift does not move orgs.
            org_field.disabled = True
            org_field.initial = instance.organization_id
            org_field.help_text = "Organization cannot be changed after a Shift is created."
            if not self.is_bound:
                site_field.initial = instance.site_id
                dept_field.initial = instance.department_id
                self.fields["code"].initial = instance.code
                self.fields["name"].initial = instance.name
                self.fields["start_time"].initial = instance.start_time
                self.fields["end_time"].initial = instance.end_time
                self.fields["effective_from"].initial = instance.effective_from
                self.fields["effective_to"].initial = instance.effective_to
                self.fields["is_active"].initial = instance.is_active

    def clean(self) -> dict[str, Any]:
        cleaned = super().clean() or {}
        site = cleaned.get("site")
        department = cleaned.get("department")
        if department is not None and site is None:
            self.add_error("department", "Department requires a site.")
        effective_from = cleaned.get("effective_from")
        effective_to = cleaned.get("effective_to")
        if effective_from and effective_to and effective_to < effective_from:
            self.add_error("effective_to", "effective_to cannot be earlier than effective_from.")
        return cleaned
