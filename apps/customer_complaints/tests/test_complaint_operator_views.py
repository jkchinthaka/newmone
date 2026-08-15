"""Operator customer-complaint workspace tests."""

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
from apps.customer_complaints.models import CustomerComplaintCase
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
def test_complaint_create_and_detail(client: Client) -> None:
    demo = load_synthetic_demo_data()
    _grant(
        demo.admin,
        demo.organization,
        CustomerComplaintCase,
        "view_customercomplaint",
        "create_customercomplaint",
    )
    client.force_login(demo.admin)
    listed = client.get(reverse("complaints:list"))
    assert listed.status_code == 200
    created = client.post(
        reverse("complaints:create"),
        {
            "code": "DEMO-CMP-UI-1",
            "description": "DEMO complaint description",
            "batch_reference": "DEMO-BATCH-0001",
        },
    )
    assert created.status_code == 302
    case = CustomerComplaintCase.objects.get(code="DEMO-CMP-UI-1")
    detail = client.get(reverse("complaints:detail", kwargs={"case_id": case.id}))
    assert detail.status_code == 200
    assert b"DEMO complaint description" in detail.content
    assert b"never auto-send" in detail.content
