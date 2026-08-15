"""Operator NCR/CAPA workspace tests."""

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
from apps.capa.models import CorrectiveAction
from apps.nonconformance.models import NonConformanceRecord
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
def test_ncr_create_and_detail(client: Client) -> None:
    demo = load_synthetic_demo_data()
    _grant(
        demo.admin,
        demo.organization,
        NonConformanceRecord,
        "view_nonconformancerecord",
        "create_nonconformance",
        "manage_nonconformance",
        "close_nonconformance",
    )
    client.force_login(demo.admin)
    listed = client.get(reverse("nonconformance:list"))
    assert listed.status_code == 200
    created = client.post(
        reverse("nonconformance:create"),
        {
            "code": "DEMO-NCR-1",
            "title": "DEMO ncr title",
            "description": "DEMO description",
            "containment": "DEMO hold note",
        },
    )
    assert created.status_code == 302
    ncr = NonConformanceRecord.objects.get(code="DEMO-NCR-1")
    detail = client.get(reverse("nonconformance:detail", kwargs={"ncr_id": ncr.id}))
    assert detail.status_code == 200
    assert b"DEMO hold note" in detail.content


@pytest.mark.django_db
def test_capa_effectiveness_workspace(client: Client) -> None:
    demo = load_synthetic_demo_data()
    _grant(
        demo.admin,
        demo.organization,
        CorrectiveAction,
        "view_correctiveaction",
        "create_capa",
        "manage_capa",
        "close_capa",
    )
    client.force_login(demo.admin)
    created = client.post(
        reverse("capa:create"),
        {"code": "DEMO-CAPA-1", "title": "DEMO capa", "summary": "DEMO summary"},
    )
    assert created.status_code == 302
    capa = CorrectiveAction.objects.get(code="DEMO-CAPA-1")
    client.post(
        reverse("capa:transition", kwargs={"capa_id": capa.id}),
        {"to_status": "IN_PROGRESS"},
    )
    client.post(
        reverse("capa:transition", kwargs={"capa_id": capa.id}),
        {"to_status": "VERIFICATION"},
    )
    reviewed = client.post(
        reverse("capa:effectiveness", kwargs={"capa_id": capa.id}),
        {"notes": "DEMO effectiveness review"},
    )
    assert reviewed.status_code == 302
    detail = client.get(reverse("capa:detail", kwargs={"capa_id": capa.id}))
    assert detail.status_code == 200
    assert b"DEMO effectiveness review" in detail.content
