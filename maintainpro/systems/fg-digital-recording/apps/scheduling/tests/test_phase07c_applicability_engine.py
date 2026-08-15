"""Phase 07C — checklist applicability engine tests."""

from __future__ import annotations

import datetime
import time
import uuid
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.management import call_command
from django.test import Client
from django.urls import reverse
from tests.factories import (
    grant_role,
    make_org,
    make_role_with_permission,
    make_site,
    make_user,
)

from apps.accounts.models import User
from apps.checklists.models import ChecklistTemplate, ChecklistVersionStatus
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
)
from apps.master_data.models import FGProduct
from apps.master_data.services import create_fg_product
from apps.organizations.models import Organization, Shift
from apps.scheduling.applicability import (
    create_checklist_applicability_rule,
    deactivate_checklist_applicability_rule,
    delete_checklist_applicability_rule,
    preview_checklist_applicability,
    resolve_checklist_applicability,
    update_checklist_applicability_rule,
)
from apps.scheduling.models import (
    ApplicabilityMatchOutcome,
    ChecklistApplicabilityRule,
    ChecklistTask,
)
from apps.scheduling.services import create_batch_checklist_task
from apps.security_audit.models import SecurityAuditEvent


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
    user = make_user(employee_code=f"A07C{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"R07C{suffix}",
        name=f"Appl manager {suffix}",
        permission=_perm(ChecklistApplicabilityRule, "manage_checklistapplicability"),
    )
    role.permissions.add(_perm(ChecklistApplicabilityRule, "view_checklistapplicability"))
    role.permissions.add(_perm(ChecklistTask, "manage_checklisttask"))
    role.permissions.add(_perm(ChecklistTask, "view_checklisttask"))
    role.permissions.add(_perm(ChecklistTemplate, "manage_checklist"))
    role.permissions.add(_perm(ChecklistTemplate, "view_checklisttemplate"))
    role.permissions.add(_perm(FGProduct, "manage_fgproduct"))
    role.permissions.add(_perm(FGProduct, "view_fgproduct"))
    grant_role(user, role, organization=org)
    return user


def _published_template_version(*, actor: User, org: Organization, code: str) -> Any:
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


def _make_shift(org: Organization, *, code: str) -> Shift:
    return Shift.objects.create(
        organization=org,
        code=code,
        name=f"Shift {code}",
        start_time=datetime.time(8, 0),
        end_time=datetime.time(16, 0),
        effective_from=datetime.date(2026, 1, 1),
        is_active=True,
    )


@pytest.mark.django_db
def test_single_match() -> None:
    org = make_org(code=f"O07C1{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    product = create_fg_product(actor=actor, organization=org, code="P1", name="P1")
    template, version = _published_template_version(actor=actor, org=org, code="T1")
    rule = create_checklist_applicability_rule(
        actor=actor,
        organization=org,
        code="RULE-1",
        name="Rule 1",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        product=product,
    )
    result = resolve_checklist_applicability(organization_id=org.id, product_id=product.id)
    assert result.outcome == ApplicabilityMatchOutcome.ONE_MATCH
    assert result.matched_rule is not None
    assert result.matched_rule.id == rule.id
    assert result.checklist_version is not None
    assert result.checklist_version.id == version.id
    assert SecurityAuditEvent.objects.filter(
        event_type="CHECKLIST_APPLICABILITY_RULE_CREATED"
    ).exists()


@pytest.mark.django_db
def test_no_match() -> None:
    org = make_org(code=f"O07C2{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    product = create_fg_product(actor=actor, organization=org, code="P2", name="P2")
    other = create_fg_product(actor=actor, organization=org, code="P2B", name="P2B")
    template, version = _published_template_version(actor=actor, org=org, code="T2")
    create_checklist_applicability_rule(
        actor=actor,
        organization=org,
        code="RULE-2",
        name="Rule 2",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        product=product,
    )
    result = resolve_checklist_applicability(organization_id=org.id, product_id=other.id)
    assert result.outcome == ApplicabilityMatchOutcome.NO_MATCH
    assert result.matched_rule is None


@pytest.mark.django_db
def test_conflict_multiple_matches_never_picks_first() -> None:
    org = make_org(code=f"O07C3{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    product = create_fg_product(actor=actor, organization=org, code="P3", name="P3")
    t1, v1 = _published_template_version(actor=actor, org=org, code="T3A")
    t2, v2 = _published_template_version(actor=actor, org=org, code="T3B")
    create_checklist_applicability_rule(
        actor=actor,
        organization=org,
        code="RULE-A",
        name="A",
        checklist_template_id=t1.id,
        checklist_version_id=v1.id,
        product=product,
    )
    create_checklist_applicability_rule(
        actor=actor,
        organization=org,
        code="RULE-B",
        name="B",
        checklist_template_id=t2.id,
        checklist_version_id=v2.id,
        product=product,
    )
    result = resolve_checklist_applicability(organization_id=org.id, product_id=product.id)
    assert result.outcome == ApplicabilityMatchOutcome.MULTIPLE_MATCHES
    assert result.matched_rule is None
    assert len(result.matched_rules) == 2
    assert "never_silently_choose_first" in result.reasons


@pytest.mark.django_db
def test_inactive_reference_outcome() -> None:
    org = make_org(code=f"O07C4{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    product = create_fg_product(actor=actor, organization=org, code="P4", name="P4")
    template, version = _published_template_version(actor=actor, org=org, code="T4")
    rule = create_checklist_applicability_rule(
        actor=actor,
        organization=org,
        code="RULE-4",
        name="Rule 4",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        product=product,
    )
    version.status = ChecklistVersionStatus.RETIRED
    version.save(update_fields=["status", "updated_at"])
    result = resolve_checklist_applicability(organization_id=org.id, product_id=product.id)
    assert result.outcome == ApplicabilityMatchOutcome.INVALID_INACTIVE_REFERENCE
    assert rule.id in {r.id for r in result.invalid_rules}


@pytest.mark.django_db
def test_effective_date_window() -> None:
    org = make_org(code=f"O07C5{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    template, version = _published_template_version(actor=actor, org=org, code="T5")
    create_checklist_applicability_rule(
        actor=actor,
        organization=org,
        code="RULE-5",
        name="Dated",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        effective_from=datetime.date(2026, 1, 1),
        effective_to=datetime.date(2026, 6, 30),
    )
    inside = resolve_checklist_applicability(
        organization_id=org.id, as_of=datetime.date(2026, 3, 15)
    )
    assert inside.outcome == ApplicabilityMatchOutcome.ONE_MATCH
    outside = resolve_checklist_applicability(
        organization_id=org.id, as_of=datetime.date(2026, 8, 1)
    )
    assert outside.outcome == ApplicabilityMatchOutcome.NO_MATCH
    with pytest.raises(ValidationError):
        create_checklist_applicability_rule(
            actor=actor,
            organization=org,
            code="RULE-5B",
            name="Bad dates",
            checklist_template_id=template.id,
            checklist_version_id=version.id,
            effective_from=datetime.date(2026, 7, 1),
            effective_to=datetime.date(2026, 1, 1),
        )


@pytest.mark.django_db
def test_cross_org_isolation_and_authorization() -> None:
    org_a = make_org(code=f"O07CA{uuid.uuid4().hex[:4].upper()}")
    org_b = make_org(code=f"O07CB{uuid.uuid4().hex[:4].upper()}")
    actor_a = _manager(org=org_a)
    actor_b = _manager(org=org_b)
    t_a, v_a = _published_template_version(actor=actor_a, org=org_a, code="TA")
    t_b, v_b = _published_template_version(actor=actor_b, org=org_b, code="TB")
    product_b = create_fg_product(actor=actor_b, organization=org_b, code="PB", name="PB")
    create_checklist_applicability_rule(
        actor=actor_a,
        organization=org_a,
        code="RA",
        name="A",
        checklist_template_id=t_a.id,
        checklist_version_id=v_a.id,
    )
    with pytest.raises(ValidationError):
        create_checklist_applicability_rule(
            actor=actor_a,
            organization=org_a,
            code="RX",
            name="Cross",
            checklist_template_id=t_b.id,
            checklist_version_id=v_b.id,
        )
    with pytest.raises(PermissionDenied):
        create_checklist_applicability_rule(
            actor=actor_a,
            organization=org_b,
            code="RY",
            name="Denied",
            checklist_template_id=t_b.id,
            checklist_version_id=v_b.id,
            product=product_b,
        )
    cross = resolve_checklist_applicability(organization_id=org_a.id, product_id=product_b.id)
    assert cross.outcome == ApplicabilityMatchOutcome.INVALID_INACTIVE_REFERENCE
    assert "product_cross_org" in cross.reasons
    result = resolve_checklist_applicability(organization_id=org_b.id)
    assert result.outcome == ApplicabilityMatchOutcome.NO_MATCH


@pytest.mark.django_db
def test_historical_task_pinning_survives_rule_change() -> None:
    org = make_org(code=f"O07C6{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    t1, v1 = _published_template_version(actor=actor, org=org, code="T6A")
    t2, v2 = _published_template_version(actor=actor, org=org, code="T6B")
    rule = create_checklist_applicability_rule(
        actor=actor,
        organization=org,
        code="RULE-6",
        name="Pin test",
        checklist_template_id=t1.id,
        checklist_version_id=v1.id,
    )
    task = create_batch_checklist_task(
        actor=actor,
        organization_id=org.id,
        checklist_template_id=t1.id,
        checklist_version_id=v1.id,
        batch_reference="BATCH-07C-1",
    )
    assert task.checklist_version_id == v1.id
    update_checklist_applicability_rule(
        actor=actor,
        rule_id=rule.id,
        checklist_template_id=t2.id,
        checklist_version_id=v2.id,
    )
    task.refresh_from_db()
    assert task.checklist_version_id == v1.id
    with pytest.raises(ValidationError):
        delete_checklist_applicability_rule(rule)
    deactivated = deactivate_checklist_applicability_rule(actor=actor, rule_id=rule.id)
    assert deactivated.is_active is False
    # idempotent second deactivate
    again = deactivate_checklist_applicability_rule(actor=actor, rule_id=rule.id)
    assert again.is_active is False
    with pytest.raises(ValidationError):
        deactivate_checklist_applicability_rule(actor=actor, rule_id=uuid.uuid4())
    assert SecurityAuditEvent.objects.filter(
        event_type="CHECKLIST_APPLICABILITY_RULE_UPDATED"
    ).exists()
    assert SecurityAuditEvent.objects.filter(
        event_type="CHECKLIST_APPLICABILITY_RULE_DEACTIVATED"
    ).exists()


@pytest.mark.django_db
def test_preview_permission_and_command() -> None:
    org = make_org(code=f"O07C7{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    template, version = _published_template_version(actor=actor, org=org, code="T7")
    create_checklist_applicability_rule(
        actor=actor,
        organization=org,
        code="RULE-7",
        name="Preview",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
    )
    preview = preview_checklist_applicability(actor=actor, organization_id=org.id)
    assert preview.outcome == ApplicabilityMatchOutcome.ONE_MATCH
    assert preview.to_preview_dict()["never_silent_first_match"] is True
    stranger = make_user(employee_code=f"STR{uuid.uuid4().hex[:5].upper()}")
    with pytest.raises(PermissionDenied):
        preview_checklist_applicability(actor=stranger, organization_id=org.id)

    call_command(
        "preview_checklist_applicability",
        organization=str(org.id),
        actor=str(actor.id),
    )


@pytest.mark.django_db
def test_lookup_performance_indexed_path() -> None:
    org = make_org(code=f"O07C8{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    template, version = _published_template_version(actor=actor, org=org, code="T8")
    products = [
        create_fg_product(actor=actor, organization=org, code=f"PX{i}", name=f"PX{i}")
        for i in range(40)
    ]
    for i, product in enumerate(products):
        create_checklist_applicability_rule(
            actor=actor,
            organization=org,
            code=f"R{i:03d}",
            name=f"Rule {i}",
            checklist_template_id=template.id,
            checklist_version_id=version.id,
            product=product,
        )
    target = products[-1]
    start = time.perf_counter()
    for _ in range(25):
        result = resolve_checklist_applicability(organization_id=org.id, product_id=target.id)
        assert result.outcome == ApplicabilityMatchOutcome.ONE_MATCH
    elapsed = time.perf_counter() - start
    assert elapsed < 2.0


@pytest.mark.django_db
def test_site_shift_process_and_preview_ui(client: Client) -> None:
    org = make_org(code=f"O07C9{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    site = make_site(org, code="S1")
    shift = _make_shift(org, code="SH1")
    template, version = _published_template_version(actor=actor, org=org, code="T9")
    create_checklist_applicability_rule(
        actor=actor,
        organization=org,
        code="RULE-9",
        name="Site shift",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        site=site,
        shift=shift,
        process_reference="PROC-A",
    )
    hit = resolve_checklist_applicability(
        organization_id=org.id,
        site_id=site.id,
        shift_id=shift.id,
        process_reference="PROC-A",
    )
    assert hit.outcome == ApplicabilityMatchOutcome.ONE_MATCH
    miss = resolve_checklist_applicability(
        organization_id=org.id,
        site_id=site.id,
        shift_id=shift.id,
        process_reference="OTHER",
    )
    assert miss.outcome == ApplicabilityMatchOutcome.NO_MATCH

    client.force_login(actor)
    response = client.get(reverse("scheduling:applicability_preview"))
    assert response.status_code == 200
    post = client.post(
        reverse("scheduling:applicability_preview"),
        {
            "organization": str(org.id),
            "site": str(site.id),
            "shift": str(shift.id),
            "process_reference": "PROC-A",
        },
    )
    assert post.status_code == 200
    assert b"ONE_MATCH" in post.content


@pytest.mark.django_db
def test_invalid_context_and_preview_dict() -> None:
    org = make_org(code=f"O07CX{uuid.uuid4().hex[:4].upper()}")
    org_b = make_org(code=f"O07CY{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    actor_b = _manager(org=org_b)
    product_b = create_fg_product(actor=actor_b, organization=org_b, code="PX", name="PX")
    bad = resolve_checklist_applicability(organization_id=org.id, product_id=product_b.id)
    assert bad.outcome == ApplicabilityMatchOutcome.INVALID_INACTIVE_REFERENCE
    assert "product_cross_org" in bad.reasons

    missing = resolve_checklist_applicability(organization_id=org.id, product_id=uuid.uuid4())
    assert missing.outcome == ApplicabilityMatchOutcome.INVALID_INACTIVE_REFERENCE

    template, version = _published_template_version(actor=actor, org=org, code="TX")
    rule = create_checklist_applicability_rule(
        actor=actor,
        organization=org,
        code="RULE-X",
        name="X",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
    )
    preview = preview_checklist_applicability(actor=actor, organization_id=org.id)
    payload = preview.to_preview_dict()
    assert payload["outcome"] == ApplicabilityMatchOutcome.ONE_MATCH
    assert payload["never_silent_first_match"] is True
    assert payload["selected"]["rule_id"] == str(rule.id)
    assert preview.checklist_template_id == template.id
    assert preview.checklist_version_id == version.id


@pytest.mark.django_db
def test_inactive_dimension_targets_and_update_fields() -> None:
    org = make_org(code=f"O07CZ{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    product = create_fg_product(actor=actor, organization=org, code="PZ", name="PZ")
    site = make_site(org, code="SZ")
    template, version = _published_template_version(actor=actor, org=org, code="TZ")
    rule = create_checklist_applicability_rule(
        actor=actor,
        organization=org,
        code="RULE-Z",
        name="Z",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        product=product,
        site=site,
    )
    product.is_active = False
    product.save(update_fields=["is_active", "updated_at"])
    result = resolve_checklist_applicability(
        organization_id=org.id, product_id=product.id, site_id=site.id
    )
    assert result.outcome == ApplicabilityMatchOutcome.INVALID_INACTIVE_REFERENCE

    product.is_active = True
    product.save(update_fields=["is_active", "updated_at"])
    template.is_active = False
    template.save(update_fields=["is_active", "updated_at"])
    result2 = resolve_checklist_applicability(
        organization_id=org.id, product_id=product.id, site_id=site.id
    )
    assert result2.outcome == ApplicabilityMatchOutcome.INVALID_INACTIVE_REFERENCE

    template.is_active = True
    template.save(update_fields=["is_active", "updated_at"])
    updated = update_checklist_applicability_rule(
        actor=actor,
        rule_id=rule.id,
        name="Z-updated",
        process_reference="LABEL-1",
        is_active=True,
        notes="note",
    )
    assert updated.name == "Z-updated"
    assert updated.process_reference == "LABEL-1"
    assert SecurityAuditEvent.objects.filter(
        event_type="CHECKLIST_APPLICABILITY_RULE_UPDATED"
    ).exists()

    # Required dimension with null context → no match
    miss = resolve_checklist_applicability(organization_id=org.id)
    assert miss.outcome == ApplicabilityMatchOutcome.NO_MATCH

    from apps.scheduling.applicability import deactivate_checklist_applicability_rule

    deactivated = deactivate_checklist_applicability_rule(actor=actor, rule_id=rule.id)
    assert deactivated.is_active is False
    again = deactivate_checklist_applicability_rule(actor=actor, rule_id=rule.id)
    assert again.is_active is False
    assert SecurityAuditEvent.objects.filter(
        event_type="CHECKLIST_APPLICABILITY_RULE_DEACTIVATED"
    ).exists()
    with pytest.raises(ValidationError):
        deactivate_checklist_applicability_rule(actor=actor, rule_id=uuid.uuid4())

    # Update remaining fields for coverage
    t2, v2 = _published_template_version(actor=actor, org=org, code="TZ2")
    rule2 = create_checklist_applicability_rule(
        actor=actor,
        organization=org,
        code="RULE-Z2",
        name="Z2",
        checklist_template_id=t2.id,
        checklist_version_id=v2.id,
    )
    update_checklist_applicability_rule(
        actor=actor,
        rule_id=rule2.id,
        code="RULE-Z2B",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        product=product,
        site=site,
        effective_from=datetime.date(2026, 1, 1),
        effective_to=datetime.date(2026, 12, 31),
    )
    rule2.refresh_from_db()
    assert rule2.code == "RULE-Z2B"
    assert rule2.checklist_template_id == template.id


@pytest.mark.django_db
def test_update_deactivate_and_clear_dates() -> None:
    org = make_org(code=f"O07CU{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    template, version = _published_template_version(actor=actor, org=org, code="TU")
    rule = create_checklist_applicability_rule(
        actor=actor,
        organization=org,
        code="RULE-U",
        name="Updatable",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        effective_from=datetime.date(2026, 1, 1),
        effective_to=datetime.date(2026, 12, 31),
    )
    updated = update_checklist_applicability_rule(
        actor=actor,
        rule_id=rule.id,
        name="Updated name",
        process_reference="LABEL-1",
        notes="n1",
        is_active=False,
        clear_effective_from=True,
        clear_effective_to=True,
    )
    assert updated.name == "Updated name"
    assert updated.process_reference == "LABEL-1"
    assert updated.is_active is False
    assert updated.effective_from is None
    assert updated.effective_to is None
    assert resolve_checklist_applicability(organization_id=org.id).outcome == (
        ApplicabilityMatchOutcome.NO_MATCH
    )


@pytest.mark.django_db
def test_duplicate_code_and_blank_validation() -> None:
    org = make_org(code=f"O07CD{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    template, version = _published_template_version(actor=actor, org=org, code="TD")
    create_checklist_applicability_rule(
        actor=actor,
        organization=org,
        code="DUP",
        name="One",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
    )
    with pytest.raises(ValidationError):
        create_checklist_applicability_rule(
            actor=actor,
            organization=org,
            code="DUP",
            name="Two",
            checklist_template_id=template.id,
            checklist_version_id=version.id,
        )
    with pytest.raises(ValidationError):
        create_checklist_applicability_rule(
            actor=actor,
            organization=org,
            code="  ",
            name="Blank",
            checklist_template_id=template.id,
            checklist_version_id=version.id,
        )


@pytest.mark.django_db
def test_inactive_dimension_targets_and_context() -> None:
    org = make_org(code=f"O07CI{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    product = create_fg_product(actor=actor, organization=org, code="PI", name="PI")
    site = make_site(org, code="SI")
    shift = _make_shift(org, code="SHI")
    template, version = _published_template_version(actor=actor, org=org, code="TI")
    rule = create_checklist_applicability_rule(
        actor=actor,
        organization=org,
        code="RULE-I",
        name="Inactive dims",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        product=product,
        site=site,
        shift=shift,
    )
    product.is_active = False
    product.save(update_fields=["is_active", "updated_at"])
    result = resolve_checklist_applicability(
        organization_id=org.id, product_id=product.id, site_id=site.id, shift_id=shift.id
    )
    # inactive product in context → INVALID; also rule target invalid if matched
    assert result.outcome == ApplicabilityMatchOutcome.INVALID_INACTIVE_REFERENCE

    missing_org = resolve_checklist_applicability(organization_id=uuid.uuid4())
    assert missing_org.outcome == ApplicabilityMatchOutcome.INVALID_INACTIVE_REFERENCE
    assert "organization_not_found" in missing_org.reasons

    # preview dict surface
    preview = preview_checklist_applicability(
        actor=actor, organization_id=org.id, site_id=site.id, shift_id=shift.id
    )
    d = preview.to_preview_dict()
    assert "dimensions_supported" in d
    assert d["never_silent_first_match"] is True
    assert rule.id  # keep reference for lint silence


@pytest.mark.django_db
def test_department_and_model_str_clean() -> None:
    from tests.factories import make_department

    org = make_org(code=f"O07CJ{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    site = make_site(org, code="SJ")
    dept = make_department(org, code="DJ", site=site)
    template, version = _published_template_version(actor=actor, org=org, code="TJ")
    rule = create_checklist_applicability_rule(
        actor=actor,
        organization=org,
        code="RULE-J",
        name="Dept",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        site=site,
        department=dept,
    )
    assert "RULE-J" in str(rule)
    hit = resolve_checklist_applicability(
        organization_id=org.id, site_id=site.id, department_id=dept.id
    )
    assert hit.outcome == ApplicabilityMatchOutcome.ONE_MATCH
    assert hit.checklist_template_id == template.id
    assert hit.checklist_version_id == version.id

    # unknown rule update
    with pytest.raises(ValidationError):
        update_checklist_applicability_rule(actor=actor, rule_id=uuid.uuid4(), name="x")


@pytest.mark.django_db
def test_auth_and_lookup_error_paths() -> None:
    org = make_org(code=f"O07CE{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    template, version = _published_template_version(actor=actor, org=org, code="TE")
    with pytest.raises(PermissionDenied):
        create_checklist_applicability_rule(
            actor=None,
            organization=org,
            code="X",
            name="X",
            checklist_template_id=template.id,
            checklist_version_id=version.id,
        )
    with pytest.raises(ValidationError):
        create_checklist_applicability_rule(
            actor=actor,
            organization=uuid.uuid4(),
            code="X2",
            name="X2",
            checklist_template_id=template.id,
            checklist_version_id=version.id,
        )
    with pytest.raises(ValidationError):
        create_checklist_applicability_rule(
            actor=actor,
            organization=org,
            code="X3",
            name="X3",
            checklist_template_id=uuid.uuid4(),
            checklist_version_id=version.id,
        )
    with pytest.raises(ValidationError):
        create_checklist_applicability_rule(
            actor=actor,
            organization=org,
            code="X4",
            name="X4",
            checklist_template_id=template.id,
            checklist_version_id=uuid.uuid4(),
        )
    with pytest.raises(ValidationError):
        create_checklist_applicability_rule(
            actor=actor,
            organization=org,
            code="X5",
            name="X5",
            checklist_template_id=template.id,
            checklist_version_id=version.id,
            product=uuid.uuid4(),
        )
    rule = create_checklist_applicability_rule(
        actor=actor,
        organization=org,
        code="OK-E",
        name="OK",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        effective_from=datetime.date(2026, 2, 1),
        effective_to=datetime.date(2026, 2, 28),
    )
    # before window / after window via resolve
    before = resolve_checklist_applicability(
        organization_id=org.id, as_of=datetime.date(2026, 1, 15)
    )
    assert before.outcome == ApplicabilityMatchOutcome.NO_MATCH
    after = resolve_checklist_applicability(
        organization_id=org.id, as_of=datetime.date(2026, 3, 15)
    )
    assert after.outcome == ApplicabilityMatchOutcome.NO_MATCH

    # update missing template/version
    with pytest.raises(ValidationError):
        update_checklist_applicability_rule(
            actor=actor, rule_id=rule.id, checklist_template_id=uuid.uuid4()
        )
    with pytest.raises(ValidationError):
        update_checklist_applicability_rule(
            actor=actor, rule_id=rule.id, checklist_version_id=uuid.uuid4()
        )
    # set dates via update
    update_checklist_applicability_rule(
        actor=actor,
        rule_id=rule.id,
        effective_from=datetime.date(2026, 1, 1),
        effective_to=datetime.date(2026, 12, 31),
        code="OK-E2",
        site=make_site(org, code="SE"),
        shift=_make_shift(org, code="SHE"),
        department=None,
        product=None,
    )
    # inactive organization
    org.is_active = False
    org.save(update_fields=["is_active", "updated_at"])
    inactive_org = resolve_checklist_applicability(organization_id=org.id)
    assert inactive_org.outcome == ApplicabilityMatchOutcome.INVALID_INACTIVE_REFERENCE
    assert "organization_inactive" in inactive_org.reasons


@pytest.mark.django_db
def test_inactive_template_and_cross_org_site_shift() -> None:
    org_a = make_org(code=f"O07CEA{uuid.uuid4().hex[:4].upper()}")
    org_b = make_org(code=f"O07CEB{uuid.uuid4().hex[:4].upper()}")
    actor_a = _manager(org=org_a)
    _actor_b = _manager(org=org_b)
    site_b = make_site(org_b, code="SB")
    shift_b = _make_shift(org_b, code="SHB")
    t_a, v_a = _published_template_version(actor=actor_a, org=org_a, code="TEA")
    rule = create_checklist_applicability_rule(
        actor=actor_a,
        organization=org_a,
        code="RULE-TEA",
        name="T",
        checklist_template_id=t_a.id,
        checklist_version_id=v_a.id,
    )
    # inactive template target
    t_a.is_active = False
    t_a.save(update_fields=["is_active", "updated_at"])
    bad = resolve_checklist_applicability(organization_id=org_a.id)
    assert bad.outcome == ApplicabilityMatchOutcome.INVALID_INACTIVE_REFERENCE
    assert rule.id in {r.id for r in bad.invalid_rules}

    # cross-org site/shift in context
    cross_site = resolve_checklist_applicability(organization_id=org_a.id, site_id=site_b.id)
    assert cross_site.outcome == ApplicabilityMatchOutcome.INVALID_INACTIVE_REFERENCE
    assert "site_cross_org" in cross_site.reasons
    cross_shift = resolve_checklist_applicability(organization_id=org_a.id, shift_id=shift_b.id)
    assert "shift_cross_org" in cross_shift.reasons
    missing_site = resolve_checklist_applicability(organization_id=org_a.id, site_id=uuid.uuid4())
    assert "site_not_found" in missing_site.reasons
    missing_shift = resolve_checklist_applicability(organization_id=org_a.id, shift_id=uuid.uuid4())
    assert "shift_not_found" in missing_shift.reasons
    missing_dept = resolve_checklist_applicability(
        organization_id=org_a.id, department_id=uuid.uuid4()
    )
    assert "department_not_found" in missing_dept.reasons
