"""Enterprise shell UI — navigation visibility and dashboard rendering."""

from __future__ import annotations

import pytest
from django.contrib.auth.models import Permission
from django.test import Client
from django.urls import reverse
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.checklists.models import ChecklistTemplate


def _perm(codename: str) -> Permission:
    from django.contrib.contenttypes.models import ContentType

    content_type = ContentType.objects.get_for_model(ChecklistTemplate)
    permission, _created = Permission.objects.get_or_create(
        content_type=content_type,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


@pytest.mark.django_db
def test_dashboard_hides_unauthorized_module_links(client: Client) -> None:
    user = make_user(employee_code="UI-NAV-01")
    client.force_login(user)
    response = client.get(reverse("accounts:landing"))
    assert response.status_code == 200
    content = response.content.decode()
    assert "Welcome" in content
    assert "Dashboard" in content
    assert "Checklist Definitions" not in content
    assert "Supervisor Review" not in content
    assert "QA Review" not in content
    assert "Reports" not in content
    assert reverse("accounts:logout") in content


@pytest.mark.django_db
def test_dashboard_shows_authorized_checklist_link(client: Client) -> None:
    org = make_org(code="UIORG1")
    user = make_user(employee_code="UI-NAV-02")
    role = make_role_with_permission(
        code="UIVIEW",
        name="View checklists",
        permission=_perm("view_checklisttemplate"),
    )
    grant_role(user, role, organization=org)
    client.force_login(user)
    response = client.get(reverse("accounts:landing"))
    content = response.content.decode()
    assert "Checklist Definitions" in content
    assert reverse("checklists:template_list") in content


@pytest.mark.django_db
def test_login_shows_environment_badge(client: Client) -> None:
    response = client.get(reverse("accounts:login"))
    content = response.content.decode()
    assert "Sign in" in content
    assert "env-chip" in content
    assert "Employee code" in content


@pytest.mark.django_db
def test_dashboard_includes_unread_notification_card(client: Client) -> None:
    user = make_user(employee_code="UI-NAV-04")
    client.force_login(user)
    response = client.get(reverse("accounts:landing"))
    content = response.content.decode()
    assert "Unread notifications" in content
    assert "Work queues" in content


@pytest.mark.django_db
def test_authenticated_shell_has_sidebar_landmarks(client: Client) -> None:
    user = make_user(employee_code="UI-NAV-03")
    client.force_login(user)
    response = client.get(reverse("accounts:landing"))
    content = response.content.decode()
    assert 'aria-label="Application"' in content
    assert 'aria-label="Primary"' in content
    assert 'href="#main-content"' in content
    assert "Skip to content" in content
