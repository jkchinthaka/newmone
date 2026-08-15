"""Concurrency tests for checklist versioning (unique version + CAS publish)."""

from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import connection
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.checklists.models import ChecklistTemplate, ChecklistVersion, ChecklistVersionStatus
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
    update_checklist_section,
)
from apps.core.db_namespace import restore_postgresql_table_names
from apps.organizations.models import Organization

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture(autouse=True)
def _ensure_pg_table_names() -> None:
    restore_postgresql_table_names()


def _perm(codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(ChecklistTemplate)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _manager(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"CKC{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"CKCM{suffix}",
        name=f"CK concurrency {suffix}",
        permission=_perm("manage_checklist"),
    )
    role.permissions.add(_perm("view_checklisttemplate"))
    grant_role(user, role, organization=org)
    return user


def test_concurrent_publish_one_winner() -> None:
    org = make_org(code=f"CKP{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    template = create_checklist_template(
        actor=manager, organization=org, code="CHK-PUB", name="Publish race"
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="S")
    add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="I1",
        label="Item",
        response_type="YES_NO",
        is_required=True,
    )

    def _run() -> str:
        connection.close()
        try:
            published = publish_checklist_version(actor=manager, version_id=version.id)
            return published.status
        except ValidationError:
            return "CONFLICT"

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = [f.result() for f in as_completed([pool.submit(_run) for _ in range(4)])]

    assert results.count(ChecklistVersionStatus.PUBLISHED) == 1
    version.refresh_from_db()
    assert version.status == ChecklistVersionStatus.PUBLISHED


def test_publish_vs_edit_published_immutable() -> None:
    org = make_org(code=f"CKE{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    template = create_checklist_template(
        actor=manager, organization=org, code="CHK-ED", name="Edit race"
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="S")
    add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="I1",
        label="Item",
        response_type="YES_NO",
        is_required=True,
    )

    def _publish() -> str:
        connection.close()
        publish_checklist_version(actor=manager, version_id=version.id)
        return "PUBLISHED"

    def _edit() -> str:
        connection.close()
        try:
            update_checklist_section(
                actor=manager, section_id=section.id, title="Edited after race"
            )
            return "EDITED"
        except ValidationError:
            return "BLOCKED"

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(_publish), pool.submit(_edit)]
        outcomes = {f.result() for f in as_completed(futures)}

    version.refresh_from_db()
    assert version.status == ChecklistVersionStatus.PUBLISHED
    assert "PUBLISHED" in outcomes
    section.refresh_from_db()
    if "EDITED" in outcomes:
        # Edit won the race before publish; published snapshot still immutable afterwards.
        with pytest.raises(ValidationError):
            update_checklist_section(actor=manager, section_id=section.id, title="After publish")
    else:
        assert section.title == "S"


def test_two_clients_allocate_distinct_version_numbers() -> None:
    org = make_org(code=f"CKA{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    template = create_checklist_template(
        actor=manager, organization=org, code="CHK-AL", name="Alloc race"
    )

    def _create() -> int:
        connection.close()
        version = create_checklist_version(actor=manager, template_id=template.id)
        return version.version_number

    with ThreadPoolExecutor(max_workers=4) as pool:
        numbers = [f.result() for f in as_completed([pool.submit(_create) for _ in range(4)])]

    assert sorted(numbers) == [1, 2, 3, 4]
    assert ChecklistVersion.objects.filter(template=template).count() == 4
