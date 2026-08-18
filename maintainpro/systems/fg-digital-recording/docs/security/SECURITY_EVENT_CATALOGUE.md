# Security Event Catalogue

**Document status:** Phase 03 foundation + Phase 03C role governance + Phase 04A/04B/04C org/shift + Phase 05A FG Product + Phase 06 checklist events
**Last updated:** 2026-08-10

## Event types

| Event | When |
| --- | --- |
| `LOGIN_SUCCESS` | Successful employee-code authentication |
| `LOGIN_FAILURE` | Failed authentication (generic reasons in metadata) |
| `ACCOUNT_LOCKED` | Failure threshold reached |
| `ACCOUNT_UNLOCKED` | Explicit admin unlock |
| `LOGOUT` | Session logout |
| `PASSWORD_CHANGED` | User or forced password change |
| `PASSWORD_RESET_BY_ADMIN` | Admin sets a new password |
| `USER_ACTIVATED` / `USER_DEACTIVATED` | Active-flag changes |
| `ROLE_ASSIGNED` / `ROLE_REVOKED` | Scoped role assignment lifecycle |
| `ROLE_PERMISSIONS_UPDATED` | Role permission set replaced via governance service |
| `ROLE_TEMPLATE_CREATED` / `ROLE_TEMPLATE_UPDATED` | RoleTemplate lifecycle (technical; not business approval) |
| `ROLE_TEMPLATE_APPLIED` | Template permissions copied onto a Role (no user assignment) |
| `SHIFT_CREATED` | Configurable Shift created via domain service |
| `SHIFT_UPDATED` | Configurable Shift fields updated via domain service |
| `SHIFT_ACTIVATED` | Shift reactivated (`is_active=True`) |
| `SHIFT_DEACTIVATED` | Shift deactivated (`is_active=False`) |
| `ORGANIZATION_CREATED` / `UPDATED` / `ACTIVATED` / `DEACTIVATED` | Organization lifecycle (Phase 04C) |
| `SITE_CREATED` / `UPDATED` / `ACTIVATED` / `DEACTIVATED` | Site lifecycle (Phase 04C) |
| `DEPARTMENT_CREATED` / `UPDATED` / `ACTIVATED` / `DEACTIVATED` | Department lifecycle (Phase 04C) |
| `ORGANIZATION_HIERARCHY_IMPORT_PREVIEWED` / `COMPLETED` / `FAILED` | Controlled hierarchy import (Phase 04C) |
| `FG_PRODUCT_CREATED` | Configurable FG Product created via domain service |
| `FG_PRODUCT_UPDATED` | Configurable FG Product fields updated via domain service |
| `FG_PRODUCT_ACTIVATED` | FG Product reactivated (`is_active=True`) |
| `FG_PRODUCT_DEACTIVATED` | FG Product deactivated (`is_active=False`) |
| `FG_PRODUCT_IMPORT_PREVIEWED` / `COMPLETED` / `FAILED` | Controlled FG Product CSV import (Phase 05C) |
| `PRODUCT_SPECIFICATION_CREATED` / `SPECIFICATION_VERSION_*` / `SPECIFICATION_PARAMETER_*` | Product specification lifecycle (Phase 06O; OUT_OF_SPEC ≠ disposition) |
| `EQUIPMENT_CREATED` / `UPDATED` / `ACTIVATED` / `DEACTIVATED` / `STATUS_CHANGED` | Equipment master lifecycle (Phase 05D) |
| `CALIBRATION_RECORD_CREATED` | Calibration record created |
| `CALIBRATION_CERTIFICATE_METADATA_UPDATED` | Certificate/provider metadata updated |
| `TRAINING_RECORD_CREATED` / `UPDATED` / `STATUS_CHANGED` | Training / competency lifecycle (Phase 05E) |
| `TRAINING_ENFORCEMENT_POLICY_CREATED` / `UPDATED` | Training gate mode metadata (OFF/WARN/BLOCK; not auto-enforced) |
| `CHECKLIST_TEMPLATE_CREATED` | Checklist template created |
| `CHECKLIST_TEMPLATE_UPDATED` | Checklist template updated |
| `CHECKLIST_TEMPLATE_ACTIVATED` | Checklist template activated |
| `CHECKLIST_TEMPLATE_DEACTIVATED` | Checklist template deactivated |
| `CHECKLIST_VERSION_CREATED` | Blank draft checklist version created |
| `CHECKLIST_VERSION_CLONED` | Draft checklist version cloned from a source version |
| `CHECKLIST_VERSION_PUBLISHED` | Checklist version published (immutable thereafter); metadata includes effectivity |
| `CHECKLIST_VERSION_EFFECTIVITY_UPDATED` | Checklist version effective_from/to changed (Phase 07D) |
| `CHECKLIST_VERSION_RETIRED` | Published checklist version retired |
| `CHECKLIST_VERSION_EFFECTIVITY_UPDATED` | Checklist version `effective_from` / `effective_to` changed (Phase 07D) |
| `CHECKLIST_TASK_CREATED` | Batch checklist task created (or idempotent return of existing) |
| `CHECKLIST_TASK_CANCELLED` | Batch checklist task cancelled (soft cancel) |
| `CHECKLIST_TASK_ASSIGNED` / `REASSIGNED` / `UNASSIGNED` | Task ownership changes (Phase 07G; never grants RBAC) |
| `CHECKLIST_TASK_DUE_WINDOW_UPDATED` | Configured due_from/due_at/due_soon change (Phase 07H; overdue ≠ NCR) |
| `CHECKLIST_TASK_GENERATED` | Schedule engine created a task occurrence (system) |
| `CHECKLIST_SCHEDULE_CREATED` | Checklist schedule definition created |
| `CHECKLIST_SCHEDULE_DEACTIVATED` | Checklist schedule deactivated |
| `CHECKLIST_SCHEDULE_GENERATION_RUN` | Replay-safe schedule generation tick completed |
| `EXTERNAL_BATCH_EVENT_RECEIVED` | Inbound batch event accepted for processing (Phase 07F adapter) |
| `EXTERNAL_BATCH_EVENT_DUPLICATE` | Idempotent duplicate of a completed batch event |
| `EXTERNAL_BATCH_EVENT_MAPPING_FAILED` | External key mapping failed — no task created |
| `EXTERNAL_BATCH_EVENT_APPLICABILITY_FAILED` | Applicability not ONE_MATCH — no task created |
| `EXTERNAL_BATCH_EVENT_VERSION_FAILED` | Effective-version resolution failed — no task created |
| `EXTERNAL_BATCH_EVENT_PROCESSED` | Batch event completed to ChecklistTask |
| `EXTERNAL_BATCH_EVENT_REJECTED` | Batch event rejected at task create |
| `EXTERNAL_BATCH_MAPPING_UPSERTED` | External batch mapping created/updated |
| `CHECKLIST_APPLICABILITY_RULE_CREATED` / `UPDATED` / `DEACTIVATED` | Checklist applicability rule lifecycle (Phase 07C) |
| `CHECKLIST_APPLICABILITY_PREVIEWED` | Management applicability preview (Phase 07C; no task mutation) |
| `CHECKLIST_RECORD_STARTED` | Draft checklist record started for a PENDING task |
| `CHECKLIST_RECORD_DRAFT_SAVED` | Draft checklist responses saved (aggregate; may include `draft_version`, `save_mode`, `autosave`) |
| `CHECKLIST_RECORD_SUBMITTED` | Checklist record submitted with immutable Submission #1 snapshot |
| `SUPERVISOR_REVIEW_COMPLETED` | Immutable Supervisor review recorded for a ChecklistSubmission (09C adds self-review governance metadata) |
| `SUPERVISOR_REVIEW_GOVERNANCE_POLICY_SET` | Org Supervisor review governance policy created/updated (Phase 09C) |
| `SUPERVISOR_REVIEW_DELEGATION_GRANTED` | Temporary review delegation via time-bounded ScopedRoleAssignment (Phase 09C) |
| `SUPERVISOR_REVIEW_DELEGATION_REVOKED` | Temporary review delegation revoked (Phase 09C) |
| `CHECKLIST_CORRECTION_STARTED` | Controlled correction cycle started for a RETURNED submission |
| `CHECKLIST_CORRECTION_RESUBMITTED` | Correction resubmitted as next immutable ChecklistSubmission |
| `QA_REVIEW_COMPLETED` | Immutable QA disposition recorded for a ChecklistSubmission |
| `EVIDENCE_UPLOADED` | Evidence attachment stored in private storage (SHA-256; no answer values) |
| `EVIDENCE_DOWNLOADED` | Authorized evidence download served (attachment disposition) |
| `EVIDENCE_RETIRED` | Evidence soft-retired (no hard delete) |
| `EVIDENCE_ACCESS_DENIED` | Evidence download denied or blob missing |
| `NONCONFORMANCE_CREATED` | Formal NCR created (manual; Phase 12) |
| `NONCONFORMANCE_UPDATED` | NCR case fields updated |
| `NONCONFORMANCE_STATUS_CHANGED` | NCR proposed lifecycle transition |
| `NONCONFORMANCE_CLOSED` | NCR closed |
| `HOLD_CASE_CREATED` | Hold case opened (free-text reason/scope) |
| `HOLD_CASE_CLOSED` | Hold case closed (free-text resolution) |
| `CAPA_CREATED` | CAPA header created |
| `CAPA_STATUS_CHANGED` | CAPA proposed lifecycle transition |
| `CAPA_ACTION_ADDED` | CAPA action item added |
| `CAPA_VERIFICATION_RECORDED` | CAPA verification notes recorded |
| `CAPA_EFFECTIVENESS_REVIEWED` | CAPA effectiveness review recorded |
| `CAPA_CLOSED` | CAPA closed (human-only) |
| `DISPATCH_QUALITY_RECORD_CREATED` | Loading/dispatch quality record created (Phase 13) |
| `DISPATCH_QUALITY_RECORD_UPDATED` | Dispatch quality record fields updated |
| `DISPATCH_VEHICLE_INSPECTION_LINKED` | Dynamic vehicle inspection checklist linked |
| `DISPATCH_QA_REVIEW_LINKED` | QAReview linked for traceability / optional gate |
| `DISPATCH_TEMPERATURE_RECORDED` | Cold-chain temperature recorded (Decimal; no limits) |
| `DISPATCH_QUANTITY_LINE_SET` | Released/loaded/remaining quantity line set |
| `DISPATCH_RELEASE_POLICY_UPDATED` | Org QA RELEASE-before-loading policy updated |
| `DISPATCH_RELEASE_GATE_EVALUATED` | Release gate evaluated on completion attempt |
| `DISPATCH_RELEASE_GATE_BLOCKED` | Completion blocked by enabled QA RELEASE gate |
| `DISPATCH_QUALITY_RECORD_COMPLETED` | Dispatch quality record completed |
| `DISPATCH_QUALITY_RECORD_CANCELLED` | Dispatch quality record cancelled |
| `NOTIFICATION_POLICY_UPDATED` | Org notification event/email policy updated (Phase 15) |
| `NOTIFICATION_CREATED` | In-app notification created (safe payload only) |
| `NOTIFICATION_READ` | Notification marked read by recipient |
| `NOTIFICATION_EMAIL_DELIVERED` | Notification email delivered |
| `NOTIFICATION_EMAIL_FAILED` | Notification email delivery failed |
| `REPORT_RUN_ENQUEUED` | Governed report run enqueued for background generation (Phase 16) |
| `REPORT_RUN_COMPLETED` | Governed report run completed |
| `REPORT_EXPORTED` | Governed report exported (CSV generated for export) |
| `REPORT_EXPORT_DOWNLOADED` | Governed report CSV downloaded |
| `INTEGRATION_INBOUND_SUCCEEDED` | Integration inbound attempt succeeded (Phase 17) |
| `INTEGRATION_INBOUND_FAILED` | Integration inbound attempt failed |
| `INTEGRATION_INBOUND_DUPLICATE` | Integration inbound duplicate (idempotent) |
| `INTEGRATION_LIVE_BLOCKED` | Live Bileeta pull blocked by evidence gate |
| `INTEGRATION_DEAD_LETTER` | Integration attempt marked dead letter |
| `INTEGRATION_OUTBOUND_BLOCKED` | Outbound ERP disposition blocked pending APR-017 |
| `AI_ASSISTANCE_COMPLETED` | AI assistance request completed (advisory) (Phase 18) |
| `AI_ASSISTANCE_BLOCKED` | AI assistance request blocked (safety/auth) |
| `AI_ASSISTANCE_DISABLED` | AI assistance invoked while feature disabled |
| `AI_ASSISTANCE_FALLBACK` | AI assistance safe fallback after provider failure/timeout |
| `LAB_SAMPLE_CREATED` | Laboratory sample created (Phase 22) |
| `LAB_SAMPLE_STATUS_CHANGED` | Laboratory sample status changed |
| `LAB_RESULT_ENTERED` | Laboratory result entered |
| `LAB_RESULT_VERIFIED` | Laboratory result verified |
| `LAB_RESULT_FINALIZED` | Laboratory result finalized |
| `LAB_RESULT_AMENDED` | Laboratory result amended (new revision) |
| `LAB_EXTERNAL_CERTIFICATE_RECORDED` | Laboratory external certificate recorded |
| `LAB_POSITIVE_RELEASE_POLICY_UPDATED` | Laboratory positive-release policy updated |

## Safe metadata

Allowed examples: `reason` codes (`invalid_credentials`, `account_locked`, `inactive`), role/assignment UUIDs, organization/site/department UUIDs, boolean flags.

Organization / Site / Department events may include: entity UUID, normalized code, organization UUID, optional site UUID, active status, changed field names. Hierarchy import events may include dry_run flag, row_count, created_counts/ids, error_count, and truncated error summaries — never invent company catalogue values in metadata.

Shift events may include: Shift UUID, normalized Shift code, Organization UUID, optional Site UUID, optional Department UUID, active status, overnight derived flag, changed field names.

FG Product events may include: FG Product UUID, normalized Product code, Organization UUID, active status, changed field names.

Checklist / recording / review / correction events may include: template UUID/code, version UUID/number, organization UUID, record/task/submission/correction UUIDs, submission numbers, batch_reference, changed_item_count / answered_item_count. Do **not** store response values, Supervisor review notes, TEXT answers, or numerical measurements in security audit metadata.

Checklist task events may include: task UUID, organization UUID, template UUID/code, version UUID/number, `batch_reference`, status. Do not store checklist question text or request bodies.

Checklist draft recording events may include: record UUID, task UUID, organization UUID, template UUID, version UUID, `batch_reference`, `changed_item_count`. Do **not** store answer values, question text, remarks, or request bodies.

Checklist submission events may include: record UUID, submission UUID, submission number, task UUID, organization UUID, template UUID, version UUID, `batch_reference`, `answered_item_count`. Do **not** store answer values, question text, remarks, or request bodies.

Supervisor review events may include: review UUID, submission UUID, submission number, record UUID, task UUID, organization UUID, template UUID, version UUID, `batch_reference`, `decision`. Do **not** store review notes, answer values, question text, or request bodies.

Unknown login identifiers must be masked or hashed â€” never store raw unknown employee codes in clear text when the account is unknown.

## Prohibited fields

Passwords, session keys, cookies, Authorization headers, CSRF tokens, raw POST bodies, full database or Redis URLs, secrets.

## Privacy and retention

Retention period is **deferred** â€” not decided in Phase 03. Events are append-oriented and must not be silently editable through normal admin workflows.

## Related

- [AUTHENTICATION_AND_ACCESS_CONTROL.md](AUTHENTICATION_AND_ACCESS_CONTROL.md)
- [ADR-008-CONFIGURABLE-SHIFT-FOUNDATION.md](../architecture/ADR-008-CONFIGURABLE-SHIFT-FOUNDATION.md)
- [ADR-009-FG-MASTER-DATA-DOMAIN.md](../architecture/ADR-009-FG-MASTER-DATA-DOMAIN.md)

### HACCP (Phase 23)

| Event | Meaning |
| --- | --- |
| HACCP_PLAN_CREATED | Plan shell created |
| HACCP_PLAN_VERSION_CREATED | Draft version created |
| HACCP_PLAN_VERSION_APPROVED | Version approved (immutable) |
| HACCP_PLAN_VERSION_RETIRED | Approved version retired |
| HACCP_CONTROL_POINT_MAPPED | Control point added on draft version |
| HACCP_CHECKLIST_BINDING_SET | Checklist item bound to exact version/CP |

### Sampling (Phase 24)

| Event | Meaning |
| --- | --- |
| SAMPLING_PLAN_CREATED | Plan shell created |
| SAMPLING_PLAN_VERSION_CREATED | Draft version created |
| SAMPLING_PLAN_VERSION_APPROVED | Version approved (immutable) |
| SAMPLING_PLAN_VERSION_RETIRED | Approved version retired |
| SAMPLING_CHECKLIST_BINDING_SET | REPEATING_GROUP bound to plan version |

### Device traceability (Phase 25)

| Event | Meaning |
| --- | --- |
| DEVICE_CALIBRATION_OVERRIDE | Manual override of calibration BLOCK gate (reason required) |

### Foreign body (Phase 26)

| Event | Meaning |
| --- | --- |
| FOREIGN_BODY_TEST_PIECE_CREATED | Test piece created |
| FOREIGN_BODY_SCHEDULE_RULE_CREATED | Schedule rule shell created |
| FOREIGN_BODY_CHALLENGE_RECORDED | Challenge recorded |
| FOREIGN_BODY_CHALLENGE_VERIFIED | Challenge verified |
| FOREIGN_BODY_CHALLENGE_VOIDED | Challenge voided |
| FOREIGN_BODY_CONTAINMENT_ASSESSED | FAIL containment assessed |

### Sanitation (Phase 27)

| Event | Meaning |
| --- | --- |
| SANITATION_PROGRAM_CREATED | Program shell created |
| SANITATION_PROGRAM_VERSION_CREATED | Draft version created |
| SANITATION_PROGRAM_VERSION_APPROVED | Version approved (immutable) |
| SANITATION_PROGRAM_VERSION_RETIRED | Approved version retired |
| SANITATION_CHECKLIST_BINDING_SET | Checklist template bound + frozen context |
| SANITATION_FAIL_POLICY_UPDATED | Org fail / production-stop policy stub updated |

### Environmental monitoring (Phase 28)

| Event | Meaning |
| --- | --- |
| EM_POINT_CREATED | Monitoring point created |
| EM_PARAMETER_CREATED | Monitoring parameter created |
| EM_SPEC_CREATED | Monitoring specification created |
| EM_SPEC_VERSION_CREATED | Spec version drafted |
| EM_SPEC_VERSION_APPROVED | Spec version approved |
| EM_SPEC_VERSION_RETIRED | Spec version retired |
| EM_SCHEDULE_LINKED | ChecklistSchedule linked for recurring readings |
| EM_READING_RECORDED | Reading recorded |
| EM_EXCURSION_EVALUATED | WARN/EXCURSION evaluated |
| EM_EXCURSION_POLICY_UPDATED | Auto-HOLD policy stub updated |

### Packaging artwork (Phase 29)

| Event type | Meaning |
| --- | --- |
| PACKAGING_ARTWORK_CREATED | Packaging artwork identity created |
| PACKAGING_ARTWORK_VERSION_CREATED | Artwork version drafted |
| PACKAGING_ARTWORK_VERSION_APPROVED | Artwork version approved (immutable) |
| PACKAGING_ARTWORK_VERSION_RETIRED | Approved artwork version retired |
| PACKAGING_ARTWORK_CHECKLIST_BINDING_SET | Checklist item bound to approved artwork version |
| PACKAGING_LINE_CLEARANCE_HOOK_CREATED | Future line-clearance / changeover hook created |
| PACKAGING_ARTWORK_VERIFICATION_RECORDED | Batch artwork verification recorded |

### Allergen / changeover (Phase 30)

| Event type | Meaning |
| --- | --- |
| ALLERGEN_REFERENCE_CREATED | Allergen reference shell created |
| PRODUCT_ALLERGEN_DECLARATION_CREATED | Product allergen declaration drafted |
| PRODUCT_ALLERGEN_DECLARATION_APPROVED | Product allergen declaration approved |
| CHANGEOVER_RECORDED | Product changeover recorded |
| CHANGEOVER_VERIFIED | Product changeover verified |
| LINE_CLEARANCE_RECORDED | Line clearance recorded (checklist-driven) |
| ALLERGEN_RISK_POLICY_UPDATED | Allergen risk / production-block policy stub updated |

### Receiving / raw material quality (Phase 31)

| Event type | Meaning |
| --- | --- |
| RECEIVING_MATERIAL_REFERENCE_CREATED | ERP-mapped material reference created |
| RECEIVING_MATERIAL_SPEC_APPROVED | Material specification version approved |
| RECEIVING_RECEIPT_QUALITY_CREATED | Receipt quality record created |
| RECEIVING_RECEIPT_QUALITY_DISPOSITIONED | Local quality disposition set (ERP stock not updated) |
| RECEIVING_LAB_SAMPLE_LINKED | Lab sample linked to receipt |
| RECEIVING_ERP_OUTBOUND_BLOCKED | ERP outbound blocked (Phase 17 gate) |

### Supplier quality (Phase 32)

| Event type | Meaning |
| --- | --- |
| SUPPLIER_QUALITY_PROFILE_CREATED | ERP-referenced supplier quality profile created |
| SUPPLIER_QUALITY_PROFILE_UPDATED | Supplier quality profile updated |
| SUPPLIER_CERTIFICATE_RECORDED | Supplier certificate recorded |
| SUPPLIER_CERTIFICATE_VERIFIED | Supplier certificate verified |
| SUPPLIER_QUALITY_EVENT_RECORDED | Supplier quality event recorded (defect/audit/complaint/other) |

### Incoming Quality Control (Phase 33)

| Event type | Meaning |
| --- | --- |
| IQC_CASE_OPENED | IQC inspection case opened |
| IQC_TASK_CREATED | ChecklistTask created for IQC |
| IQC_SAMPLING_RESOLVED | Sampling requirement resolved (advisory) |
| IQC_LAB_SAMPLE_LINKED | Lab sample linked via IQC |
| IQC_REVIEW_ATTACHED | Supervisor review attached |
| IQC_DISPOSITIONED | Local disposition completed |
| IQC_RECEIPT_EVENT_PROCESSED | Incoming GRN event processed |
| IQC_RECEIPT_EVENT_DUPLICATE | Duplicate GRN event (idempotent) |
| IQC_POLICY_UPDATED | IQC policy stub updated |
| IQC_ERP_OUTBOUND_BLOCKED | ERP outbound blocked |
| IQC_ERP_OUTBOUND_PREPARED | ERP outbound prepared (adapter not live) |

### In-Process Quality Control (Phase 34)

| Event type | Meaning |
| --- | --- |
| IPQC_DEFINITION_CREATED | Process-check definition created |
| IPQC_CASE_OPENED | IPQC inspection case opened |
| IPQC_CASE_DUPLICATE | Duplicate generation (idempotent) |
| IPQC_TASK_CREATED | ChecklistTask created for IPQC |
| IPQC_SCHEDULED_GENERATION_RUN | Scheduled TIME_INTERVAL/SHIFT generation |
| IPQC_EQUIPMENT_LINKED | Equipment device trace linked |
| IPQC_MEASUREMENT_RECORDED | Spec measurement recorded (not FG release) |
| IPQC_SAMPLING_RESOLVED | Sampling requirement resolved (advisory) |
| IPQC_HACCP_METADATA_ATTACHED | HACCP metadata snapshot attached |
| IPQC_FAILURE_RECORDED | Failure recorded; stop dual-gate evaluated |
| IPQC_STOP_PRODUCTION_SIGNALLED | Stop-production signal (dual-gate ON) |
| IPQC_ESCALATED_TO_NCR | Controlled NCR escalation |
| IPQC_ESCALATED_TO_HOLD | Controlled HOLD escalation |
| IPQC_CASE_COMPLETED | Case completed (not FG release) |
| IPQC_POLICY_UPDATED | IPQC policy stub updated |

### Electronic Batch Quality Dossier (Phase 35)

| Event type | Meaning |
| --- | --- |
| BATCH_DOSSIER_VIEWED | Dossier assembled/viewed |
| BATCH_DOSSIER_EXPORT_PREPARED | PDF export hook prepared (no PDF rendered) |
| BATCH_DOSSIER_EXPORT_BLOCKED | PDF export hook blocked |
| BATCH_DOSSIER_POLICY_UPDATED | Dossier policy stub updated |

### Batch Genealogy (Phase 36)

| Event type | Meaning |
| --- | --- |
| BATCH_GENEALOGY_EDGE_INGESTED | ERP genealogy edge ingested |
| BATCH_GENEALOGY_EDGE_DUPLICATE | Duplicate ERP genealogy edge (idempotent) |
| BATCH_GENEALOGY_CYCLE_REJECTED | Edge rejected by cycle prevention |
| BATCH_GENEALOGY_BACKWARD_TRACE | Backward genealogy trace executed |
| BATCH_GENEALOGY_FORWARD_TRACE | Forward genealogy trace executed |
| BATCH_GENEALOGY_POLICY_UPDATED | Genealogy policy stub updated |

### Product Recall / Withdrawal (Phase 37)

| Event type | Meaning |
| --- | --- |
| RECALL_CASE_CREATED | Recall case created |
| RECALL_CASE_INITIATED | Recall case initiated (high-risk) |
| RECALL_AFFECTED_PRODUCT_ADDED | Affected product added |
| RECALL_AFFECTED_BATCH_ADDED | Affected batch added |
| RECALL_GENEALOGY_EXPANDED | Genealogy expansion applied |
| RECALL_QUANTITY_RECONCILED | Quantity reconciliation updated |
| RECALL_COMMUNICATION_RECORDED | Communication reference recorded (no auto-send) |
| RECALL_EXTERNAL_NOTIFICATION_BLOCKED | External notification blocked |
| RECALL_EXTERNAL_NOTIFICATION_PREPARED | External notification prepared (not sent) |
| RECALL_ERP_DISTRIBUTION_BLOCKED | ERP distribution pull blocked |
| RECALL_ERP_DISTRIBUTION_PREPARED | ERP distribution pull prepared (not live) |
| RECALL_CASE_CLOSED | Recall case closed |
| RECALL_POLICY_UPDATED | Recall policy stub updated |

### Phase 36 — Batch genealogy

| Event | Meaning |
| --- | --- |
| GENEALOGY_EDGE_INGESTED | ERP/integration edge accepted |
| GENEALOGY_EDGE_DUPLICATE | Idempotent duplicate ingest |
| GENEALOGY_EDGE_REJECTED | Ingest rejected |
| GENEALOGY_CYCLE_PREVENTED | Cycle-creating edge blocked |
| GENEALOGY_TRACE_EXECUTED | Forward/backward trace run |
| GENEALOGY_POLICY_UPDATED | Party-detail policy stub updated |

### Product Recall / Withdrawal (Phase 37)

| Event type | Meaning |
| --- | --- |
| RECALL_CASE_CREATED | Recall/withdrawal case created |
| RECALL_CASE_INITIATED | Case initiated (high-risk) |
| RECALL_AFFECTED_PRODUCT_ADDED | Affected product added |
| RECALL_AFFECTED_BATCH_ADDED | Affected batch added |
| RECALL_GENEALOGY_EXPANDED | Genealogy expansion applied |
| RECALL_QUANTITY_RECONCILED | Quantity reconciliation updated |
| RECALL_COMMUNICATION_RECORDED | Communication reference recorded (no auto-send) |
| RECALL_EXTERNAL_NOTIFICATION_BLOCKED | External notification blocked by dual-gate |
| RECALL_EXTERNAL_NOTIFICATION_PREPARED | External notification prepared (message not sent) |
| RECALL_ERP_DISTRIBUTION_BLOCKED | ERP distribution pull blocked by dual-gate |
| RECALL_ERP_DISTRIBUTION_PREPARED | ERP distribution pull prepared (not executed live) |
| RECALL_CASE_CLOSED | Case closed |
| RECALL_POLICY_UPDATED | Recall policy stub updated |

### Mock Recall Exercises (Phase 38)

| Event type | Meaning |
| --- | --- |
| MOCK_RECALL_EXERCISE_CREATED | Mock recall exercise created |
| MOCK_RECALL_EXERCISE_STARTED | Mock recall exercise started |
| MOCK_RECALL_METRICS_UPDATED | Mock exercise metrics updated |
| MOCK_RECALL_EXERCISE_COMPLETED | Mock recall exercise completed |
| MOCK_RECALL_GENEALOGY_EXERCISED | Mock genealogy exercise run |
| MOCK_RECALL_SIDE_EFFECT_BLOCKED | Mock real side effect blocked |
| MOCK_RECALL_FINDING_RECORDED | Mock finding recorded |
| MOCK_RECALL_FINDING_LINKED_NCR | Mock finding linked to NCR (explicit) |
| MOCK_RECALL_FINDING_LINKED_CAPA | Mock finding linked to CAPA (explicit) |
| MOCK_RECALL_IMPROVEMENT_CREATED | Mock improvement action created (explicit) |

### Customer Quality Complaints (Phase 39)

| Event | Meaning |
| --- | --- |
| COMPLAINT_CASE_CREATED | Customer complaint case created |
| COMPLAINT_CASE_OPENED | Customer complaint case opened |
| COMPLAINT_BATCH_UPDATED | Complaint batch reference updated |
| COMPLAINT_BATCH_TRACE_UPDATED | Batch-trace links updated |
| COMPLAINT_EVIDENCE_LINKED | Evidence linked to complaint |
| COMPLAINT_INVESTIGATION_LINKED | Investigation/RCA/NCR/CAPA linked (explicit) |
| COMPLAINT_COMMUNICATION_RECORDED | Communication reference recorded (no auto-send) |
| COMPLAINT_CUSTOMER_RESPONSE_BLOCKED | Customer response blocked by dual-gate |
| COMPLAINT_CUSTOMER_RESPONSE_PREPARED | Customer response prepared (not sent) |
| COMPLAINT_CASE_CLOSED | Customer complaint case closed |
| COMPLAINT_POLICY_UPDATED | Complaint policy stub updated |
| COMPLAINT_CATEGORY_CONFIG_UPSERTED | Category/severity config upserted |

### Returned Product Quality (Phase 40)

| Event | Meaning |
| --- | --- |
| RETURN_QUALITY_CREATED | Return quality record created (quarantine) |
| RETURN_QUALITY_QUANTITY_UPDATED | Quantity/UOM reference updated |
| RETURN_QUALITY_INSPECTION_STARTED | Checklist inspection task started |
| RETURN_QUALITY_DISPOSITIONED | Local disposition applied (ERP stock unchanged) |
| RETURN_QUALITY_POLICY_UPSERTED | Return quality policy stub upserted |
| RETURN_ERP_STOCK_MOVEMENT_BLOCKED | ERP stock movement blocked / refused |

### Quality Quarantine (Phase 41)

| Event | Meaning |
| --- | --- |
| QUARANTINE_OPENED | Quality quarantine opened |
| QUARANTINE_QUANTITY_UPDATED | Quantity reference updated (not inventory ledger) |
| QUARANTINE_RELEASED | Quarantine released (permission + dual-gate) |
| QUARANTINE_ERP_SYNC_STATUS_UPDATED | Local ERP sync status tracked |
| QUARANTINE_ERP_SYNC_BLOCKED | ERP outbound blocked / refused |
| QUARANTINE_POLICY_UPSERTED | Quarantine policy stub upserted |

### Controlled Rework (Phase 42)

| Event | Meaning |
| --- | --- |
| REWORK_CASE_CREATED | Rework case created (explicit; not from REJECT) |
| REWORK_CASE_AUTHORIZED | Rework case authorized |
| REWORK_CASE_STARTED | Rework execution started |
| REWORK_CASE_COMPLETED | Rework completed with result refs |
| REWORK_CASE_CANCELLED | Rework case cancelled |
| REWORK_GENEALOGY_RECORDED | Source/result genealogy recorded |
| REWORK_REINSPECTION_OPENED | New inspection on resulting batch |
| REWORK_POLICY_UPSERTED | Rework policy stub upserted |
| REWORK_ERP_STOCK_MOVEMENT_BLOCKED | ERP quantity/status update blocked |

### Quality Document Control (Phase 43)

| Event | Meaning |
| --- | --- |
| DOCUMENT_CREATED | Quality document created with first draft revision |
| DOCUMENT_VERSION_CREATED | New draft revision created |
| DOCUMENT_VERSION_UPDATED | Draft version updated |
| DOCUMENT_SUBMITTED_FOR_REVIEW | Version submitted for review |
| DOCUMENT_RETURNED_TO_DRAFT | Version returned to draft |
| DOCUMENT_APPROVED | Version approved (author cannot approve) |
| DOCUMENT_MADE_EFFECTIVE | Version made effective |
| DOCUMENT_RETIRED | Version retired (including supersession) |
| DOCUMENT_ACKNOWLEDGED | Optional read/ack (not competency) |
| DOCUMENT_VERSION_LINKED | Quality record linked to an exact version |

### Quality Change Control (Phase 44)

| Event | Meaning |
| --- | --- |
| CHANGE_REQUESTED | Quality change request created |
| CHANGE_ASSESSMENT_STARTED | Change moved to assessment |
| CHANGE_IMPACT_RECORDED | Impact assessment recorded |
| CHANGE_AFFECTED_LINKED | Affected area linked |
| CHANGE_APPROVED | Change approved (not engineering completion) |
| CHANGE_IMPLEMENTATION_STARTED | Approved change moved to implementation |
| CHANGE_IMPLEMENTATION_LINKED | Deployed config/version linked (not approval) |
| CHANGE_VERIFICATION_STARTED | Submitted for verification |
| CHANGE_CLOSED | Verified and closed |

### Quality Audit Management (Phase 45)

These events are security-log records *about* the QMS audit module. They are
not the QMS audit records themselves.

| Event | Meaning |
| --- | --- |
| QUALITY_AUDIT_PLANNED | QMS audit planned |
| QUALITY_AUDIT_PARTICIPANT_ADDED | Participant added |
| QUALITY_AUDIT_CHECKLIST_REGISTERED | Template registered as audit checklist |
| QUALITY_AUDIT_CHECKLIST_BOUND | Audit checklist version bound |
| QUALITY_AUDIT_STARTED | Execution started |
| QUALITY_AUDIT_FINDING_CREATED | Finding recorded (NCR/CAPA not auto-created) |
| QUALITY_AUDIT_FINDING_ACTION_COMPLETED | Finding action completed |
| QUALITY_AUDIT_FINDING_VERIFIED | Finding verified |
| QUALITY_AUDIT_FINDING_CLOSED | Finding closed |
| QUALITY_AUDIT_CASE_LINKED | Explicit NCR/CAPA link |
| QUALITY_AUDIT_CLOSED | QMS audit closed |
| QUALITY_AUDIT_CANCELLED | QMS audit cancelled |
| QUALITY_AUDIT_FINDING_CODE_UPSERTED | Classification/severity shell upserted |

### Compliance Control Mapping (Phase 46)

These events are security-log records *about* the mapping module. They are
not certification, legal-compliance, or QMS quality-audit records.

| Event | Meaning |
| --- | --- |
| COMPLIANCE_SOURCE_REGISTERED | Source registered (applicability not assessed) |
| COMPLIANCE_EDITION_RECORDED | Official edition citation recorded |
| COMPLIANCE_SOURCE_REVISED | New edition; previous superseded |
| COMPLIANCE_APPLICABILITY_UPDATED | Applicability decision updated |
| COMPLIANCE_APPLICABILITY_SET | Applicability decision recorded |
| COMPLIANCE_EDITION_SUPERSEDED | Edition superseded |
| COMPLIANCE_EDITION_WITHDRAWN | Edition withdrawn |
| COMPLIANCE_MAPPING_CREATED | Control mapping created (not a claim) |
| COMPLIANCE_MAPPING_STATUS_CHANGED | Mapping status updated |
| COMPLIANCE_EVIDENCE_LINKED | Evidence citation linked |
| COMPLIANCE_GAP_RECORDED | Gap recorded (follow-up not automatic) |
| COMPLIANCE_GAP_OPENED | Gap opened |
| COMPLIANCE_GAP_ACTION_LINKED | Explicit Risk/Change/NCR/CAPA/Action |
| COMPLIANCE_MAPPING_VERIFIED | Implemented control verified (not a certificate) |
| COMPLIANCE_GAP_CLOSED | Gap closed |

### Quality Risk Management (Phase 47)

These events record access-sensitive quality-risk actions. They are not a
scoring certificate and do not invent a company matrix.

| Event | Meaning |
| --- | --- |
| QUALITY_RISK_CREATED | Risk created (no scoring applied) |
| QUALITY_RISK_OPENED | Risk opened |
| QUALITY_RISK_ASSESSED | Historical assessment recorded |
| QUALITY_RISK_REVIEWED | Periodic review recorded |
| QUALITY_RISK_LINKED | Context link recorded |
| QUALITY_RISK_MITIGATION_ADDED | Mitigation recorded |
| QUALITY_RISK_ACCEPTED | Residual risk accepted |
| QUALITY_RISK_CLOSED | Risk closed |
| QUALITY_RISK_CANCELLED | Risk cancelled |
| QUALITY_RISK_CANCELLED | Risk cancelled |
| QUALITY_RISK_CATEGORY_UPSERTED | Category shell upserted |
| QUALITY_RISK_SCORING_POLICY_UPDATED | Scoring policy updated (default OFF) |

### Process FMEA (Phase 48)

These events record access-sensitive Process FMEA actions. They are not an
RPN certificate and do not invent Action Priority bands.

| Event | Meaning |
| --- | --- |
| PROCESS_FMEA_CREATED | FMEA created with draft version 1 |
| PROCESS_FMEA_VERSION_CREATED | New revision created from an approved version |
| PROCESS_FMEA_APPROVED | Version approved and locked |
| PROCESS_FMEA_SUPERSEDED | Prior approved version superseded |
| PROCESS_FMEA_WITHDRAWN | Draft version withdrawn and locked |
| PROCESS_FMEA_STEP_ADDED | Process step recorded |
| PROCESS_FMEA_FAILURE_MODE_ADDED | Failure mode recorded |
| PROCESS_FMEA_ASSESSED | S/O/D assessment recorded (no threshold) |
| PROCESS_FMEA_LINKED | Context link recorded |
| PROCESS_FMEA_ACTION_RECORDED | Recommended action recorded |
| PROCESS_FMEA_SCORING_POLICY_UPDATED | Scoring policy updated (default OFF) |

### Structured RCA (Phase 49)

These events record investigation actions. They are not an auto-confirmed root cause.

| Event | Meaning |
| --- | --- |
| RCA_CREATED | RCA created (no cause confirmed) |
| RCA_STARTED | RCA marked in progress |
| RCA_PARTICIPANT_ADDED | Participant recorded |
| RCA_FIVE_WHY_RECORDED | Optional 5 Why step recorded |
| RCA_FISHBONE_RECORDED | Optional fishbone entry recorded |
| RCA_HYPOTHESIS_RECORDED | Possible cause / AI hypothesis recorded |
| RCA_CAUSE_STATE_CHANGED | Cause marked supported |
| RCA_ROOT_CAUSE_CONFIRMED | Human confirmed root cause with evidence |
| RCA_EVIDENCE_LINKED | Evidence citation linked |
| RCA_CAPA_LINKED | Confirmed cause linked to CAPA (explicit) |
| RCA_VERIFIED | Verification recorded |
| RCA_CLOSED | RCA closed |
| RCA_CANCELLED | RCA cancelled |

