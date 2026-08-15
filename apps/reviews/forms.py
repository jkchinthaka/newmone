"""Supervisor review forms."""

from __future__ import annotations

from django import forms

from apps.reviews.services import REVIEW_NOTE_MAX_LENGTH, normalize_review_note


class SupervisorReviewConfirmForm(forms.Form):
    review_note = forms.CharField(
        required=False,
        widget=forms.Textarea(
            attrs={
                "rows": 4,
                "class": "form-control",
                "aria-describedby": "review-note-help",
            }
        ),
        max_length=REVIEW_NOTE_MAX_LENGTH,
        label="Review note (optional)",
    )

    def clean_review_note(self) -> str:
        return normalize_review_note(self.cleaned_data.get("review_note"))
