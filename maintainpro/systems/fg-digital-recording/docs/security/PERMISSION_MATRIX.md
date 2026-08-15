# Permission Matrix â€” Technical vs Business

**Document status:** Technical catalogue companion (Phase 03C)
**Authority:** Code permissions + `apps/access_control/permission_catalogue.py`
**Rule:** TECHNICALLY SUPPORTED â‰  BUSINESS APPROVED. Silence is not approval.

## Vocabulary

| Label | Meaning |
| --- | --- |
| TECHNICALLY SUPPORTED | Permission/codename exists and is enforceable via scoped RBAC |
| BUSINESS APPROVED | Named owner mapping of permission â†’ business responsibility with APR evidence |
| APPROVAL REQUIRED | No written owner mapping yet |

## Capability separation (non-negotiable technical)

- `manage_*` does **not** imply `record_checklisttask`
- `assign_checklisttask` does **not** grant view/manage/record (ownership only; Phase 07G)
- `manage_checklisttask` does **not** imply `assign_checklisttask`
- `record_checklisttask` does **not** imply Supervisor or QA review
- `review_checklistsubmission` does **not** imply QA or record
- `qa_review_checklistsubmission` does **not** imply Supervisor or record
- Submit and correction use the **record** permission (documented as separate capability buckets)

## Matrix

| Catalogue key | Permission | Bucket | Object scopes | Technical | Business mapping |
| --- | --- | --- | --- | --- | --- |
| view_checklisttask | `scheduling.view_checklisttask` | view | Organization / Site / Department | TECHNICALLY SUPPORTED | APPROVAL REQUIRED |
| view_checklisttemplate | `checklists.view_checklisttemplate` | view | Organization / system-wide | TECHNICALLY SUPPORTED | APPROVAL REQUIRED |
| view_checklistsubmission | `reviews.view_supervisorreview` | view | Organization / Site / Department | TECHNICALLY SUPPORTED | APPROVAL REQUIRED |
| manage_checklisttask | `scheduling.manage_checklisttask` | manage | Organization / Site / Department | TECHNICALLY SUPPORTED | APPROVAL REQUIRED |
| assign_checklisttask | `scheduling.assign_checklisttask` | manage | Organization / Site / Department | TECHNICALLY SUPPORTED | APPROVAL REQUIRED |
| manage_checklist | `checklists.manage_checklist` | checklist_publish | Organization / system-wide | TECHNICALLY SUPPORTED | APPROVAL REQUIRED |
| manage_fgproduct | `master_data.manage_fgproduct` | master_data | Organization / Site | TECHNICALLY SUPPORTED | APPROVAL REQUIRED |
| manage_shift | `organizations.manage_shift` | master_data | Organization / Site | TECHNICALLY SUPPORTED | APPROVAL REQUIRED |
| manage_capa | `capa.manage_capa` | manage | Organization / Site / Department | TECHNICALLY SUPPORTED | APPROVAL REQUIRED |
| manage_nonconformance | `nonconformance.manage_nonconformance` | manage | Organization / Site / Department | TECHNICALLY SUPPORTED | APPROVAL REQUIRED |
| manage_supplierquality_qa | `supplier_quality.manage_supplierquality_qa` | manage | Organization / system-wide | TECHNICALLY SUPPORTED | APPROVAL REQUIRED |
| view_supplierquality_procurement | `supplier_quality.view_supplierquality_procurement` | view | Organization / system-wide | TECHNICALLY SUPPORTED | APPROVAL REQUIRED |
| record_checklisttask | `scheduling.record_checklisttask` | record | Organization / Site / Department | TECHNICALLY SUPPORTED | APPROVAL REQUIRED (APR-007) |
| submit_via_record | `scheduling.record_checklisttask` | submit | Organization / Site / Department | TECHNICALLY SUPPORTED | APPROVAL REQUIRED |
| correction_via_record | `scheduling.record_checklisttask` | correction | Organization / Site / Department | TECHNICALLY SUPPORTED | APPROVAL REQUIRED |
| review_checklistsubmission | `reviews.review_checklistsubmission` | supervisor_review | Organization / Site / Department | TECHNICALLY SUPPORTED | APPROVAL REQUIRED (APR-008) |
| qa_review_checklistsubmission | `quality.qa_review_checklistsubmission` | qa_review | Organization / Site / Department | TECHNICALLY SUPPORTED | APPROVAL REQUIRED (APR-009) |
| audit_event_view | `security_audit.view_securityauditevent` | audit_access | system-wide | TECHNICALLY SUPPORTED | APPROVAL REQUIRED |
| system_administration_superuser | Django `is_superuser` | system_administration | system-wide | TECHNICALLY SUPPORTED | APPROVAL REQUIRED (break-glass only) |

## Approved business mappings found

**None.** APR-007 / APR-008 / APR-009 / APR-010 remain **EVIDENCE REQUIRED**.

## Related

- [PHASE_03C_ROLE_GOVERNANCE.md](../governance/PHASE_03C_ROLE_GOVERNANCE.md)
- [SOD_DECISION_REGISTER.md](../governance/SOD_DECISION_REGISTER.md)
- [ADR-007-SCOPED-RBAC.md](../architecture/ADR-007-SCOPED-RBAC.md)
- [CHECKLIST_RECORDER_ROLE_MAPPING.md](../business/CHECKLIST_RECORDER_ROLE_MAPPING.md)

## Phase 12 quality-case permissions (technical)

| key | permission | notes |
| --- | --- | --- |
| create_nonconformance | `nonconformance.create_nonconformance` | Formal NCR create; not ChecklistCorrection |
| manage_nonconformance | `nonconformance.manage_nonconformance` | Lifecycle / field updates; does not imply close |
| close_nonconformance | `nonconformance.close_nonconformance` | Close NCR (manage also accepted as legacy close) |
| create_holdcase | `nonconformance.create_holdcase` | Open HoldCase; free-text reason only |
| manage_holdcase | `nonconformance.manage_holdcase` | Manage open holds |
| close_holdcase | `nonconformance.close_holdcase` | Close with free-text resolution (no company enum) |
| create_capa | `capa.create_capa` | Create CAPA |
| manage_capa | `capa.manage_capa` | Actions / verification / effectiveness |
| close_capa | `capa.close_capa` | Human-only CAPA closure |

Business role mapping for the above remains APPROVAL REQUIRED.

## Phase 13 loading / dispatch permissions (technical)

| key | permission | notes |
| --- | --- | --- |
| create_dispatchqualityrecord | `dispatch.create_dispatchqualityrecord` | Create loading/dispatch quality records |
| manage_dispatchqualityrecord | `dispatch.manage_dispatchqualityrecord` | Update, link inspection/QA, temps, quantities |
| complete_dispatchqualityrecord | `dispatch.complete_dispatchqualityrecord` | Complete (subject to configurable RELEASE gate) |
| manage_dispatchreleasepolicy | `dispatch.manage_dispatchreleasepolicy` | Configure QA RELEASE-before-loading (default OFF) |

Business role mapping and gate enablement remain APPROVAL REQUIRED / EVIDENCE REQUIRED.

## Phase 15 notification permissions (technical)

| key | permission | notes |
| --- | --- | --- |
| view_own_notifications | `notifications.view_own_notifications` | In-app inbox; own notifications only |
| manage_notifications | `notifications.manage_notifications` | Create/dispatch policy-gated workflow notifications |
| manage_notificationpolicy | `notifications.manage_notificationpolicy` | Enable event types / optional email (all default OFF) |

Business event matrix, SMTP production use, and SMS provider remain APPROVAL REQUIRED / EVIDENCE REQUIRED.


## Phase 16 governed reporting permissions (technical)

| key | permission | notes |
| --- | --- | --- |
| view_reportcatalogue | `reports.view_reportcatalogue` | View report catalogue for an organization |
| run_qualityreport | `reports.run_qualityreport` | Run governed quality reports |
| export_qualityreport | `reports.export_qualityreport` | Export/download report CSV (audited) |

Official report packs, Excel/PDF, and production distribution remain APPROVAL REQUIRED / EVIDENCE REQUIRED.

## Phase 17 Bileeta / ERP boundary permissions (technical)

| key | permission | notes |
| --- | --- | --- |
| view_integrationboundary | `integrations.view_integrationboundary` | View vendor evidence status / boundary metadata |
| manage_integrationboundary | `integrations.manage_integrationboundary` | Ingest mock/contract events, dead-letter, reconciliation ops |

Live Bileeta HTTP remains blocked until APR-011/012 evidence is PRESENT. Outbound disposition send remains blocked until APR-017.


## Phase 18 safe AI assistance permissions (technical)

| key | permission | notes |
| --- | --- | --- |
| use_aiassistance | `ai_assistance.use_aiassistance` | Invoke optional advisory AI (still requires feature flag ON) |
| view_aiassistanceaudit | `ai_assistance.view_aiassistanceaudit` | View high-level AI usage audit rows |
| register_labsample | `laboratory.register_labsample` | Register lab samples / tests |
| enter_labresult | `laboratory.enter_labresult` | Enter or amend lab results |
| verify_labresult | `laboratory.verify_labresult` | Verify entered lab results |
| finalize_labresult | `laboratory.finalize_labresult` | Finalize verified lab results |
| manage_laboratory | `laboratory.manage_laboratory` | Lab catalogue + positive-release policy stub |
| view_laboratory | `laboratory.view_laboratory` | Read-only laboratory viewing |

AI default OFF. AI must not execute RELEASE/HOLD/REJECT, publish, spec/role changes, ERP disposition, CAPA close, or factual root-cause declarations.

### HACCP (Phase 23)

| Key | Permission | Notes |
| --- | --- | --- |
| manage_haccpplan | `haccp.manage_haccpplan` | Draft/edit only |
| approve_haccpplan | `haccp.approve_haccpplan` | Food-safety approval; not System Admin by default |
| view_haccp | `haccp.view_haccp` | Read-only |

### Sampling (Phase 24)

| Key | Permission | Notes |
| --- | --- | --- |
| manage_samplingplan | `sampling.manage_samplingplan` | Draft/edit |
| publish_samplingplan | `sampling.publish_samplingplan` | Approve/retire |
| view_sampling | `sampling.view_sampling` | Read-only |

### Instruments / device traceability (Phase 25)

| Key | Permission | Notes |
| --- | --- | --- |
| override_calibration_gate | `instruments.override_calibration_gate` | Override BLOCK when company flag approved; audited |

### Foreign body (Phase 26)

| Key | Permission | Notes |
| --- | --- | --- |
| manage_testpiece | `foreign_body.manage_testpiece` | Catalogue / schedule shells |
| record_challengeresult | `foreign_body.record_challengeresult` | Record challenges |
| verify_challengeresult | `foreign_body.verify_challengeresult` | Verify/void |
| view_foreignbody | `foreign_body.view_foreignbody` | Read-only |

### Sanitation (Phase 27)

| Key | Permission | Notes |
| --- | --- | --- |
| manage_sanitationprogram | `sanitation.manage_sanitationprogram` | Draft/edit programs, scopes, chemicals |
| publish_sanitationprogram | `sanitation.publish_sanitationprogram` | Approve/retire + fail-policy stub |
| view_sanitation | `sanitation.view_sanitation` | Read-only |

### Environmental monitoring (Phase 28)

| Key | Permission | Notes |
| --- | --- | --- |
| manage_environmental | `environmental.manage_environmental` | Points, params, specs, policy stubs |
| record_environmentalreading | `environmental.record_environmentalreading` | MANUAL/LAB/SENSOR readings |
| view_environmental | `environmental.view_environmental` | Read-only / trend |

### Packaging artwork (Phase 29)

| Key | Permission | Notes |
| --- | --- | --- |
| manage_packagingartwork | `packaging.manage_packagingartwork` | Product Master: draft/edit artwork versions |
| approve_packagingartwork | `packaging.approve_packagingartwork` | Document Control: approve/retire (not implied by manage) |
| view_packagingartwork | `packaging.view_packaging` | Read-only |

### Allergen / changeover (Phase 30)

| Key | Permission | Notes |
| --- | --- | --- |
| manage_allergenreference | `changeover.manage_allergenreference` | Generic allergen reference shells (unseeded) |
| manage_changeover | `changeover.manage_changeover` | Record changeover / line clearance |
| verify_changeover | `changeover.verify_changeover` | Verify changeover / approve declarations (not implied by manage) |
| view_changeover | `changeover.view_changeover` | Read-only |
| manage_allergenriskpolicy | `changeover.manage_allergenriskpolicy` | Dual-gate production-block stub (default OFF) |

### Receiving / raw material quality (Phase 31)

| Key | Permission | Notes |
| --- | --- | --- |
| manage_materialreference | `receiving.manage_materialreference` | ERP-mapped material shells (not inventory master) |
| manage_receiptquality | `receiving.manage_receiptquality` | Create/edit receipt quality records |
| disposition_receiptquality | `receiving.disposition_receiptquality` | Local ACCEPTED/HOLD/REJECTED (not ERP stock) |
| view_receiptquality | `receiving.view_receiptquality` | Read-only |
| manage_materialspecification | `receiving.manage_materialspecification` | Draft material specs (no invented limits) |
| approve_materialspecification | `receiving.approve_materialspecification` | Approve/retire material specs |

### Incoming Quality Control (Phase 33)

| Key | Permission | Notes |
| --- | --- | --- |
| manage_iqc | `iqc.manage_iqc` | Ingest GRN events; open cases; generate tasks |
| disposition_iqc | `iqc.disposition_iqc` | Local disposition (review gate when required) |
| view_iqc | `iqc.view_iqc` | Read-only |
| manage_iqcpolicy | `iqc.manage_iqcpolicy` | Review/ERP outbound policy stubs (default OFF) |

### In-Process Quality Control (Phase 34)

| Key | Permission | Notes |
| --- | --- | --- |
| manage_ipqc | `ipqc.manage_ipqc` | Manage definitions; generate IPQC cases / tasks |
| record_ipqc | `ipqc.record_ipqc` | Record measurements and equipment links |
| escalate_ipqc | `ipqc.escalate_ipqc` | Controlled NCR/HOLD escalation (not implied by manage/record) |
| view_ipqc | `ipqc.view_ipqc` | Read-only cases and due/overdue/failure dashboard |
| manage_ipqcpolicy | `ipqc.manage_ipqcpolicy` | Stop-production policy stubs (default OFF) |

### Electronic Batch Quality Dossier (Phase 35)

| Key | Permission | Notes |
| --- | --- | --- |
| view_batchdossier | `batch_dossier.view_batchdossier` | Assemble/view read-only dossier |
| export_batchdossier | `batch_dossier.export_batchdossier` | PDF export hook (dual-gate OFF) |
| manage_batchdossierpolicy | `batch_dossier.manage_batchdossierpolicy` | Export policy stubs |

### Batch Genealogy Traceability (Phase 36)

| Key | Permission | Notes |
| --- | --- | --- |
| view_batchgenealogy | `batch_genealogy.view_batchgenealogy` | Backward/forward traces |
| ingest_batchgenealogy | `batch_genealogy.ingest_batchgenealogy` | ERP edge/node ingest |
| view_genealogy_partner | `batch_genealogy.view_genealogy_partner` | Supplier/customer refs (restricted) |
| manage_batchgenealogypolicy | `batch_genealogy.manage_batchgenealogypolicy` | Mongo projection policy stubs (dual-gate OFF) |

### Product Recall / Withdrawal (Phase 37)

| Key | Permission | Notes |
| --- | --- | --- |
| view_recall | `recall.view_recall` | View cases and timelines |
| initiate_recall | `recall.initiate_recall` | High-risk; explicit scoped grant — not System Admin / staff / superuser by default |
| manage_recallcase | `recall.manage_recallcase` | Scope, quantities, communication refs |
| close_recall | `recall.close_recall` | Close cases (not implied by manage) |
| manage_recallpolicy | `recall.manage_recallpolicy` | External-notify / ERP-pull stubs (dual-gates OFF) |

### Mock Recall Exercises (Phase 38)

| Key | Permission | Notes |
| --- | --- | --- |
| run_mock_recall | `recall.run_mock_recall` | Mock exercises only — not `initiate_recall` |
| manage_mock_recall_findings | `recall.manage_mock_recall_findings` | Explicit NCR/CAPA/improvement links from mock findings |

### Customer Quality Complaints (Phase 39)

| Key | Permission | Notes |
| --- | --- | --- |
| view_customercomplaint | `customer_complaints.view_customercomplaint` | View cases (sensitive redacted) |
| create_customercomplaint | `customer_complaints.create_customercomplaint` | Create cases |
| manage_customercomplaint | `customer_complaints.manage_customercomplaint` | Investigation / batch-trace / evidence |
| close_customercomplaint | `customer_complaints.close_customercomplaint` | Close cases |
| view_complaint_customer_sensitive | `customer_complaints.view_complaint_customer_sensitive` | Privacy-restricted customer labels |
| record_complaint_communication | `customer_complaints.record_complaint_communication` | Communication refs (no auto-send) |
| manage_complaintpolicy | `customer_complaints.manage_complaintpolicy` | Category shells / auto-send stubs |

### Returned Product Quality (Phase 40)

| Key | Permission | Notes |
| --- | --- | --- |
| view_returnquality | `product_returns.view_returnquality` | View return quality records |
| manage_returnquality | `product_returns.manage_returnquality` | Create/update; never saleable via app |
| inspect_returnquality | `product_returns.inspect_returnquality` | Start checklist inspection tasks |
| disposition_returnquality | `product_returns.disposition_returnquality` | RELEASE/HOLD/REWORK/REJECT (policy may restrict) |
| manage_returnpolicystub | `product_returns.manage_returnpolicystub` | ERP stock gate / disposition allow-list stubs |


### Quality Quarantine (Phase 41)

| Key | Permission | Notes |
| --- | --- | --- |
| view_qualityquarantine | `quality_quarantine.view_qualityquarantine` | View organization-scoped cases and immutable history |
| manage_qualityquarantine | `quality_quarantine.manage_qualityquarantine` | Open cases, update permitted quantity refs, and track ERP status locally |
| release_qualityquarantine | `quality_quarantine.release_qualityquarantine` | Release requires this scoped grant plus settings approval; business mapping EVIDENCE REQUIRED |
| manage_quarantinepolicystub | `quality_quarantine.manage_quarantinepolicystub` | Manage quantity and ERP synchronization policy stubs; does not approve live ERP |

ERP remains the inventory ledger. No role is mapped to a Nelna job title by this technical foundation; owner and SoD mapping remain APR-066 EVIDENCE REQUIRED.

### Controlled Rework (Phase 42)

| Key | Permission | Notes |
| --- | --- | --- |
| view_reworkcase | `rework.view_reworkcase` | View organization-scoped rework cases and history |
| create_reworkcase | `rework.create_reworkcase` | Create cases; REJECT does not auto-create |
| authorize_reworkcase | `rework.authorize_reworkcase` | Separate authorization grant |
| execute_reworkcase | `rework.execute_reworkcase` | Start/complete, genealogy, reinspection |
| manage_reworkpolicystub | `rework.manage_reworkpolicystub` | Org ERP-stock gate stub; does not approve live ERP |

ERP quantity/status updates remain dual-gated OFF. Owner/SoD mapping remains APR-067 EVIDENCE REQUIRED.

### Quality Document Control (Phase 43)

| Key | Permission | Notes |
| --- | --- | --- |
| view_effectivedocument | `document_control.view_effectivedocument` | Operators see applicable effective documents/files only |
| edit_qualitydocument | `document_control.edit_qualitydocument` | Create documents and edit drafts |
| approve_qualitydocument | `document_control.approve_qualitydocument` | Separate from edit; author cannot approve own version |
| publish_qualitydocument | `document_control.publish_qualitydocument` | Make effective or retire |
| acknowledge_qualitydocument | `document_control.acknowledge_qualitydocument` | Optional read/ack; not competency training |
| link_qualitydocumentversion | `document_control.link_qualitydocumentversion` | Bind a quality record to an exact version |

Document numbering and role mapping remain APR-068 EVIDENCE REQUIRED.

### Quality Change Control (Phase 44)

| Key | Permission | Notes |
| --- | --- | --- |
| view_qualitychange | `change_control.view_qualitychange` | View organization-scoped change requests and history |
| create_qualitychange | `change_control.create_qualitychange` | Create requests and link affected areas before approval |
| assess_qualitychange | `change_control.assess_qualitychange` | Record impact assessment |
| approve_qualitychange | `change_control.approve_qualitychange` | Separate from create; requester cannot self-approve |
| implement_qualitychange | `change_control.implement_qualitychange` | Link deployed config/version; not approval |
| verify_qualitychange | `change_control.verify_qualitychange` | Verify and close; approver cannot also close |

Change SOP and role mapping remain APR-069 EVIDENCE REQUIRED.

### Quality Audit Management (Phase 45)

| Key | Permission | Notes |
| --- | --- | --- |
| view_qualityaudit | `quality_audits.view_qualityaudit` | View QMS audits/findings; not security_audit |
| plan_qualityaudit | `quality_audits.plan_qualityaudit` | Plan audits, participants, audit-checklist bindings |
| execute_qualityaudit | `quality_audits.execute_qualityaudit` | Execute and record findings; not operational QA review |
| close_qualityaudit | `quality_audits.close_qualityaudit` | Verify findings and close/cancel audits |
| link_audit_quality_case | `quality_audits.link_audit_quality_case` | Explicit NCR/CAPA only; never automatic |
| manage_auditfindingconfig | `quality_audits.manage_auditfindingconfig` | Unseeded classification/severity shells |

Audit programme and role mapping remain APR-070 EVIDENCE REQUIRED.

### Compliance Control Mapping (Phase 46)

| Key | Permission | Notes |
| --- | --- | --- |
| view_compliancemapping | `compliance_mapping.view_compliancemapping` | Read-only auditor access |
| manage_compliancesource | `compliance_mapping.manage_compliancesource` | Restricted source/applicability administration |
| manage_compliancecontrol | `compliance_mapping.manage_compliancecontrol` | Mappings, evidence citations, gaps |
| verify_compliancecontrol | `compliance_mapping.verify_compliancecontrol` | Verification ≠ COMPLIANT |
| link_compliance_gap_action | `compliance_mapping.link_compliance_gap_action` | Explicit Risk/Change/NCR/CAPA/Action only |

Official sources and role mapping remain APR-071 EVIDENCE REQUIRED. No ISO/FSSC/HACCP/SLS/legal claim.

### Quality Risk Management (Phase 47)

| Key | Permission | Notes |
| --- | --- | --- |
| view_qualityrisk | `quality_risks.view_qualityrisk` | View risks and dashboards |
| manage_qualityrisk | `quality_risks.manage_qualityrisk` | Create/maintain risks, reviews, links, mitigations |
| assess_qualityrisk | `quality_risks.assess_qualityrisk` | Append-only assessments |
| accept_qualityrisk | `quality_risks.accept_qualityrisk` | Residual acceptance; not a matrix threshold |
| manage_qualityriskpolicy | `quality_risks.manage_qualityriskpolicy` | Owner-cited scoring policy; default OFF |

Scoring methodology remains APR-072 EVIDENCE REQUIRED.

### Process FMEA (Phase 48)

| Key | Permission | Notes |
| --- | --- | --- |
| view_processfmea | `process_fmea.view_processfmea` | View FMEA records and versions |
| manage_processfmea | `process_fmea.manage_processfmea` | Draft structure, links, generic actions |
| approve_processfmea | `process_fmea.approve_processfmea` | Approve draft versions; approved are immutable |
| configure_processfmeascoring | `process_fmea.configure_processfmeascoring` | Owner-cited scoring policy; default OFF |
| link_processfmea_action | `process_fmea.link_processfmea_action` | Explicit CAPA/change from recommended actions |

PFMEA methodology remains APR-073 EVIDENCE REQUIRED. S×O×D product is not an RPN policy.

### Structured RCA (Phase 49)

| Key | Permission | Notes |
| --- | --- | --- |
| view_rca | `rca.view_rca` | View RCA records and history |
| manage_rca | `rca.manage_rca` | Create/edit RCA, methods, possible/supported causes |
| confirm_rca | `rca.confirm_rca` | Human confirm + verification; AI cannot confirm |
| link_rca_capa | `rca.link_rca_capa` | Explicit CAPA from confirmed root cause |

RCA SOP remains APR-074 EVIDENCE REQUIRED.

