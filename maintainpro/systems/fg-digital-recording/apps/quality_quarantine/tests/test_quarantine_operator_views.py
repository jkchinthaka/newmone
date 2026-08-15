"""Operator quality-quarantine workspace tests."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.test import Client
from django.urls import reverse
from tests.factories import grant_role, make_role_with_permission

from apps.accounts.models import User
from apps.organizations.models import Organization
from apps.quality_quarantine.models import QualityQuarantineRecord
from apps.recording.synthetic_demo import load_synthetic_demo_data


def _grant(user: User, org: Organization, model: type[Any], *codes: str) -> None:
    first = Permission.objects.get_or_create(
        content_type=ContentType.objects.get_for_model(model),
        codename=codes[0],
        defaults={"name": codes[0]},
    )[0]
    role = make_role_with_permission(
        code=f"V{uuid.uuid4().hex[:6].upper()}",
        name="view",
        permission=first,
    )
    for code in codes[1:]:
        perm, _ = Permission.objects.get_or_create(
            content_type=ContentType.objects.get_for_model(model),
            codename=code,
            defaults={"name": code},
        )
        role.permissions.add(perm)
    grant_role(user, role, organization=org)


@pytest.mark.django_db
def test_quarantine_create_and_detail(client: Client) -> None:
    demo = load_synthetic_demo_data()
    _grant(
        demo.admin,
        demo.organization,
        QualityQuarantineRecord,
        "view_qualityquarantine",
        "manage_qualityquarantine",
    )
    client.force_login(demo.admin)
    listed = client.get(reverse("quarantine:list"))
    assert listed.status_code == 200
    created = client.post(
        reverse("quarantine:create"),
        {
            "code": "DEMO-QRT-UI-1",
            "batch_reference": "DEMO-BATCH-0001",
            "source": "MANUAL",
            "source_reference": "DEMO",
            "reason_reference": "DEMO quarantine reason",
        },
    )
    assert created.status_code == 302
    record = QualityQuarantineRecord.objects.get(code="DEMO-QRT-UI-1")
    detail = client.get(reverse("quarantine:detail", kwargs={"quarantine_id": record.id}))
    assert detail.status_code == 200
    assert b"DEMO quarantine reason" in detail.content
    assert b"Inventory ledger is unchanged" in detail.content
