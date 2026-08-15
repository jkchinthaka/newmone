"""Phase 06D — FG-QA-001 draft proposal loader tests."""

from __future__ import annotations

import csv
import uuid
from pathlib import Path

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import Client
from django.urls import reverse
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.checklists.models import (
    ChecklistItem,
    ChecklistResponseType,
    ChecklistTemplate,
    ChecklistVersion,
    ChecklistVersionStatus,
)
from apps.checklists.proposal_loader import (
    FG_QA_001_TEMPLATE_CODE,
    REQUIRED_CSV_HEADERS,
    default_proposal_csv_path,
    load_fg_qa_001_draft,
    parse_fg_qa_001_csv,
    proposal_fingerprint,
)
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
)
from apps.organizations.models import Organization
from apps.security_audit.models import SecurityAuditEvent


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
    user = make_user(employee_code=f"FGL{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"FGLM{suffix}",
        name=f"FG Loader Manager {suffix}",
        permission=_perm("manage_checklist"),
    )
    role.permissions.add(_perm("view_checklisttemplate"))
    grant_role(user, role, organization=org)
    return user


def _write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(REQUIRED_CSV_HEADERS))
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def _minimal_valid_rows() -> list[dict[str, str]]:
    return [
        {
            "template_code": "FG-QA-001",
            "template_name": "Finished Goods Quality Release & Dispatch Checklist",
            "template_revision": "Draft v0.1 — Proposed",
            "section_order": "1",
            "section_title": "Area & Hygiene",
            "item_order": "1",
            "item_code": "FGQA-01",
            "item_label": "FG handling/storage area is clean and sanitary",
            "required": "true",
            "response_type": "YES_NO_NA",
            "unit": "",
            "minimum": "",
            "maximum": "",
            "select_options": "",
            "notes": "PROPOSED",
        }
    ]


@pytest.mark.django_db
def test_parse_official_proposal_csv() -> None:
    definition = parse_fg_qa_001_csv()
    assert definition.template_code == FG_QA_001_TEMPLATE_CODE
    assert len(definition.section_titles) == 7
    assert len(definition.items) == 42
    assert proposal_fingerprint(definition)
    disposition = next(item for item in definition.items if item.code == "FGQA-41")
    assert disposition.response_type == ChecklistResponseType.SELECT
    assert [opt.value for opt in disposition.options] == ["RELEASE", "HOLD", "REJECT"]
    temps = [item for item in definition.items if item.code in {"FGQA-21", "FGQA-23", "FGQA-33"}]
    assert all(item.unit == "°C" for item in temps)
    assert all(
        item.minimum_value is None and item.maximum_value is None for item in definition.items
    )


@pytest.mark.django_db
def test_parser_rejects_invalid_csv(tmp_path: Path) -> None:
    bad = tmp_path / "bad.csv"
    _write_csv(bad, _minimal_valid_rows())
    with pytest.raises(ValidationError):
        parse_fg_qa_001_csv(bad)

    rows = _minimal_valid_rows()
    rows[0]["response_type"] = "PHOTO"
    _write_csv(bad, rows)
    with pytest.raises(ValidationError):
        parse_fg_qa_001_csv(bad)

    rows = _minimal_valid_rows()
    rows[0]["response_type"] = "NUMBER"
    rows[0]["minimum"] = "10"
    rows[0]["maximum"] = "1"
    _write_csv(bad, rows)
    with pytest.raises(ValidationError):
        parse_fg_qa_001_csv(bad)

    rows = _minimal_valid_rows()
    rows.append(dict(rows[0]))
    rows[1]["item_order"] = "1"
    rows[1]["item_code"] = "FGQA-02"
    _write_csv(bad, rows)
    with pytest.raises(ValidationError):
        parse_fg_qa_001_csv(bad)


@pytest.mark.django_db
def test_load_creates_draft_idempotent_and_never_publishes() -> None:
    org = make_org(code="ORG-FGL1")
    manager = _manager(org=org)
    result = load_fg_qa_001_draft(actor=manager, organization_id=org.id, dry_run=True)
    assert result.status == "dry_run"
    assert ChecklistTemplate.objects.filter(organization=org).count() == 0

    created = load_fg_qa_001_draft(actor=manager, organization_id=org.id)
    assert created.status == "created"
    assert created.version_id is not None
    template = ChecklistTemplate.objects.get(organization=org, code=FG_QA_001_TEMPLATE_CODE)
    assert template.product_id is None
    version = ChecklistVersion.objects.get(pk=created.version_id)
    assert version.status == ChecklistVersionStatus.DRAFT
    assert version.sections.count() == 7
    assert ChecklistItem.objects.filter(section__version=version).count() == 42
    item_41 = ChecklistItem.objects.get(section__version=version, code="FGQA-41")
    assert list(item_41.options.order_by("position").values_list("value", flat=True)) == [
        "RELEASE",
        "HOLD",
        "REJECT",
    ]
    assert SecurityAuditEvent.objects.filter(
        event_type="CHECKLIST_TEMPLATE_CREATED", actor=manager
    ).exists()
    assert not SecurityAuditEvent.objects.filter(event_type="CHECKLIST_VERSION_PUBLISHED").exists()

    noop = load_fg_qa_001_draft(actor=manager, organization_id=org.id)
    assert noop.status == "noop"
    assert ChecklistVersion.objects.filter(template=template).count() == 1


@pytest.mark.django_db
def test_divergent_draft_and_published_preserved() -> None:
    org = make_org(code="ORG-FGL2")
    manager = _manager(org=org)
    load_fg_qa_001_draft(actor=manager, organization_id=org.id)
    template = ChecklistTemplate.objects.get(organization=org, code=FG_QA_001_TEMPLATE_CODE)
    draft = ChecklistVersion.objects.get(template=template, status=ChecklistVersionStatus.DRAFT)
    item = ChecklistItem.objects.filter(section__version=draft).first()
    assert item is not None
    item.label = "Changed for divergence test"
    item.save(update_fields=["label"])
    with pytest.raises(ValidationError):
        load_fg_qa_001_draft(actor=manager, organization_id=org.id)

    other = create_checklist_template(
        actor=manager, organization=org, code="CHK-OTHER", name="Other"
    )
    other_version = create_checklist_version(actor=manager, template_id=other.id)
    section = add_checklist_section(actor=manager, version_id=other_version.id, title="S")
    add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="I1",
        label="Item",
        response_type="YES_NO",
    )
    published = publish_checklist_version(actor=manager, version_id=other_version.id)
    assert published.status == ChecklistVersionStatus.PUBLISHED
    published.refresh_from_db()
    assert published.status == ChecklistVersionStatus.PUBLISHED


@pytest.mark.django_db
def test_new_draft_after_no_draft_with_history() -> None:
    org = make_org(code="ORG-FGL3")
    manager = _manager(org=org)
    first = load_fg_qa_001_draft(actor=manager, organization_id=org.id)
    assert first.version_id is not None
    version = ChecklistVersion.objects.get(pk=first.version_id)
    publish_checklist_version(actor=manager, version_id=version.id)
    version.refresh_from_db()
    assert version.status == ChecklistVersionStatus.PUBLISHED

    second = load_fg_qa_001_draft(actor=manager, organization_id=org.id)
    assert second.status == "created"
    assert second.version_id is not None
    new_draft = ChecklistVersion.objects.get(pk=second.version_id)
    assert new_draft.status == ChecklistVersionStatus.DRAFT
    assert new_draft.version_number == 2
    version.refresh_from_db()
    assert version.status == ChecklistVersionStatus.PUBLISHED
    assert ChecklistVersion.objects.filter(template_id=first.template_id).count() == 2


@pytest.mark.django_db
def test_command_requires_org_actor_and_scopes() -> None:
    org_a = make_org(code="ORG-FGL4A")
    org_b = make_org(code="ORG-FGL4B")
    manager_a = _manager(org=org_a)
    with pytest.raises(CommandError):
        call_command(
            "load_fg_qa_001_draft",
            organization=str(uuid.uuid4()),
            actor=str(manager_a.id),
        )
    with pytest.raises(CommandError):
        call_command("load_fg_qa_001_draft", organization=str(org_a.id), actor=str(uuid.uuid4()))
    with pytest.raises(CommandError):
        call_command(
            "load_fg_qa_001_draft",
            organization=str(org_b.id),
            actor=str(manager_a.id),
        )
    call_command(
        "load_fg_qa_001_draft",
        organization=str(org_a.id),
        actor=str(manager_a.id),
        dry_run=True,
    )
    assert ChecklistTemplate.objects.filter(organization=org_a).count() == 0
    call_command(
        "load_fg_qa_001_draft",
        organization=str(org_a.id),
        actor=str(manager_a.id),
    )
    assert (
        ChecklistTemplate.objects.filter(organization=org_a, code=FG_QA_001_TEMPLATE_CODE).count()
        == 1
    )
    assert ChecklistTemplate.objects.filter(organization=org_b).count() == 0


@pytest.mark.django_db
def test_transaction_rollback_on_populate_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    org = make_org(code="ORG-FGL5")
    manager = _manager(org=org)
    from apps.checklists import services as checklist_services

    original = checklist_services.add_checklist_item
    calls = {"n": 0}

    def _boom(*args: object, **kwargs: object) -> ChecklistItem:
        calls["n"] += 1
        if calls["n"] >= 5:
            raise ValidationError({"item": "forced failure"})
        return original(*args, **kwargs)  # type: ignore[arg-type]

    monkeypatch.setattr("apps.checklists.proposal_loader.add_checklist_item", _boom)
    with pytest.raises(ValidationError):
        load_fg_qa_001_draft(actor=manager, organization_id=org.id)
    assert ChecklistTemplate.objects.filter(organization=org).count() == 0
    assert ChecklistVersion.objects.filter(template__organization=org).count() == 0


@pytest.mark.django_db
def test_review_ui_banner(client: Client) -> None:
    org = make_org(code="ORG-FGL6")
    manager = _manager(org=org)
    result = load_fg_qa_001_draft(actor=manager, organization_id=org.id)
    assert result.version_id is not None
    client.force_login(manager)
    body = client.get(
        reverse("checklists:version_detail", args=[result.version_id])
    ).content.decode()
    assert "NOT APPROVED FOR PRODUCTION USE" in body
    assert "Proposed draft" in body
    assert "Draft" in body
    assert "execution" in body.lower() or "recording" in body.lower()
    assert default_proposal_csv_path().name == "FG_QA_001_DRAFT_V0_1.csv"
