"""Phase 07D — checklist effective-version selection tests."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.utils import timezone
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.checklists.effective_version import (
    EffectiveVersionOutcome,
    assert_exactly_one_effective_version,
    resolve_effective_checklist_version,
    set_checklist_version_effectivity,
)
from apps.checklists.models import ChecklistTemplate, ChecklistVersionStatus
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
    retire_checklist_version,
)
from apps.organizations.models import Organization
from apps.scheduling.models import ChecklistTask
from apps.scheduling.services import (
    create_batch_checklist_task,
    create_batch_checklist_task_using_effective_version,
)
from apps.security_audit.models import SecurityAuditEvent

UTC = ZoneInfo("UTC")


def _perm(model: type[Any], codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _manager(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"E07D{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"R07D{suffix}",
        name=f"07D manager {suffix}",
        permission=_perm(ChecklistTemplate, "manage_checklist"),
    )
    role.permissions.add(_perm(ChecklistTemplate, "view_checklisttemplate"))
    role.permissions.add(_perm(ChecklistTask, "manage_checklisttask"))
    role.permissions.add(_perm(ChecklistTask, "view_checklisttask"))
    grant_role(user, role, organization=org)
    return user


def _published(*, actor: User, org: Organization, code: str) -> Any:
    template = create_checklist_template(
        actor=actor, organization=org, code=code, name=f"Template {code}"
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="S")
    add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="I1",
        label="Item",
        response_type="YES_NO",
        is_required=True,
    )
    published = publish_checklist_version(actor=actor, version_id=version.id)
    return template, published


@pytest.mark.django_db
def test_exact_timestamp_boundaries_inclusive() -> None:
    org = make_org(code=f"O07D1{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    template, version = _published(actor=actor, org=org, code="T1")
    start = datetime(2026, 3, 1, 8, 0, 0, tzinfo=UTC)
    end = datetime(2026, 3, 1, 16, 0, 0, tzinfo=UTC)
    set_checklist_version_effectivity(
        actor=actor,
        version_id=version.id,
        effective_from=start,
        effective_to=end,
    )
    assert SecurityAuditEvent.objects.filter(
        event_type="CHECKLIST_VERSION_EFFECTIVITY_UPDATED"
    ).exists()

    at_start = resolve_effective_checklist_version(template_id=template.id, as_of=start)
    assert at_start.outcome == EffectiveVersionOutcome.ONE_ELIGIBLE_VERSION
    assert at_start.selected_version is not None
    assert at_start.selected_version.id == version.id

    at_end = resolve_effective_checklist_version(template_id=template.id, as_of=end)
    assert at_end.outcome == EffectiveVersionOutcome.ONE_ELIGIBLE_VERSION

    before = resolve_effective_checklist_version(
        template_id=template.id, as_of=start - timedelta(seconds=1)
    )
    assert before.outcome == EffectiveVersionOutcome.NO_ELIGIBLE_VERSION
    assert before.blocked is True
    assert EffectiveVersionOutcome.BLOCKED in before.reasons

    after = resolve_effective_checklist_version(
        template_id=template.id, as_of=end + timedelta(seconds=1)
    )
    assert after.outcome == EffectiveVersionOutcome.NO_ELIGIBLE_VERSION


@pytest.mark.django_db
def test_overlapping_eligible_versions_never_arbitrary() -> None:
    from apps.checklists.models import ChecklistVersion

    org = make_org(code=f"O07D2{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    template, v1 = _published(actor=actor, org=org, code="T2")
    set_checklist_version_effectivity(
        actor=actor,
        version_id=v1.id,
        effective_from=datetime(2026, 1, 1, tzinfo=UTC),
        effective_to=datetime(2026, 6, 30, 23, 59, 59, tzinfo=UTC),
    )
    # Second version: non-overlapping window while DRAFT, then publish.
    v2 = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=v2.id, title="S2")
    add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="I2",
        label="Item2",
        response_type="YES_NO",
        is_required=True,
    )
    set_checklist_version_effectivity(
        actor=actor,
        version_id=v2.id,
        effective_from=datetime(2026, 7, 1, tzinfo=UTC),
        effective_to=datetime(2026, 12, 31, 23, 59, 59, tzinfo=UTC),
    )
    v2 = publish_checklist_version(actor=actor, version_id=v2.id)

    mid = resolve_effective_checklist_version(
        template_id=template.id, as_of=datetime(2026, 3, 15, 12, 0, tzinfo=UTC)
    )
    assert mid.outcome == EffectiveVersionOutcome.ONE_ELIGIBLE_VERSION
    assert mid.selected_version is not None
    assert mid.selected_version.id == v1.id
    assert mid.checklist_version_id == v1.id

    # Simulate legacy overlapping PUBLISHED windows (bypass service) → resolve conflict.
    ChecklistVersion.objects.filter(pk__in=[v1.id, v2.id]).update(
        effective_from=None, effective_to=None
    )
    result = resolve_effective_checklist_version(template_id=template.id, as_of=timezone.now())
    assert result.outcome == EffectiveVersionOutcome.OVERLAPPING_ELIGIBLE_VERSIONS
    assert result.selected_version is None
    assert len(result.candidates) == 2
    assert result.blocked is True
    with pytest.raises(ValidationError) as exc:
        assert_exactly_one_effective_version(template_id=template.id)
    assert "blocked" in exc.value.message_dict or "BLOCKED" in str(exc.value)

    # Service rejects reintroducing overlap on a PUBLISHED version.
    ChecklistVersion.objects.filter(pk=v1.id).update(
        effective_from=datetime(2026, 1, 1, tzinfo=UTC),
        effective_to=datetime(2026, 6, 30, 23, 59, 59, tzinfo=UTC),
    )
    ChecklistVersion.objects.filter(pk=v2.id).update(
        effective_from=datetime(2026, 7, 1, tzinfo=UTC),
        effective_to=datetime(2026, 12, 31, 23, 59, 59, tzinfo=UTC),
    )
    with pytest.raises(ValidationError):
        set_checklist_version_effectivity(
            actor=actor,
            version_id=v2.id,
            effective_from=datetime(2026, 1, 1, tzinfo=UTC),
            effective_to=datetime(2026, 12, 31, tzinfo=UTC),
        )


@pytest.mark.django_db
def test_retirement_excludes_from_selection_but_remains_readable() -> None:
    org = make_org(code=f"O07D3{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    template, version = _published(actor=actor, org=org, code="T3")
    retired = retire_checklist_version(actor=actor, version_id=version.id)
    assert retired.status == ChecklistVersionStatus.RETIRED
    # Still readable historically.
    version.refresh_from_db()
    assert version.status == ChecklistVersionStatus.RETIRED
    result = resolve_effective_checklist_version(template_id=template.id, as_of=timezone.now())
    assert result.outcome == EffectiveVersionOutcome.NO_ELIGIBLE_VERSION
    with pytest.raises(ValidationError):
        set_checklist_version_effectivity(
            actor=actor,
            version_id=version.id,
            effective_from=timezone.now(),
        )


@pytest.mark.django_db
def test_historical_task_never_auto_upgrades() -> None:
    org = make_org(code=f"O07D4{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    template, v1 = _published(actor=actor, org=org, code="T4")
    task = create_batch_checklist_task(
        actor=actor,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=v1.id,
        batch_reference="BATCH-07D-1",
    )
    assert task.checklist_version_id == v1.id

    # Close v1 window before publishing a successor (publish rejects overlapping windows).
    set_checklist_version_effectivity(
        actor=actor,
        version_id=v1.id,
        effective_from=datetime(2020, 1, 1, tzinfo=UTC),
        effective_to=datetime(2020, 12, 31, tzinfo=UTC),
    )
    v2 = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=v2.id, title="S")
    add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="I1",
        label="Item",
        response_type="YES_NO",
        is_required=True,
    )
    set_checklist_version_effectivity(
        actor=actor,
        version_id=v2.id,
        effective_from=datetime(2021, 1, 1, tzinfo=UTC),
        clear_effective_to=True,
    )
    v2 = publish_checklist_version(actor=actor, version_id=v2.id)
    task.refresh_from_db()
    assert task.checklist_version_id == v1.id  # historical pin unchanged
    # New selection at "now" would pick v2 — task still pinned to v1.
    now_pick = resolve_effective_checklist_version(template_id=template.id, as_of=timezone.now())
    assert now_pick.outcome == EffectiveVersionOutcome.ONE_ELIGIBLE_VERSION
    assert now_pick.selected_version is not None
    assert now_pick.selected_version.id == v2.id
    assert task.checklist_version_id == v1.id


@pytest.mark.django_db
def test_cross_org_and_task_create_blocked_paths() -> None:
    org_a = make_org(code=f"O07DA{uuid.uuid4().hex[:4].upper()}")
    org_b = make_org(code=f"O07DB{uuid.uuid4().hex[:4].upper()}")
    actor_a = _manager(org=org_a)
    actor_b = _manager(org=org_b)
    t_a, v_a = _published(actor=actor_a, org=org_a, code="TA")
    t_b, v_b = _published(actor=actor_b, org=org_b, code="TB")

    # Org B template never selected for Org A context via engine (template-scoped).
    res_b = resolve_effective_checklist_version(template_id=t_b.id, as_of=timezone.now())
    assert res_b.outcome == EffectiveVersionOutcome.ONE_ELIGIBLE_VERSION

    with pytest.raises(PermissionDenied):
        set_checklist_version_effectivity(
            actor=actor_a,
            version_id=v_b.id,
            effective_from=timezone.now(),
        )

    # No eligible → task create using effective version is BLOCKED.
    retire_checklist_version(actor=actor_a, version_id=v_a.id)
    with pytest.raises(ValidationError) as exc:
        create_batch_checklist_task_using_effective_version(
            actor=actor_a,
            organization_id=org_a.id,
            checklist_template_id=t_a.id,
            batch_reference="BATCH-BLOCKED",
            as_of=timezone.now(),
        )
    assert "NO_ELIGIBLE_VERSION" in str(exc.value) or "BLOCKED" in str(exc.value)

    # Fresh template with one published → deterministic create.
    t2, v2 = _published(actor=actor_a, org=org_a, code="TA2")
    task = create_batch_checklist_task_using_effective_version(
        actor=actor_a,
        organization_id=org_a.id,
        checklist_template_id=t2.id,
        batch_reference="BATCH-OK",
        as_of=timezone.now(),
    )
    assert task.checklist_version_id == v2.id
    payload = resolve_effective_checklist_version(template_id=t2.id, as_of=timezone.now()).to_dict()
    assert payload["never_arbitrary_selection"] is True
    assert "APR-015" in payload["apr_015_note"]


@pytest.mark.django_db
def test_publish_audits_effectivity_fields_and_invalid_window() -> None:
    org = make_org(code=f"O07D5{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    template = create_checklist_template(actor=actor, organization=org, code="T5", name="T5")
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="S")
    add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="I1",
        label="Item",
        response_type="YES_NO",
        is_required=True,
    )
    set_checklist_version_effectivity(
        actor=actor,
        version_id=version.id,
        effective_from=datetime(2026, 1, 1, tzinfo=UTC),
        effective_to=datetime(2026, 12, 31, tzinfo=UTC),
    )
    published = publish_checklist_version(actor=actor, version_id=version.id)
    event = SecurityAuditEvent.objects.filter(event_type="CHECKLIST_VERSION_PUBLISHED").latest(
        "created_at"
    )
    assert event.metadata.get("effective_from") is not None
    assert published.effective_from is not None

    with pytest.raises(ValidationError):
        set_checklist_version_effectivity(
            actor=actor,
            version_id=version.id,
            effective_from=datetime(2026, 12, 31, tzinfo=UTC),
            effective_to=datetime(2026, 1, 1, tzinfo=UTC),
        )

    inactive = resolve_effective_checklist_version(template_id=uuid.uuid4(), as_of=timezone.now())
    assert inactive.outcome == EffectiveVersionOutcome.INVALID_TEMPLATE


@pytest.mark.django_db
def test_inactive_template_naive_as_of_and_auth_edges() -> None:
    org = make_org(code=f"O07D6{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    stranger = make_user(employee_code=f"STR{uuid.uuid4().hex[:5].upper()}")
    template, version = _published(actor=actor, org=org, code="T6")

    # Naive as_of is normalized; still selects the unbounded PUBLISHED version.
    naive = datetime(2026, 5, 1, 12, 0, 0)  # noqa: DTZ001 — intentional naive input
    resolved = resolve_effective_checklist_version(template_id=template.id, as_of=naive)
    assert resolved.outcome == EffectiveVersionOutcome.ONE_ELIGIBLE_VERSION
    assert resolved.checklist_version_id == version.id

    template.is_active = False
    template.save(update_fields=["is_active", "updated_at"])
    inactive = resolve_effective_checklist_version(template_id=template.id, as_of=timezone.now())
    assert inactive.outcome == EffectiveVersionOutcome.INVALID_TEMPLATE
    assert inactive.blocked is True

    with pytest.raises(PermissionDenied):
        set_checklist_version_effectivity(
            actor=stranger,
            version_id=version.id,
            effective_from=timezone.now(),
        )
    with pytest.raises(PermissionDenied):
        set_checklist_version_effectivity(
            actor=None,
            version_id=version.id,
            effective_from=timezone.now(),
        )
    with pytest.raises(ValidationError):
        set_checklist_version_effectivity(
            actor=actor,
            version_id=uuid.uuid4(),
            effective_from=timezone.now(),
        )

    template.is_active = True
    template.save(update_fields=["is_active", "updated_at"])
    set_checklist_version_effectivity(
        actor=actor,
        version_id=version.id,
        effective_from=datetime(2026, 1, 1, tzinfo=UTC),
        effective_to=datetime(2026, 12, 31, tzinfo=UTC),
    )
    cleared = set_checklist_version_effectivity(
        actor=actor,
        version_id=version.id,
        clear_effective_from=True,
        clear_effective_to=True,
    )
    assert cleared.effective_from is None
    assert cleared.effective_to is None
