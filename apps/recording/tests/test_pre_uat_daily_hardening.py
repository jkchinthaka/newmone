"""Pre-UAT Daily Records date validation and CL choice-label fidelity."""

from __future__ import annotations

import uuid

import pytest
from django import forms
from django.test import Client
from django.urls import reverse

from apps.checklists.models import ChecklistItem, ChecklistItemKind, ChecklistResponseType
from apps.recording.controlled_form_seed import seed_controlled_form_templates
from apps.recording.forms import ChecklistDraftForm
from apps.recording.models import ChoiceResponseValue
from apps.recording.synthetic_demo import load_synthetic_demo_data


@pytest.mark.parametrize(
    ("form_code", "yes_label", "no_label"),
    [
        ("NMS/PPU/CL/24", "Acceptable", "Unacceptable"),
        ("NMS/PPU/CL/30", "PASS", "FAIL"),
        ("NMS/PPU/CL/18", "PASS", "FAIL"),
        ("OTHER", "Yes", "No"),
    ],
)
def test_controlled_form_choice_labels(form_code: str, yes_label: str, no_label: str) -> None:
    form = ChecklistDraftForm(items=[], form_code=form_code, draft_version=1)
    assert form._choice_labels() == (yes_label, no_label)

    item = ChecklistItem(
        id=uuid.UUID("00000000-0000-0000-0000-0000000000aa"),
        code="CLEAN",
        label="Cleanliness",
        item_kind=ChecklistItemKind.SIMPLE,
        response_type=ChecklistResponseType.YES_NO,
        is_required=True,
        position=1,
    )
    form._add_item_field(item, sample_index=1, initial_responses={})
    response_key = next(key for key in form.fields if key.startswith("response_"))
    response_field = form.fields[response_key]
    assert isinstance(response_field, forms.ChoiceField)
    choices = list(response_field.choices)  # type: ignore[arg-type]
    assert (ChoiceResponseValue.YES, yes_label) in choices
    assert (ChoiceResponseValue.NO, no_label) in choices


@pytest.mark.django_db
def test_daily_malformed_date_and_month_redirect_with_message(client: Client) -> None:
    demo = load_synthetic_demo_data()
    seed_controlled_form_templates(actor=demo.admin, organization=demo.organization)
    client.force_login(demo.recorder)

    bad_date = client.get(reverse("recording:daily_home"), {"date": "xyz"}, follow=True)
    assert bad_date.status_code == 200
    assert b"valid date" in bad_date.content.lower()

    bad_open = client.get(
        reverse("recording:daily_open", kwargs={"form_code": "NMS/PPU/CL/24"}),
        {"date": "abc"},
    )
    assert bad_open.status_code == 302
    assert bad_open["Location"] == reverse("recording:daily_home")

    bad_month = client.get(
        reverse("recording:daily_monthly_print"),
        {"form": "NMS/PPU/CL/24", "month": "abcd"},
        follow=True,
    )
    assert bad_month.status_code == 200
    assert b"valid month" in bad_month.content.lower()

    bad_month_num = client.get(
        reverse("recording:daily_monthly_print"),
        {"form": "NMS/PPU/CL/24", "month": "2026-99"},
    )
    assert bad_month_num.status_code == 302

    bad_history = client.get(
        reverse("recording:daily_history"),
        {"date_from": "bad", "date_to": "also-bad"},
    )
    assert bad_history.status_code == 302
    assert bad_history["Location"] == reverse("recording:daily_history")

    good = client.get(reverse("recording:daily_home"), {"date": "2026-08-01"})
    assert good.status_code == 200
