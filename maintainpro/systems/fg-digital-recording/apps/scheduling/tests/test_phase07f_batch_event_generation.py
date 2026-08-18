"""Phase 07F — external batch event → ChecklistTask adapter boundary tests."""

from __future__ import annotations

import threading
import uuid
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.db import connection
from django.test import TransactionTestCase
from tests.factories import (
    grant_role,
    make_org,
    make_role_with_permission,
    make_shift,
    make_site,
    make_user,
)

from apps.accounts.models import User
from apps.checklists.models import ChecklistTemplate
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
)
from apps.master_data.models import FGProduct
from apps.master_data.services import create_fg_product
from apps.organizations.models import Organization
from apps.scheduling.applicability import create_checklist_applicability_rule
from apps.scheduling.batch_events import (
    ExternalBatchEventInput,
    process_external_batch_event,
    upsert_external_batch_mapping,
)
from apps.scheduling.integration import accept_external_batch_event
from apps.scheduling.models import (
    ChecklistApplicabilityRule,
    ChecklistTask,
    ExternalBatchEvent,
    ExternalBatchEventStatus,
    ExternalBatchMapping,
)
from apps.security_audit.models import SecurityAuditEvent

UTC = ZoneInfo("UTC")
SOURCE = "TEST_SOURCE"


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
    user = make_user(employee_code=f"E07F{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"R07F{suffix}",
        name=f"07F manager {suffix}",
        permission=_perm(ExternalBatchMapping, "manage_externalbatchmapping"),
    )
    role.permissions.add(_perm(ChecklistTask, "manage_checklisttask"))
    role.permissions.add(_perm(ChecklistTask, "view_checklisttask"))
    role.permissions.add(_perm(ChecklistApplicabilityRule, "manage_checklistapplicability"))
    role.permissions.add(_perm(ChecklistApplicabilityRule, "view_checklistapplicability"))
    role.permissions.add(_perm(ChecklistTemplate, "manage_checklist"))
    role.permissions.add(_perm(ChecklistTemplate, "view_checklisttemplate"))
    role.permissions.add(_perm(FGProduct, "manage_fgproduct"))
    role.permissions.add(_perm(FGProduct, "view_fgproduct"))
    grant_role(user, role, organization=org)
    return user


def _published(*, actor: User, org: Organization, code: str = "CHK-07F") -> Any:
    template = create_checklist_template(
        actor=actor, organization=org, code=code, name=f"{code} Name"
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="Section")
    add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="I1",
        label="Item",
        response_type="YES_NO",
    )
    published = publish_checklist_version(actor=actor, version_id=version.id)
    return template, published


def _wire_happy_path(*, actor: User, org: Organization, product: FGProduct | None = None) -> Any:
    template, published = _published(actor=actor, org=org)
    upsert_external_batch_mapping(
        actor=actor,
        source_system=SOURCE,
        mapping_kind="ORGANIZATION",
        external_key=f"EXT-{org.code}",
        organization_id=org.id,
    )
    if product is not None:
        upsert_external_batch_mapping(
            actor=actor,
            source_system=SOURCE,
            mapping_kind="PRODUCT",
            external_key=f"EXT-{product.code}",
            organization_id=org.id,
            product_id=product.id,
        )
    create_checklist_applicability_rule(
        actor=actor,
        organization=org,
        checklist_template_id=template.id,
        checklist_version_id=published.id,
        code=f"APL-{template.code}",
        name="07F rule",
        product=product,
    )
    return template, published


@pytest.mark.django_db
def test_happy_path_creates_task_via_map_apply_version() -> None:
    org = make_org(code="ORG07F1")
    actor = _manager(org=org)
    product = create_fg_product(actor=actor, organization=org, code="P07F1", name="Product 07F1")
    template, published = _wire_happy_path(actor=actor, org=org, product=product)

    receipt = accept_external_batch_event(
        actor=actor,
        source_system=SOURCE,
        source_event_id="evt-001",
        external_batch_id="BATCH-001",
        external_organization_key=f"EXT-{org.code}",
        external_product_key=f"EXT-{product.code}",
    )
    assert receipt.status == ExternalBatchEventStatus.COMPLETED
    assert receipt.checklist_task_id is not None
    task = receipt.checklist_task
    assert task is not None
    assert task.batch_reference == "BATCH-001"
    assert task.checklist_template_id == template.id
    assert task.checklist_version_id == published.id
    assert task.organization_id == org.id


@pytest.mark.django_db
def test_duplicate_event_is_idempotent() -> None:
    org = make_org(code="ORG07F2")
    actor = _manager(org=org)
    product = create_fg_product(actor=actor, organization=org, code="P07F2", name="Product 07F2")
    _wire_happy_path(actor=actor, org=org, product=product)

    first = accept_external_batch_event(
        actor=actor,
        source_system=SOURCE,
        source_event_id="evt-dup",
        external_batch_id="BATCH-DUP",
        external_organization_key=f"EXT-{org.code}",
        external_product_key=f"EXT-{product.code}",
    )
    second = accept_external_batch_event(
        actor=actor,
        source_system=SOURCE,
        source_event_id="evt-dup",
        external_batch_id="BATCH-DUP",
        external_organization_key=f"EXT-{org.code}",
        external_product_key=f"EXT-{product.code}",
    )
    assert first.status == ExternalBatchEventStatus.COMPLETED
    assert second.status == ExternalBatchEventStatus.COMPLETED
    assert first.checklist_task_id == second.checklist_task_id
    assert ChecklistTask.objects.filter(batch_reference="BATCH-DUP").count() == 1
    assert SecurityAuditEvent.objects.filter(event_type="EXTERNAL_BATCH_EVENT_DUPLICATE").exists()


@pytest.mark.django_db
def test_mapping_failure_creates_no_task() -> None:
    org = make_org(code="ORG07F3")
    actor = _manager(org=org)
    _wire_happy_path(actor=actor, org=org)

    receipt = accept_external_batch_event(
        actor=actor,
        source_system=SOURCE,
        source_event_id="evt-map-fail",
        external_batch_id="BATCH-MAP",
        external_organization_key="UNKNOWN-ORG",
    )
    assert receipt.status == ExternalBatchEventStatus.MAPPING_FAILED
    assert receipt.checklist_task_id is None
    assert ChecklistTask.objects.filter(batch_reference="BATCH-MAP").count() == 0
    assert receipt.failure_code == "ORG_MAPPING_NOT_FOUND"


@pytest.mark.django_db
def test_no_applicability_fails_without_task() -> None:
    org = make_org(code="ORG07F4")
    actor = _manager(org=org)
    upsert_external_batch_mapping(
        actor=actor,
        source_system=SOURCE,
        mapping_kind="ORGANIZATION",
        external_key=f"EXT-{org.code}",
        organization_id=org.id,
    )
    # Published template exists but no applicability rule.
    _published(actor=actor, org=org, code="CHK-NOAPL")

    receipt = accept_external_batch_event(
        actor=actor,
        source_system=SOURCE,
        source_event_id="evt-no-apl",
        external_batch_id="BATCH-NOAPL",
        external_organization_key=f"EXT-{org.code}",
    )
    assert receipt.status == ExternalBatchEventStatus.APPLICABILITY_FAILED
    assert receipt.checklist_task_id is None
    assert ChecklistTask.objects.filter(batch_reference="BATCH-NOAPL").count() == 0


@pytest.mark.django_db
def test_version_conflict_and_overlap_block() -> None:
    org = make_org(code="ORG07F5")
    actor = _manager(org=org)
    template, published = _wire_happy_path(actor=actor, org=org)

    # Second PUBLISHED version with unbounded effectivity → overlap at as_of.
    v2 = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=v2.id, title="S2")
    add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="I2",
        label="Item2",
        response_type="YES_NO",
    )
    publish_checklist_version(actor=actor, version_id=v2.id)
    assert published is not None

    receipt = accept_external_batch_event(
        actor=actor,
        source_system=SOURCE,
        source_event_id="evt-ver-overlap",
        external_batch_id="BATCH-VER",
        external_organization_key=f"EXT-{org.code}",
        as_of=datetime(2026, 1, 1, tzinfo=UTC),
    )
    assert receipt.status == ExternalBatchEventStatus.VERSION_FAILED
    assert receipt.checklist_task_id is None
    assert ChecklistTask.objects.filter(batch_reference="BATCH-VER").count() == 0


@pytest.mark.django_db
def test_retry_after_mapping_correction() -> None:
    org = make_org(code="ORG07F6")
    actor = _manager(org=org)
    product = create_fg_product(actor=actor, organization=org, code="P07F6", name="Product 07F6")
    template, published = _published(actor=actor, org=org, code="CHK-RETRY")
    create_checklist_applicability_rule(
        actor=actor,
        organization=org,
        checklist_template_id=template.id,
        checklist_version_id=published.id,
        code="APL-RETRY",
        name="retry rule",
        product=product,
    )

    failed = accept_external_batch_event(
        actor=actor,
        source_system=SOURCE,
        source_event_id="evt-retry",
        external_batch_id="BATCH-RETRY",
        external_organization_key=f"EXT-{org.code}",
        external_product_key=f"EXT-{product.code}",
    )
    assert failed.status == ExternalBatchEventStatus.MAPPING_FAILED
    assert failed.checklist_task_id is None

    upsert_external_batch_mapping(
        actor=actor,
        source_system=SOURCE,
        mapping_kind="ORGANIZATION",
        external_key=f"EXT-{org.code}",
        organization_id=org.id,
    )
    upsert_external_batch_mapping(
        actor=actor,
        source_system=SOURCE,
        mapping_kind="PRODUCT",
        external_key=f"EXT-{product.code}",
        organization_id=org.id,
        product_id=product.id,
    )

    ok = accept_external_batch_event(
        actor=actor,
        source_system=SOURCE,
        source_event_id="evt-retry",
        external_batch_id="BATCH-RETRY",
        external_organization_key=f"EXT-{org.code}",
        external_product_key=f"EXT-{product.code}",
    )
    assert ok.status == ExternalBatchEventStatus.COMPLETED
    assert ok.checklist_task_id is not None
    assert ok.attempt_count >= 2
    assert ChecklistTask.objects.filter(batch_reference="BATCH-RETRY").count() == 1


@pytest.mark.django_db
def test_cross_org_isolation() -> None:
    org_a = make_org(code="ORG07FA")
    org_b = make_org(code="ORG07FB")
    actor_a = _manager(org=org_a)
    actor_b = _manager(org=org_b)
    product_a = create_fg_product(actor=actor_a, organization=org_a, code="PA", name="Product A")
    product_b = create_fg_product(actor=actor_b, organization=org_b, code="PB", name="Product B")
    _wire_happy_path(actor=actor_a, org=org_a, product=product_a)
    _wire_happy_path(actor=actor_b, org=org_b, product=product_b)

    receipt_a = accept_external_batch_event(
        actor=actor_a,
        source_system=SOURCE,
        source_event_id="evt-xa",
        external_batch_id="BATCH-XA",
        external_organization_key=f"EXT-{org_a.code}",
        external_product_key=f"EXT-{product_a.code}",
    )
    receipt_b = accept_external_batch_event(
        actor=actor_b,
        source_system=SOURCE,
        source_event_id="evt-xb",
        external_batch_id="BATCH-XB",
        external_organization_key=f"EXT-{org_b.code}",
        external_product_key=f"EXT-{product_b.code}",
    )
    assert receipt_a.status == ExternalBatchEventStatus.COMPLETED
    assert receipt_b.status == ExternalBatchEventStatus.COMPLETED
    assert receipt_a.organization_id == org_a.id
    assert receipt_b.organization_id == org_b.id
    assert receipt_a.checklist_task is not None
    assert receipt_b.checklist_task is not None
    assert receipt_a.checklist_task.organization_id == org_a.id
    assert receipt_b.checklist_task.organization_id == org_b.id


@pytest.mark.django_db
def test_site_shift_mapping_and_opaque_line_key() -> None:
    org = make_org(code="ORG07F7")
    actor = _manager(org=org)
    site = make_site(org, code="SITE07F")
    shift = make_shift(org, code="SHIFT07F", site=site)
    template, published = _published(actor=actor, org=org, code="CHK-SS")
    upsert_external_batch_mapping(
        actor=actor,
        source_system=SOURCE,
        mapping_kind="ORGANIZATION",
        external_key=f"EXT-{org.code}",
        organization_id=org.id,
    )
    upsert_external_batch_mapping(
        actor=actor,
        source_system=SOURCE,
        mapping_kind="SITE",
        external_key="EXT-SITE",
        organization_id=org.id,
        site_id=site.id,
    )
    upsert_external_batch_mapping(
        actor=actor,
        source_system=SOURCE,
        mapping_kind="SHIFT",
        external_key="EXT-SHIFT",
        organization_id=org.id,
        shift_id=shift.id,
    )
    create_checklist_applicability_rule(
        actor=actor,
        organization=org,
        checklist_template_id=template.id,
        checklist_version_id=published.id,
        code="APL-SS",
        name="site shift rule",
        site=site,
        shift=shift,
    )
    receipt = accept_external_batch_event(
        actor=actor,
        source_system=SOURCE,
        source_event_id="evt-ss",
        external_batch_id="BATCH-SS",
        external_organization_key=f"EXT-{org.code}",
        external_site_key="EXT-SITE",
        external_shift_key="EXT-SHIFT",
        external_line_key="LINE-OPAQUE-ONLY",
    )
    assert receipt.status == ExternalBatchEventStatus.COMPLETED
    assert receipt.site_id == site.id
    assert receipt.shift_id == shift.id
    assert receipt.external_line_key == "LINE-OPAQUE-ONLY"


@pytest.mark.django_db
def test_audit_metadata_has_no_secret_fields() -> None:
    org = make_org(code="ORG07F8")
    actor = _manager(org=org)
    _wire_happy_path(actor=actor, org=org)
    accept_external_batch_event(
        actor=actor,
        source_system=SOURCE,
        source_event_id="evt-audit",
        external_batch_id="BATCH-AUDIT",
        external_organization_key=f"EXT-{org.code}",
    )
    events = SecurityAuditEvent.objects.filter(event_type__startswith="EXTERNAL_BATCH_EVENT_")
    assert events.exists()
    forbidden = {"password", "token", "secret", "authorization", "api_key", "credential"}
    for ev in events:
        blob = str(ev.metadata).lower()
        for word in forbidden:
            assert word not in blob


class ConcurrentBatchEventTests(TransactionTestCase):
    def test_concurrent_duplicate_events_single_task(self) -> None:
        org = make_org(code="ORG07FC")
        actor = _manager(org=org)
        product = create_fg_product(actor=actor, organization=org, code="PC", name="Product C")
        _wire_happy_path(actor=actor, org=org, product=product)

        results: list[ExternalBatchEvent] = []
        errors: list[BaseException] = []

        def _run() -> None:
            try:
                connection.close()
                receipt = process_external_batch_event(
                    actor=actor,
                    event=ExternalBatchEventInput(
                        source_system=SOURCE,
                        source_event_id="evt-conc",
                        external_batch_id="BATCH-CONC",
                        external_organization_key=f"EXT-{org.code}",
                        external_product_key=f"EXT-{product.code}",
                    ),
                )
                results.append(receipt)
            except BaseException as exc:  # noqa: BLE001
                errors.append(exc)

        threads = [threading.Thread(target=_run) for _ in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=30)

        assert not errors, errors
        assert len(results) == 2
        assert all(r.status == ExternalBatchEventStatus.COMPLETED for r in results)
        assert results[0].checklist_task_id == results[1].checklist_task_id
        assert ChecklistTask.objects.filter(batch_reference="BATCH-CONC").count() == 1
