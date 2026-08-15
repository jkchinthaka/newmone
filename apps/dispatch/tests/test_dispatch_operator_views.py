"""Operator dispatch quality workspace tests."""

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
from apps.dispatch.models import DispatchQualityRecord
from apps.organizations.models import Organization
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
def test_dispatch_create_and_detail(client: Client) -> None:
    demo = load_synthetic_demo_data()
    _grant(
        demo.admin,
        demo.organization,
        DispatchQualityRecord,
        "view_dispatchqualityrecord",
        "create_dispatchqualityrecord",
    )
    client.force_login(demo.admin)
    listed = client.get(reverse("dispatch:list"))
    assert listed.status_code == 200
    created = client.post(
        reverse("dispatch:create"),
        {
            "code": "DEMO-DSP-UI-1",
            "vehicle_reference": "DEMO-TRUCK-UI",
            "notes": "DEMO dispatch note",
        },
    )
    assert created.status_code == 302
    record = DispatchQualityRecord.objects.get(code="DEMO-DSP-UI-1")
    detail = client.get(reverse("dispatch:detail", kwargs={"record_id": record.id}))
    assert detail.status_code == 200
    assert b"DEMO-TRUCK-UI" in detail.content
    assert b"Disabled" in detail.content
