"""RCA operator URL/RBAC tests — Phase 49 UI."""

from __future__ import annotations

import uuid

import pytest
from django.test import Client
from django.urls import reverse
from tests.factories import make_org, make_user

from apps.rca.models import RcaSourceKind, RcaStatus, RootCauseAnalysis
from apps.rca.services import create_rca, start_rca
from apps.rca.tests.test_phase49_rca import _rca_user


@pytest.mark.django_db
def test_rca_list_denied_without_view(client: Client) -> None:
    user = make_user(employee_code="RCA-UI-00")
    client.force_login(user)
    response = client.get(reverse("rca:list"))
    assert response.status_code == 403


@pytest.mark.django_db
def test_rca_create_start_and_detail_workspace(client: Client) -> None:
    org = make_org(code="RCAUI1")
    actor = _rca_user(org=org, manage=True)
    client.force_login(actor)
    list_response = client.get(reverse("rca:list"))
    assert list_response.status_code == 200
    assert b"Root Cause Analysis" in list_response.content
    create = client.post(
        reverse("rca:create"),
        {
            "organization_id": str(org.id),
            "rca_code": "SYN-RCA-UI-01",
            "source_kind": RcaSourceKind.OTHER,
            "source_citation": "Synthetic owner citation",
            "problem_statement": "Synthetic packing leak for UI test.",
            "containment_reference": "Hold lot SYN-HOLD-01 cited only.",
        },
    )
    assert create.status_code == 302
    rca = RootCauseAnalysis.objects.get(rca_code="SYN-RCA-UI-01")
    assert rca.containment_reference.startswith("Hold lot")
    detail = client.get(reverse("rca:detail", kwargs={"rca_id": rca.id}))
    assert detail.status_code == 200
    assert b"Immediate containment" in detail.content
    start = client.post(reverse("rca:start", kwargs={"rca_id": rca.id}))
    assert start.status_code == 302
    rca.refresh_from_db()
    assert rca.status == RcaStatus.IN_PROGRESS


@pytest.mark.django_db
def test_confirm_hidden_without_confirm_permission(client: Client) -> None:
    org = make_org(code="RCAUI2")
    manager = _rca_user(org=org, manage=True)
    rca = create_rca(
        actor=manager,
        organization_id=org.id,
        rca_code="SYN-RCA-UI-02",
        source_kind=RcaSourceKind.OTHER,
        source_citation="Synthetic",
        problem_statement="Synthetic problem",
    )
    start_rca(actor=manager, rca_id=rca.id)
    client.force_login(manager)
    page = client.get(reverse("rca:detail", kwargs={"rca_id": rca.id}))
    assert b"Confirm root cause" not in page.content


@pytest.mark.django_db
def test_sidebar_shows_rca_only_when_authorized(client: Client) -> None:
    org = make_org(code="RCAUI3")
    viewer = _rca_user(org=org, view=True)
    other = make_user(employee_code=f"NO{uuid.uuid4().hex[:6]}")
    client.force_login(viewer)
    landing = client.get(reverse("accounts:landing"))
    assert b"Root Cause Analysis" in landing.content
    client.force_login(other)
    landing_denied = client.get(reverse("accounts:landing"))
    assert b"Root Cause Analysis" not in landing_denied.content
