"""SOURCE RECEIVED daily-form workspace tests."""

from __future__ import annotations

from datetime import date

import pytest
from django.test import Client
from django.urls import reverse

from apps.checklists.controlled_forms import DISPATCH_SAMPLE_COUNT
from apps.checklists.models import ChecklistTemplate
from apps.recording.controlled_form_seed import seed_controlled_form_templates
from apps.recording.synthetic_demo import load_synthetic_demo_data
from apps.scheduling.services import ensure_controlled_daily_task


@pytest.mark.django_db
def test_daily_home_and_open_cleaning(client: Client) -> None:
    demo = load_synthetic_demo_data()
    seed_controlled_form_templates(actor=demo.admin, organization=demo.organization)
    client.force_login(demo.recorder)
    home = client.get(reverse("recording:daily_home"))
    assert home.status_code == 200
    assert b"NMS/PPU/CL/24" in home.content
    assert b"SOURCE RECEIVED" in home.content
    opened = client.get(
        reverse("recording:daily_open", kwargs={"form_code": "NMS/PPU/CL/24"}),
        {"date": "2026-08-11"},
    )
    assert opened.status_code == 302
    again = ensure_controlled_daily_task(
        actor=demo.recorder,
        organization_id=demo.organization.id,
        form_code="NMS/PPU/CL/24",
        record_date=date(2026, 8, 11),
    )
    duplicate = ensure_controlled_daily_task(
        actor=demo.recorder,
        organization_id=demo.organization.id,
        form_code="NMS/PPU/CL/24",
        record_date=date(2026, 8, 11),
    )
    assert again.id == duplicate.id


@pytest.mark.django_db
def test_cl18_occurrence_token_retry_and_new_create() -> None:
    demo = load_synthetic_demo_data()
    seed_controlled_form_templates(actor=demo.admin, organization=demo.organization)
    first = ensure_controlled_daily_task(
        actor=demo.recorder,
        organization_id=demo.organization.id,
        form_code="NMS/PPU/CL/18",
        record_date=date(2026, 8, 11),
        occurrence_token="stable-intent-token",
    )
    retry = ensure_controlled_daily_task(
        actor=demo.recorder,
        organization_id=demo.organization.id,
        form_code="NMS/PPU/CL/18",
        record_date=date(2026, 8, 11),
        occurrence_token="stable-intent-token",
    )
    other = ensure_controlled_daily_task(
        actor=demo.recorder,
        organization_id=demo.organization.id,
        form_code="NMS/PPU/CL/18",
        record_date=date(2026, 8, 11),
        occurrence_token="second-intent-token",
    )
    assert first.id == retry.id
    assert first.id != other.id


@pytest.mark.django_db
def test_dispatch_template_has_ten_samples() -> None:
    demo = load_synthetic_demo_data()
    seed_controlled_form_templates(actor=demo.admin, organization=demo.organization)
    template = ChecklistTemplate.objects.get(organization=demo.organization, code="NMS/PPU/CL/18")
    version = template.versions.get(status="PUBLISHED")
    sample_codes = {
        item.code
        for section in version.sections.all()
        for item in section.items.all()
        if item.code.startswith("T")
    }
    assert len(sample_codes) == DISPATCH_SAMPLE_COUNT


@pytest.mark.django_db
def test_reports_empty_copy_without_reporting_orgs(client: Client) -> None:
    demo = load_synthetic_demo_data()
    client.force_login(demo.admin)
    response = client.get(reverse("reports:catalogue"))
    assert response.status_code == 200
    assert b"No organizations are currently available for reporting." in response.content
