"""Phase 35 — Electronic batch quality dossier tests."""

from __future__ import annotations

import time
import uuid
from typing import Any

import pytest
from django.contrib import admin
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.test import override_settings
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.batch_dossier.admin import SoftRetentionAdmin
from apps.batch_dossier.models import (
    BatchDossierExportStatus,
    BatchDossierPolicy,
)
from apps.batch_dossier.policy import evaluate_batch_dossier_pdf_export
from apps.batch_dossier.selectors import (
    evidence_for_linked_targets,
    normalize_batch_reference,
    page_values,
)
from apps.batch_dossier.services import (
    assemble_batch_quality_dossier,
    prepare_batch_dossier_pdf_export,
    upsert_batch_dossier_policy,
)
from apps.capa.models import CorrectiveAction
from apps.capa.services import create_corrective_action
from apps.checklists.models import ChecklistResponseType, ChecklistTemplate
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
)
from apps.dispatch.models import DispatchQualityRecord
from apps.dispatch.services import create_dispatch_quality_record
from apps.evidence.models import EvidenceAttachment, EvidenceLinkedKind
from apps.evidence.services import upload_evidence_attachment
from apps.instruments.models import Equipment
from apps.integrations.models import IntegrationAttempt
from apps.ipqc.models import IpqcProcessCheckDefinition, IpqcTriggerKind
from apps.ipqc.services import (
    create_ipqc_process_check_definition,
    generate_ipqc_case,
    mark_ipqc_failure,
)
from apps.laboratory.models import LabSample
from apps.laboratory.services import register_lab_sample
from apps.nonconformance.models import HoldCase, NonConformanceRecord
from apps.nonconformance.services import create_hold_case, create_nonconformance
from apps.organizations.models import Organization
from apps.quality.models import QAReview, QAReviewDecision
from apps.quality.services import create_qa_review
from apps.recording.correction_services import start_checklist_correction
from apps.recording.models import ChecklistCorrectionStatus
from apps.recording.services import (
    save_checklist_draft_responses,
    start_checklist_recording,
    submit_checklist_record,
)
from apps.reviews.models import SupervisorReview, SupervisorReviewDecision
from apps.reviews.services import create_supervisor_review
from apps.scheduling.models import ChecklistTask
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


def _dossier_user(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"BD{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"BD{suffix}",
        name=f"Batch dossier {suffix}",
        permission=_perm(BatchDossierPolicy, "view_batchdossier"),
    )
    for model, code in [
        (BatchDossierPolicy, "export_batchdossier"),
        (BatchDossierPolicy, "manage_batchdossierpolicy"),
        (ChecklistTemplate, "manage_checklist"),
        (ChecklistTemplate, "view_checklisttemplate"),
        (ChecklistTask, "manage_checklisttask"),
        (ChecklistTask, "view_checklisttask"),
        (ChecklistTask, "record_checklisttask"),
        (SupervisorReview, "review_checklistsubmission"),
        (SupervisorReview, "view_supervisorreview"),
        (LabSample, "register_labsample"),
        (LabSample, "view_laboratory"),
        (NonConformanceRecord, "create_nonconformance"),
        (NonConformanceRecord, "manage_nonconformance"),
        (NonConformanceRecord, "view_nonconformancerecord"),
        (HoldCase, "create_holdcase"),
        (HoldCase, "manage_holdcase"),
        (HoldCase, "view_holdcase"),
        (CorrectiveAction, "create_capa"),
        (CorrectiveAction, "manage_capa"),
        (CorrectiveAction, "view_correctiveaction"),
        (IpqcProcessCheckDefinition, "manage_ipqc"),
        (IpqcProcessCheckDefinition, "view_ipqc"),
        (IpqcProcessCheckDefinition, "record_ipqc"),
        (SecurityAuditEvent, "view_securityauditevent"),
        (Equipment, "view_equipment"),
        (Equipment, "manage_equipment"),
        (IntegrationAttempt, "view_integrationboundary"),
        (QAReview, "qa_review_checklistsubmission"),
        (EvidenceAttachment, "view_evidenceattachment"),
        (EvidenceAttachment, "upload_evidenceattachment"),
        (DispatchQualityRecord, "create_dispatchqualityrecord"),
        (DispatchQualityRecord, "manage_dispatchqualityrecord"),
    ]:
        role.permissions.add(_perm(model, code))
    grant_role(user, role, organization=org)
    return user


def _published_fg_checklist(actor: User, org: Organization) -> Any:
    template = create_checklist_template(
        actor=actor,
        organization=org,
        code=f"FG-{uuid.uuid4().hex[:5].upper()}",
        name="FG batch checklist",
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="FG")
    item = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="OK",
        label="Acceptable?",
        response_type=ChecklistResponseType.YES_NO,
        is_required=True,
    )
    published = publish_checklist_version(actor=actor, version_id=version.id)
    return template, published, item


def _submit_task(actor: User, task: ChecklistTask, item_id: uuid.UUID) -> Any:
    record = start_checklist_recording(actor=actor, task_id=task.id)
    save_checklist_draft_responses(actor=actor, record_id=record.id, answers={(item_id, 1): "YES"})
    return submit_checklist_record(actor=actor, record_id=record.id)


@pytest.mark.django_db
def test_complete_batch_partial_no_lab_hold_capa_export_cross_org() -> None:
    org = make_org(code=f"BD{uuid.uuid4().hex[:5].upper()}")
    org_b = make_org(code=f"BX{uuid.uuid4().hex[:5].upper()}")
    actor = _dossier_user(org=org)
    outsider = _dossier_user(org=org_b)
    batch = f"BATCH-{uuid.uuid4().hex[:8].upper()}"

    template, version, item = _published_fg_checklist(actor, org)
    task = create_batch_checklist_task(
        actor=actor,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        batch_reference=batch,
    )
    submission = _submit_task(actor, task, item.id)
    create_supervisor_review(
        actor=actor,
        submission_id=submission.id,
        decision=SupervisorReviewDecision.APPROVED,
        review_note="Synthetic approve",
    )

    create_qa_review(
        actor=actor,
        submission_id=submission.id,
        decision=QAReviewDecision.RELEASE,
        review_note="Synthetic QA",
    )
    create_dispatch_quality_record(
        actor=actor,
        organization=org,
        code=f"DQ-{uuid.uuid4().hex[:5].upper()}",
        batch_reference=batch,
    )
    upload_evidence_attachment(
        actor=actor,
        linked_kind=EvidenceLinkedKind.CHECKLIST_SUBMISSION,
        linked_object_id=submission.id,
        file_name="batch-note.pdf",
        content_type="application/pdf",
        file_bytes=b"%PDF-1.4 synthetic",
        caption="Synthetic",
    )

    ipqc_def = create_ipqc_process_check_definition(
        actor=actor,
        organization=org,
        code=f"IP-{uuid.uuid4().hex[:5].upper()}",
        name="IPQC shell",
        checklist_template=template,
        checklist_version=version,
        trigger_kind=IpqcTriggerKind.BATCH,
    )
    ipqc_case, _ = generate_ipqc_case(
        actor=actor,
        definition=ipqc_def,
        batch_reference=batch,
        auto_generate_task=False,
    )
    mark_ipqc_failure(actor=actor, case=ipqc_case)

    ncr = create_nonconformance(
        actor=actor,
        organization=org,
        code=f"NCR-{uuid.uuid4().hex[:5].upper()}",
        title="Batch NCR shell",
        batch_reference=batch,
        checklist_task_id=task.id,
        checklist_submission_id=submission.id,
    )
    hold = create_hold_case(
        actor=actor,
        organization=org,
        code=f"HLD-{uuid.uuid4().hex[:5].upper()}",
        reason_reference="BATCH-HOLD",
        batch_reference=batch,
        nonconformance_id=ncr.id,
    )
    capa = create_corrective_action(
        actor=actor,
        organization=org,
        code=f"CAPA-{uuid.uuid4().hex[:5].upper()}",
        title="Batch CAPA shell",
        nonconformance_id=ncr.id,
    )
    assert hold.id and capa.id

    sample = register_lab_sample(
        actor=actor,
        organization=org,
        code=f"LAB-{uuid.uuid4().hex[:5].upper()}",
        batch_reference=batch,
        checklist_submission=submission,
    )
    dossier = assemble_batch_quality_dossier(actor=actor, organization=org, batch_reference=batch)
    payload = dossier.as_dict()
    assert payload["mutable_records_not_duplicated"] is True
    assert payload["identity"]["batch_reference"] == batch
    assert dossier.sections["fg_checklist_tasks"]["total_count"] >= 1
    assert dossier.sections["submissions"]["total_count"] >= 1
    assert dossier.sections["supervisor_reviews"]["total_count"] >= 1
    assert dossier.sections["qa_reviews"]["total_count"] >= 1
    assert dossier.sections["loading_dispatch"]["total_count"] >= 1
    assert dossier.sections["evidence"]["access"] == "ALLOWED"
    assert dossier.sections["ipqc"]["total_count"] >= 1
    assert dossier.sections["lab_results"]["total_count"] >= 1
    assert dossier.sections["ncr"]["total_count"] >= 1
    assert dossier.sections["hold"]["total_count"] >= 1
    assert dossier.sections["capa"]["total_count"] >= 1
    assert len(dossier.timeline) >= 4
    assert dossier.export_hook["allowed"] is False
    assert SecurityAuditEvent.objects.filter(event_type="BATCH_DOSSIER_VIEWED").exists()

    batch2 = f"BATCH-{uuid.uuid4().hex[:8].upper()}"
    create_batch_checklist_task(
        actor=actor,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        batch_reference=batch2,
    )
    partial = assemble_batch_quality_dossier(actor=actor, organization=org, batch_reference=batch2)
    assert partial.sections["lab_results"]["access"] in {"ALLOWED", "EMPTY"}
    assert partial.sections["lab_results"]["total_count"] == 0
    assert partial.sections["fg_checklist_tasks"]["total_count"] >= 1

    with pytest.raises(PermissionDenied):
        assemble_batch_quality_dossier(actor=outsider, organization=org, batch_reference=batch)

    export_req = prepare_batch_dossier_pdf_export(
        actor=actor, organization=org, batch_reference=batch
    )
    assert export_req.status == BatchDossierExportStatus.BLOCKED
    assert export_req.dossier_fingerprint

    upsert_batch_dossier_policy(
        actor=actor,
        organization=org,
        pdf_export_enabled=True,
        procedure_reference="PROC-TBC",
    )
    with override_settings(BATCH_DOSSIER_PDF_EXPORT_APPROVED=False):
        decision = evaluate_batch_dossier_pdf_export(organization_id=org.id)
        assert decision.allowed is False
        assert decision.reason_code == "SETTINGS_APPROVAL_MISSING"
    with override_settings(BATCH_DOSSIER_PDF_EXPORT_APPROVED=True):
        decision_on = evaluate_batch_dossier_pdf_export(organization_id=org.id)
        assert decision_on.allowed is True
        prepared = prepare_batch_dossier_pdf_export(
            actor=actor, organization=org, batch_reference=batch
        )
        assert prepared.status == BatchDossierExportStatus.PREPARED
        assert prepared.metadata.get("pdf_not_generated") is True

    with pytest.raises(ValidationError):
        assemble_batch_quality_dossier(actor=actor, organization=org, batch_reference="  ")

    assert sample.batch_reference == batch


@pytest.mark.django_db
def test_multiple_corrections_and_query_performance() -> None:
    org = make_org(code=f"BC{uuid.uuid4().hex[:5].upper()}")
    actor = _dossier_user(org=org)
    batch = f"BATCH-{uuid.uuid4().hex[:8].upper()}"
    template, version, item = _published_fg_checklist(actor, org)

    task1 = create_batch_checklist_task(
        actor=actor,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        batch_reference=batch,
    )
    sub1 = _submit_task(actor, task1, item.id)
    create_supervisor_review(
        actor=actor,
        submission_id=sub1.id,
        decision=SupervisorReviewDecision.RETURNED_FOR_CORRECTION,
        review_note="Synthetic return 1",
    )
    corr1 = start_checklist_correction(actor=actor, source_submission_id=sub1.id)
    assert corr1.status == ChecklistCorrectionStatus.DRAFT

    template2, version2, item2 = _published_fg_checklist(actor, org)
    task2 = create_batch_checklist_task(
        actor=actor,
        organization_id=org.id,
        checklist_template_id=template2.id,
        checklist_version_id=version2.id,
        batch_reference=batch,
    )
    sub2 = _submit_task(actor, task2, item2.id)
    create_supervisor_review(
        actor=actor,
        submission_id=sub2.id,
        decision=SupervisorReviewDecision.RETURNED_FOR_CORRECTION,
        review_note="Synthetic return 2",
    )
    corr2 = start_checklist_correction(actor=actor, source_submission_id=sub2.id)
    assert corr2.id != corr1.id

    dossier = assemble_batch_quality_dossier(actor=actor, organization=org, batch_reference=batch)
    assert dossier.sections["corrections"]["total_count"] >= 2
    assert dossier.sections["submissions"]["total_count"] >= 2

    for _ in range(10):
        tmpl, ver, _item = _published_fg_checklist(actor, org)
        create_batch_checklist_task(
            actor=actor,
            organization_id=org.id,
            checklist_template_id=tmpl.id,
            checklist_version_id=ver.id,
            batch_reference=batch,
        )
    started = time.perf_counter()
    snap = assemble_batch_quality_dossier(
        actor=actor,
        organization=org,
        batch_reference=batch,
        evidence_limit=20,
        audit_limit=20,
    )
    elapsed = time.perf_counter() - started
    assert snap.performance["unbounded_retrieval_avoided"] is True
    assert snap.sections["evidence"]["limit"] == 20
    assert elapsed < 8.0


@pytest.mark.django_db
def test_section_authz_denied_and_helpers() -> None:
    org = make_org(code=f"BZ{uuid.uuid4().hex[:5].upper()}")
    viewer = make_user(employee_code=f"VW{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    role = make_role_with_permission(
        code=f"VW{uuid.uuid4().hex[:6].upper()}",
        name="Dossier viewer only",
        permission=_perm(BatchDossierPolicy, "view_batchdossier"),
    )
    role.permissions.add(_perm(ChecklistTask, "view_checklisttask"))
    grant_role(viewer, role, organization=org)
    batch = f"BATCH-{uuid.uuid4().hex[:8].upper()}"

    # Actor with manage perms creates a task so section exists for viewer.
    actor = _dossier_user(org=org)
    template, version, item = _published_fg_checklist(actor, org)
    create_batch_checklist_task(
        actor=actor,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        batch_reference=batch,
    )
    dossier = assemble_batch_quality_dossier(actor=viewer, organization=org, batch_reference=batch)
    assert dossier.sections["fg_checklist_tasks"]["access"] in {"ALLOWED", "EMPTY"}
    assert dossier.sections["lab_results"]["access"] == "DENIED"
    assert dossier.sections["ncr"]["access"] == "DENIED"
    assert dossier.sections["evidence"]["access"] == "DENIED"

    assert normalize_batch_reference("  X  ") == "X"
    rows, total, more = page_values(
        ChecklistTask.objects.none(),
        limit=10,
        offset=0,
        serializer=lambda o: {"id": str(o.id)},
    )
    assert rows == () and total == 0 and more is False
    assert evidence_for_linked_targets(organization_id=org.id, targets=[]).count() == 0

    policy = BatchDossierPolicy(organization=org, updated_by=actor)
    assert "batch dossier policy" in str(policy)
    req = prepare_batch_dossier_pdf_export(actor=actor, organization=org, batch_reference=batch)
    assert "EBR-EXPORT" in str(req) or req.batch_reference == batch
    assert SoftRetentionAdmin(BatchDossierPolicy, admin.site).has_delete_permission(None) is False
    from apps.batch_dossier.assembly import DossierSectionPage

    page = DossierSectionPage(
        key="demo", access="EMPTY", items=(), total_count=0, limit=10, offset=0, has_more=False
    )
    assert page.as_dict()["access"] == "EMPTY"
    upsert_batch_dossier_policy(actor=actor, organization=org, pdf_export_enabled=True)
    with override_settings(BATCH_DOSSIER_PDF_EXPORT_APPROVED=True):
        assert evaluate_batch_dossier_pdf_export(organization_id=org.id).allowed is True
