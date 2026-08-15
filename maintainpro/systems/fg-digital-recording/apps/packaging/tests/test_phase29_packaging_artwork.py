"""Phase 29 — packaging artwork verification foundation tests."""

from __future__ import annotations

import datetime
import uuid
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.checklists.models import ChecklistResponseType, ChecklistTemplate
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
)
from apps.evidence.linking import resolve_linked_target
from apps.evidence.models import EvidenceLinkedKind
from apps.master_data.models import FGProduct
from apps.master_data.services import create_fg_product
from apps.organizations.models import Organization
from apps.packaging.models import ArtworkVersion, ArtworkVersionStatus, PackagingArtwork
from apps.packaging.selectors import (
    artworks_for_organization,
    artworks_for_product,
    versions_for_artwork,
)
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


def _manager(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"PM{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"PM{suffix}",
        name=f"Product master {suffix}",
        permission=_perm(PackagingArtwork, "manage_packagingartwork"),
    )
    role.permissions.add(_perm(PackagingArtwork, "view_packagingartwork"))
    role.permissions.add(_perm(FGProduct, "manage_fgproduct"))
    role.permissions.add(_perm(ChecklistTemplate, "manage_checklist"))
    role.permissions.add(_perm(ChecklistTemplate, "view_checklisttemplate"))
    grant_role(user, role, organization=org)
    return user


def _approver(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"DC{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"DC{suffix}",
        name=f"Doc control {suffix}",
        permission=_perm(PackagingArtwork, "approve_packagingartwork"),
    )
    role.permissions.add(_perm(PackagingArtwork, "view_packagingartwork"))
    grant_role(user, role, organization=org)
    return user


def _product(manager: User, org: Organization) -> FGProduct:
    return create_fg_product(
        actor=manager,
        organization=org,
        code=f"FG-{uuid.uuid4().hex[:6].upper()}",
        name="Packaging product shell",
    )


def _initial_draft(artwork: PackagingArtwork) -> ArtworkVersion:
    return artwork.versions.get(version_number=1)


@pytest.mark.django_db
def test_versioning_effective_dates_product_and_history() -> None:
    org = make_org(code=f"P{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    approver = _approver(org=org)
    product = _product(manager, org)
    artwork = create_packaging_artwork(
        actor=manager,
        organization=org,
        product=product,
        code=f"ART-{uuid.uuid4().hex[:5].upper()}",
        title="Front label shell",
        pack_configuration_label="PACK-OPAQUE",
    )
    assert artworks_for_product(product.id).filter(pk=artwork.id).exists()
    version = _initial_draft(artwork)
    update_artwork_version_draft(
        actor=manager,
        version=version,
        effective_from=datetime.date(2026, 1, 1),
        effective_to=datetime.date(2026, 12, 31),
        approval_reference="APR-OPAQUE-REF",
        date_code_format_reference="DATECODE-RULE-REF",
        evidence_object_key="private/artwork/v1.pdf",
        evidence_file_name="v1.pdf",
    )
    version.refresh_from_db()
    with pytest.raises(PermissionDenied):
        approve_artwork_version(actor=manager, version=version)
    approve_artwork_version(actor=approver, version=version)
    version.refresh_from_db()
    assert version.status == ArtworkVersionStatus.APPROVED
    assert artwork_version_is_effective(version, as_of=datetime.date(2026, 6, 1))
    assert not artwork_version_is_effective(version, as_of=datetime.date(2025, 12, 31))
    assert versions_for_artwork(artwork.id).count() == 1
    assert artworks_for_organization(org.id).filter(pk=artwork.id).exists()

    # Additional draft version for versioning coverage
    draft2 = create_artwork_version_draft(
        actor=manager,
        artwork=artwork,
        change_summary="Second draft shell",
        date_code_format_reference="DATECODE-RULE-REF-2",
    )
    assert draft2.version_number == 2
    assert draft2.status == ArtworkVersionStatus.DRAFT
    assert versions_for_artwork(artwork.id).count() == 2

    record, match = record_artwork_verification(
        actor=manager,
        organization=org,
        artwork_version=version,
        batch_reference="BATCH-OPAQUE",
        mfg_date=datetime.date(2026, 3, 1),
        exp_date=datetime.date(2026, 9, 1),  # recorded, not calculated
        batch_code="BC-OPAQUE",
    )
    frozen = dict(record.frozen_artwork_context)
    assert frozen["artwork_version_id"] == str(version.id)
    assert frozen["no_shelf_life_calculation"] is True
    assert match["matched"] is True
    assert record.date_code_format_reference_snapshot == "DATECODE-RULE-REF"

    artwork.title = "Renamed later"
    artwork.save(update_fields=["title", "updated_at"])
    record.refresh_from_db()
    assert record.frozen_artwork_context["artwork_title"] == frozen["artwork_title"]
    assert SecurityAuditEvent.objects.filter(
        event_type="PACKAGING_ARTWORK_VERSION_APPROVED"
    ).exists()


@pytest.mark.django_db
def test_checklist_binding_and_wrong_artwork() -> None:
    org = make_org(code=f"P{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    approver = _approver(org=org)
    product = _product(manager, org)
    artwork = create_packaging_artwork(
        actor=manager,
        organization=org,
        product=product,
        code=f"ART-{uuid.uuid4().hex[:5].upper()}",
        title="Label A",
    )
    other = create_packaging_artwork(
        actor=manager,
        organization=org,
        product=product,
        code=f"ART-{uuid.uuid4().hex[:5].upper()}",
        title="Label B",
    )
    v1 = _initial_draft(artwork)
    v2 = _initial_draft(other)
    approve_artwork_version(actor=approver, version=v1)
    approve_artwork_version(actor=approver, version=v2)
    v1.refresh_from_db()
    v2.refresh_from_db()

    template = create_checklist_template(
        actor=manager,
        organization=org,
        code=f"CL-{uuid.uuid4().hex[:5].upper()}",
        name="Label check shell",
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="S")
    item = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="LBL",
        label="Verify artwork",
        response_type=ChecklistResponseType.YES_NO,
        is_required=True,
    )
    binding = bind_checklist_item_to_artwork(actor=manager, checklist_item=item, artwork_version=v1)
    snap = snapshot_for_checklist_item(item.id)
    assert snap is not None
    assert snap["artwork_version_id"] == str(v1.id)
    assert binding.frozen_artwork_context["product_code"] == product.code

    wrong = assert_artwork_matches_expected(expected_version=v1, observed_artwork_version_id=v2.id)
    assert wrong.matched is False
    assert wrong.reason_code == "WRONG_ARTWORK_VERSION"
    record, decision = record_artwork_verification(
        actor=manager,
        organization=org,
        artwork_version=v1,
        observed_artwork_version_id=v2.id,
    )
    assert decision["matched"] is False
    assert decision["reason_code"] == "WRONG_ARTWORK_VERSION"
    assert record.frozen_artwork_context["verification"]["matched"] is False


@pytest.mark.django_db
def test_authorization_separation_and_cross_org() -> None:
    org_a = make_org(code=f"A{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"B{uuid.uuid4().hex[:6].upper()}")
    manager_a = _manager(org=org_a)
    manager_b = _manager(org=org_b)
    product_a = _product(manager_a, org_a)
    product_b = _product(manager_b, org_b)
    with pytest.raises(ValidationError):
        create_packaging_artwork(
            actor=manager_a,
            organization=org_a,
            product=product_b,
            code="XORG",
            title="Bad",
        )
    with pytest.raises(PermissionDenied):
        create_packaging_artwork(
            actor=manager_b,
            organization=org_a,
            product=product_a,
            code="XPERM",
            title="Bad",
        )


@pytest.mark.django_db
def test_line_clearance_hook_and_evidence_link() -> None:
    org = make_org(code=f"P{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    approver = _approver(org=org)
    product = _product(manager, org)
    artwork = create_packaging_artwork(
        actor=manager,
        organization=org,
        product=product,
        code=f"ART-{uuid.uuid4().hex[:5].upper()}",
        title="Hook art",
    )
    version = _initial_draft(artwork)
    approve_artwork_version(actor=approver, version=version)
    version.refresh_from_db()
    hook = create_line_clearance_hook(
        actor=manager,
        organization=org,
        code=f"LC-{uuid.uuid4().hex[:5].upper()}",
        artwork_version=version,
        line_code="LINE-OPAQUE",
        title="Future clearance hook",
    )
    assert hook.artwork_version_id == version.id
    target = resolve_linked_target(
        kind=EvidenceLinkedKind.PACKAGING_ARTWORK_VERSION, object_id=version.id
    )
    assert target.organization_id == org.id
    assert target.linkage_immutable is True


@pytest.mark.django_db
def test_effective_date_validation_on_draft() -> None:
    org = make_org(code=f"P{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    product = _product(manager, org)
    artwork = create_packaging_artwork(
        actor=manager,
        organization=org,
        product=product,
        code=f"ART-{uuid.uuid4().hex[:5].upper()}",
        title="Dates",
    )
    version = _initial_draft(artwork)
    with pytest.raises(ValidationError):
        update_artwork_version_draft(
            actor=manager,
            version=version,
            effective_from=datetime.date(2026, 2, 1),
            effective_to=datetime.date(2026, 1, 1),
        )
    version.refresh_from_db()
    update_artwork_version_draft(
        actor=manager,
        version=version,
        effective_from=datetime.date(2026, 1, 1),
        effective_to=datetime.date(2026, 12, 31),
    )
    version.refresh_from_db()
    approver = _approver(org=org)
    approve_artwork_version(actor=approver, version=version)
    version.refresh_from_db()
    retire_artwork_version(actor=approver, version=version)
    version.refresh_from_db()
    assert version.status == ArtworkVersionStatus.RETIRED
    not_approved = assert_artwork_matches_expected(
        expected_version=version, observed_artwork_version_id=version.id
    )
    assert not_approved.matched is False
    assert not_approved.reason_code == "EXPECTED_NOT_APPROVED"
    missing = assert_artwork_matches_expected(
        expected_version=version, observed_artwork_version_id=None
    )
    assert missing.reason_code == "ARTWORK_NOT_PROVIDED"
