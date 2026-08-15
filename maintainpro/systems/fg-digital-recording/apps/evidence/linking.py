"""Resolve allowlisted evidence link targets and organization scope."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError

from apps.access_control.services import Scope, user_has_permission
from apps.accounts.models import User
from apps.capa.models import CorrectiveAction
from apps.changeover.models import ChangeoverRecord, LineClearanceRecord
from apps.compliance_mapping.models import ComplianceControlMapping
from apps.customer_complaints.models import CustomerComplaintCase
from apps.document_control.models import DocumentVersionStatus, QualityDocumentVersion
from apps.environmental.models import MonitoringReading
from apps.evidence.models import EvidenceLinkedKind
from apps.instruments.models import CalibrationRecord
from apps.ipqc.models import IpqcInspectionCase
from apps.iqc.models import IqcInspectionCase
from apps.laboratory.models import LabExternalCertificate, LabSample
from apps.nonconformance.models import NonConformanceRecord
from apps.packaging.models import ArtworkVersion
from apps.product_returns.models import ReturnQualityRecord
from apps.quality.models import QAReview
from apps.quality_audits.models import QualityAuditFinding, QualityAuditStatus
from apps.recall.models import RecallCase
from apps.receiving.models import ReceiptQualityRecord
from apps.recording.models import (
    ChecklistRecordStatus,
    ChecklistResponse,
    ChecklistSubmission,
)
from apps.reviews.models import SupervisorReview
from apps.sanitation.models import SanitationProgram
from apps.scheduling.services import RECORD_CHECKLIST_TASK

UPLOAD_EVIDENCE = "evidence.upload_evidenceattachment"
VIEW_EVIDENCE = "evidence.view_evidenceattachment"
RETIRE_EVIDENCE = "evidence.retire_evidenceattachment"

# Parent-domain permissions used with evidence upload/view (deny by default).
REVIEW_SUBMISSION = "reviews.review_checklistsubmission"
QA_REVIEW_SUBMISSION = "quality.qa_review_checklistsubmission"
MANAGE_NCR = "nonconformance.manage_nonconformance"
MANAGE_CAPA = "capa.manage_capa"
VIEW_LAB = "laboratory.view_laboratory"
REGISTER_SAMPLE = "laboratory.register_labsample"
ENTER_RESULT = "laboratory.enter_labresult"
MANAGE_LAB = "laboratory.manage_laboratory"
MANAGE_EQUIPMENT = "instruments.manage_equipment"
VIEW_EQUIPMENT = "instruments.view_equipment"
VIEW_SANITATION = "sanitation.view_sanitation"
MANAGE_SANITATION = "sanitation.manage_sanitationprogram"
VIEW_ENVIRONMENTAL = "environmental.view_environmental"
RECORD_ENVIRONMENTAL = "environmental.record_environmentalreading"
MANAGE_ENVIRONMENTAL = "environmental.manage_environmental"
VIEW_PACKAGING = "packaging.view_packaging"
MANAGE_PACKAGING = "packaging.manage_packagingartwork"
APPROVE_PACKAGING = "packaging.approve_packagingartwork"
VIEW_CHANGEOVER = "changeover.view_changeover"
MANAGE_CHANGEOVER = "changeover.manage_changeover"
VERIFY_CHANGEOVER = "changeover.verify_changeover"
VIEW_RECEIVING = "receiving.view_receiptquality"
MANAGE_RECEIVING = "receiving.manage_receiptquality"
DISPOSITION_RECEIVING = "receiving.disposition_receiptquality"
VIEW_IQC = "iqc.view_iqc"
MANAGE_IQC = "iqc.manage_iqc"
DISPOSITION_IQC = "iqc.disposition_iqc"
VIEW_IPQC = "ipqc.view_ipqc"
MANAGE_IPQC = "ipqc.manage_ipqc"
RECORD_IPQC = "ipqc.record_ipqc"
ESCALATE_IPQC = "ipqc.escalate_ipqc"
VIEW_RECALL = "recall.view_recall"
MANAGE_RECALL = "recall.manage_recallcase"
INITIATE_RECALL = "recall.initiate_recall"
CLOSE_RECALL = "recall.close_recall"
VIEW_COMPLAINT = "customer_complaints.view_customercomplaint"
MANAGE_COMPLAINT = "customer_complaints.manage_customercomplaint"
CREATE_COMPLAINT = "customer_complaints.create_customercomplaint"
CLOSE_COMPLAINT = "customer_complaints.close_customercomplaint"
VIEW_RETURN = "product_returns.view_returnquality"
MANAGE_RETURN = "product_returns.manage_returnquality"
INSPECT_RETURN = "product_returns.inspect_returnquality"
DISPOSITION_RETURN = "product_returns.disposition_returnquality"
VIEW_EFFECTIVE_DOCUMENT = "document_control.view_effectivedocument"
EDIT_DOCUMENT = "document_control.edit_qualitydocument"
APPROVE_DOCUMENT = "document_control.approve_qualitydocument"
PUBLISH_DOCUMENT = "document_control.publish_qualitydocument"
VIEW_QUALITY_AUDIT = "quality_audits.view_qualityaudit"
EXECUTE_QUALITY_AUDIT = "quality_audits.execute_qualityaudit"
CLOSE_QUALITY_AUDIT = "quality_audits.close_qualityaudit"
VIEW_COMPLIANCE_MAPPING = "compliance_mapping.view_compliancemapping"
MANAGE_COMPLIANCE_CONTROL = "compliance_mapping.manage_compliancecontrol"


@dataclass(frozen=True, slots=True)
class LinkedTarget:
    kind: str
    object_id: uuid.UUID
    organization_id: uuid.UUID
    linkage_immutable: bool
    obj: Any


def _scope(organization_id: uuid.UUID) -> Scope:
    return Scope(organization_id=organization_id)


def resolve_linked_target(*, kind: str, object_id: uuid.UUID) -> LinkedTarget:
    if kind not in EvidenceLinkedKind.values:
        raise ValidationError({"linked_kind": "Linked object kind is not architecture-approved."})

    if kind == EvidenceLinkedKind.CHECKLIST_RESPONSE:
        response = (
            ChecklistResponse.objects.select_related(
                "checklist_record",
                "checklist_record__organization",
            )
            .filter(pk=object_id)
            .first()
        )
        if response is None:
            raise ValidationError({"linked_object_id": "Checklist response not found."})
        record = response.checklist_record
        immutable = record.status != ChecklistRecordStatus.DRAFT
        return LinkedTarget(
            kind=kind,
            object_id=response.id,
            organization_id=record.organization_id,
            linkage_immutable=immutable,
            obj=response,
        )

    if kind == EvidenceLinkedKind.CHECKLIST_SUBMISSION:
        submission = (
            ChecklistSubmission.objects.select_related(
                "checklist_record",
                "checklist_record__organization",
            )
            .filter(pk=object_id)
            .first()
        )
        if submission is None:
            raise ValidationError({"linked_object_id": "Checklist submission not found."})
        return LinkedTarget(
            kind=kind,
            object_id=submission.id,
            organization_id=submission.checklist_record.organization_id,
            linkage_immutable=True,
            obj=submission,
        )

    if kind == EvidenceLinkedKind.SUPERVISOR_REVIEW:
        review = (
            SupervisorReview.objects.select_related(
                "organization",
                "checklist_submission",
                "checklist_submission__checklist_record",
            )
            .filter(pk=object_id)
            .first()
        )
        if review is None:
            raise ValidationError({"linked_object_id": "Supervisor review not found."})
        return LinkedTarget(
            kind=kind,
            object_id=review.id,
            organization_id=review.organization_id,
            linkage_immutable=True,
            obj=review,
        )

    if kind == EvidenceLinkedKind.QA_REVIEW:
        qa_review = (
            QAReview.objects.select_related(
                "organization",
                "checklist_submission",
                "checklist_submission__checklist_record",
            )
            .filter(pk=object_id)
            .first()
        )
        if qa_review is None:
            raise ValidationError({"linked_object_id": "QA review not found."})
        return LinkedTarget(
            kind=kind,
            object_id=qa_review.id,
            organization_id=qa_review.organization_id,
            linkage_immutable=True,
            obj=qa_review,
        )

    if kind == EvidenceLinkedKind.NONCONFORMANCE:
        ncr = NonConformanceRecord.objects.filter(pk=object_id).first()
        if ncr is None:
            raise ValidationError({"linked_object_id": "Nonconformance record not found."})
        return LinkedTarget(
            kind=kind,
            object_id=ncr.id,
            organization_id=ncr.organization_id,
            linkage_immutable=True,
            obj=ncr,
        )

    if kind == EvidenceLinkedKind.CAPA:
        capa = CorrectiveAction.objects.filter(pk=object_id).first()
        if capa is None:
            raise ValidationError({"linked_object_id": "CAPA record not found."})
        return LinkedTarget(
            kind=kind,
            object_id=capa.id,
            organization_id=capa.organization_id,
            linkage_immutable=True,
            obj=capa,
        )

    if kind == EvidenceLinkedKind.LAB_SAMPLE:
        sample = LabSample.objects.filter(pk=object_id).first()
        if sample is None:
            raise ValidationError({"linked_object_id": "Laboratory sample not found."})
        return LinkedTarget(
            kind=kind,
            object_id=sample.id,
            organization_id=sample.organization_id,
            linkage_immutable=sample.status in {"COMPLETED", "CANCELLED"},
            obj=sample,
        )

    if kind == EvidenceLinkedKind.LAB_EXTERNAL_CERTIFICATE:
        cert = LabExternalCertificate.objects.filter(pk=object_id).first()
        if cert is None:
            raise ValidationError(
                {"linked_object_id": "Laboratory external certificate not found."}
            )
        return LinkedTarget(
            kind=kind,
            object_id=cert.id,
            organization_id=cert.organization_id,
            linkage_immutable=True,
            obj=cert,
        )

    if kind == EvidenceLinkedKind.CALIBRATION_CERTIFICATE:
        calib = CalibrationRecord.objects.select_related("equipment").filter(pk=object_id).first()
        if calib is None:
            raise ValidationError({"linked_object_id": "Calibration record not found."})
        return LinkedTarget(
            kind=kind,
            object_id=calib.id,
            organization_id=calib.equipment.organization_id,
            linkage_immutable=True,
            obj=calib,
        )

    if kind == EvidenceLinkedKind.SANITATION_PROGRAM:
        program = SanitationProgram.objects.filter(pk=object_id).first()
        if program is None:
            raise ValidationError({"linked_object_id": "Sanitation program not found."})
        return LinkedTarget(
            kind=kind,
            object_id=program.id,
            organization_id=program.organization_id,
            linkage_immutable=True,
            obj=program,
        )

    if kind == EvidenceLinkedKind.MONITORING_READING:
        reading = MonitoringReading.objects.filter(pk=object_id).first()
        if reading is None:
            raise ValidationError(
                {"linked_object_id": "Environmental monitoring reading not found."}
            )
        return LinkedTarget(
            kind=kind,
            object_id=reading.id,
            organization_id=reading.organization_id,
            linkage_immutable=True,
            obj=reading,
        )

    if kind == EvidenceLinkedKind.PACKAGING_ARTWORK_VERSION:
        version = ArtworkVersion.objects.select_related("artwork").filter(pk=object_id).first()
        if version is None:
            raise ValidationError({"linked_object_id": "Packaging artwork version not found."})
        return LinkedTarget(
            kind=kind,
            object_id=version.id,
            organization_id=version.artwork.organization_id,
            linkage_immutable=version.is_immutable,
            obj=version,
        )

    if kind == EvidenceLinkedKind.CHANGEOVER_RECORD:
        changeover = ChangeoverRecord.objects.filter(pk=object_id).first()
        if changeover is None:
            raise ValidationError({"linked_object_id": "Changeover record not found."})
        return LinkedTarget(
            kind=kind,
            object_id=changeover.id,
            organization_id=changeover.organization_id,
            linkage_immutable=changeover.status in {"RECORDED", "VERIFIED", "VOIDED"},
            obj=changeover,
        )

    if kind == EvidenceLinkedKind.LINE_CLEARANCE_RECORD:
        clearance = LineClearanceRecord.objects.filter(pk=object_id).first()
        if clearance is None:
            raise ValidationError({"linked_object_id": "Line clearance record not found."})
        return LinkedTarget(
            kind=kind,
            object_id=clearance.id,
            organization_id=clearance.organization_id,
            linkage_immutable=clearance.status in {"COMPLETED", "VOIDED"},
            obj=clearance,
        )

    if kind == EvidenceLinkedKind.RECEIPT_QUALITY_RECORD:
        receipt = ReceiptQualityRecord.objects.filter(pk=object_id).first()
        if receipt is None:
            raise ValidationError({"linked_object_id": "Receipt quality record not found."})
        return LinkedTarget(
            kind=kind,
            object_id=receipt.id,
            organization_id=receipt.organization_id,
            linkage_immutable=receipt.quality_state != "PENDING_INSPECTION",
            obj=receipt,
        )

    if kind == EvidenceLinkedKind.IQC_INSPECTION_CASE:
        case = IqcInspectionCase.objects.filter(pk=object_id).first()
        if case is None:
            raise ValidationError({"linked_object_id": "IQC inspection case not found."})
        return LinkedTarget(
            kind=kind,
            object_id=case.id,
            organization_id=case.organization_id,
            linkage_immutable=case.workflow_status in {"DISPOSITIONED", "CLOSED"},
            obj=case,
        )

    if kind == EvidenceLinkedKind.IPQC_INSPECTION_CASE:
        ipqc_case = IpqcInspectionCase.objects.filter(pk=object_id).first()
        if ipqc_case is None:
            raise ValidationError({"linked_object_id": "IPQC inspection case not found."})
        return LinkedTarget(
            kind=kind,
            object_id=ipqc_case.id,
            organization_id=ipqc_case.organization_id,
            linkage_immutable=ipqc_case.workflow_status in {"COMPLETED", "CLOSED"},
            obj=ipqc_case,
        )

    if kind == EvidenceLinkedKind.RECALL_CASE:
        recall_case = RecallCase.objects.filter(pk=object_id).first()
        if recall_case is None:
            raise ValidationError({"linked_object_id": "Recall case not found."})
        return LinkedTarget(
            kind=kind,
            object_id=recall_case.id,
            organization_id=recall_case.organization_id,
            linkage_immutable=recall_case.status in {"CLOSED", "CANCELLED"},
            obj=recall_case,
        )

    if kind == EvidenceLinkedKind.CUSTOMER_COMPLAINT_CASE:
        complaint = CustomerComplaintCase.objects.filter(pk=object_id).first()
        if complaint is None:
            raise ValidationError({"linked_object_id": "Customer complaint case not found."})
        return LinkedTarget(
            kind=kind,
            object_id=complaint.id,
            organization_id=complaint.organization_id,
            linkage_immutable=complaint.status in {"CLOSED", "CANCELLED"},
            obj=complaint,
        )

    if kind == EvidenceLinkedKind.RETURN_QUALITY_RECORD:
        return_record = ReturnQualityRecord.objects.filter(pk=object_id).first()
        if return_record is None:
            raise ValidationError({"linked_object_id": "Return quality record not found."})
        return LinkedTarget(
            kind=kind,
            object_id=return_record.id,
            organization_id=return_record.organization_id,
            linkage_immutable=return_record.status in {"DISPOSITIONED", "CANCELLED"},
            obj=return_record,
        )

    if kind == EvidenceLinkedKind.QUALITY_DOCUMENT_VERSION:
        document_version = (
            QualityDocumentVersion.objects.select_related("document").filter(pk=object_id).first()
        )
        if document_version is None:
            raise ValidationError({"linked_object_id": "Quality document version not found."})
        return LinkedTarget(
            kind=kind,
            object_id=document_version.id,
            organization_id=document_version.document.organization_id,
            linkage_immutable=document_version.status
            in {
                DocumentVersionStatus.APPROVED,
                DocumentVersionStatus.EFFECTIVE,
                DocumentVersionStatus.RETIRED,
            },
            obj=document_version,
        )

    if kind == EvidenceLinkedKind.QUALITY_AUDIT_FINDING:
        finding = QualityAuditFinding.objects.select_related("audit").filter(pk=object_id).first()
        if finding is None:
            raise ValidationError({"linked_object_id": "Quality audit finding not found."})
        return LinkedTarget(
            kind=kind,
            object_id=finding.id,
            organization_id=finding.audit.organization_id,
            linkage_immutable=finding.audit.status
            in {QualityAuditStatus.CLOSED, QualityAuditStatus.CANCELLED},
            obj=finding,
        )

    if kind == EvidenceLinkedKind.COMPLIANCE_CONTROL_MAPPING:
        mapping = (
            ComplianceControlMapping.objects.select_related("edition").filter(pk=object_id).first()
        )
        if mapping is None:
            raise ValidationError({"linked_object_id": "Compliance control mapping not found."})
        return LinkedTarget(
            kind=kind,
            object_id=mapping.id,
            organization_id=mapping.organization_id,
            linkage_immutable=mapping.edition.is_locked,
            obj=mapping,
        )

    raise ValidationError({"linked_kind": "Unsupported linked kind."})


def assert_can_upload_to_target(*, actor: User, target: LinkedTarget) -> None:
    if not user_has_permission(actor, UPLOAD_EVIDENCE, scope=_scope(target.organization_id)):
        raise PermissionDenied("Permission denied.")
    _assert_parent_access(actor=actor, target=target, for_mutate=True)


def assert_can_view_target(*, actor: User, target: LinkedTarget) -> None:
    if not user_has_permission(actor, VIEW_EVIDENCE, scope=_scope(target.organization_id)):
        # Fall back: upload grant implies view of own org evidence for Phase 11
        # only when parent access also holds — still require explicit view OR upload.
        if not user_has_permission(actor, UPLOAD_EVIDENCE, scope=_scope(target.organization_id)):
            raise PermissionDenied("Permission denied.")
    _assert_parent_access(actor=actor, target=target, for_mutate=False)


def assert_can_retire(*, actor: User, target: LinkedTarget) -> None:
    """
    Soft-retire requires explicit retire permission plus parent view access.

    Does not use for_mutate=True so immutable linkages can still be soft-retired
    under controlled policy (reason required in the retire service).
    """
    if not user_has_permission(actor, RETIRE_EVIDENCE, scope=_scope(target.organization_id)):
        raise PermissionDenied("Permission denied.")
    _assert_parent_access(actor=actor, target=target, for_mutate=False)


def _assert_parent_access(*, actor: User, target: LinkedTarget, for_mutate: bool) -> None:
    org_scope = _scope(target.organization_id)
    kind = target.kind

    if kind == EvidenceLinkedKind.CHECKLIST_RESPONSE:
        if not user_has_permission(actor, RECORD_CHECKLIST_TASK, scope=org_scope):
            raise PermissionDenied("Permission denied.")
        response: ChecklistResponse = target.obj
        if for_mutate and response.checklist_record.status != ChecklistRecordStatus.DRAFT:
            raise ValidationError(
                {
                    "linked_object_id": (
                        "Evidence cannot be attached/changed on a non-draft checklist response "
                        "without controlled retirement policy."
                    )
                }
            )
        return

    if kind == EvidenceLinkedKind.CHECKLIST_SUBMISSION:
        # Submission evidence: recorder, supervisor, or QA in org may view;
        # upload requires upload permission (already checked) + any of these.
        allowed = (
            user_has_permission(actor, RECORD_CHECKLIST_TASK, scope=org_scope)
            or user_has_permission(actor, REVIEW_SUBMISSION, scope=org_scope)
            or user_has_permission(actor, QA_REVIEW_SUBMISSION, scope=org_scope)
        )
        if not allowed:
            raise PermissionDenied("Permission denied.")
        return

    if kind == EvidenceLinkedKind.SUPERVISOR_REVIEW:
        if not user_has_permission(actor, REVIEW_SUBMISSION, scope=org_scope):
            raise PermissionDenied("Permission denied.")
        return

    if kind == EvidenceLinkedKind.QA_REVIEW:
        if not user_has_permission(actor, QA_REVIEW_SUBMISSION, scope=org_scope):
            raise PermissionDenied("Permission denied.")
        return

    if kind == EvidenceLinkedKind.NONCONFORMANCE:
        if not user_has_permission(actor, MANAGE_NCR, scope=org_scope):
            raise PermissionDenied("Permission denied.")
        return

    if kind == EvidenceLinkedKind.CAPA:
        if not user_has_permission(actor, MANAGE_CAPA, scope=org_scope):
            raise PermissionDenied("Permission denied.")
        return

    if kind == EvidenceLinkedKind.LAB_SAMPLE:
        allowed = (
            user_has_permission(actor, VIEW_LAB, scope=org_scope)
            or user_has_permission(actor, REGISTER_SAMPLE, scope=org_scope)
            or user_has_permission(actor, MANAGE_LAB, scope=org_scope)
        )
        if not allowed:
            raise PermissionDenied("Permission denied.")
        if for_mutate and target.linkage_immutable:
            raise ValidationError(
                {
                    "linked_object_id": (
                        "Evidence cannot be attached to a completed/cancelled lab sample "
                        "without controlled retirement policy."
                    )
                }
            )
        return

    if kind == EvidenceLinkedKind.LAB_EXTERNAL_CERTIFICATE:
        allowed = (
            user_has_permission(actor, VIEW_LAB, scope=org_scope)
            or user_has_permission(actor, ENTER_RESULT, scope=org_scope)
            or user_has_permission(actor, MANAGE_LAB, scope=org_scope)
            or user_has_permission(actor, REGISTER_SAMPLE, scope=org_scope)
        )
        if not allowed:
            raise PermissionDenied("Permission denied.")
        return

    if kind == EvidenceLinkedKind.CALIBRATION_CERTIFICATE:
        allowed = user_has_permission(
            actor, VIEW_EQUIPMENT, scope=org_scope
        ) or user_has_permission(actor, MANAGE_EQUIPMENT, scope=org_scope)
        if not allowed:
            raise PermissionDenied("Permission denied.")
        return

    if kind == EvidenceLinkedKind.SANITATION_PROGRAM:
        allowed = user_has_permission(
            actor, VIEW_SANITATION, scope=org_scope
        ) or user_has_permission(actor, MANAGE_SANITATION, scope=org_scope)
        if not allowed:
            raise PermissionDenied("Permission denied.")
        return

    if kind == EvidenceLinkedKind.MONITORING_READING:
        allowed = (
            user_has_permission(actor, VIEW_ENVIRONMENTAL, scope=org_scope)
            or user_has_permission(actor, RECORD_ENVIRONMENTAL, scope=org_scope)
            or user_has_permission(actor, MANAGE_ENVIRONMENTAL, scope=org_scope)
        )
        if not allowed:
            raise PermissionDenied("Permission denied.")
        return

    if kind == EvidenceLinkedKind.PACKAGING_ARTWORK_VERSION:
        allowed = (
            user_has_permission(actor, VIEW_PACKAGING, scope=org_scope)
            or user_has_permission(actor, MANAGE_PACKAGING, scope=org_scope)
            or user_has_permission(actor, APPROVE_PACKAGING, scope=org_scope)
        )
        if not allowed:
            raise PermissionDenied("Permission denied.")
        if for_mutate and target.obj.is_immutable:
            raise ValidationError(
                {
                    "linked_object_id": (
                        "Evidence cannot be attached/changed on an approved/retired "
                        "artwork version without controlled retirement policy."
                    )
                }
            )
        return

    if kind in {
        EvidenceLinkedKind.CHANGEOVER_RECORD,
        EvidenceLinkedKind.LINE_CLEARANCE_RECORD,
    }:
        allowed = (
            user_has_permission(actor, VIEW_CHANGEOVER, scope=org_scope)
            or user_has_permission(actor, MANAGE_CHANGEOVER, scope=org_scope)
            or user_has_permission(actor, VERIFY_CHANGEOVER, scope=org_scope)
        )
        if not allowed:
            raise PermissionDenied("Permission denied.")
        return

    if kind == EvidenceLinkedKind.RECEIPT_QUALITY_RECORD:
        allowed = (
            user_has_permission(actor, VIEW_RECEIVING, scope=org_scope)
            or user_has_permission(actor, MANAGE_RECEIVING, scope=org_scope)
            or user_has_permission(actor, DISPOSITION_RECEIVING, scope=org_scope)
        )
        if not allowed:
            raise PermissionDenied("Permission denied.")
        return

    if kind == EvidenceLinkedKind.IQC_INSPECTION_CASE:
        allowed = (
            user_has_permission(actor, VIEW_IQC, scope=org_scope)
            or user_has_permission(actor, MANAGE_IQC, scope=org_scope)
            or user_has_permission(actor, DISPOSITION_IQC, scope=org_scope)
        )
        if not allowed:
            raise PermissionDenied("Permission denied.")
        return

    if kind == EvidenceLinkedKind.IPQC_INSPECTION_CASE:
        allowed = (
            user_has_permission(actor, VIEW_IPQC, scope=org_scope)
            or user_has_permission(actor, MANAGE_IPQC, scope=org_scope)
            or user_has_permission(actor, RECORD_IPQC, scope=org_scope)
            or user_has_permission(actor, ESCALATE_IPQC, scope=org_scope)
        )
        if not allowed:
            raise PermissionDenied("Permission denied.")
        return

    if kind == EvidenceLinkedKind.RECALL_CASE:
        allowed = (
            user_has_permission(actor, VIEW_RECALL, scope=org_scope)
            or user_has_permission(actor, MANAGE_RECALL, scope=org_scope)
            or user_has_permission(actor, INITIATE_RECALL, scope=org_scope)
            or user_has_permission(actor, CLOSE_RECALL, scope=org_scope)
        )
        if not allowed:
            raise PermissionDenied("Permission denied.")
        return

    if kind == EvidenceLinkedKind.CUSTOMER_COMPLAINT_CASE:
        allowed = (
            user_has_permission(actor, VIEW_COMPLAINT, scope=org_scope)
            or user_has_permission(actor, MANAGE_COMPLAINT, scope=org_scope)
            or user_has_permission(actor, CREATE_COMPLAINT, scope=org_scope)
            or user_has_permission(actor, CLOSE_COMPLAINT, scope=org_scope)
        )
        if not allowed:
            raise PermissionDenied("Permission denied.")
        return

    if kind == EvidenceLinkedKind.RETURN_QUALITY_RECORD:
        allowed = (
            user_has_permission(actor, VIEW_RETURN, scope=org_scope)
            or user_has_permission(actor, MANAGE_RETURN, scope=org_scope)
            or user_has_permission(actor, INSPECT_RETURN, scope=org_scope)
            or user_has_permission(actor, DISPOSITION_RETURN, scope=org_scope)
        )
        if not allowed:
            raise PermissionDenied("Permission denied.")
        return

    if kind == EvidenceLinkedKind.QUALITY_DOCUMENT_VERSION:
        version: QualityDocumentVersion = target.obj
        editor = (
            user_has_permission(actor, EDIT_DOCUMENT, scope=org_scope)
            or user_has_permission(actor, APPROVE_DOCUMENT, scope=org_scope)
            or user_has_permission(actor, PUBLISH_DOCUMENT, scope=org_scope)
        )
        if for_mutate:
            if not editor:
                raise PermissionDenied("Permission denied.")
            if version.status in {
                DocumentVersionStatus.APPROVED,
                DocumentVersionStatus.EFFECTIVE,
                DocumentVersionStatus.RETIRED,
            }:
                raise ValidationError(
                    {
                        "linked_object_id": (
                            "Files cannot be attached to approved, effective, or "
                            "retired document versions."
                        )
                    }
                )
            return
        if editor:
            return
        if version.status == DocumentVersionStatus.EFFECTIVE and user_has_permission(
            actor, VIEW_EFFECTIVE_DOCUMENT, scope=org_scope
        ):
            return
        raise PermissionDenied("Operators may access only effective document files.")

    if kind == EvidenceLinkedKind.QUALITY_AUDIT_FINDING:
        allowed = (
            user_has_permission(actor, VIEW_QUALITY_AUDIT, scope=org_scope)
            or user_has_permission(actor, EXECUTE_QUALITY_AUDIT, scope=org_scope)
            or user_has_permission(actor, CLOSE_QUALITY_AUDIT, scope=org_scope)
        )
        if not allowed:
            raise PermissionDenied("Permission denied.")
        if for_mutate and target.linkage_immutable:
            raise ValidationError(
                {"linked_object_id": "Evidence cannot be attached to a closed or cancelled audit."}
            )
        return

    if kind == EvidenceLinkedKind.COMPLIANCE_CONTROL_MAPPING:
        allowed = user_has_permission(actor, VIEW_COMPLIANCE_MAPPING, scope=org_scope)
        if not allowed:
            raise PermissionDenied("Permission denied.")
        if for_mutate:
            if not user_has_permission(actor, MANAGE_COMPLIANCE_CONTROL, scope=org_scope):
                raise PermissionDenied("Permission denied.")
            if target.linkage_immutable:
                raise ValidationError(
                    {
                        "linked_object_id": (
                            "Evidence cannot be attached to a superseded or withdrawn edition."
                        )
                    }
                )
        return

    raise PermissionDenied("Permission denied.")
