"""RCA operator forms — thin adapters over Phase 49 services."""

from __future__ import annotations

from django import forms

from apps.rca.models import RcaFishboneCategory, RcaSourceKind, RcaStatus


class RcaCreateForm(forms.Form):
    organization_id = forms.UUIDField()
    rca_code = forms.CharField(max_length=64, label="RCA identifier")
    source_kind = forms.ChoiceField(choices=RcaSourceKind.choices)
    source_citation = forms.CharField(max_length=512, required=False)
    linked_object_id = forms.UUIDField(required=False)
    problem_statement = forms.CharField(widget=forms.Textarea, label="Problem statement")
    containment_reference = forms.CharField(
        required=False,
        widget=forms.Textarea,
        label="Immediate containment reference",
        help_text="Optional citation only. Does not open or close NCR/CAPA.",
    )
    facilitator_reference = forms.CharField(max_length=128, required=False)


class RcaStatusFilterForm(forms.Form):
    status = forms.ChoiceField(
        required=False,
        choices=[("", "All statuses"), *RcaStatus.choices],
    )


class RcaFiveWhyForm(forms.Form):
    sequence = forms.IntegerField(min_value=1)
    why_question = forms.CharField(max_length=512)
    answer = forms.CharField(widget=forms.Textarea)


class RcaFishboneForm(forms.Form):
    category = forms.ChoiceField(choices=RcaFishboneCategory.choices)
    category_label = forms.CharField(max_length=128, required=False)
    description = forms.CharField(widget=forms.Textarea)


class RcaCauseForm(forms.Form):
    statement = forms.CharField(widget=forms.Textarea)
    evidence_citation = forms.CharField(max_length=512, required=False)


class RcaEvidenceForm(forms.Form):
    citation = forms.CharField(max_length=512, required=False)
    cause_id = forms.UUIDField(required=False)


class RcaSupportForm(forms.Form):
    evidence_citation = forms.CharField(max_length=512, required=False)


class RcaConfirmForm(forms.Form):
    confirmation_note = forms.CharField(required=False, widget=forms.Textarea)


class RcaVerifyForm(forms.Form):
    verification_notes = forms.CharField(widget=forms.Textarea)


class RcaCapaLinkForm(forms.Form):
    create_follow_up = forms.BooleanField(required=False)
    capa_code = forms.CharField(max_length=64, required=False)
    existing_capa_id = forms.UUIDField(required=False)


class RcaParticipantForm(forms.Form):
    name_reference = forms.CharField(max_length=128)
    role_note = forms.CharField(max_length=128, required=False)
