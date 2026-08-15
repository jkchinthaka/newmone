"""Technical permission catalogue — not company-approved role mappings.

Each entry is TECHNICALLY SUPPORTED in code. Mapping any entry to a Nelna
business responsibility requires owner evidence (APR-007/008/009/010 and related).
Do not treat this module as an approved organizational chart or SoD policy.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Final


class CapabilityBucket(StrEnum):
    VIEW = "view"
    MANAGE = "manage"
    RECORD = "record"
    SUBMIT = "submit"
    SUPERVISOR_REVIEW = "supervisor_review"
    CORRECTION = "correction"
    QA_REVIEW = "qa_review"
    QUALITY_CASE = "quality_case"
    DISPATCH = "dispatch"
    NOTIFICATIONS = "notifications"
    REPORTING = "reporting"
    INTEGRATIONS = "integrations"
    AI_ASSISTANCE = "ai_assistance"
    LABORATORY = "laboratory"
    HACCP = "haccp"
    SAMPLING = "sampling"
    FOREIGN_BODY = "foreign_body"
    SANITATION = "sanitation"
    ENVIRONMENTAL = "environmental"
    PACKAGING = "packaging"
    CHANGEOVER = "changeover"
    RECEIVING = "receiving"
    IQC = "iqc"
    IPQC = "ipqc"
    BATCH_DOSSIER = "batch_dossier"
    BATCH_GENEALOGY = "batch_genealogy"
    RECALL = "recall"
    CUSTOMER_COMPLAINTS = "customer_complaints"
    PRODUCT_RETURNS = "product_returns"
    QUALITY_QUARANTINE = "quality_quarantine"
    REWORK = "rework"
    DOCUMENT_CONTROL = "document_control"
    CHANGE_CONTROL = "change_control"
    QUALITY_AUDITS = "quality_audits"
    COMPLIANCE_MAPPING = "compliance_mapping"
    QUALITY_RISKS = "quality_risks"
    PROCESS_FMEA = "process_fmea"
    RCA = "rca"
    EVIDENCE = "evidence"
    MASTER_DATA = "master_data"
    CHECKLIST_PUBLISH = "checklist_publish"
    AUDIT_ACCESS = "audit_access"
    SYSTEM_ADMINISTRATION = "system_administration"


class ObjectScope(StrEnum):
    ORGANIZATION = "Organization"
    SITE = "Site"
    DEPARTMENT = "Department"
    SYSTEM_WIDE = "system-wide"


class TechnicalSupportStatus(StrEnum):
    TECHNICALLY_SUPPORTED = "TECHNICALLY SUPPORTED"


class BusinessMappingStatus(StrEnum):
    APPROVAL_REQUIRED = "APPROVAL REQUIRED"


@dataclass(frozen=True, slots=True)
class PermissionCatalogueEntry:
    """One technical permission (or capability note) in the catalogue."""

    key: str
    permission: str
    bucket: CapabilityBucket
    scopes: tuple[ObjectScope, ...]
    description: str
    technical_status: TechnicalSupportStatus = TechnicalSupportStatus.TECHNICALLY_SUPPORTED
    business_mapping_status: BusinessMappingStatus = BusinessMappingStatus.APPROVAL_REQUIRED
    notes: str = ""


# Catalogue keys are stable identifiers for docs/tests — not business role codes.
PERMISSION_CATALOGUE: Final[tuple[PermissionCatalogueEntry, ...]] = (
    PermissionCatalogueEntry(
        key="view_checklisttask",
        permission="scheduling.view_checklisttask",
        bucket=CapabilityBucket.VIEW,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Inspect checklist orchestration tasks (Django default view).",
    ),
    PermissionCatalogueEntry(
        key="view_checklisttemplate",
        permission="checklists.view_checklisttemplate",
        bucket=CapabilityBucket.VIEW,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SYSTEM_WIDE),
        description="Inspect checklist template definitions (Django default view).",
    ),
    PermissionCatalogueEntry(
        key="view_fgproduct",
        permission="master_data.view_fgproduct",
        bucket=CapabilityBucket.VIEW,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SYSTEM_WIDE),
        description="Inspect FG Product master rows (Django default view).",
    ),
    PermissionCatalogueEntry(
        key="view_shift",
        permission="organizations.view_shift",
        bucket=CapabilityBucket.VIEW,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Inspect Shift configuration (Django default view).",
    ),
    PermissionCatalogueEntry(
        key="view_checklistsubmission",
        permission="reviews.view_supervisorreview",
        bucket=CapabilityBucket.VIEW,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Inspect Supervisor review objects where authorized (default view).",
        notes="Does not grant review_checklistsubmission.",
    ),
    PermissionCatalogueEntry(
        key="manage_checklisttask",
        permission="scheduling.manage_checklisttask",
        bucket=CapabilityBucket.MANAGE,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Create/cancel administrative checklist tasks.",
        notes="Does not imply record_checklisttask or assign_checklisttask.",
    ),
    PermissionCatalogueEntry(
        key="assign_checklisttask",
        permission="scheduling.assign_checklisttask",
        bucket=CapabilityBucket.MANAGE,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Assign / reassign / unassign checklist task ownership.",
        notes=(
            "Ownership only — assignment never grants view/manage/record permission. "
            "Assignee must still hold valid scoped RBAC independently."
        ),
    ),
    PermissionCatalogueEntry(
        key="view_checklistapplicability",
        permission="scheduling.view_checklistapplicability",
        bucket=CapabilityBucket.VIEW,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Preview / inspect checklist applicability rules.",
        notes="Does not auto-create tasks; APR-013/014/015 remain evidence-gated.",
    ),
    PermissionCatalogueEntry(
        key="view_checklistschedule",
        permission="scheduling.view_checklistschedule",
        bucket=CapabilityBucket.VIEW,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="View checklist schedule definitions.",
        notes="Frequencies remain EVIDENCE REQUIRED; no seeded Nelna cadences.",
    ),
    PermissionCatalogueEntry(
        key="manage_checklistschedule",
        permission="scheduling.manage_checklistschedule",
        bucket=CapabilityBucket.MASTER_DATA,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Configure checklist schedules (shift/window/interval).",
        notes=(
            "Never invent frequencies. Missed windows never auto-create NCR. "
            "Celery Beat poll is infrastructure only."
        ),
    ),
    PermissionCatalogueEntry(
        key="manage_checklistapplicability",
        permission="scheduling.manage_checklistapplicability",
        bucket=CapabilityBucket.MASTER_DATA,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Configure checklist applicability rules (org-scoped).",
        notes=(
            "Never silently picks among conflicts. Production Line dimension not modeled. "
            "APR-013/014/015 EVIDENCE REQUIRED for production policy."
        ),
    ),
    PermissionCatalogueEntry(
        key="manage_externalbatchmapping",
        permission="scheduling.manage_externalbatchmapping",
        bucket=CapabilityBucket.MASTER_DATA,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Configure external batch identity mappings (org/product/site/shift).",
        notes=(
            "Adapter boundary only — no live Bileeta/ERP connector. "
            "APR-011/012 remain EVIDENCE REQUIRED for production ingestion."
        ),
    ),
    PermissionCatalogueEntry(
        key="manage_checklist",
        permission="checklists.manage_checklist",
        bucket=CapabilityBucket.CHECKLIST_PUBLISH,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SYSTEM_WIDE),
        description="Manage checklist definitions including publish lifecycle.",
        notes="Publish capability is technical; content approval remains APR/TEMPLATE evidence.",
    ),
    PermissionCatalogueEntry(
        key="manage_fgproduct",
        permission="master_data.manage_fgproduct",
        bucket=CapabilityBucket.MASTER_DATA,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Manage FG Product master-data rows.",
    ),
    PermissionCatalogueEntry(
        key="view_productspecification",
        permission="master_data.view_productspecification",
        bucket=CapabilityBucket.VIEW,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Inspect product quality specifications and versions (Django default view).",
        notes="Limits remain empty until APR-006 / ASM-001 evidence.",
    ),
    PermissionCatalogueEntry(
        key="manage_productspecification",
        permission="master_data.manage_productspecification",
        bucket=CapabilityBucket.MASTER_DATA,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Create/edit/approve/retire versioned product quality specifications.",
        notes=(
            "High-privilege technical capability; publishing is audited. "
            "Do not invent temperature/weight/microbiological limits."
        ),
    ),
    PermissionCatalogueEntry(
        key="view_equipment",
        permission="instruments.view_equipment",
        bucket=CapabilityBucket.VIEW,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Inspect equipment master and calibration history (Django default view).",
        notes="Separate from operator record permissions.",
    ),
    PermissionCatalogueEntry(
        key="manage_equipment",
        permission="instruments.manage_equipment",
        bucket=CapabilityBucket.MASTER_DATA,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Manage equipment assets and calibration records.",
        notes="Not implied by scheduling.record_checklisttask / operator roles.",
    ),
    PermissionCatalogueEntry(
        key="override_calibration_gate",
        permission="instruments.override_calibration_gate",
        bucket=CapabilityBucket.MASTER_DATA,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Override calibration BLOCK when company policy explicitly approves.",
        notes=(
            "Requires INSTRUMENTS_CALIBRATION_OVERRIDE_APPROVED=true. "
            "Audited as DEVICE_CALIBRATION_OVERRIDE. Not implied by manage_equipment."
        ),
    ),
    PermissionCatalogueEntry(
        key="view_trainingrecord",
        permission="training.view_trainingrecord",
        bucket=CapabilityBucket.VIEW,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Inspect training / competency records (Django default view).",
        notes="Separate from operator record permissions.",
    ),
    PermissionCatalogueEntry(
        key="manage_trainingrecord",
        permission="training.manage_trainingrecord",
        bucket=CapabilityBucket.MASTER_DATA,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Manage training and competency records / enforcement policy metadata.",
        notes=(
            "Not implied by scheduling.record_checklisttask / operator roles. "
            "Gate WARN/BLOCK EVIDENCE REQUIRED."
        ),
    ),
    PermissionCatalogueEntry(
        key="manage_shift",
        permission="organizations.manage_shift",
        bucket=CapabilityBucket.MASTER_DATA,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Manage Shift configuration rows.",
    ),
    PermissionCatalogueEntry(
        key="create_nonconformance",
        permission="nonconformance.create_nonconformance",
        bucket=CapabilityBucket.QUALITY_CASE,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Create formal nonconformance cases (manual only; no FAIL/CCP auto-raise).",
        notes="Distinct from recording ChecklistCorrection / resubmission.",
    ),
    PermissionCatalogueEntry(
        key="manage_nonconformance",
        permission="nonconformance.manage_nonconformance",
        bucket=CapabilityBucket.QUALITY_CASE,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Update/transition open nonconformance cases.",
        notes="Does not invent severity or auto-HOLD rules.",
    ),
    PermissionCatalogueEntry(
        key="close_nonconformance",
        permission="nonconformance.close_nonconformance",
        bucket=CapabilityBucket.QUALITY_CASE,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Close nonconformance cases (separate from manage).",
    ),
    PermissionCatalogueEntry(
        key="create_holdcase",
        permission="nonconformance.create_holdcase",
        bucket=CapabilityBucket.QUALITY_CASE,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Open Hold cases manually (free-text reason/scope).",
        notes="Resolution catalogues remain EVIDENCE REQUIRED — not seeded.",
    ),
    PermissionCatalogueEntry(
        key="manage_holdcase",
        permission="nonconformance.manage_holdcase",
        bucket=CapabilityBucket.QUALITY_CASE,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Manage open Hold cases.",
    ),
    PermissionCatalogueEntry(
        key="close_holdcase",
        permission="nonconformance.close_holdcase",
        bucket=CapabilityBucket.QUALITY_CASE,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Close Hold cases with free-text resolution.",
    ),
    PermissionCatalogueEntry(
        key="create_capa",
        permission="capa.create_capa",
        bucket=CapabilityBucket.QUALITY_CASE,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Create CAPA headers (human workflow foundation).",
    ),
    PermissionCatalogueEntry(
        key="manage_capa",
        permission="capa.manage_capa",
        bucket=CapabilityBucket.QUALITY_CASE,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Manage CAPA actions, verification, and effectiveness review fields.",
        notes="No AI final CAPA closure.",
    ),
    PermissionCatalogueEntry(
        key="close_capa",
        permission="capa.close_capa",
        bucket=CapabilityBucket.QUALITY_CASE,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Human-only CAPA closure.",
    ),
    PermissionCatalogueEntry(
        key="create_dispatchqualityrecord",
        permission="dispatch.create_dispatchqualityrecord",
        bucket=CapabilityBucket.DISPATCH,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Create loading/dispatch quality records.",
        notes="No ERP writes; no invented temperature/release rules.",
    ),
    PermissionCatalogueEntry(
        key="manage_dispatchqualityrecord",
        permission="dispatch.manage_dispatchqualityrecord",
        bucket=CapabilityBucket.DISPATCH,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Update dispatch records, link vehicle inspection/QA, record temps/qty.",
    ),
    PermissionCatalogueEntry(
        key="complete_dispatchqualityrecord",
        permission="dispatch.complete_dispatchqualityrecord",
        bucket=CapabilityBucket.DISPATCH,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Complete dispatch quality records (subject to configurable release gate).",
        notes="Separate from manage; AI suggestions never authorize completion.",
    ),
    PermissionCatalogueEntry(
        key="manage_dispatchreleasepolicy",
        permission="dispatch.manage_dispatchreleasepolicy",
        bucket=CapabilityBucket.DISPATCH,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Configure org QA RELEASE-before-loading gate (default disabled).",
        notes="Enabling requires Dispatch + QA owner evidence (APR-017) — not seeded.",
    ),
    PermissionCatalogueEntry(
        key="view_own_notifications",
        permission="notifications.view_own_notifications",
        bucket=CapabilityBucket.NOTIFICATIONS,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="View own in-app workflow notifications.",
    ),
    PermissionCatalogueEntry(
        key="manage_notifications",
        permission="notifications.manage_notifications",
        bucket=CapabilityBucket.NOTIFICATIONS,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Dispatch workflow notifications (policy-gated event types).",
        notes="Must not include checklist answers or sensitive notes in payloads.",
    ),
    PermissionCatalogueEntry(
        key="manage_notificationpolicy",
        permission="notifications.manage_notificationpolicy",
        bucket=CapabilityBucket.NOTIFICATIONS,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Enable/disable notification event types and optional email channel.",
        notes="All events default OFF; SMS not integrated.",
    ),
    PermissionCatalogueEntry(
        key="view_reportcatalogue",
        permission="reports.view_reportcatalogue",
        bucket=CapabilityBucket.REPORTING,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="View the governed quality report catalogue.",
        notes="Catalogue codes are technical; official report packs EVIDENCE REQUIRED.",
    ),
    PermissionCatalogueEntry(
        key="run_qualityreport",
        permission="reports.run_qualityreport",
        bucket=CapabilityBucket.REPORTING,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Run governed quality reports within organization scope.",
        notes="Historical submission reports must use immutable snapshots only.",
    ),
    PermissionCatalogueEntry(
        key="export_qualityreport",
        permission="reports.export_qualityreport",
        bucket=CapabilityBucket.REPORTING,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Export/download governed quality report CSV results.",
        notes="Sensitive exports are audited. Excel/PDF not implemented in Phase 16.",
    ),
    PermissionCatalogueEntry(
        key="view_integrationboundary",
        permission="integrations.view_integrationboundary",
        bucket=CapabilityBucket.INTEGRATIONS,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.SYSTEM_WIDE),
        description="View ERP/Bileeta integration evidence gate and attempt status.",
        notes="Live connector remains blocked until APR-011/APR-012 evidence.",
    ),
    PermissionCatalogueEntry(
        key="manage_integrationboundary",
        permission="integrations.manage_integrationboundary",
        bucket=CapabilityBucket.INTEGRATIONS,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.SYSTEM_WIDE),
        description="Ingest mock/contract batch events via integration boundary.",
        notes="Must not invent endpoints; outbound disposition blocked without APR-017.",
    ),
    PermissionCatalogueEntry(
        key="use_aiassistance",
        permission="ai_assistance.use_aiassistance",
        bucket=CapabilityBucket.AI_ASSISTANCE,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Use advisory AI assistance within organization scope.",
        notes="AI never RELEASE/HOLD/REJECT, close CAPA, publish, or change roles/specs.",
    ),
    PermissionCatalogueEntry(
        key="view_aiassistanceaudit",
        permission="ai_assistance.view_aiassistanceaudit",
        bucket=CapabilityBucket.AI_ASSISTANCE,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="View high-level AI assistance usage audit metadata.",
        notes="Full prompts are not stored by default.",
    ),
    PermissionCatalogueEntry(
        key="register_labsample",
        permission="laboratory.register_labsample",
        bucket=CapabilityBucket.LABORATORY,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Register laboratory samples and related tests.",
        notes="No auto role mapping; lab catalogue evidence required for production content.",
    ),
    PermissionCatalogueEntry(
        key="enter_labresult",
        permission="laboratory.enter_labresult",
        bucket=CapabilityBucket.LABORATORY,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Enter or amend laboratory results (amendments create new revisions).",
    ),
    PermissionCatalogueEntry(
        key="verify_labresult",
        permission="laboratory.verify_labresult",
        bucket=CapabilityBucket.LABORATORY,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Verify entered laboratory results.",
    ),
    PermissionCatalogueEntry(
        key="finalize_labresult",
        permission="laboratory.finalize_labresult",
        bucket=CapabilityBucket.LABORATORY,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Finalize verified laboratory results (immutable thereafter except amendment).",
    ),
    PermissionCatalogueEntry(
        key="manage_laboratory",
        permission="laboratory.manage_laboratory",
        bucket=CapabilityBucket.LABORATORY,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Administer lab method/parameter catalogue and positive-release policy stubs.",
        notes="Positive-release blocking stays OFF without company QA approval.",
    ),
    PermissionCatalogueEntry(
        key="view_laboratory",
        permission="laboratory.view_laboratory",
        bucket=CapabilityBucket.LABORATORY,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Read-only view of laboratory samples and results.",
    ),
    PermissionCatalogueEntry(
        key="manage_haccpplan",
        permission="haccp.manage_haccpplan",
        bucket=CapabilityBucket.HACCP,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Draft/edit HACCP plan versions and control-point mappings.",
        notes="Does not grant food-safety approval authority.",
    ),
    PermissionCatalogueEntry(
        key="approve_haccpplan",
        permission="haccp.approve_haccpplan",
        bucket=CapabilityBucket.HACCP,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Approve or retire HACCP plan versions.",
        notes="High privilege; System Admin is not assumed to hold this by default.",
    ),
    PermissionCatalogueEntry(
        key="view_haccp",
        permission="haccp.view_haccp",
        bucket=CapabilityBucket.HACCP,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Read-only view of HACCP plans and control points.",
    ),
    PermissionCatalogueEntry(
        key="manage_samplingplan",
        permission="sampling.manage_samplingplan",
        bucket=CapabilityBucket.SAMPLING,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Draft/edit sampling plan versions and rules.",
        notes="No invented AQL/ISO tables; values from approved configuration only.",
    ),
    PermissionCatalogueEntry(
        key="publish_samplingplan",
        permission="sampling.publish_samplingplan",
        bucket=CapabilityBucket.SAMPLING,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Approve or retire sampling plan versions.",
    ),
    PermissionCatalogueEntry(
        key="view_sampling",
        permission="sampling.view_sampling",
        bucket=CapabilityBucket.SAMPLING,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Read-only view of sampling plans.",
    ),
    PermissionCatalogueEntry(
        key="manage_testpiece",
        permission="foreign_body.manage_testpiece",
        bucket=CapabilityBucket.FOREIGN_BODY,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Manage foreign-body test-piece catalogue and schedule rule shells.",
        notes="Do not invent Fe/Non-Fe/SS sizes or frequencies.",
    ),
    PermissionCatalogueEntry(
        key="record_challengeresult",
        permission="foreign_body.record_challengeresult",
        bucket=CapabilityBucket.FOREIGN_BODY,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Record metal-detector / foreign-body challenge tests.",
        notes="Cannot verify own record (SoD).",
    ),
    PermissionCatalogueEntry(
        key="verify_challengeresult",
        permission="foreign_body.verify_challengeresult",
        bucket=CapabilityBucket.FOREIGN_BODY,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Verify or void foreign-body challenge tests.",
        notes="Separate from record permission.",
    ),
    PermissionCatalogueEntry(
        key="view_foreignbody",
        permission="foreign_body.view_foreignbody",
        bucket=CapabilityBucket.FOREIGN_BODY,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Read-only foreign-body challenge history.",
    ),
    PermissionCatalogueEntry(
        key="manage_sanitationprogram",
        permission="sanitation.manage_sanitationprogram",
        bucket=CapabilityBucket.SANITATION,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Draft/edit sanitation programs, scopes, schedule links, chemical shells.",
        notes="Does not invent cleaning chemicals, concentrations, or frequencies.",
    ),
    PermissionCatalogueEntry(
        key="publish_sanitationprogram",
        permission="sanitation.publish_sanitationprogram",
        bucket=CapabilityBucket.SANITATION,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Approve/retire sanitation program versions and fail-policy stubs.",
    ),
    PermissionCatalogueEntry(
        key="view_sanitation",
        permission="sanitation.view_sanitation",
        bucket=CapabilityBucket.SANITATION,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Read-only view of sanitation programs.",
    ),
    PermissionCatalogueEntry(
        key="manage_environmental",
        permission="environmental.manage_environmental",
        bucket=CapabilityBucket.ENVIRONMENTAL,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Manage monitoring points, parameters, specs, and excursion policy stubs.",
        notes="Does not invent EM limits, frequencies, or parameter catalogues.",
    ),
    PermissionCatalogueEntry(
        key="record_environmentalreading",
        permission="environmental.record_environmentalreading",
        bucket=CapabilityBucket.ENVIRONMENTAL,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Record MANUAL/LAB/SENSOR environmental monitoring readings.",
    ),
    PermissionCatalogueEntry(
        key="view_environmental",
        permission="environmental.view_environmental",
        bucket=CapabilityBucket.ENVIRONMENTAL,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Read-only environmental monitoring history and trend index.",
    ),
    PermissionCatalogueEntry(
        key="manage_packagingartwork",
        permission="packaging.manage_packagingartwork",
        bucket=CapabilityBucket.PACKAGING,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Draft/edit packaging artwork versions (Product Master style).",
        notes="Separated from approve_packagingartwork (Document Control).",
    ),
    PermissionCatalogueEntry(
        key="approve_packagingartwork",
        permission="packaging.approve_packagingartwork",
        bucket=CapabilityBucket.PACKAGING,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Approve/retire packaging artwork versions (Document Control).",
        notes="Not implied by manage_packagingartwork.",
    ),
    PermissionCatalogueEntry(
        key="view_packagingartwork",
        permission="packaging.view_packaging",
        bucket=CapabilityBucket.PACKAGING,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Read-only packaging artwork viewing.",
    ),
    PermissionCatalogueEntry(
        key="manage_allergenreference",
        permission="changeover.manage_allergenreference",
        bucket=CapabilityBucket.CHANGEOVER,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Manage generic allergen reference shells (not seeded catalogues).",
        notes="Does not invent Nelna allergen lists.",
    ),
    PermissionCatalogueEntry(
        key="manage_changeover",
        permission="changeover.manage_changeover",
        bucket=CapabilityBucket.CHANGEOVER,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Record changeover and line-clearance events.",
    ),
    PermissionCatalogueEntry(
        key="verify_changeover",
        permission="changeover.verify_changeover",
        bucket=CapabilityBucket.CHANGEOVER,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Verify changeover / approve product allergen declarations (QA/Food Safety).",
        notes="Not implied by manage_changeover.",
    ),
    PermissionCatalogueEntry(
        key="view_changeover",
        permission="changeover.view_changeover",
        bucket=CapabilityBucket.CHANGEOVER,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Read-only allergen/changeover/line-clearance viewing.",
    ),
    PermissionCatalogueEntry(
        key="manage_allergenriskpolicy",
        permission="changeover.manage_allergenriskpolicy",
        bucket=CapabilityBucket.CHANGEOVER,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Update allergen risk / production-block policy stubs.",
        notes="Dual-gated with CHANGEOVER_ALLERGEN_BLOCK_APPROVED (default OFF).",
    ),
    PermissionCatalogueEntry(
        key="manage_materialreference",
        permission="receiving.manage_materialreference",
        bucket=CapabilityBucket.RECEIVING,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Manage ERP-mapped material reference shells (not inventory master).",
    ),
    PermissionCatalogueEntry(
        key="manage_receiptquality",
        permission="receiving.manage_receiptquality",
        bucket=CapabilityBucket.RECEIVING,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Create/edit raw material receipt quality records.",
    ),
    PermissionCatalogueEntry(
        key="disposition_receiptquality",
        permission="receiving.disposition_receiptquality",
        bucket=CapabilityBucket.RECEIVING,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Set local receipt quality disposition (ACCEPTED/HOLD/REJECTED).",
        notes="Does not update ERP stock; not implied by manage_receiptquality.",
    ),
    PermissionCatalogueEntry(
        key="view_receiptquality",
        permission="receiving.view_receiptquality",
        bucket=CapabilityBucket.RECEIVING,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Read-only receipt quality / material receiving viewing.",
    ),
    PermissionCatalogueEntry(
        key="manage_materialspecification",
        permission="receiving.manage_materialspecification",
        bucket=CapabilityBucket.RECEIVING,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Draft material specification versions (no invented limits).",
    ),
    PermissionCatalogueEntry(
        key="approve_materialspecification",
        permission="receiving.approve_materialspecification",
        bucket=CapabilityBucket.RECEIVING,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Approve/retire material specification versions.",
        notes="Not implied by manage_materialspecification.",
    ),
    PermissionCatalogueEntry(
        key="manage_iqc",
        permission="iqc.manage_iqc",
        bucket=CapabilityBucket.IQC,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Ingest receipt events and orchestrate IQC workflow / tasks.",
    ),
    PermissionCatalogueEntry(
        key="disposition_iqc",
        permission="iqc.disposition_iqc",
        bucket=CapabilityBucket.IQC,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Complete IQC local disposition (not ERP stock).",
        notes="Review gate when review_required; not implied by manage_iqc.",
    ),
    PermissionCatalogueEntry(
        key="view_iqc",
        permission="iqc.view_iqc",
        bucket=CapabilityBucket.IQC,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Read-only IQC inspection cases.",
    ),
    PermissionCatalogueEntry(
        key="manage_iqcpolicy",
        permission="iqc.manage_iqcpolicy",
        bucket=CapabilityBucket.IQC,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Update IQC review/ERP outbound policy stubs.",
        notes="Dual-gated with IQC_ERP_OUTBOUND_APPROVED (default OFF).",
    ),
    PermissionCatalogueEntry(
        key="manage_ipqc",
        permission="ipqc.manage_ipqc",
        bucket=CapabilityBucket.IPQC,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Manage IPQC definitions and generate in-process inspection cases.",
    ),
    PermissionCatalogueEntry(
        key="record_ipqc",
        permission="ipqc.record_ipqc",
        bucket=CapabilityBucket.IPQC,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Record IPQC measurements and equipment links.",
    ),
    PermissionCatalogueEntry(
        key="escalate_ipqc",
        permission="ipqc.escalate_ipqc",
        bucket=CapabilityBucket.IPQC,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Escalate IPQC failures to NCR/HOLD (controlled; never auto from FAIL).",
        notes="Not implied by manage_ipqc or record_ipqc.",
    ),
    PermissionCatalogueEntry(
        key="view_ipqc",
        permission="ipqc.view_ipqc",
        bucket=CapabilityBucket.IPQC,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="Read-only IPQC cases and due/overdue/failure dashboard.",
    ),
    PermissionCatalogueEntry(
        key="manage_ipqcpolicy",
        permission="ipqc.manage_ipqcpolicy",
        bucket=CapabilityBucket.IPQC,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Update IPQC stop-production policy stubs.",
        notes="Dual-gated with IPQC_STOP_PRODUCTION_ON_FAIL_APPROVED (default OFF).",
    ),
    PermissionCatalogueEntry(
        key="view_batchdossier",
        permission="batch_dossier.view_batchdossier",
        bucket=CapabilityBucket.BATCH_DOSSIER,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="View electronic batch quality dossier (read-only aggregation).",
        notes="Section contents still require domain view permissions (object-level).",
    ),
    PermissionCatalogueEntry(
        key="export_batchdossier",
        permission="batch_dossier.export_batchdossier",
        bucket=CapabilityBucket.BATCH_DOSSIER,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Prepare batch dossier PDF export hook (no live PDF in Phase 35).",
        notes="Dual-gated with BATCH_DOSSIER_PDF_EXPORT_APPROVED (default OFF).",
    ),
    PermissionCatalogueEntry(
        key="manage_batchdossierpolicy",
        permission="batch_dossier.manage_batchdossierpolicy",
        bucket=CapabilityBucket.BATCH_DOSSIER,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Update batch dossier PDF export policy stubs.",
    ),
    PermissionCatalogueEntry(
        key="view_batchgenealogy",
        permission="batch_genealogy.view_batchgenealogy",
        bucket=CapabilityBucket.BATCH_GENEALOGY,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE),
        description="View backward/forward batch genealogy traces.",
    ),
    PermissionCatalogueEntry(
        key="ingest_batchgenealogy",
        permission="batch_genealogy.ingest_batchgenealogy",
        bucket=CapabilityBucket.BATCH_GENEALOGY,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Ingest ERP/integration genealogy edges (never invent).",
    ),
    PermissionCatalogueEntry(
        key="view_genealogy_partner",
        permission="batch_genealogy.view_genealogy_partner",
        bucket=CapabilityBucket.BATCH_GENEALOGY,
        scopes=(ObjectScope.ORGANIZATION,),
        description="View supplier/customer references on genealogy nodes.",
        notes="Not implied by view_batchgenealogy.",
    ),
    PermissionCatalogueEntry(
        key="manage_batchgenealogypolicy",
        permission="batch_genealogy.manage_batchgenealogypolicy",
        bucket=CapabilityBucket.BATCH_GENEALOGY,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Update genealogy Mongo projection / depth policy stubs.",
        notes="Dual-gated with BATCH_GENEALOGY_MONGO_PROJECTION_APPROVED (default OFF).",
    ),
    PermissionCatalogueEntry(
        key="view_recall",
        permission="recall.view_recall",
        bucket=CapabilityBucket.RECALL,
        scopes=(ObjectScope.ORGANIZATION,),
        description="View recall/withdrawal cases and timelines.",
    ),
    PermissionCatalogueEntry(
        key="initiate_recall",
        permission="recall.initiate_recall",
        bucket=CapabilityBucket.RECALL,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Initiate recall/withdrawal cases (high-risk).",
        notes=(
            "Explicit scoped grant required — not implied by System Admin / is_staff / "
            "is_superuser (APR-062)."
        ),
    ),
    PermissionCatalogueEntry(
        key="manage_recallcase",
        permission="recall.manage_recallcase",
        bucket=CapabilityBucket.RECALL,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Update recall scope, quantities, and communication references.",
    ),
    PermissionCatalogueEntry(
        key="close_recall",
        permission="recall.close_recall",
        bucket=CapabilityBucket.RECALL,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Close recall/withdrawal cases.",
        notes="Not implied by manage_recallcase.",
    ),
    PermissionCatalogueEntry(
        key="manage_recallpolicy",
        permission="recall.manage_recallpolicy",
        bucket=CapabilityBucket.RECALL,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Update recall external-notification / ERP-pull policy stubs.",
        notes=(
            "Dual-gated with RECALL_EXTERNAL_NOTIFICATION_APPROVED and "
            "RECALL_ERP_DISTRIBUTION_PULL_APPROVED (default OFF)."
        ),
    ),
    PermissionCatalogueEntry(
        key="run_mock_recall",
        permission="recall.run_mock_recall",
        bucket=CapabilityBucket.RECALL,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Run MOCK recall exercises (never a real recall initiation).",
        notes="Technically and visually isolated from real recalls (ADR-049 / APR-063).",
    ),
    PermissionCatalogueEntry(
        key="manage_mock_recall_findings",
        permission="recall.manage_mock_recall_findings",
        bucket=CapabilityBucket.RECALL,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Record mock findings and explicitly link NCR/CAPA/improvement.",
        notes="Findings never auto-open NCR/CAPA — explicit user action required.",
    ),
    PermissionCatalogueEntry(
        key="view_customercomplaint",
        permission="customer_complaints.view_customercomplaint",
        bucket=CapabilityBucket.CUSTOMER_COMPLAINTS,
        scopes=(ObjectScope.ORGANIZATION,),
        description="View customer quality complaint cases and timelines.",
    ),
    PermissionCatalogueEntry(
        key="create_customercomplaint",
        permission="customer_complaints.create_customercomplaint",
        bucket=CapabilityBucket.CUSTOMER_COMPLAINTS,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Create customer quality complaint cases.",
    ),
    PermissionCatalogueEntry(
        key="manage_customercomplaint",
        permission="customer_complaints.manage_customercomplaint",
        bucket=CapabilityBucket.CUSTOMER_COMPLAINTS,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Update complaint investigation, batch refs, and quality links.",
    ),
    PermissionCatalogueEntry(
        key="close_customercomplaint",
        permission="customer_complaints.close_customercomplaint",
        bucket=CapabilityBucket.CUSTOMER_COMPLAINTS,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Close customer complaint cases.",
        notes="Not implied by manage_customercomplaint.",
    ),
    PermissionCatalogueEntry(
        key="view_complaint_customer_sensitive",
        permission="customer_complaints.view_complaint_customer_sensitive",
        bucket=CapabilityBucket.CUSTOMER_COMPLAINTS,
        scopes=(ObjectScope.ORGANIZATION,),
        description="View customer-sensitive display labels on complaints.",
        notes="Privacy-restricted — not implied by view_customercomplaint (APR-064).",
    ),
    PermissionCatalogueEntry(
        key="record_complaint_communication",
        permission="customer_complaints.record_complaint_communication",
        bucket=CapabilityBucket.CUSTOMER_COMPLAINTS,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Record complaint communication references (no auto-send).",
    ),
    PermissionCatalogueEntry(
        key="manage_complaintpolicy",
        permission="customer_complaints.manage_complaintpolicy",
        bucket=CapabilityBucket.CUSTOMER_COMPLAINTS,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Update complaint category config and auto-response policy stubs.",
        notes="Dual-gated with COMPLAINT_CUSTOMER_RESPONSE_AUTO_SEND_APPROVED (default OFF).",
    ),
    PermissionCatalogueEntry(
        key="view_returnquality",
        permission="product_returns.view_returnquality",
        bucket=CapabilityBucket.PRODUCT_RETURNS,
        scopes=(ObjectScope.ORGANIZATION,),
        description="View returned product quality records and timelines.",
    ),
    PermissionCatalogueEntry(
        key="manage_returnquality",
        permission="product_returns.manage_returnquality",
        bucket=CapabilityBucket.PRODUCT_RETURNS,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Create/update return quality records and quantity references.",
        notes="Returned stock never becomes saleable through this application.",
    ),
    PermissionCatalogueEntry(
        key="inspect_returnquality",
        permission="product_returns.inspect_returnquality",
        bucket=CapabilityBucket.PRODUCT_RETURNS,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Start return inspection via checklist engine tasks.",
    ),
    PermissionCatalogueEntry(
        key="disposition_returnquality",
        permission="product_returns.disposition_returnquality",
        bucket=CapabilityBucket.PRODUCT_RETURNS,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Apply return disposition (RELEASE/HOLD/REWORK/REJECT architecture).",
        notes="Company policy governs allowed paths (APR-065). Local quality only.",
    ),
    PermissionCatalogueEntry(
        key="manage_returnpolicystub",
        permission="product_returns.manage_returnpolicystub",
        bucket=CapabilityBucket.PRODUCT_RETURNS,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Manage return quality policy stubs (ERP stock gate / disposition allow-list).",
        notes="Dual-gated with PRODUCT_RETURNS_ERP_STOCK_MOVEMENT_APPROVED (default OFF).",
    ),
    PermissionCatalogueEntry(
        key="view_qualityquarantine",
        permission="quality_quarantine.view_qualityquarantine",
        bucket=CapabilityBucket.QUALITY_QUARANTINE,
        scopes=(ObjectScope.ORGANIZATION,),
        description="View quality quarantine records and append-only history.",
    ),
    PermissionCatalogueEntry(
        key="manage_qualityquarantine",
        permission="quality_quarantine.manage_qualityquarantine",
        bucket=CapabilityBucket.QUALITY_QUARANTINE,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Open quarantine cases and manage local quality-state references.",
        notes="ERP remains authoritative inventory ledger; APR-066 EVIDENCE REQUIRED.",
    ),
    PermissionCatalogueEntry(
        key="release_qualityquarantine",
        permission="quality_quarantine.release_qualityquarantine",
        bucket=CapabilityBucket.QUALITY_QUARANTINE,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Release an open local quality quarantine when the settings gate is approved.",
        notes="Dual-gated with QUALITY_QUARANTINE_RELEASE_APPROVED (default OFF).",
    ),
    PermissionCatalogueEntry(
        key="manage_quarantinepolicystub",
        permission="quality_quarantine.manage_quarantinepolicystub",
        bucket=CapabilityBucket.QUALITY_QUARANTINE,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Manage quantity-recording and ERP-sync policy stubs.",
        notes=(
            "ERP sync also requires QUALITY_QUARANTINE_ERP_SYNC_APPROVED; "
            "APR-066 EVIDENCE REQUIRED."
        ),
    ),
    PermissionCatalogueEntry(
        key="view_reworkcase",
        permission="rework.view_reworkcase",
        bucket=CapabilityBucket.REWORK,
        scopes=(ObjectScope.ORGANIZATION,),
        description="View controlled rework cases and append-only history.",
    ),
    PermissionCatalogueEntry(
        key="create_reworkcase",
        permission="rework.create_reworkcase",
        bucket=CapabilityBucket.REWORK,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Create rework cases. REJECT does not auto-create rework.",
        notes="Explicit create permission required; APR-067 EVIDENCE REQUIRED.",
    ),
    PermissionCatalogueEntry(
        key="authorize_reworkcase",
        permission="rework.authorize_reworkcase",
        bucket=CapabilityBucket.REWORK,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Authorize a draft rework case before execution.",
        notes="Create and authorize are separate grants.",
    ),
    PermissionCatalogueEntry(
        key="execute_reworkcase",
        permission="rework.execute_reworkcase",
        bucket=CapabilityBucket.REWORK,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Start/complete rework, record genealogy, and open reinspection.",
        notes="ERP quantity/status still requires REWORK_ERP_STOCK_MOVEMENT_APPROVED.",
    ),
    PermissionCatalogueEntry(
        key="manage_reworkpolicystub",
        permission="rework.manage_reworkpolicystub",
        bucket=CapabilityBucket.REWORK,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Manage rework policy stubs including the org ERP-stock gate.",
        notes="Dual-gated with REWORK_ERP_STOCK_MOVEMENT_APPROVED (default OFF); APR-067.",
    ),
    PermissionCatalogueEntry(
        key="view_effectivedocument",
        permission="document_control.view_effectivedocument",
        bucket=CapabilityBucket.DOCUMENT_CONTROL,
        scopes=(ObjectScope.ORGANIZATION,),
        description="View applicable effective quality documents and their files.",
        notes="Operators do not see draft, under-review, or approved-but-not-effective versions.",
    ),
    PermissionCatalogueEntry(
        key="edit_qualitydocument",
        permission="document_control.edit_qualitydocument",
        bucket=CapabilityBucket.DOCUMENT_CONTROL,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Create documents and edit draft versions.",
        notes="Approved/effective/retired versions are immutable; create a new revision.",
    ),
    PermissionCatalogueEntry(
        key="approve_qualitydocument",
        permission="document_control.approve_qualitydocument",
        bucket=CapabilityBucket.DOCUMENT_CONTROL,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Review and approve document versions (not the version author).",
        notes="Separate from edit and publish; APR-068 EVIDENCE REQUIRED.",
    ),
    PermissionCatalogueEntry(
        key="publish_qualitydocument",
        permission="document_control.publish_qualitydocument",
        bucket=CapabilityBucket.DOCUMENT_CONTROL,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Make a version effective or retire it.",
    ),
    PermissionCatalogueEntry(
        key="acknowledge_qualitydocument",
        permission="document_control.acknowledge_qualitydocument",
        bucket=CapabilityBucket.DOCUMENT_CONTROL,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Record optional read/acknowledgement of an effective version.",
        notes="Acknowledgement is not competency training (Phase 05E).",
    ),
    PermissionCatalogueEntry(
        key="link_qualitydocumentversion",
        permission="document_control.link_qualitydocumentversion",
        bucket=CapabilityBucket.DOCUMENT_CONTROL,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Link a quality record to an exact approved/effective/retired version.",
    ),
    PermissionCatalogueEntry(
        key="view_qualitychange",
        permission="change_control.view_qualitychange",
        bucket=CapabilityBucket.CHANGE_CONTROL,
        scopes=(ObjectScope.ORGANIZATION,),
        description="View quality change requests and lifecycle history.",
    ),
    PermissionCatalogueEntry(
        key="create_qualitychange",
        permission="change_control.create_qualitychange",
        bucket=CapabilityBucket.CHANGE_CONTROL,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Create change requests and link affected areas before approval.",
    ),
    PermissionCatalogueEntry(
        key="assess_qualitychange",
        permission="change_control.assess_qualitychange",
        bucket=CapabilityBucket.CHANGE_CONTROL,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Record quality, food-safety, technical, training, and data-migration impact.",
    ),
    PermissionCatalogueEntry(
        key="approve_qualitychange",
        permission="change_control.approve_qualitychange",
        bucket=CapabilityBucket.CHANGE_CONTROL,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Approve a change after impact assessment. Requester cannot self-approve.",
        notes="Engineering completion is never approval; APR-069 EVIDENCE REQUIRED.",
    ),
    PermissionCatalogueEntry(
        key="implement_qualitychange",
        permission="change_control.implement_qualitychange",
        bucket=CapabilityBucket.CHANGE_CONTROL,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Record deployed configuration/version links after approval.",
        notes="Implementation links do not constitute business approval.",
    ),
    PermissionCatalogueEntry(
        key="verify_qualitychange",
        permission="change_control.verify_qualitychange",
        bucket=CapabilityBucket.CHANGE_CONTROL,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Verify and close a change. Approver cannot also close.",
    ),
    PermissionCatalogueEntry(
        key="view_qualityaudit",
        permission="quality_audits.view_qualityaudit",
        bucket=CapabilityBucket.QUALITY_AUDITS,
        scopes=(ObjectScope.ORGANIZATION,),
        description="View QMS quality audits and findings (not security audit events).",
        notes="Distinct from audit_access / security_audit.",
    ),
    PermissionCatalogueEntry(
        key="plan_qualityaudit",
        permission="quality_audits.plan_qualityaudit",
        bucket=CapabilityBucket.QUALITY_AUDITS,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Plan QMS audits, participants, and audit-checklist bindings.",
    ),
    PermissionCatalogueEntry(
        key="execute_qualityaudit",
        permission="quality_audits.execute_qualityaudit",
        bucket=CapabilityBucket.QUALITY_AUDITS,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Execute audits and record findings. Separate from operational QA review.",
    ),
    PermissionCatalogueEntry(
        key="close_qualityaudit",
        permission="quality_audits.close_qualityaudit",
        bucket=CapabilityBucket.QUALITY_AUDITS,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Verify findings and close QMS quality audits.",
    ),
    PermissionCatalogueEntry(
        key="link_audit_quality_case",
        permission="quality_audits.link_audit_quality_case",
        bucket=CapabilityBucket.QUALITY_AUDITS,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Explicitly link or create NCR/CAPA from a finding. Never automatic.",
    ),
    PermissionCatalogueEntry(
        key="manage_auditfindingconfig",
        permission="quality_audits.manage_auditfindingconfig",
        bucket=CapabilityBucket.QUALITY_AUDITS,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Manage unseeded finding classification/severity code shells.",
        notes="APR-070 EVIDENCE REQUIRED before claiming a company taxonomy.",
    ),
    PermissionCatalogueEntry(
        key="view_compliancemapping",
        permission="compliance_mapping.view_compliancemapping",
        bucket=CapabilityBucket.COMPLIANCE_MAPPING,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Read-only view of compliance sources and control mappings.",
        notes="Auditor read access. Not a certification or legal-compliance claim.",
    ),
    PermissionCatalogueEntry(
        key="manage_compliancesource",
        permission="compliance_mapping.manage_compliancesource",
        bucket=CapabilityBucket.COMPLIANCE_MAPPING,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Register and revise compliance sources and applicability decisions.",
        notes="Restricted administration. Do not seed unsupported applicability.",
    ),
    PermissionCatalogueEntry(
        key="manage_compliancecontrol",
        permission="compliance_mapping.manage_compliancecontrol",
        bucket=CapabilityBucket.COMPLIANCE_MAPPING,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Create mappings, evidence citations, and gap records.",
    ),
    PermissionCatalogueEntry(
        key="verify_compliancecontrol",
        permission="compliance_mapping.verify_compliancecontrol",
        bucket=CapabilityBucket.COMPLIANCE_MAPPING,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Record verification of an implemented control. Verification is not COMPLIANT.",
    ),
    PermissionCatalogueEntry(
        key="link_compliance_gap_action",
        permission="compliance_mapping.link_compliance_gap_action",
        bucket=CapabilityBucket.COMPLIANCE_MAPPING,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Explicitly link gap follow-up (risk/change/NCR/CAPA/action). Never automatic.",
    ),
    PermissionCatalogueEntry(
        key="view_qualityrisk",
        permission="quality_risks.view_qualityrisk",
        bucket=CapabilityBucket.QUALITY_RISKS,
        scopes=(ObjectScope.ORGANIZATION,),
        description="View quality risks, assessments, and dashboard queries.",
        notes="No invented scoring matrix.",
    ),
    PermissionCatalogueEntry(
        key="manage_qualityrisk",
        permission="quality_risks.manage_qualityrisk",
        bucket=CapabilityBucket.QUALITY_RISKS,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Create and maintain quality risks, links, reviews, and mitigations.",
    ),
    PermissionCatalogueEntry(
        key="assess_qualityrisk",
        permission="quality_risks.assess_qualityrisk",
        bucket=CapabilityBucket.QUALITY_RISKS,
        scopes=(ObjectScope.ORGANIZATION,),
        description=(
            "Record append-only historical assessments. Previous versions are not overwritten."
        ),
    ),
    PermissionCatalogueEntry(
        key="accept_qualityrisk",
        permission="quality_risks.accept_qualityrisk",
        bucket=CapabilityBucket.QUALITY_RISKS,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Accept residual risk. Separate from manage. No invented acceptance threshold.",
    ),
    PermissionCatalogueEntry(
        key="manage_qualityriskpolicy",
        permission="quality_risks.manage_qualityriskpolicy",
        bucket=CapabilityBucket.QUALITY_RISKS,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Configure owner-cited scoring policy. Default OFF. APR-072 EVIDENCE REQUIRED.",
    ),
    PermissionCatalogueEntry(
        key="view_processfmea",
        permission="process_fmea.view_processfmea",
        bucket=CapabilityBucket.PROCESS_FMEA,
        scopes=(ObjectScope.ORGANIZATION,),
        description="View process FMEA records and versions.",
        notes="No invented RPN or Action Priority policy.",
    ),
    PermissionCatalogueEntry(
        key="manage_processfmea",
        permission="process_fmea.manage_processfmea",
        bucket=CapabilityBucket.PROCESS_FMEA,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Draft and maintain process FMEA versions, steps, modes, and links.",
    ),
    PermissionCatalogueEntry(
        key="approve_processfmea",
        permission="process_fmea.approve_processfmea",
        bucket=CapabilityBucket.PROCESS_FMEA,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Approve a draft process FMEA version. Approved versions are immutable.",
    ),
    PermissionCatalogueEntry(
        key="configure_processfmeascoring",
        permission="process_fmea.configure_processfmeascoring",
        bucket=CapabilityBucket.PROCESS_FMEA,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Configure owner-cited FMEA scoring. Default OFF. APR-073 EVIDENCE REQUIRED.",
    ),
    PermissionCatalogueEntry(
        key="link_processfmea_action",
        permission="process_fmea.link_processfmea_action",
        bucket=CapabilityBucket.PROCESS_FMEA,
        scopes=(ObjectScope.ORGANIZATION,),
        description=(
            "Explicitly link recommended actions to CAPA or change request. Never automatic."
        ),
    ),
    PermissionCatalogueEntry(
        key="view_rca",
        permission="rca.view_rca",
        bucket=CapabilityBucket.RCA,
        scopes=(ObjectScope.ORGANIZATION,),
        description="View structured RCA records and history.",
        notes="AI hypotheses are not confirmed root causes.",
    ),
    PermissionCatalogueEntry(
        key="manage_rca",
        permission="rca.manage_rca",
        bucket=CapabilityBucket.RCA,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Create and edit RCA records, optional methods, and possible/supported causes.",
    ),
    PermissionCatalogueEntry(
        key="confirm_rca",
        permission="rca.confirm_rca",
        bucket=CapabilityBucket.RCA,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Human confirmation of a root cause with evidence. Software/AI cannot confirm.",
    ),
    PermissionCatalogueEntry(
        key="link_rca_capa",
        permission="rca.link_rca_capa",
        bucket=CapabilityBucket.RCA,
        scopes=(ObjectScope.ORGANIZATION,),
        description="Link a confirmed root cause to CAPA by explicit action. Never automatic.",
    ),
    PermissionCatalogueEntry(
        key="manage_supplierquality_qa",
        permission="supplier_quality.manage_supplierquality_qa",
        bucket=CapabilityBucket.MANAGE,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SYSTEM_WIDE),
        description="Manage supplier quality profiles (QA-oriented technical permission).",
    ),
    PermissionCatalogueEntry(
        key="view_supplierquality_procurement",
        permission="supplier_quality.view_supplierquality_procurement",
        bucket=CapabilityBucket.VIEW,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SYSTEM_WIDE),
        description="View supplier quality profiles (procurement-oriented technical permission).",
    ),
    PermissionCatalogueEntry(
        key="record_checklisttask",
        permission="scheduling.record_checklisttask",
        bucket=CapabilityBucket.RECORD,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Enter draft checklist responses.",
        notes="Also used for correction/resubmission entry (same technical permission).",
    ),
    PermissionCatalogueEntry(
        key="submit_via_record",
        permission="scheduling.record_checklisttask",
        bucket=CapabilityBucket.SUBMIT,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description=(
            "Submit draft records (submit rides on record permission; no separate codename)."
        ),
        notes="Distinct capability bucket for documentation; same Django permission as record.",
    ),
    PermissionCatalogueEntry(
        key="correction_via_record",
        permission="scheduling.record_checklisttask",
        bucket=CapabilityBucket.CORRECTION,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description=(
            "Start/edit/resubmit corrections (technical permission is record_checklisttask)."
        ),
        notes="Ownership locking EVIDENCE REQUIRED; manage/review do not imply correction.",
    ),
    PermissionCatalogueEntry(
        key="review_checklistsubmission",
        permission="reviews.review_checklistsubmission",
        bucket=CapabilityBucket.SUPERVISOR_REVIEW,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Record immutable Supervisor review on submissions.",
        notes="Does not imply record or QA review.",
    ),
    PermissionCatalogueEntry(
        key="qa_review_checklistsubmission",
        permission="quality.qa_review_checklistsubmission",
        bucket=CapabilityBucket.QA_REVIEW,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Record immutable QA final disposition (RELEASE/HOLD/REJECT labels).",
        notes="Does not imply Supervisor review or recording.",
    ),
    PermissionCatalogueEntry(
        key="upload_evidenceattachment",
        permission="evidence.upload_evidenceattachment",
        bucket=CapabilityBucket.EVIDENCE,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Upload optional evidence attachments to allowlisted quality objects.",
        notes="Does not force evidence for checklist items; parent capability also required.",
    ),
    PermissionCatalogueEntry(
        key="view_evidenceattachment",
        permission="evidence.view_evidenceattachment",
        bucket=CapabilityBucket.EVIDENCE,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="View/download evidence via authorized endpoints (no public URLs).",
        notes="Every download is authorization-checked; binaries stay in private storage.",
    ),
    PermissionCatalogueEntry(
        key="retire_evidenceattachment",
        permission="evidence.retire_evidenceattachment",
        bucket=CapabilityBucket.EVIDENCE,
        scopes=(ObjectScope.ORGANIZATION, ObjectScope.SITE, ObjectScope.DEPARTMENT),
        description="Soft-retire evidence (no casual hard-delete), including immutable linkages.",
        notes="Immutable parent linkages require this permission plus a retirement reason.",
    ),
    PermissionCatalogueEntry(
        key="audit_event_view",
        permission="security_audit.view_securityauditevent",
        bucket=CapabilityBucket.AUDIT_ACCESS,
        scopes=(ObjectScope.SYSTEM_WIDE,),
        description="View security audit events via Django admin/default view (if granted).",
        notes="No separate custom audit-export permission in Phase 03C.",
    ),
    PermissionCatalogueEntry(
        key="system_administration_superuser",
        permission="__django_superuser__",
        bucket=CapabilityBucket.SYSTEM_ADMINISTRATION,
        scopes=(ObjectScope.SYSTEM_WIDE,),
        description="Django is_superuser bypasses scoped RBAC checks (tested separately).",
        notes=(
            "Not a Permission row. Prefer scoped roles for operational work; "
            "superuser is break-glass."
        ),
    ),
)


CATALOGUE_BY_KEY: Final[dict[str, PermissionCatalogueEntry]] = {
    entry.key: entry for entry in PERMISSION_CATALOGUE
}


def catalogue_keys() -> frozenset[str]:
    return frozenset(CATALOGUE_BY_KEY)


def entries_for_bucket(bucket: CapabilityBucket) -> tuple[PermissionCatalogueEntry, ...]:
    return tuple(e for e in PERMISSION_CATALOGUE if e.bucket == bucket)


def technical_permission_codenames() -> frozenset[str]:
    """Django app_label.codename values (excludes superuser sentinel)."""
    return frozenset(
        e.permission for e in PERMISSION_CATALOGUE if e.permission != "__django_superuser__"
    )
