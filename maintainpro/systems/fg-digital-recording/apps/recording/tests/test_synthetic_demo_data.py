"""Synthetic demo dataset — not company master data."""

from __future__ import annotations

import pytest
from django.core.management import call_command
from django.test import override_settings

from apps.organizations.models import Organization
from apps.recording.synthetic_demo import DEMO_ORG_CODE, load_synthetic_demo_data
from apps.scheduling.models import ChecklistTask


@pytest.mark.django_db
@override_settings(DEBUG=True, ENVIRONMENT_LABEL="local")
def test_synthetic_demo_data_is_idempotent_and_labelled() -> None:
    first = load_synthetic_demo_data()
    second = load_synthetic_demo_data()
    assert first.organization.code == DEMO_ORG_CODE
    assert "DEMO" in first.organization.name
    assert first.product.code.startswith("DEMO")
    assert first.template.code.startswith("DEMO")
    assert first.task.batch_reference.startswith("DEMO-")
    assert second.created is False
    assert second.organization.id == first.organization.id
    assert Organization.objects.filter(code=DEMO_ORG_CODE).count() == 1
    assert (
        ChecklistTask.objects.filter(
            organization=first.organization, batch_reference="DEMO-BATCH-0001"
        ).count()
        == 1
    )
    assert ChecklistTask.objects.filter(organization=first.organization).count() >= 1


@pytest.mark.django_db
@override_settings(DEBUG=False, ENVIRONMENT_LABEL="production")
def test_synthetic_demo_data_blocked_in_production() -> None:
    from django.core.exceptions import ValidationError

    with pytest.raises(ValidationError):
        load_synthetic_demo_data()


@pytest.mark.django_db
@override_settings(DEBUG=True, ENVIRONMENT_LABEL="local")
def test_management_command_prints_demo_banner(capsys: pytest.CaptureFixture[str]) -> None:
    call_command("load_synthetic_demo_data")
    captured = capsys.readouterr()
    assert "NOT COMPANY MASTER DATA" in captured.out
    assert "DEMO-REC-001" in captured.out
