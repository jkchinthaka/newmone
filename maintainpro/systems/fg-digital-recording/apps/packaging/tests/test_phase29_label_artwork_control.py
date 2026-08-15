"""Phase 29 — packaging label / artwork verification foundation tests."""

from __future__ import annotations

import datetime
import uuid
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from tests.factories import (
    grant_role,
    make_org,
    make_role_with_permission,
    make_user,
)

from apps.accounts.models import User
from apps.checklists.models import ChecklistResponseType, ChecklistTemplate
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
)
from apps.master_data.models import FGProduct
from apps.organizations.models import Organization
from apps.packaging.models import (
    ArtworkVersion,
    ArtworkVersionStatus,
    PackagingArtwork,
    PackagingHistoryEntry,
)
from apps.packaging.selectors import artworks_for_organization
from apps.packaging.services import (
    approve_artwork_version,
    bind_checklist_item_to_artwork,
    create_artwork_version_draft,
    create_line_clearance_hook,
    create_packaging_artwork,
    record_artwork_verification,
    retire_artwork_version,
    update_artwork_version_draft,
)
from apps.packaging.snapshots import artwork_version_is_effective, snapshot_for_checklist_item
from apps.packaging.verification import assert_artwork_matches_expected
from apps.security_audit.models import SecurityAuditEvent


def _perm(model: type[Any], codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _product_master(org: Organization) -> User:
    user = make_user(employee_code=f"PM{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    role = make_role_with_permission(
        code=f"P{uuid.uuid4().hex[:6].upper()}",
        name="Product master packaging",
        permission=_perm(PackagingArtwork, "manage_packagingartwork"),
    )
    role.permissions.add(_perm(PackagingArtwork, "view_packaging"))
    role.permissions.add(_perm(ChecklistTemplate, "manage_checklist"))
    role.permissions.add(_perm(ChecklistTemplate, "view_checklisttemplate"))
    role.permissions.add(_perm(FGProduct, "manage_fgproduct"))
    grant_role(user, role, organization=org)
    return user


def _doc_control(org: Organization) -> User:
    user = make_user(employee_code=f"DC{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    role = make_role_with_permission(
        code=f"D{uuid.uuid4().hex[:6].upper()}",
        name="Document control packaging",
        permission=_perm(PackagingArtwork, "approve_packagingartwork"),
    )
    role.permissions.add(_perm(PackagingArtwork, "view_packaging"))
    grant_role(user, role, organization=org)
    return user


def _fg_product(org: Organization, actor: User | None = None) -> FGProduct:
    return FGProduct.objects.create(
        organization=org,
        code=f"FG-{uuid.uuid4().hex[:6].upper()}",
        name="FG shell product",
    )


def _published_item(*, actor: User, org: Organization) -> Any:
    template = create_checklist_template(
        actor=actor,
        organization=org,
        code=f"PKG-{uuid.uuid4().hex[:6].upper()}",
        name="Label check shell",
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="Label")
    item = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="ART",
        label="Verify artwork version",
        response_type=ChecklistResponseType.YES_NO,
        is_required=True,
    )
    publish_checklist_version(actor=actor, version_id=version.id)
    return item


@pytest.mark.django_db
def test_versioning_effective_dates_and_product_association() -> None:
    org = make_org(code=f"P{uuid.uuid4().hex[:6].upper()}")
    master = _product_master(org)
    doc = _doc_control(org)
    product = _fg_product(org, master)

    artwork = create_packaging_artwork(
        actor=master,
        organization=org,
        product=product,
        code=f"ART-{uuid.uuid4().hex[:5].upper()}",
        title="Primary label shell",
        pack_configuration_label="PACK-OPAQUE",
    )
    assert artwork.product_id == product.id
    v1 = artwork.versions.get(version_number=1)
    update_artwork_version_draft(
        actor=master,
        version=v1,
        date_code_format_reference="COMPANY-DATECODE-REF",
        batch_code_format_reference="COMPANY-BATCH-REF",
        evidence_object_key="private/artworks/shell.pdf",
        evidence_file_name="shell.pdf",
        effective_from=datetime.date(2026, 1, 1),
        effective_to=datetime.date(2026, 12, 31),
    )
    with pytest.raises(PermissionDenied):
        approve_artwork_version(actor=master, version=v1)
    approve_artwork_version(
        actor=doc,
        version=v1,
        approval_reference="DC-APPROVAL-OPAQUE",
    )
    v1.refresh_from_db()
    assert v1.status == ArtworkVersionStatus.APPROVED
    assert artwork_version_is_effective(v1, as_of=datetime.date(2026, 6, 1))
    assert not artwork_version_is_effective(v1, as_of=datetime.date(2025, 12, 31))
    assert artworks_for_organization(org.id).filter(pk=artwork.id).exists()
    assert PackagingHistoryEntry.objects.filter(event_type="ARTWORK_VERSION_APPROVED").exists()


@pytest.mark.django_db
def test_checklist_binding_historical_reference_and_wrong_artwork() -> None:
    org = make_org(code=f"P{uuid.uuid4().hex[:6].upper()}")
    master = _product_master(org)
    doc = _doc_control(org)
    product = _fg_product(org, master)
    artwork = create_packaging_artwork(
        actor=master,
        organization=org,
        product=product,
        code=f"ART-{uuid.uuid4().hex[:5].upper()}",
        title="Label A",
    )
    v1 = artwork.versions.get(version_number=1)
    approve_artwork_version(actor=doc, version=v1)
    v1.refresh_from_db()

    item = _published_item(actor=master, org=org)
    binding = bind_checklist_item_to_artwork(actor=master, checklist_item=item, artwork_version=v1)
    snap = snapshot_for_checklist_item(item.id)
    assert snap is not None
    assert snap["artwork_version_id"] == str(v1.id)
    assert binding.frozen_artwork_context["product_code"] == product.code

    other = create_packaging_artwork(
        actor=master,
        organization=org,
        product=product,
        code=f"ART-{uuid.uuid4().hex[:5].upper()}",
        title="Label B",
    )
    other_v = other.versions.get(version_number=1)
    approve_artwork_version(actor=doc, version=other_v)
    other_v.refresh_from_db()

    mismatch = assert_artwork_matches_expected(
        expected_version=v1,
        observed_artwork_version_id=other_v.id,
    )
    assert mismatch.matched is False
    assert mismatch.reason_code == "WRONG_ARTWORK_VERSION"

    record, decision = record_artwork_verification(
        actor=master,
        organization=org,
        artwork_version=v1,
        batch_reference="BATCH-OPAQUE",
        mfg_date=datetime.date(2026, 8, 1),
        exp_date=datetime.date(2026, 12, 1),  # recorded value — not calculated
        batch_code="BC-OPAQUE",
        observed_artwork_version_id=other_v.id,
    )
    assert decision["matched"] is False
    assert decision["reason_code"] == "WRONG_ARTWORK_VERSION"
    assert record.frozen_artwork_context["artwork_version_id"] == str(v1.id)
    assert record.date_code_format_reference_snapshot == v1.date_code_format_reference


@pytest.mark.django_db
def test_line_clearance_hook_and_immutable_approved() -> None:
    org = make_org(code=f"P{uuid.uuid4().hex[:6].upper()}")
    master = _product_master(org)
    doc = _doc_control(org)
    product = _fg_product(org, master)
    artwork = create_packaging_artwork(
        actor=master,
        organization=org,
        product=product,
        code=f"ART-{uuid.uuid4().hex[:5].upper()}",
        title="Hook artwork",
    )
    v1 = artwork.versions.get(version_number=1)
    approve_artwork_version(actor=doc, version=v1)
    v1.refresh_from_db()
    hook = create_line_clearance_hook(
        actor=master,
        organization=org,
        artwork_version=v1,
        code=f"LC-{uuid.uuid4().hex[:5].upper()}",
        title="Future changeover hook",
        line_code="LINE-OPAQUE",
    )
    assert hook.artwork_version_id == v1.id
    with pytest.raises(ValidationError):
        update_artwork_version_draft(actor=master, version=v1, notes="mutate")
    # Capture historical context while still approved, then retire.
    record, decision = record_artwork_verification(
        actor=master,
        organization=org,
        artwork_version=v1,
        batch_reference="HIST",
        observed_artwork_version_id=v1.id,
    )
    assert decision["matched"] is True
    frozen = dict(record.frozen_artwork_context)
    retire_artwork_version(actor=doc, version=v1)
    v1.refresh_from_db()
    assert v1.status == ArtworkVersionStatus.RETIRED
    record.refresh_from_db()
    assert record.artwork_version_id == v1.id
    assert record.frozen_artwork_context == frozen
    with pytest.raises(ValidationError):
        record_artwork_verification(
            actor=master,
            organization=org,
            artwork_version=v1,
            batch_reference="AFTER-RETIRE",
            observed_artwork_version_id=v1.id,
        )


@pytest.mark.django_db
def test_authorization_and_cross_org() -> None:
    org_a = make_org(code=f"A{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"B{uuid.uuid4().hex[:6].upper()}")
    master_a = _product_master(org_a)
    master_b = _product_master(org_b)
    doc_a = _doc_control(org_a)
    product_a = _fg_product(org_a, master_a)
    product_b = _fg_product(org_b, master_b)

    with pytest.raises(PermissionDenied):
        create_packaging_artwork(
            actor=master_a,
            organization=org_b,
            product=product_b,
            code="X",
            title="Nope",
        )

    artwork = create_packaging_artwork(
        actor=master_a,
        organization=org_a,
        product=product_a,
        code=f"ART-{uuid.uuid4().hex[:5].upper()}",
        title="A",
    )
    v1 = artwork.versions.get(version_number=1)
    approve_artwork_version(actor=doc_a, version=v1)
    v1.refresh_from_db()

    item_b = _published_item(actor=master_b, org=org_b)
    with pytest.raises(PermissionDenied):
        bind_checklist_item_to_artwork(actor=master_b, checklist_item=item_b, artwork_version=v1)

    # Product Master cannot approve; Document Control cannot create.
    with pytest.raises(PermissionDenied):
        create_packaging_artwork(
            actor=doc_a,
            organization=org_a,
            product=product_a,
            code="Z",
            title="Doc cannot create",
        )
    assert SecurityAuditEvent.objects.filter(event_type="PACKAGING_ARTWORK_CREATED").exists()


@pytest.mark.django_db
def test_new_version_draft_after_approve() -> None:
    org = make_org(code=f"P{uuid.uuid4().hex[:6].upper()}")
    master = _product_master(org)
    doc = _doc_control(org)
    product = _fg_product(org, master)
    artwork = create_packaging_artwork(
        actor=master,
        organization=org,
        product=product,
        code=f"ART-{uuid.uuid4().hex[:5].upper()}",
        title="Rev",
    )
    v1 = artwork.versions.get(version_number=1)
    approve_artwork_version(actor=doc, version=v1)
    v2 = create_artwork_version_draft(
        actor=master,
        artwork=artwork,
        change_summary="Company revision",
        date_code_format_reference="REF-V2",
    )
    assert v2.version_number == 2
    assert v2.status == ArtworkVersionStatus.DRAFT
    assert ArtworkVersion.objects.filter(artwork=artwork).count() == 2


@pytest.mark.django_db
def test_selectors_verification_edges_and_guards() -> None:
    from apps.packaging.admin import SoftRetentionAdmin
    from apps.packaging.selectors import (
        artworks_for_product,
        verifications_for_organization,
        versions_for_artwork,
    )
    from apps.packaging.verification import assert_artwork_matches_expected

    org = make_org(code=f"P{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"B{uuid.uuid4().hex[:6].upper()}")
    master = _product_master(org)
    doc = _doc_control(org)
    product = _fg_product(org, master)
    product_b = _fg_product(org_b)

    with pytest.raises(ValidationError):
        create_packaging_artwork(
            actor=master,
            organization=org,
            product=product_b,
            code="X",
            title="Cross product",
        )
    with pytest.raises(ValidationError):
        create_packaging_artwork(
            actor=master,
            organization=org,
            product=product,
            code="",
            title="",
        )

    artwork = create_packaging_artwork(
        actor=master,
        organization=org,
        product=product,
        code=f"ART-{uuid.uuid4().hex[:5].upper()}",
        title="Edges",
    )
    assert artworks_for_product(product.id).filter(pk=artwork.id).exists()
    v1 = artwork.versions.get(version_number=1)
    assert versions_for_artwork(artwork.id).count() == 1
    assert str(artwork)
    assert str(v1)

    decision_missing = assert_artwork_matches_expected(
        expected_version=v1, observed_artwork_version_id=None
    )
    assert decision_missing.reason_code == "ARTWORK_NOT_PROVIDED"
    decision_draft = assert_artwork_matches_expected(
        expected_version=v1, observed_artwork_version_id=v1.id
    )
    assert decision_draft.reason_code == "EXPECTED_NOT_APPROVED"

    with pytest.raises(ValidationError):
        update_artwork_version_draft(
            actor=master,
            version=v1,
            effective_from=datetime.date(2026, 12, 1),
            effective_to=datetime.date(2026, 1, 1),
        )
    update_artwork_version_draft(
        actor=master,
        version=v1,
        change_summary="ready",
        date_code_format_reference="FMT",
        batch_code_format_reference="BATCH-FMT",
        approval_reference="pre",
        evidence_object_key="k",
        evidence_file_name="f.pdf",
        evidence_content_type="application/pdf",
        notes="n",
        effective_from=datetime.date(2026, 6, 1),
        effective_to=datetime.date(2026, 6, 30),
    )
    approve_artwork_version(actor=doc, version=v1)
    v1.refresh_from_db()
    assert artwork_version_is_effective(v1, as_of=datetime.date(2026, 6, 15))
    assert not artwork_version_is_effective(v1, as_of=datetime.date(2026, 5, 1))
    assert not artwork_version_is_effective(v1, as_of=datetime.date(2026, 7, 1))
    decision_window = assert_artwork_matches_expected(
        expected_version=v1, observed_artwork_version_id=v1.id
    )
    # as_of today (2026-08-10) is outside Jun window
    assert decision_window.reason_code == "EXPECTED_NOT_EFFECTIVE"

    assert snapshot_for_checklist_item(uuid.uuid4()) is None
    item = _published_item(actor=master, org=org)
    bind_checklist_item_to_artwork(actor=master, checklist_item=item, artwork_version=v1)
    binding = item.artwork_binding
    binding.frozen_artwork_context = {}
    binding.save(update_fields=["frozen_artwork_context"])
    rebuilt = snapshot_for_checklist_item(item.id)
    assert rebuilt is not None
    assert rebuilt["artwork_version_id"] == str(v1.id)

    record, _ = record_artwork_verification(
        actor=master,
        organization=org,
        artwork_version=v1,
        batch_reference="EDGE",
        observed_artwork_version_id=v1.id,
        # verification allows recording even when not in effective window —
        # match decision carries EXPECTED_NOT_EFFECTIVE
    )
    assert verifications_for_organization(org.id).filter(pk=record.id).exists()
    assert str(record)

    with pytest.raises(ValidationError):
        create_line_clearance_hook(
            actor=master,
            organization=org,
            artwork_version=v1,
            code="",
        )
    retire_artwork_version(actor=doc, version=v1)
    v1.refresh_from_db()
    with pytest.raises(ValidationError):
        retire_artwork_version(actor=doc, version=v1)
    with pytest.raises(ValidationError):
        approve_artwork_version(actor=doc, version=v1)

    from django.contrib.admin.sites import AdminSite

    admin = SoftRetentionAdmin(PackagingArtwork, AdminSite())
    assert admin.has_delete_permission(request=None) is False  # type: ignore[arg-type]
    assert artwork.code in str(artwork)
