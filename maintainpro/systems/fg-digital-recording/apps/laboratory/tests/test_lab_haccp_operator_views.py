"""Laboratory and HACCP operator workspace tests."""

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
from apps.haccp.models import HaccpPlan
from apps.laboratory.models import LabSample
from apps.organizations.models import Organization
from apps.recording.synthetic_demo import load_synthetic_demo_data


def _grant(user: User, org: Organization, model: type[Any], *codes: str) -> None:
    first = Permission.objects.get_or_create(
        content_type=ContentType.objects.get_for_model(model),
        codename=codes[0],
        defaults={"name": codes[0]},
    )[0]
    role = make_role_with_permission(
        code=f"L{uuid.uuid4().hex[:6].upper()}",
        name="lab",
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
def test_lab_and_haccp_lists(client: Client) -> None:
    demo = load_synthetic_demo_data()
    _grant(demo.admin, demo.organization, LabSample, "view_laboratory")
    _grant(demo.admin, demo.organization, HaccpPlan, "view_haccp")
    client.force_login(demo.admin)
    lab = client.get(reverse("laboratory:list"))
    assert lab.status_code == 200
    assert b"Laboratory samples" in lab.content
    haccp = client.get(reverse("haccp:list"))
    assert haccp.status_code == 200
    assert b"HACCP plans" in haccp.content
