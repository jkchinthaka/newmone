"""Synthetic DEMO / TEST dataset — not company master data.

This loader exists so a new engineer can exercise the core recording workflow
locally. Every code, name, limit, and role is synthetic. It must never be
treated as Nelna operational configuration.
"""

from __future__ import annotations

import datetime
from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from django.conf import settings
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction

from apps.access_control.services import assign_role, create_role
from apps.accounts.models import User
from apps.accounts.services import create_application_user
from apps.checklists.models import ChecklistResponseType, ChecklistTemplate
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
)
from apps.master_data.models import FGProduct
from apps.master_data.services import create_fg_product
from apps.organizations.models import Department, Organization, Shift, Site
from apps.organizations.services import create_department, create_organization, create_site
from apps.quality.models import QAReview
from apps.reviews.models import SupervisorReview
from apps.scheduling.models import ChecklistTask
from apps.scheduling.services import create_batch_checklist_task

DEMO_BANNER = "DEMO / TEST DATA — NOT COMPANY MASTER DATA"
DEMO_ORG_CODE = "DEMOORG1"
DEMO_PASSWORD = "Demo-Only-Pass-123!"  # noqa: S105 — local synthetic only
ALLOWED_DEMO_ENVIRONMENTS = frozenset({"local", "test", "development", "ci"})


@dataclass(frozen=True, slots=True)
class SyntheticDemoDataset:
    organization: Organization
    site: Site
    department: Department
    shift: Shift
    product: FGProduct
    template: ChecklistTemplate
    task: ChecklistTask
    admin: User
    recorder: User
    supervisor: User
    qa: User
    created: bool


def demo_environment_allowed() -> bool:
    label = str(getattr(settings, "ENVIRONMENT_LABEL", "") or "").strip().lower()
    if label in {"production", "prod", "uat", "staging"}:
        return False
    if label in ALLOWED_DEMO_ENVIRONMENTS:
        return True
    return bool(getattr(settings, "DEBUG", False))


def _perm(model: type[Any], codename: str) -> Permission:
    content_type = ContentType.objects.get_for_model(model)
    permission, _created = Permission.objects.get_or_create(
        content_type=content_type,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _grant(*, user: User, org: Organization, model: type[Any], codenames: tuple[str, ...]) -> None:
    suffix = uuid4().hex[:8].upper()
    first = _perm(model, codenames[0])
    role = create_role(
        code=f"DEMO{suffix}",
        name=f"DEMO role {suffix}",
        permissions=[first],
    )
    for extra in codenames[1:]:
        role.permissions.add(_perm(model, extra))
    assign_role(user=user, role=role, organization=org)


def _user(employee_code: str) -> User:
    existing = User.objects.filter(employee_code=employee_code).first()
    if isinstance(existing, User):
        return existing
    return create_application_user(
        employee_code=employee_code,
        password=DEMO_PASSWORD,
        is_staff=True,
    )


@transaction.atomic
def load_synthetic_demo_data(*, force: bool = False) -> SyntheticDemoDataset:
    """Create or return the synthetic demonstration dataset."""
    if not demo_environment_allowed():
        raise ValidationError(
            {
                "environment": (
                    "Synthetic demo data is blocked outside local/test "
                    "(ENVIRONMENT_LABEL/DEBUG gate)."
                )
            }
        )

    org_code = DEMO_ORG_CODE if not force else f"DEMO{uuid4().hex[:6].upper()}"
    existing = Organization.objects.filter(code=org_code).first()
    if existing is not None and not force:
        product = FGProduct.objects.filter(organization=existing, code="DEMOPROD1").get()
        template = ChecklistTemplate.objects.filter(organization=existing, code="DEMOCHK1").get()
        task = ChecklistTask.objects.filter(
            organization=existing,
            batch_reference="DEMO-BATCH-0001",
        ).get()
        from apps.recording.controlled_form_seed import seed_controlled_form_templates

        seed_controlled_form_templates(actor=_user("DEMO-ADMIN-001"), organization=existing)
        dataset = SyntheticDemoDataset(
            organization=existing,
            site=Site.objects.get(organization=existing, code="DEMOSITE1"),
            department=Department.objects.get(organization=existing, code="DEMODEPT1"),
            shift=Shift.objects.get(organization=existing, code="DEMOSHIFT1"),
            product=product,
            template=template,
            task=task,
            admin=_user("DEMO-ADMIN-001"),
            recorder=_user("DEMO-REC-001"),
            supervisor=_user("DEMO-SUP-001"),
            qa=_user("DEMO-QA-001"),
            created=False,
        )
        seed_demo_daily_workflow(dataset)
        seed_demo_quality_cases(dataset)
        return dataset

    admin = _user("DEMO-ADMIN-001")
    recorder = _user("DEMO-REC-001")
    supervisor = _user("DEMO-SUP-001")
    qa = _user("DEMO-QA-001")

    org = create_organization(
        code=org_code,
        name="DEMO Organization (not company master data)",
    )
    site = create_site(
        organization=org,
        code="DEMOSITE1",
        name="DEMO Site (synthetic)",
    )
    department = create_department(
        organization=org,
        code="DEMODEPT1",
        name="DEMO Department (synthetic)",
        site=site,
    )
    shift = Shift.objects.create(
        organization=org,
        site=site,
        department=department,
        code="DEMOSHIFT1",
        name="DEMO Shift (synthetic 06:00-14:00 — not a company shift)",
        start_time=datetime.time(6, 0),
        end_time=datetime.time(14, 0),
        effective_from=datetime.date(2026, 1, 1),
        is_active=True,
    )

    _grant(
        user=admin,
        org=org,
        model=ChecklistTemplate,
        codenames=("manage_checklist", "view_checklisttemplate"),
    )
    _grant(
        user=admin,
        org=org,
        model=FGProduct,
        codenames=("manage_fgproduct", "view_fgproduct"),
    )
    _grant(
        user=admin,
        org=org,
        model=ChecklistTask,
        codenames=("manage_checklisttask", "view_checklisttask"),
    )
    _grant(
        user=recorder,
        org=org,
        model=ChecklistTask,
        codenames=("record_checklisttask", "view_checklisttask"),
    )
    _grant(
        user=supervisor,
        org=org,
        model=SupervisorReview,
        codenames=("review_checklistsubmission", "view_supervisorreview"),
    )
    _grant(
        user=qa,
        org=org,
        model=QAReview,
        codenames=("qa_review_checklistsubmission", "view_qareview"),
    )

    product = create_fg_product(
        actor=admin,
        organization=org,
        code="DEMOPROD1",
        name="DEMO Finished Good (synthetic — not a company SKU)",
        description="Synthetic demonstration product. Not Nelna catalogue data.",
    )
    template = create_checklist_template(
        actor=admin,
        organization=org,
        code="DEMOCHK1",
        name="DEMO Checklist (synthetic — not FG-QA-001)",
    )
    version = create_checklist_version(actor=admin, template_id=template.id)
    section = add_checklist_section(
        actor=admin,
        version_id=version.id,
        title="DEMO Section A (synthetic)",
    )
    add_checklist_item(
        actor=admin,
        section_id=section.id,
        code="DEMOYN1",
        label="DEMO visual check passed? (synthetic item — not a company criterion)",
        response_type=ChecklistResponseType.YES_NO,
        is_required=True,
    )
    add_checklist_item(
        actor=admin,
        section_id=section.id,
        code="DEMONOTE1",
        label="DEMO optional note (synthetic)",
        response_type=ChecklistResponseType.TEXT,
        is_required=False,
    )
    published = publish_checklist_version(actor=admin, version_id=version.id)
    from apps.recording.controlled_form_seed import seed_controlled_form_templates

    seed_controlled_form_templates(actor=admin, organization=org)
    task = create_batch_checklist_task(
        actor=admin,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=published.id,
        batch_reference="DEMO-BATCH-0001",
    )
    dataset = SyntheticDemoDataset(
        organization=org,
        site=site,
        department=department,
        shift=shift,
        product=product,
        template=template,
        task=task,
        admin=admin,
        recorder=recorder,
        supervisor=supervisor,
        qa=qa,
        created=True,
    )
    seed_demo_daily_workflow(dataset)
    seed_demo_quality_cases(dataset)
    return dataset


def _demo_answers_for_task(task: ChecklistTask) -> dict[tuple[object, int], str]:
    from apps.checklists.models import ChecklistItem, ChecklistResponseType

    answers: dict[tuple[object, int], str] = {}
    for item in ChecklistItem.objects.filter(section__version=task.checklist_version):
        if item.response_type == ChecklistResponseType.YES_NO:
            answers[(item.id, 1)] = "YES"
        elif item.response_type == ChecklistResponseType.NUMBER:
            answers[(item.id, 1)] = "-16.5"
        elif item.code == "VEHICLE":
            answers[(item.id, 1)] = "DEMO-TRUCK-001"
        elif item.code == "GIN":
            answers[(item.id, 1)] = "DEMO-GIN-001"
        elif item.code == "TIME":
            answers[(item.id, 1)] = "08:00"
        elif item.code in {"CORR", "CA", "REMARKS"}:
            answers[(item.id, 1)] = "DEMO placeholder — not a company reading"
    return answers


def seed_demo_daily_workflow(dataset: SyntheticDemoDataset) -> None:
    """Idempotent DEMO submitted records for all four SOURCE RECEIVED forms."""
    if not demo_environment_allowed():
        return
    from apps.recording.models import ChecklistRecordStatus
    from apps.recording.services import (
        save_checklist_draft_responses,
        start_checklist_recording,
        submit_checklist_record,
    )
    from apps.scheduling.services import ensure_controlled_daily_task

    record_date = datetime.date(2026, 8, 1)
    specs: tuple[tuple[str, str], ...] = (
        ("NMS/PPU/CL/24", ""),
        ("NMS/PPU/CL/39", "CR1"),
        ("NMS/PPU/CL/30", ""),
        ("NMS/PPU/CL/18", ""),
    )
    for form_code, room_key in specs:
        try:
            task = ensure_controlled_daily_task(
                actor=dataset.recorder,
                organization_id=dataset.organization.id,
                form_code=form_code,
                record_date=record_date,
                room_key=room_key,
            )
        except ValidationError:
            continue
        record = start_checklist_recording(actor=dataset.recorder, task_id=task.id)
        if record.status == ChecklistRecordStatus.SUBMITTED:
            continue
        save_checklist_draft_responses(
            actor=dataset.recorder,
            record_id=record.id,
            answers=_demo_answers_for_task(task),
        )
        submit_checklist_record(actor=dataset.recorder, record_id=record.id)


def seed_demo_quality_cases(dataset: SyntheticDemoDataset) -> None:
    """Idempotent DEMO NCR-adjacent quality cases for local workspace queues."""
    if not demo_environment_allowed():
        return
    from apps.access_control.services import organization_ids_with_permission
    from apps.customer_complaints.models import CustomerComplaintCase
    from apps.customer_complaints.services import VIEW as VIEW_COMPLAINT
    from apps.customer_complaints.services import create_complaint_case
    from apps.dispatch.models import DispatchQualityRecord
    from apps.dispatch.services import VIEW_DISPATCH, create_dispatch_quality_record
    from apps.quality_quarantine.models import QualityQuarantineRecord, QuarantineSource
    from apps.quality_quarantine.services import VIEW as VIEW_QUARANTINE
    from apps.quality_quarantine.services import open_quarantine_record

    org = dataset.organization
    admin = dataset.admin
    if org.id not in organization_ids_with_permission(admin, VIEW_DISPATCH):
        _grant(
            user=admin,
            org=org,
            model=DispatchQualityRecord,
            codenames=("view_dispatchqualityrecord", "create_dispatchqualityrecord"),
        )
    if org.id not in organization_ids_with_permission(admin, VIEW_COMPLAINT):
        _grant(
            user=admin,
            org=org,
            model=CustomerComplaintCase,
            codenames=("view_customercomplaint", "create_customercomplaint"),
        )
    if org.id not in organization_ids_with_permission(admin, VIEW_QUARANTINE):
        _grant(
            user=admin,
            org=org,
            model=QualityQuarantineRecord,
            codenames=("view_qualityquarantine", "manage_qualityquarantine"),
        )
    if not DispatchQualityRecord.objects.filter(organization=org, code="DEMO-DSP-001").exists():
        try:
            create_dispatch_quality_record(
                actor=admin,
                organization=org,
                code="DEMO-DSP-001",
                vehicle_reference="DEMO-TRUCK-001",
                batch_reference="DEMO-BATCH-0001",
                notes="DEMO dispatch quality placeholder — not a company load.",
            )
        except (ValidationError, PermissionDenied):
            pass
    if not CustomerComplaintCase.objects.filter(organization=org, code="DEMO-CMP-001").exists():
        try:
            create_complaint_case(
                actor=admin,
                organization=org,
                code="DEMO-CMP-001",
                description="DEMO complaint placeholder — not a customer record.",
                product_reference="DEMOPROD1",
                batch_reference="DEMO-BATCH-0001",
            )
        except (ValidationError, PermissionDenied):
            pass
    if not QualityQuarantineRecord.objects.filter(organization=org, code="DEMO-QRT-001").exists():
        try:
            open_quarantine_record(
                actor=admin,
                organization=org,
                code="DEMO-QRT-001",
                batch_reference="DEMO-BATCH-0001",
                source=QuarantineSource.MANUAL,
                source_reference="DEMO",
                reason_reference="DEMO quality-state placeholder — not an ERP hold.",
            )
        except (ValidationError, PermissionDenied):
            pass
