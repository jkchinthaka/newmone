"""Security audit event model — append-oriented auth/RBAC events."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class SecurityAuditEvent(models.Model):
    class EventType(models.TextChoices):
        LOGIN_SUCCESS = "LOGIN_SUCCESS", "Login success"
        LOGIN_FAILURE = "LOGIN_FAILURE", "Login failure"
        ACCOUNT_LOCKED = "ACCOUNT_LOCKED", "Account locked"
        ACCOUNT_UNLOCKED = "ACCOUNT_UNLOCKED", "Account unlocked"
        LOGOUT = "LOGOUT", "Logout"
        PASSWORD_CHANGED = "PASSWORD_CHANGED", "Password changed"
        PASSWORD_RESET_BY_ADMIN = "PASSWORD_RESET_BY_ADMIN", "Password reset by admin"
        USER_ACTIVATED = "USER_ACTIVATED", "User activated"
        USER_DEACTIVATED = "USER_DEACTIVATED", "User deactivated"
        ROLE_ASSIGNED = "ROLE_ASSIGNED", "Role assigned"
        ROLE_REVOKED = "ROLE_REVOKED", "Role revoked"
        ROLE_PERMISSIONS_UPDATED = "ROLE_PERMISSIONS_UPDATED", "Role permissions updated"
        ROLE_TEMPLATE_CREATED = "ROLE_TEMPLATE_CREATED", "Role template created"
        ROLE_TEMPLATE_UPDATED = "ROLE_TEMPLATE_UPDATED", "Role template updated"
        ROLE_TEMPLATE_APPLIED = "ROLE_TEMPLATE_APPLIED", "Role template applied to role"
        SHIFT_CREATED = "SHIFT_CREATED", "Shift created"
        SHIFT_UPDATED = "SHIFT_UPDATED", "Shift updated"
        SHIFT_ACTIVATED = "SHIFT_ACTIVATED", "Shift activated"
        SHIFT_DEACTIVATED = "SHIFT_DEACTIVATED", "Shift deactivated"
        ORGANIZATION_CREATED = "ORGANIZATION_CREATED", "Organization created"
        ORGANIZATION_UPDATED = "ORGANIZATION_UPDATED", "Organization updated"
        ORGANIZATION_ACTIVATED = "ORGANIZATION_ACTIVATED", "Organization activated"
        ORGANIZATION_DEACTIVATED = "ORGANIZATION_DEACTIVATED", "Organization deactivated"
        SITE_CREATED = "SITE_CREATED", "Site created"
        SITE_UPDATED = "SITE_UPDATED", "Site updated"
        SITE_ACTIVATED = "SITE_ACTIVATED", "Site activated"
        SITE_DEACTIVATED = "SITE_DEACTIVATED", "Site deactivated"
        DEPARTMENT_CREATED = "DEPARTMENT_CREATED", "Department created"
        DEPARTMENT_UPDATED = "DEPARTMENT_UPDATED", "Department updated"
        DEPARTMENT_ACTIVATED = "DEPARTMENT_ACTIVATED", "Department activated"
        DEPARTMENT_DEACTIVATED = "DEPARTMENT_DEACTIVATED", "Department deactivated"
        ORGANIZATION_HIERARCHY_IMPORT_PREVIEWED = (
            "ORGANIZATION_HIERARCHY_IMPORT_PREVIEWED",
            "Organization hierarchy import previewed",
        )
        ORGANIZATION_HIERARCHY_IMPORT_COMPLETED = (
            "ORGANIZATION_HIERARCHY_IMPORT_COMPLETED",
            "Organization hierarchy import completed",
        )
        ORGANIZATION_HIERARCHY_IMPORT_FAILED = (
            "ORGANIZATION_HIERARCHY_IMPORT_FAILED",
            "Organization hierarchy import failed",
        )
        FG_PRODUCT_CREATED = "FG_PRODUCT_CREATED", "FG Product created"
        FG_PRODUCT_UPDATED = "FG_PRODUCT_UPDATED", "FG Product updated"
        FG_PRODUCT_ACTIVATED = "FG_PRODUCT_ACTIVATED", "FG Product activated"
        FG_PRODUCT_DEACTIVATED = "FG_PRODUCT_DEACTIVATED", "FG Product deactivated"
        FG_PRODUCT_IMPORT_PREVIEWED = (
            "FG_PRODUCT_IMPORT_PREVIEWED",
            "FG Product import previewed",
        )
        FG_PRODUCT_IMPORT_COMPLETED = (
            "FG_PRODUCT_IMPORT_COMPLETED",
            "FG Product import completed",
        )
        FG_PRODUCT_IMPORT_FAILED = (
            "FG_PRODUCT_IMPORT_FAILED",
            "FG Product import failed",
        )
        EQUIPMENT_CREATED = "EQUIPMENT_CREATED", "Equipment created"
        EQUIPMENT_UPDATED = "EQUIPMENT_UPDATED", "Equipment updated"
        EQUIPMENT_ACTIVATED = "EQUIPMENT_ACTIVATED", "Equipment activated"
        EQUIPMENT_DEACTIVATED = "EQUIPMENT_DEACTIVATED", "Equipment deactivated"
        EQUIPMENT_STATUS_CHANGED = (
            "EQUIPMENT_STATUS_CHANGED",
            "Equipment operational status changed",
        )
        CALIBRATION_RECORD_CREATED = (
            "CALIBRATION_RECORD_CREATED",
            "Calibration record created",
        )
        CALIBRATION_CERTIFICATE_METADATA_UPDATED = (
            "CALIBRATION_CERTIFICATE_METADATA_UPDATED",
            "Calibration certificate metadata updated",
        )
        TRAINING_RECORD_CREATED = "TRAINING_RECORD_CREATED", "Training record created"
        TRAINING_RECORD_UPDATED = "TRAINING_RECORD_UPDATED", "Training record updated"
        TRAINING_RECORD_STATUS_CHANGED = (
            "TRAINING_RECORD_STATUS_CHANGED",
            "Training record status changed",
        )
        TRAINING_ENFORCEMENT_POLICY_CREATED = (
            "TRAINING_ENFORCEMENT_POLICY_CREATED",
            "Training enforcement policy created",
        )
        TRAINING_ENFORCEMENT_POLICY_UPDATED = (
            "TRAINING_ENFORCEMENT_POLICY_UPDATED",
            "Training enforcement policy updated",
        )
        PRODUCT_SPECIFICATION_CREATED = (
            "PRODUCT_SPECIFICATION_CREATED",
            "Product specification created",
        )
        SPECIFICATION_VERSION_CREATED = (
            "SPECIFICATION_VERSION_CREATED",
            "Specification version created",
        )
        SPECIFICATION_VERSION_UPDATED = (
            "SPECIFICATION_VERSION_UPDATED",
            "Specification version updated",
        )
        SPECIFICATION_VERSION_APPROVED = (
            "SPECIFICATION_VERSION_APPROVED",
            "Specification version approved",
        )
        SPECIFICATION_VERSION_RETIRED = (
            "SPECIFICATION_VERSION_RETIRED",
            "Specification version retired",
        )
        SPECIFICATION_VERSION_CLONED = (
            "SPECIFICATION_VERSION_CLONED",
            "Specification version cloned",
        )
        SPECIFICATION_PARAMETER_CREATED = (
            "SPECIFICATION_PARAMETER_CREATED",
            "Specification parameter created",
        )
        SPECIFICATION_PARAMETER_UPDATED = (
            "SPECIFICATION_PARAMETER_UPDATED",
            "Specification parameter updated",
        )
        SPECIFICATION_PARAMETER_REMOVED = (
            "SPECIFICATION_PARAMETER_REMOVED",
            "Specification parameter removed",
        )
        CHECKLIST_TEMPLATE_CREATED = "CHECKLIST_TEMPLATE_CREATED", "Checklist template created"
        CHECKLIST_TEMPLATE_UPDATED = "CHECKLIST_TEMPLATE_UPDATED", "Checklist template updated"
        CHECKLIST_TEMPLATE_ACTIVATED = (
            "CHECKLIST_TEMPLATE_ACTIVATED",
            "Checklist template activated",
        )
        CHECKLIST_TEMPLATE_DEACTIVATED = (
            "CHECKLIST_TEMPLATE_DEACTIVATED",
            "Checklist template deactivated",
        )
        CHECKLIST_VERSION_CREATED = "CHECKLIST_VERSION_CREATED", "Checklist version created"
        CHECKLIST_VERSION_CLONED = "CHECKLIST_VERSION_CLONED", "Checklist version cloned"
        CHECKLIST_VERSION_PUBLISHED = "CHECKLIST_VERSION_PUBLISHED", "Checklist version published"
        CHECKLIST_VERSION_RETIRED = "CHECKLIST_VERSION_RETIRED", "Checklist version retired"
        CHECKLIST_VERSION_EFFECTIVITY_UPDATED = (
            "CHECKLIST_VERSION_EFFECTIVITY_UPDATED",
            "Checklist version effectivity updated",
        )
        CHECKLIST_ITEM_EVALUATION_RULE_SET = (
            "CHECKLIST_ITEM_EVALUATION_RULE_SET",
            "Checklist item evaluation rule set",
        )
        CHECKLIST_ITEM_EVALUATION_RULE_CLEARED = (
            "CHECKLIST_ITEM_EVALUATION_RULE_CLEARED",
            "Checklist item evaluation rule cleared",
        )
        CHECKLIST_ITEM_CONTROL_POINT_METADATA_UPDATED = (
            "CHECKLIST_ITEM_CONTROL_POINT_METADATA_UPDATED",
            "Checklist item control-point metadata updated",
        )
        CHECKLIST_ITEM_MEASUREMENT_SEMANTICS_UPDATED = (
            "CHECKLIST_ITEM_MEASUREMENT_SEMANTICS_UPDATED",
            "Checklist item measurement semantics updated",
        )
        CHECKLIST_TASK_CREATED = "CHECKLIST_TASK_CREATED", "Checklist task created"
        CHECKLIST_TASK_CANCELLED = "CHECKLIST_TASK_CANCELLED", "Checklist task cancelled"
        CHECKLIST_TASK_ASSIGNED = "CHECKLIST_TASK_ASSIGNED", "Checklist task assigned"
        CHECKLIST_TASK_REASSIGNED = (
            "CHECKLIST_TASK_REASSIGNED",
            "Checklist task reassigned",
        )
        CHECKLIST_TASK_UNASSIGNED = (
            "CHECKLIST_TASK_UNASSIGNED",
            "Checklist task unassigned",
        )
        CHECKLIST_TASK_DUE_WINDOW_UPDATED = (
            "CHECKLIST_TASK_DUE_WINDOW_UPDATED",
            "Checklist task due window updated",
        )
        CHECKLIST_TASK_GENERATED = (
            "CHECKLIST_TASK_GENERATED",
            "Checklist task generated by schedule engine",
        )
        CHECKLIST_SCHEDULE_CREATED = (
            "CHECKLIST_SCHEDULE_CREATED",
            "Checklist schedule created",
        )
        CHECKLIST_SCHEDULE_DEACTIVATED = (
            "CHECKLIST_SCHEDULE_DEACTIVATED",
            "Checklist schedule deactivated",
        )
        CHECKLIST_SCHEDULE_GENERATION_RUN = (
            "CHECKLIST_SCHEDULE_GENERATION_RUN",
            "Checklist schedule generation run",
        )
        EXTERNAL_BATCH_EVENT_RECEIVED = (
            "EXTERNAL_BATCH_EVENT_RECEIVED",
            "External batch event received",
        )
        EXTERNAL_BATCH_EVENT_DUPLICATE = (
            "EXTERNAL_BATCH_EVENT_DUPLICATE",
            "External batch event duplicate (idempotent)",
        )
        EXTERNAL_BATCH_EVENT_MAPPING_FAILED = (
            "EXTERNAL_BATCH_EVENT_MAPPING_FAILED",
            "External batch event mapping failed",
        )
        EXTERNAL_BATCH_EVENT_APPLICABILITY_FAILED = (
            "EXTERNAL_BATCH_EVENT_APPLICABILITY_FAILED",
            "External batch event applicability failed",
        )
        EXTERNAL_BATCH_EVENT_VERSION_FAILED = (
            "EXTERNAL_BATCH_EVENT_VERSION_FAILED",
            "External batch event effective-version failed",
        )
        EXTERNAL_BATCH_EVENT_PROCESSED = (
            "EXTERNAL_BATCH_EVENT_PROCESSED",
            "External batch event processed to checklist task",
        )
        EXTERNAL_BATCH_EVENT_REJECTED = (
            "EXTERNAL_BATCH_EVENT_REJECTED",
            "External batch event rejected",
        )
        EXTERNAL_BATCH_MAPPING_UPSERTED = (
            "EXTERNAL_BATCH_MAPPING_UPSERTED",
            "External batch mapping upserted",
        )
        CHECKLIST_APPLICABILITY_RULE_CREATED = (
            "CHECKLIST_APPLICABILITY_RULE_CREATED",
            "Checklist applicability rule created",
        )
        CHECKLIST_APPLICABILITY_RULE_UPDATED = (
            "CHECKLIST_APPLICABILITY_RULE_UPDATED",
            "Checklist applicability rule updated",
        )
        CHECKLIST_APPLICABILITY_RULE_DEACTIVATED = (
            "CHECKLIST_APPLICABILITY_RULE_DEACTIVATED",
            "Checklist applicability rule deactivated",
        )
        CHECKLIST_APPLICABILITY_PREVIEWED = (
            "CHECKLIST_APPLICABILITY_PREVIEWED",
            "Checklist applicability previewed",
        )
        CHECKLIST_RECORD_STARTED = "CHECKLIST_RECORD_STARTED", "Checklist record started"
        CHECKLIST_RECORD_DRAFT_SAVED = (
            "CHECKLIST_RECORD_DRAFT_SAVED",
            "Checklist record draft saved",
        )
        CHECKLIST_RECORD_SUBMITTED = (
            "CHECKLIST_RECORD_SUBMITTED",
            "Checklist record submitted",
        )
        SUPERVISOR_REVIEW_COMPLETED = (
            "SUPERVISOR_REVIEW_COMPLETED",
            "Supervisor review completed",
        )
        SUPERVISOR_REVIEW_GOVERNANCE_POLICY_SET = (
            "SUPERVISOR_REVIEW_GOVERNANCE_POLICY_SET",
            "Supervisor review governance policy set",
        )
        SUPERVISOR_REVIEW_DELEGATION_GRANTED = (
            "SUPERVISOR_REVIEW_DELEGATION_GRANTED",
            "Supervisor review temporary delegation granted",
        )
        SUPERVISOR_REVIEW_DELEGATION_REVOKED = (
            "SUPERVISOR_REVIEW_DELEGATION_REVOKED",
            "Supervisor review temporary delegation revoked",
        )
        CHECKLIST_CORRECTION_STARTED = (
            "CHECKLIST_CORRECTION_STARTED",
            "Checklist correction started",
        )
        CHECKLIST_CORRECTION_RESUBMITTED = (
            "CHECKLIST_CORRECTION_RESUBMITTED",
            "Checklist correction resubmitted",
        )
        QA_REVIEW_COMPLETED = (
            "QA_REVIEW_COMPLETED",
            "QA review disposition completed",
        )
        NONCONFORMANCE_CREATED = "NONCONFORMANCE_CREATED", "Nonconformance created"
        NONCONFORMANCE_UPDATED = "NONCONFORMANCE_UPDATED", "Nonconformance updated"
        NONCONFORMANCE_STATUS_CHANGED = (
            "NONCONFORMANCE_STATUS_CHANGED",
            "Nonconformance status changed",
        )
        NONCONFORMANCE_CLOSED = "NONCONFORMANCE_CLOSED", "Nonconformance closed"
        HOLD_CASE_CREATED = "HOLD_CASE_CREATED", "Hold case created"
        HOLD_CASE_CLOSED = "HOLD_CASE_CLOSED", "Hold case closed"
        CAPA_CREATED = "CAPA_CREATED", "CAPA created"
        CAPA_STATUS_CHANGED = "CAPA_STATUS_CHANGED", "CAPA status changed"
        CAPA_ACTION_ADDED = "CAPA_ACTION_ADDED", "CAPA action item added"
        CAPA_VERIFICATION_RECORDED = (
            "CAPA_VERIFICATION_RECORDED",
            "CAPA verification recorded",
        )
        CAPA_EFFECTIVENESS_REVIEWED = (
            "CAPA_EFFECTIVENESS_REVIEWED",
            "CAPA effectiveness review recorded",
        )
        CAPA_CLOSED = "CAPA_CLOSED", "CAPA closed"
        DISPATCH_QUALITY_RECORD_CREATED = (
            "DISPATCH_QUALITY_RECORD_CREATED",
            "Dispatch quality record created",
        )
        DISPATCH_QUALITY_RECORD_UPDATED = (
            "DISPATCH_QUALITY_RECORD_UPDATED",
            "Dispatch quality record updated",
        )
        DISPATCH_VEHICLE_INSPECTION_LINKED = (
            "DISPATCH_VEHICLE_INSPECTION_LINKED",
            "Dispatch vehicle inspection linked",
        )
        DISPATCH_QA_REVIEW_LINKED = (
            "DISPATCH_QA_REVIEW_LINKED",
            "Dispatch QA review linked",
        )
        DISPATCH_TEMPERATURE_RECORDED = (
            "DISPATCH_TEMPERATURE_RECORDED",
            "Dispatch cold-chain temperature recorded",
        )
        DISPATCH_QUANTITY_LINE_SET = (
            "DISPATCH_QUANTITY_LINE_SET",
            "Dispatch quantity line set",
        )
        DISPATCH_RELEASE_POLICY_UPDATED = (
            "DISPATCH_RELEASE_POLICY_UPDATED",
            "Dispatch QA release policy updated",
        )
        DISPATCH_RELEASE_GATE_EVALUATED = (
            "DISPATCH_RELEASE_GATE_EVALUATED",
            "Dispatch QA release gate evaluated",
        )
        DISPATCH_QUALITY_RECORD_COMPLETED = (
            "DISPATCH_QUALITY_RECORD_COMPLETED",
            "Dispatch quality record completed",
        )
        DISPATCH_QUALITY_RECORD_CANCELLED = (
            "DISPATCH_QUALITY_RECORD_CANCELLED",
            "Dispatch quality record cancelled",
        )
        SUPPLIER_QUALITY_PROFILE_CREATED = (
            "SUPPLIER_QUALITY_PROFILE_CREATED",
            "Supplier quality profile created",
        )
        SUPPLIER_QUALITY_PROFILE_UPDATED = (
            "SUPPLIER_QUALITY_PROFILE_UPDATED",
            "Supplier quality profile updated",
        )
        SUPPLIER_CERTIFICATE_RECORDED = (
            "SUPPLIER_CERTIFICATE_RECORDED",
            "Supplier certificate recorded",
        )
        SUPPLIER_CERTIFICATE_VERIFIED = (
            "SUPPLIER_CERTIFICATE_VERIFIED",
            "Supplier certificate verified",
        )
        SUPPLIER_QUALITY_EVENT_RECORDED = (
            "SUPPLIER_QUALITY_EVENT_RECORDED",
            "Supplier quality event recorded",
        )
        EVIDENCE_UPLOADED = (
            "EVIDENCE_UPLOADED",
            "Evidence attachment uploaded",
        )
        EVIDENCE_DOWNLOADED = (
            "EVIDENCE_DOWNLOADED",
            "Evidence attachment downloaded",
        )
        EVIDENCE_RETIRED = (
            "EVIDENCE_RETIRED",
            "Evidence attachment soft-retired",
        )
        EVIDENCE_ACCESS_DENIED = (
            "EVIDENCE_ACCESS_DENIED",
            "Evidence attachment access denied or missing blob",
        )
        DISPATCH_RELEASE_GATE_BLOCKED = (
            "DISPATCH_RELEASE_GATE_BLOCKED",
            "Dispatch completion blocked by QA release gate",
        )
        NOTIFICATION_POLICY_UPDATED = (
            "NOTIFICATION_POLICY_UPDATED",
            "Notification policy updated",
        )
        NOTIFICATION_CREATED = (
            "NOTIFICATION_CREATED",
            "In-app notification created",
        )
        NOTIFICATION_READ = (
            "NOTIFICATION_READ",
            "Notification marked read",
        )
        NOTIFICATION_EMAIL_DELIVERED = (
            "NOTIFICATION_EMAIL_DELIVERED",
            "Notification email delivered",
        )
        NOTIFICATION_EMAIL_FAILED = (
            "NOTIFICATION_EMAIL_FAILED",
            "Notification email delivery failed",
        )
        REPORT_RUN_ENQUEUED = (
            "REPORT_RUN_ENQUEUED",
            "Governed report run enqueued for background generation",
        )
        REPORT_RUN_COMPLETED = (
            "REPORT_RUN_COMPLETED",
            "Governed report run completed",
        )
        REPORT_EXPORTED = (
            "REPORT_EXPORTED",
            "Governed report exported (CSV generated for export)",
        )
        REPORT_EXPORT_DOWNLOADED = (
            "REPORT_EXPORT_DOWNLOADED",
            "Governed report CSV downloaded",
        )
        INTEGRATION_INBOUND_SUCCEEDED = (
            "INTEGRATION_INBOUND_SUCCEEDED",
            "Integration inbound attempt succeeded",
        )
        INTEGRATION_INBOUND_FAILED = (
            "INTEGRATION_INBOUND_FAILED",
            "Integration inbound attempt failed",
        )
        INTEGRATION_INBOUND_DUPLICATE = (
            "INTEGRATION_INBOUND_DUPLICATE",
            "Integration inbound duplicate (idempotent)",
        )
        INTEGRATION_LIVE_BLOCKED = (
            "INTEGRATION_LIVE_BLOCKED",
            "Live Bileeta pull blocked by evidence gate",
        )
        INTEGRATION_DEAD_LETTER = (
            "INTEGRATION_DEAD_LETTER",
            "Integration attempt marked dead letter",
        )
        INTEGRATION_OUTBOUND_BLOCKED = (
            "INTEGRATION_OUTBOUND_BLOCKED",
            "Outbound ERP disposition blocked pending approval",
        )
        AI_ASSISTANCE_COMPLETED = (
            "AI_ASSISTANCE_COMPLETED",
            "AI assistance request completed (advisory)",
        )
        AI_ASSISTANCE_BLOCKED = (
            "AI_ASSISTANCE_BLOCKED",
            "AI assistance request blocked (safety/auth)",
        )
        AI_ASSISTANCE_DISABLED = (
            "AI_ASSISTANCE_DISABLED",
            "AI assistance invoked while feature disabled",
        )
        AI_ASSISTANCE_FALLBACK = (
            "AI_ASSISTANCE_FALLBACK",
            "AI assistance safe fallback after provider failure/timeout",
        )
        LAB_SAMPLE_CREATED = "LAB_SAMPLE_CREATED", "Laboratory sample created"
        LAB_SAMPLE_STATUS_CHANGED = (
            "LAB_SAMPLE_STATUS_CHANGED",
            "Laboratory sample status changed",
        )
        LAB_RESULT_ENTERED = "LAB_RESULT_ENTERED", "Laboratory result entered"
        LAB_RESULT_VERIFIED = "LAB_RESULT_VERIFIED", "Laboratory result verified"
        LAB_RESULT_FINALIZED = "LAB_RESULT_FINALIZED", "Laboratory result finalized"
        LAB_RESULT_AMENDED = "LAB_RESULT_AMENDED", "Laboratory result amended"
        LAB_EXTERNAL_CERTIFICATE_RECORDED = (
            "LAB_EXTERNAL_CERTIFICATE_RECORDED",
            "Laboratory external certificate recorded",
        )
        LAB_POSITIVE_RELEASE_POLICY_UPDATED = (
            "LAB_POSITIVE_RELEASE_POLICY_UPDATED",
            "Laboratory positive-release policy updated",
        )

        HACCP_PLAN_CREATED = "HACCP_PLAN_CREATED", "HACCP plan created"
        HACCP_PLAN_VERSION_CREATED = (
            "HACCP_PLAN_VERSION_CREATED",
            "HACCP plan version created",
        )
        HACCP_PLAN_VERSION_APPROVED = (
            "HACCP_PLAN_VERSION_APPROVED",
            "HACCP plan version approved",
        )
        HACCP_PLAN_VERSION_RETIRED = (
            "HACCP_PLAN_VERSION_RETIRED",
            "HACCP plan version retired",
        )
        HACCP_CONTROL_POINT_MAPPED = (
            "HACCP_CONTROL_POINT_MAPPED",
            "HACCP control point mapped",
        )
        HACCP_CHECKLIST_BINDING_SET = (
            "HACCP_CHECKLIST_BINDING_SET",
            "HACCP checklist item binding set",
        )

        SAMPLING_PLAN_CREATED = "SAMPLING_PLAN_CREATED", "Sampling plan created"
        SAMPLING_PLAN_VERSION_CREATED = (
            "SAMPLING_PLAN_VERSION_CREATED",
            "Sampling plan version created",
        )
        SAMPLING_PLAN_VERSION_APPROVED = (
            "SAMPLING_PLAN_VERSION_APPROVED",
            "Sampling plan version approved",
        )
        SAMPLING_PLAN_VERSION_RETIRED = (
            "SAMPLING_PLAN_VERSION_RETIRED",
            "Sampling plan version retired",
        )
        SAMPLING_CHECKLIST_BINDING_SET = (
            "SAMPLING_CHECKLIST_BINDING_SET",
            "Sampling checklist item binding set",
        )

        DEVICE_CALIBRATION_OVERRIDE = (
            "DEVICE_CALIBRATION_OVERRIDE",
            "Calibration enforcement override for measuring device",
        )
        DEVICE_TRACE_ATTACHED = (
            "DEVICE_TRACE_ATTACHED",
            "Measuring device attached to checklist response",
        )

        FOREIGN_BODY_TEST_PIECE_CREATED = (
            "FOREIGN_BODY_TEST_PIECE_CREATED",
            "Foreign-body test piece created",
        )
        FOREIGN_BODY_SCHEDULE_RULE_CREATED = (
            "FOREIGN_BODY_SCHEDULE_RULE_CREATED",
            "Foreign-body schedule rule created",
        )
        FOREIGN_BODY_CHALLENGE_RECORDED = (
            "FOREIGN_BODY_CHALLENGE_RECORDED",
            "Metal-detector challenge test recorded",
        )
        FOREIGN_BODY_CHALLENGE_VERIFIED = (
            "FOREIGN_BODY_CHALLENGE_VERIFIED",
            "Metal-detector challenge test verified",
        )
        FOREIGN_BODY_CHALLENGE_VOIDED = (
            "FOREIGN_BODY_CHALLENGE_VOIDED",
            "Metal-detector challenge test voided",
        )
        FOREIGN_BODY_CONTAINMENT_ASSESSED = (
            "FOREIGN_BODY_CONTAINMENT_ASSESSED",
            "Foreign-body containment interval assessed",
        )

        SANITATION_PROGRAM_CREATED = (
            "SANITATION_PROGRAM_CREATED",
            "Sanitation program created",
        )
        SANITATION_PROGRAM_VERSION_CREATED = (
            "SANITATION_PROGRAM_VERSION_CREATED",
            "Sanitation program version created",
        )
        SANITATION_PROGRAM_VERSION_APPROVED = (
            "SANITATION_PROGRAM_VERSION_APPROVED",
            "Sanitation program version approved",
        )
        SANITATION_PROGRAM_VERSION_RETIRED = (
            "SANITATION_PROGRAM_VERSION_RETIRED",
            "Sanitation program version retired",
        )
        SANITATION_CHECKLIST_BINDING_SET = (
            "SANITATION_CHECKLIST_BINDING_SET",
            "Sanitation checklist template binding set",
        )
        SANITATION_FAIL_POLICY_UPDATED = (
            "SANITATION_FAIL_POLICY_UPDATED",
            "Sanitation fail / production-stop policy updated",
        )

        EM_POINT_CREATED = "EM_POINT_CREATED", "Environmental monitoring point created"
        EM_PARAMETER_CREATED = (
            "EM_PARAMETER_CREATED",
            "Environmental monitoring parameter created",
        )
        EM_SPEC_CREATED = "EM_SPEC_CREATED", "Environmental monitoring spec created"
        EM_SPEC_VERSION_CREATED = (
            "EM_SPEC_VERSION_CREATED",
            "Environmental monitoring spec version created",
        )
        EM_SPEC_VERSION_APPROVED = (
            "EM_SPEC_VERSION_APPROVED",
            "Environmental monitoring spec version approved",
        )
        EM_SPEC_VERSION_RETIRED = (
            "EM_SPEC_VERSION_RETIRED",
            "Environmental monitoring spec version retired",
        )
        EM_SCHEDULE_LINKED = (
            "EM_SCHEDULE_LINKED",
            "Environmental monitoring schedule linked",
        )
        EM_READING_RECORDED = (
            "EM_READING_RECORDED",
            "Environmental monitoring reading recorded",
        )
        EM_EXCURSION_EVALUATED = (
            "EM_EXCURSION_EVALUATED",
            "Environmental monitoring excursion/warning evaluated",
        )
        EM_EXCURSION_POLICY_UPDATED = (
            "EM_EXCURSION_POLICY_UPDATED",
            "Environmental excursion auto-HOLD policy updated",
        )

        PACKAGING_ARTWORK_CREATED = (
            "PACKAGING_ARTWORK_CREATED",
            "Packaging artwork created",
        )
        PACKAGING_ARTWORK_VERSION_CREATED = (
            "PACKAGING_ARTWORK_VERSION_CREATED",
            "Packaging artwork version created",
        )
        PACKAGING_ARTWORK_VERSION_APPROVED = (
            "PACKAGING_ARTWORK_VERSION_APPROVED",
            "Packaging artwork version approved",
        )
        PACKAGING_ARTWORK_VERSION_RETIRED = (
            "PACKAGING_ARTWORK_VERSION_RETIRED",
            "Packaging artwork version retired",
        )
        PACKAGING_ARTWORK_CHECKLIST_BINDING_SET = (
            "PACKAGING_ARTWORK_CHECKLIST_BINDING_SET",
            "Packaging artwork checklist item binding set",
        )
        PACKAGING_LINE_CLEARANCE_HOOK_CREATED = (
            "PACKAGING_LINE_CLEARANCE_HOOK_CREATED",
            "Line clearance artwork hook created",
        )
        PACKAGING_ARTWORK_VERIFICATION_RECORDED = (
            "PACKAGING_ARTWORK_VERIFICATION_RECORDED",
            "Packaging artwork verification recorded",
        )

        ALLERGEN_REFERENCE_CREATED = (
            "ALLERGEN_REFERENCE_CREATED",
            "Allergen reference shell created",
        )
        PRODUCT_ALLERGEN_DECLARATION_CREATED = (
            "PRODUCT_ALLERGEN_DECLARATION_CREATED",
            "Product allergen declaration drafted",
        )
        PRODUCT_ALLERGEN_DECLARATION_APPROVED = (
            "PRODUCT_ALLERGEN_DECLARATION_APPROVED",
            "Product allergen declaration approved",
        )
        CHANGEOVER_RECORDED = (
            "CHANGEOVER_RECORDED",
            "Product changeover recorded",
        )
        CHANGEOVER_VERIFIED = (
            "CHANGEOVER_VERIFIED",
            "Product changeover verified",
        )
        LINE_CLEARANCE_RECORDED = (
            "LINE_CLEARANCE_RECORDED",
            "Line clearance recorded",
        )
        ALLERGEN_RISK_POLICY_UPDATED = (
            "ALLERGEN_RISK_POLICY_UPDATED",
            "Allergen risk / production-block policy stub updated",
        )

        RECEIVING_MATERIAL_REFERENCE_CREATED = (
            "RECEIVING_MATERIAL_REFERENCE_CREATED",
            "ERP-mapped material reference created",
        )
        RECEIVING_MATERIAL_SPEC_APPROVED = (
            "RECEIVING_MATERIAL_SPEC_APPROVED",
            "Material specification version approved",
        )
        RECEIVING_RECEIPT_QUALITY_CREATED = (
            "RECEIVING_RECEIPT_QUALITY_CREATED",
            "Receipt quality record created",
        )
        RECEIVING_RECEIPT_QUALITY_DISPOSITIONED = (
            "RECEIVING_RECEIPT_QUALITY_DISPOSITIONED",
            "Receipt quality disposition set (local only)",
        )
        RECEIVING_LAB_SAMPLE_LINKED = (
            "RECEIVING_LAB_SAMPLE_LINKED",
            "Lab sample linked to receipt quality record",
        )
        RECEIVING_ERP_OUTBOUND_BLOCKED = (
            "RECEIVING_ERP_OUTBOUND_BLOCKED",
            "Receipt quality ERP outbound blocked (Phase 17 gate)",
        )

        IQC_CASE_OPENED = ("IQC_CASE_OPENED", "IQC inspection case opened")
        IQC_TASK_CREATED = ("IQC_TASK_CREATED", "IQC checklist task created")
        IQC_SAMPLING_RESOLVED = (
            "IQC_SAMPLING_RESOLVED",
            "IQC sampling requirement resolved",
        )
        IQC_LAB_SAMPLE_LINKED = (
            "IQC_LAB_SAMPLE_LINKED",
            "Lab sample linked via IQC case",
        )
        IQC_REVIEW_ATTACHED = (
            "IQC_REVIEW_ATTACHED",
            "IQC supervisor review attached",
        )
        IQC_DISPOSITIONED = (
            "IQC_DISPOSITIONED",
            "IQC local disposition completed",
        )
        IQC_RECEIPT_EVENT_PROCESSED = (
            "IQC_RECEIPT_EVENT_PROCESSED",
            "Incoming receipt/GRN event processed",
        )
        IQC_RECEIPT_EVENT_DUPLICATE = (
            "IQC_RECEIPT_EVENT_DUPLICATE",
            "Duplicate incoming receipt event (idempotent)",
        )
        IQC_POLICY_UPDATED = (
            "IQC_POLICY_UPDATED",
            "IQC workflow policy stub updated",
        )
        IQC_ERP_OUTBOUND_BLOCKED = (
            "IQC_ERP_OUTBOUND_BLOCKED",
            "IQC ERP outbound blocked",
        )
        IQC_ERP_OUTBOUND_PREPARED = (
            "IQC_ERP_OUTBOUND_PREPARED",
            "IQC ERP outbound prepared (adapter not live)",
        )

        IPQC_DEFINITION_CREATED = (
            "IPQC_DEFINITION_CREATED",
            "IPQC process-check definition created",
        )
        IPQC_CASE_OPENED = ("IPQC_CASE_OPENED", "IPQC inspection case opened")
        IPQC_CASE_DUPLICATE = (
            "IPQC_CASE_DUPLICATE",
            "Duplicate IPQC case generation (idempotent)",
        )
        IPQC_TASK_CREATED = (
            "IPQC_TASK_CREATED",
            "IPQC checklist task created",
        )
        IPQC_SCHEDULED_GENERATION_RUN = (
            "IPQC_SCHEDULED_GENERATION_RUN",
            "IPQC scheduled generation run",
        )
        IPQC_EQUIPMENT_LINKED = (
            "IPQC_EQUIPMENT_LINKED",
            "Equipment trace linked to IPQC case",
        )
        IPQC_MEASUREMENT_RECORDED = (
            "IPQC_MEASUREMENT_RECORDED",
            "IPQC specification measurement recorded",
        )
        IPQC_SAMPLING_RESOLVED = (
            "IPQC_SAMPLING_RESOLVED",
            "IPQC sampling requirement resolved",
        )
        IPQC_HACCP_METADATA_ATTACHED = (
            "IPQC_HACCP_METADATA_ATTACHED",
            "IPQC HACCP metadata snapshot attached",
        )
        IPQC_FAILURE_RECORDED = (
            "IPQC_FAILURE_RECORDED",
            "IPQC failure recorded (advisory / dual-gate)",
        )
        IPQC_STOP_PRODUCTION_SIGNALLED = (
            "IPQC_STOP_PRODUCTION_SIGNALLED",
            "IPQC stop-production signal (dual-gate enabled)",
        )
        IPQC_ESCALATED_TO_NCR = (
            "IPQC_ESCALATED_TO_NCR",
            "IPQC case escalated to NCR",
        )
        IPQC_ESCALATED_TO_HOLD = (
            "IPQC_ESCALATED_TO_HOLD",
            "IPQC case escalated to HOLD",
        )
        IPQC_CASE_COMPLETED = (
            "IPQC_CASE_COMPLETED",
            "IPQC case completed (not FG release)",
        )
        IPQC_POLICY_UPDATED = (
            "IPQC_POLICY_UPDATED",
            "IPQC workflow policy stub updated",
        )

        BATCH_DOSSIER_VIEWED = (
            "BATCH_DOSSIER_VIEWED",
            "Electronic batch quality dossier assembled/viewed",
        )
        BATCH_DOSSIER_EXPORT_PREPARED = (
            "BATCH_DOSSIER_EXPORT_PREPARED",
            "Batch dossier PDF export hook prepared (no PDF rendered)",
        )
        BATCH_DOSSIER_EXPORT_BLOCKED = (
            "BATCH_DOSSIER_EXPORT_BLOCKED",
            "Batch dossier PDF export hook blocked",
        )
        BATCH_DOSSIER_POLICY_UPDATED = (
            "BATCH_DOSSIER_POLICY_UPDATED",
            "Batch dossier policy stub updated",
        )
        BATCH_GENEALOGY_EDGE_INGESTED = (
            "BATCH_GENEALOGY_EDGE_INGESTED",
            "ERP genealogy edge ingested",
        )
        BATCH_GENEALOGY_EDGE_DUPLICATE = (
            "BATCH_GENEALOGY_EDGE_DUPLICATE",
            "Duplicate ERP genealogy edge (idempotent)",
        )
        BATCH_GENEALOGY_CYCLE_REJECTED = (
            "BATCH_GENEALOGY_CYCLE_REJECTED",
            "Genealogy edge rejected by cycle prevention",
        )
        BATCH_GENEALOGY_BACKWARD_TRACE = (
            "BATCH_GENEALOGY_BACKWARD_TRACE",
            "Backward genealogy trace executed",
        )
        BATCH_GENEALOGY_FORWARD_TRACE = (
            "BATCH_GENEALOGY_FORWARD_TRACE",
            "Forward genealogy trace executed",
        )
        BATCH_GENEALOGY_POLICY_UPDATED = (
            "BATCH_GENEALOGY_POLICY_UPDATED",
            "Genealogy policy stub updated",
        )

        RECALL_CASE_CREATED = (
            "RECALL_CASE_CREATED",
            "Recall/withdrawal case created",
        )
        RECALL_CASE_INITIATED = (
            "RECALL_CASE_INITIATED",
            "Recall/withdrawal case initiated (high-risk)",
        )
        RECALL_AFFECTED_PRODUCT_ADDED = (
            "RECALL_AFFECTED_PRODUCT_ADDED",
            "Affected product added to recall case",
        )
        RECALL_AFFECTED_BATCH_ADDED = (
            "RECALL_AFFECTED_BATCH_ADDED",
            "Affected batch added to recall case",
        )
        RECALL_GENEALOGY_EXPANDED = (
            "RECALL_GENEALOGY_EXPANDED",
            "Genealogy expansion applied to recall case",
        )
        RECALL_QUANTITY_RECONCILED = (
            "RECALL_QUANTITY_RECONCILED",
            "Recall quantity reconciliation updated",
        )
        RECALL_COMMUNICATION_RECORDED = (
            "RECALL_COMMUNICATION_RECORDED",
            "Recall communication reference recorded (no auto-send)",
        )
        RECALL_EXTERNAL_NOTIFICATION_BLOCKED = (
            "RECALL_EXTERNAL_NOTIFICATION_BLOCKED",
            "Recall external notification blocked by dual-gate",
        )
        RECALL_EXTERNAL_NOTIFICATION_PREPARED = (
            "RECALL_EXTERNAL_NOTIFICATION_PREPARED",
            "Recall external notification prepared (message not sent)",
        )
        RECALL_ERP_DISTRIBUTION_BLOCKED = (
            "RECALL_ERP_DISTRIBUTION_BLOCKED",
            "Recall ERP distribution pull blocked by dual-gate",
        )
        RECALL_ERP_DISTRIBUTION_PREPARED = (
            "RECALL_ERP_DISTRIBUTION_PREPARED",
            "Recall ERP distribution pull prepared (not executed live)",
        )
        RECALL_CASE_CLOSED = (
            "RECALL_CASE_CLOSED",
            "Recall/withdrawal case closed",
        )
        RECALL_POLICY_UPDATED = (
            "RECALL_POLICY_UPDATED",
            "Recall policy stub updated",
        )
        MOCK_RECALL_EXERCISE_CREATED = (
            "MOCK_RECALL_EXERCISE_CREATED",
            "MOCK recall exercise created",
        )
        MOCK_RECALL_EXERCISE_STARTED = (
            "MOCK_RECALL_EXERCISE_STARTED",
            "MOCK recall exercise started",
        )
        MOCK_RECALL_METRICS_UPDATED = (
            "MOCK_RECALL_METRICS_UPDATED",
            "MOCK recall exercise metrics updated",
        )
        MOCK_RECALL_EXERCISE_COMPLETED = (
            "MOCK_RECALL_EXERCISE_COMPLETED",
            "MOCK recall exercise completed",
        )
        MOCK_RECALL_GENEALOGY_EXERCISED = (
            "MOCK_RECALL_GENEALOGY_EXERCISED",
            "MOCK recall genealogy exercise executed",
        )
        MOCK_RECALL_SIDE_EFFECT_BLOCKED = (
            "MOCK_RECALL_SIDE_EFFECT_BLOCKED",
            "MOCK recall side effect blocked (no ERP/notify/dispatch)",
        )
        MOCK_RECALL_FINDING_RECORDED = (
            "MOCK_RECALL_FINDING_RECORDED",
            "MOCK recall finding recorded",
        )
        MOCK_RECALL_FINDING_LINKED_NCR = (
            "MOCK_RECALL_FINDING_LINKED_NCR",
            "MOCK recall finding linked to NCR (explicit)",
        )
        MOCK_RECALL_FINDING_LINKED_CAPA = (
            "MOCK_RECALL_FINDING_LINKED_CAPA",
            "MOCK recall finding linked to CAPA (explicit)",
        )
        MOCK_RECALL_IMPROVEMENT_CREATED = (
            "MOCK_RECALL_IMPROVEMENT_CREATED",
            "MOCK recall improvement action created (explicit)",
        )
        COMPLAINT_CASE_CREATED = (
            "COMPLAINT_CASE_CREATED",
            "Customer complaint case created",
        )
        COMPLAINT_CASE_OPENED = (
            "COMPLAINT_CASE_OPENED",
            "Customer complaint case opened",
        )
        COMPLAINT_BATCH_UPDATED = (
            "COMPLAINT_BATCH_UPDATED",
            "Customer complaint batch reference updated",
        )
        COMPLAINT_BATCH_TRACE_UPDATED = (
            "COMPLAINT_BATCH_TRACE_UPDATED",
            "Customer complaint batch-trace links updated",
        )
        COMPLAINT_EVIDENCE_LINKED = (
            "COMPLAINT_EVIDENCE_LINKED",
            "Evidence linked to customer complaint",
        )
        COMPLAINT_INVESTIGATION_LINKED = (
            "COMPLAINT_INVESTIGATION_LINKED",
            "Investigation/RCA/NCR/CAPA linked to complaint (explicit)",
        )
        COMPLAINT_COMMUNICATION_RECORDED = (
            "COMPLAINT_COMMUNICATION_RECORDED",
            "Complaint communication reference recorded (no auto-send)",
        )
        COMPLAINT_CUSTOMER_RESPONSE_BLOCKED = (
            "COMPLAINT_CUSTOMER_RESPONSE_BLOCKED",
            "Complaint customer response blocked by dual-gate",
        )
        COMPLAINT_CUSTOMER_RESPONSE_PREPARED = (
            "COMPLAINT_CUSTOMER_RESPONSE_PREPARED",
            "Complaint customer response prepared (message not sent)",
        )
        COMPLAINT_CASE_CLOSED = (
            "COMPLAINT_CASE_CLOSED",
            "Customer complaint case closed",
        )
        COMPLAINT_POLICY_UPDATED = (
            "COMPLAINT_POLICY_UPDATED",
            "Customer complaint policy stub updated",
        )
        COMPLAINT_CATEGORY_CONFIG_UPSERTED = (
            "COMPLAINT_CATEGORY_CONFIG_UPSERTED",
            "Complaint category/severity config upserted",
        )
        RETURN_QUALITY_CREATED = (
            "RETURN_QUALITY_CREATED",
            "Returned product quality record created (quarantine)",
        )
        RETURN_QUALITY_QUANTITY_UPDATED = (
            "RETURN_QUALITY_QUANTITY_UPDATED",
            "Return quality quantity/UOM reference updated",
        )
        RETURN_QUALITY_INSPECTION_STARTED = (
            "RETURN_QUALITY_INSPECTION_STARTED",
            "Return inspection checklist task started",
        )
        RETURN_QUALITY_DISPOSITIONED = (
            "RETURN_QUALITY_DISPOSITIONED",
            "Return quality disposition applied (local only)",
        )
        RETURN_QUALITY_POLICY_UPSERTED = (
            "RETURN_QUALITY_POLICY_UPSERTED",
            "Return quality policy stub upserted",
        )
        RETURN_ERP_STOCK_MOVEMENT_BLOCKED = (
            "RETURN_ERP_STOCK_MOVEMENT_BLOCKED",
            "Return ERP stock movement blocked by dual-gate",
        )
        QUARANTINE_OPENED = ("QUARANTINE_OPENED", "Quality quarantine opened")
        QUARANTINE_QUANTITY_UPDATED = (
            "QUARANTINE_QUANTITY_UPDATED",
            "Quality quarantine quantity reference updated",
        )
        QUARANTINE_RELEASED = ("QUARANTINE_RELEASED", "Quality quarantine released")
        QUARANTINE_ERP_SYNC_STATUS_UPDATED = (
            "QUARANTINE_ERP_SYNC_STATUS_UPDATED",
            "Quality quarantine ERP sync status tracked",
        )
        QUARANTINE_ERP_SYNC_BLOCKED = (
            "QUARANTINE_ERP_SYNC_BLOCKED",
            "Quality quarantine ERP outbound blocked",
        )
        QUARANTINE_POLICY_UPSERTED = (
            "QUARANTINE_POLICY_UPSERTED",
            "Quality quarantine policy stub upserted",
        )
        REWORK_CASE_CREATED = (
            "REWORK_CASE_CREATED",
            "Controlled rework case created",
        )
        REWORK_CASE_AUTHORIZED = (
            "REWORK_CASE_AUTHORIZED",
            "Controlled rework case authorized",
        )
        REWORK_CASE_STARTED = (
            "REWORK_CASE_STARTED",
            "Controlled rework execution started",
        )
        REWORK_CASE_COMPLETED = (
            "REWORK_CASE_COMPLETED",
            "Controlled rework case completed",
        )
        REWORK_CASE_CANCELLED = (
            "REWORK_CASE_CANCELLED",
            "Controlled rework case cancelled",
        )
        REWORK_GENEALOGY_RECORDED = (
            "REWORK_GENEALOGY_RECORDED",
            "Rework source/result genealogy recorded",
        )
        REWORK_REINSPECTION_OPENED = (
            "REWORK_REINSPECTION_OPENED",
            "New rework reinspection checklist task opened",
        )
        REWORK_POLICY_UPSERTED = (
            "REWORK_POLICY_UPSERTED",
            "Rework policy stub upserted",
        )
        REWORK_ERP_STOCK_MOVEMENT_BLOCKED = (
            "REWORK_ERP_STOCK_MOVEMENT_BLOCKED",
            "Rework ERP stock movement blocked by dual-gate",
        )
        DOCUMENT_CREATED = (
            "DOCUMENT_CREATED",
            "Quality document created",
        )
        DOCUMENT_VERSION_CREATED = (
            "DOCUMENT_VERSION_CREATED",
            "Quality document version created",
        )
        DOCUMENT_VERSION_UPDATED = (
            "DOCUMENT_VERSION_UPDATED",
            "Quality document draft version updated",
        )
        DOCUMENT_SUBMITTED_FOR_REVIEW = (
            "DOCUMENT_SUBMITTED_FOR_REVIEW",
            "Quality document version submitted for review",
        )
        DOCUMENT_RETURNED_TO_DRAFT = (
            "DOCUMENT_RETURNED_TO_DRAFT",
            "Quality document version returned to draft",
        )
        DOCUMENT_APPROVED = (
            "DOCUMENT_APPROVED",
            "Quality document version approved",
        )
        DOCUMENT_MADE_EFFECTIVE = (
            "DOCUMENT_MADE_EFFECTIVE",
            "Quality document version made effective",
        )
        DOCUMENT_RETIRED = (
            "DOCUMENT_RETIRED",
            "Quality document version retired",
        )
        DOCUMENT_ACKNOWLEDGED = (
            "DOCUMENT_ACKNOWLEDGED",
            "Quality document version acknowledged (not competency)",
        )
        DOCUMENT_VERSION_LINKED = (
            "DOCUMENT_VERSION_LINKED",
            "Quality record linked to exact document version",
        )
        CHANGE_REQUESTED = (
            "CHANGE_REQUESTED",
            "Quality change request created",
        )
        CHANGE_ASSESSMENT_STARTED = (
            "CHANGE_ASSESSMENT_STARTED",
            "Quality change moved to assessment",
        )
        CHANGE_IMPACT_RECORDED = (
            "CHANGE_IMPACT_RECORDED",
            "Quality change impact assessment recorded",
        )
        CHANGE_AFFECTED_LINKED = (
            "CHANGE_AFFECTED_LINKED",
            "Affected area linked to quality change",
        )
        CHANGE_APPROVED = (
            "CHANGE_APPROVED",
            "Quality change approved",
        )
        CHANGE_IMPLEMENTATION_STARTED = (
            "CHANGE_IMPLEMENTATION_STARTED",
            "Approved quality change moved to implementation",
        )
        CHANGE_IMPLEMENTATION_LINKED = (
            "CHANGE_IMPLEMENTATION_LINKED",
            "Deployed configuration/version linked (not approval)",
        )
        CHANGE_VERIFICATION_STARTED = (
            "CHANGE_VERIFICATION_STARTED",
            "Quality change submitted for verification",
        )
        CHANGE_CLOSED = (
            "CHANGE_CLOSED",
            "Quality change verified and closed",
        )
        QUALITY_AUDIT_PLANNED = (
            "QUALITY_AUDIT_PLANNED",
            "QMS quality audit planned",
        )
        QUALITY_AUDIT_PARTICIPANT_ADDED = (
            "QUALITY_AUDIT_PARTICIPANT_ADDED",
            "QMS quality audit participant added",
        )
        QUALITY_AUDIT_CHECKLIST_REGISTERED = (
            "QUALITY_AUDIT_CHECKLIST_REGISTERED",
            "Checklist template registered for QMS audits",
        )
        QUALITY_AUDIT_CHECKLIST_BOUND = (
            "QUALITY_AUDIT_CHECKLIST_BOUND",
            "Audit checklist version bound",
        )
        QUALITY_AUDIT_STARTED = (
            "QUALITY_AUDIT_STARTED",
            "QMS quality audit execution started",
        )
        QUALITY_AUDIT_FINDING_CREATED = (
            "QUALITY_AUDIT_FINDING_CREATED",
            "QMS quality audit finding recorded",
        )
        QUALITY_AUDIT_FINDING_ACTION_COMPLETED = (
            "QUALITY_AUDIT_FINDING_ACTION_COMPLETED",
            "QMS audit finding action completed",
        )
        QUALITY_AUDIT_FINDING_VERIFIED = (
            "QUALITY_AUDIT_FINDING_VERIFIED",
            "QMS audit finding verified",
        )
        QUALITY_AUDIT_FINDING_CLOSED = (
            "QUALITY_AUDIT_FINDING_CLOSED",
            "QMS audit finding closed",
        )
        QUALITY_AUDIT_CASE_LINKED = (
            "QUALITY_AUDIT_CASE_LINKED",
            "NCR/CAPA explicitly linked from QMS audit finding",
        )
        QUALITY_AUDIT_CLOSED = (
            "QUALITY_AUDIT_CLOSED",
            "QMS quality audit closed",
        )
        QUALITY_AUDIT_CANCELLED = (
            "QUALITY_AUDIT_CANCELLED",
            "QMS quality audit cancelled",
        )
        QUALITY_AUDIT_FINDING_CODE_UPSERTED = (
            "QUALITY_AUDIT_FINDING_CODE_UPSERTED",
            "QMS audit finding classification/severity shell upserted",
        )
        COMPLIANCE_SOURCE_REGISTERED = (
            "COMPLIANCE_SOURCE_REGISTERED",
            "Compliance source registered (not a certification claim)",
        )
        COMPLIANCE_EDITION_RECORDED = (
            "COMPLIANCE_EDITION_RECORDED",
            "Compliance source edition recorded",
        )
        COMPLIANCE_APPLICABILITY_UPDATED = (
            "COMPLIANCE_APPLICABILITY_UPDATED",
            "Compliance source applicability updated",
        )
        COMPLIANCE_EDITION_SUPERSEDED = (
            "COMPLIANCE_EDITION_SUPERSEDED",
            "Compliance source edition superseded",
        )
        COMPLIANCE_EDITION_WITHDRAWN = (
            "COMPLIANCE_EDITION_WITHDRAWN",
            "Compliance source edition withdrawn",
        )
        COMPLIANCE_MAPPING_CREATED = (
            "COMPLIANCE_MAPPING_CREATED",
            "Compliance control mapping created",
        )
        COMPLIANCE_MAPPING_STATUS_CHANGED = (
            "COMPLIANCE_MAPPING_STATUS_CHANGED",
            "Compliance mapping status changed",
        )
        COMPLIANCE_EVIDENCE_LINKED = (
            "COMPLIANCE_EVIDENCE_LINKED",
            "Compliance mapping evidence linked",
        )
        COMPLIANCE_GAP_RECORDED = (
            "COMPLIANCE_GAP_RECORDED",
            "Compliance mapping gap recorded",
        )
        COMPLIANCE_GAP_ACTION_LINKED = (
            "COMPLIANCE_GAP_ACTION_LINKED",
            "Compliance gap follow-up linked by explicit action",
        )
        COMPLIANCE_MAPPING_VERIFIED = (
            "COMPLIANCE_MAPPING_VERIFIED",
            "Compliance mapping verification recorded (not certification)",
        )
        COMPLIANCE_SOURCE_REVISED = (
            "COMPLIANCE_SOURCE_REVISED",
            "Compliance source edition revised",
        )
        COMPLIANCE_APPLICABILITY_SET = (
            "COMPLIANCE_APPLICABILITY_SET",
            "Compliance source applicability decision recorded",
        )
        COMPLIANCE_GAP_OPENED = (
            "COMPLIANCE_GAP_OPENED",
            "Compliance gap opened",
        )
        COMPLIANCE_GAP_CLOSED = (
            "COMPLIANCE_GAP_CLOSED",
            "Compliance gap closed",
        )
        QUALITY_RISK_CREATED = (
            "QUALITY_RISK_CREATED",
            "Quality risk created",
        )
        QUALITY_RISK_OPENED = (
            "QUALITY_RISK_OPENED",
            "Quality risk opened",
        )
        QUALITY_RISK_ASSESSED = (
            "QUALITY_RISK_ASSESSED",
            "Quality risk historical assessment recorded",
        )
        QUALITY_RISK_REVIEWED = (
            "QUALITY_RISK_REVIEWED",
            "Quality risk periodic review recorded",
        )
        QUALITY_RISK_LINKED = (
            "QUALITY_RISK_LINKED",
            "Quality risk context link recorded",
        )
        QUALITY_RISK_MITIGATION_ADDED = (
            "QUALITY_RISK_MITIGATION_ADDED",
            "Quality risk mitigation recorded",
        )
        QUALITY_RISK_ACCEPTED = (
            "QUALITY_RISK_ACCEPTED",
            "Residual quality risk accepted",
        )
        QUALITY_RISK_CLOSED = (
            "QUALITY_RISK_CLOSED",
            "Quality risk closed",
        )
        QUALITY_RISK_CANCELLED = (
            "QUALITY_RISK_CANCELLED",
            "Quality risk cancelled",
        )
        QUALITY_RISK_CATEGORY_UPSERTED = (
            "QUALITY_RISK_CATEGORY_UPSERTED",
            "Quality risk category shell upserted",
        )
        QUALITY_RISK_SCORING_POLICY_UPDATED = (
            "QUALITY_RISK_SCORING_POLICY_UPDATED",
            "Quality risk scoring policy updated",
        )
        PROCESS_FMEA_CREATED = (
            "PROCESS_FMEA_CREATED",
            "Process FMEA created",
        )
        PROCESS_FMEA_VERSION_CREATED = (
            "PROCESS_FMEA_VERSION_CREATED",
            "Process FMEA revision created",
        )
        PROCESS_FMEA_SUBMITTED = (
            "PROCESS_FMEA_SUBMITTED",
            "Process FMEA version submitted for review",
        )
        PROCESS_FMEA_APPROVED = (
            "PROCESS_FMEA_APPROVED",
            "Process FMEA version approved",
        )
        PROCESS_FMEA_SUPERSEDED = (
            "PROCESS_FMEA_SUPERSEDED",
            "Process FMEA version superseded",
        )
        PROCESS_FMEA_CANCELLED = (
            "PROCESS_FMEA_CANCELLED",
            "Process FMEA version cancelled",
        )
        PROCESS_FMEA_WITHDRAWN = (
            "PROCESS_FMEA_WITHDRAWN",
            "Process FMEA version withdrawn",
        )
        PROCESS_FMEA_STEP_ADDED = (
            "PROCESS_FMEA_STEP_ADDED",
            "Process FMEA process step recorded",
        )
        PROCESS_FMEA_FAILURE_MODE_ADDED = (
            "PROCESS_FMEA_FAILURE_MODE_ADDED",
            "Process FMEA failure mode recorded",
        )
        PROCESS_FMEA_SCORED = (
            "PROCESS_FMEA_SCORED",
            "Process FMEA score snapshot recorded",
        )
        PROCESS_FMEA_ASSESSED = (
            "PROCESS_FMEA_ASSESSED",
            "Process FMEA assessment recorded",
        )
        PROCESS_FMEA_LINKED = (
            "PROCESS_FMEA_LINKED",
            "Process FMEA context link recorded",
        )
        PROCESS_FMEA_ACTION_ADDED = (
            "PROCESS_FMEA_ACTION_ADDED",
            "Process FMEA recommended action recorded",
        )
        PROCESS_FMEA_ACTION_RECORDED = (
            "PROCESS_FMEA_ACTION_RECORDED",
            "Process FMEA recommended action recorded",
        )
        PROCESS_FMEA_ACTION_PROMOTED = (
            "PROCESS_FMEA_ACTION_PROMOTED",
            "Process FMEA recommended action promoted by explicit action",
        )
        PROCESS_FMEA_SCORING_POLICY_UPDATED = (
            "PROCESS_FMEA_SCORING_POLICY_UPDATED",
            "Process FMEA scoring policy updated",
        )
        RCA_CREATED = (
            "RCA_CREATED",
            "Root-cause analysis created",
        )
        RCA_STARTED = (
            "RCA_STARTED",
            "Root-cause analysis started",
        )
        RCA_PARTICIPANT_ADDED = (
            "RCA_PARTICIPANT_ADDED",
            "RCA participant recorded",
        )
        RCA_FIVE_WHY_RECORDED = (
            "RCA_FIVE_WHY_RECORDED",
            "RCA 5 Why step recorded",
        )
        RCA_FISHBONE_RECORDED = (
            "RCA_FISHBONE_RECORDED",
            "RCA fishbone entry recorded",
        )
        RCA_HYPOTHESIS_RECORDED = (
            "RCA_HYPOTHESIS_RECORDED",
            "RCA possible cause recorded",
        )
        RCA_CAUSE_STATE_CHANGED = (
            "RCA_CAUSE_STATE_CHANGED",
            "RCA cause state changed",
        )
        RCA_ROOT_CAUSE_CONFIRMED = (
            "RCA_ROOT_CAUSE_CONFIRMED",
            "Human investigator confirmed root cause",
        )
        RCA_EVIDENCE_LINKED = (
            "RCA_EVIDENCE_LINKED",
            "RCA evidence or reference recorded",
        )
        RCA_CAPA_LINKED = (
            "RCA_CAPA_LINKED",
            "Confirmed root cause linked to CAPA",
        )
        RCA_VERIFIED = (
            "RCA_VERIFIED",
            "RCA verification recorded",
        )
        RCA_CLOSED = (
            "RCA_CLOSED",
            "Root-cause analysis closed",
        )
        RCA_CANCELLED = (
            "RCA_CANCELLED",
            "Root-cause analysis cancelled",
        )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    event_type = models.CharField(max_length=64, choices=EventType.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="security_audit_actions",
    )
    subject_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="security_audit_subjects",
    )
    request_id = models.CharField(max_length=128, blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent_summary = models.CharField(max_length=512, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["event_type", "created_at"], name="sa_type_created_idx"),
            models.Index(fields=["subject_user", "created_at"], name="sa_subject_idx"),
            models.Index(fields=["actor", "created_at"], name="sa_actor_idx"),
            models.Index(fields=["request_id"], name="sa_request_id_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.event_type} @ {self.created_at}"
