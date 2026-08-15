"""Evidence upload / retire forms."""

from __future__ import annotations

from django import forms


class EvidenceUploadForm(forms.Form):
    file = forms.FileField(
        help_text="Allowlisted types only (JPEG/PNG/WebP/PDF). Executables and HTML are rejected.",
    )
    caption = forms.CharField(
        required=False,
        max_length=255,
        help_text="Optional caption — not a business disposition.",
    )


class EvidenceRetireForm(forms.Form):
    reason = forms.CharField(
        max_length=255,
        widget=forms.Textarea(attrs={"rows": 3}),
        help_text="Required reason for soft-retirement. Hard delete is not available.",
    )
