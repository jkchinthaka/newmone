# Operational Permission Matrix (Phase 03C)

**Document status:** Technical inventory — **TECHNICALLY SUPPORTED** only  
**Not:** company-approved role chart  
**Code catalogue:** `apps/access_control/permission_catalogue.py`

## Capability × permission

| Capability bucket | Permission | Org | Site | Dept | System-wide | Business mapping |
| --- | --- | --- | --- | --- | --- | --- |
| view | `scheduling.view_checklisttask` | Y | Y | Y | — | APPROVAL REQUIRED |
| view | `checklists.view_checklisttemplate` | Y | — | — | Y | APPROVAL REQUIRED |
| view | `master_data.view_fgproduct` | Y | — | — | Y | APPROVAL REQUIRED |
| view | `organizations.view_shift` | Y | Y | Y | — | APPROVAL REQUIRED |
| view | `reviews.view_supervisorreview` | Y | Y | Y | — | APPROVAL REQUIRED |
| manage | `scheduling.manage_checklisttask` | Y | Y | Y | — | APPROVAL REQUIRED |
| manage | `capa.manage_capa` | Y | Y | Y | — | APPROVAL REQUIRED |
| manage | `nonconformance.manage_nonconformance` | Y | Y | Y | — | APPROVAL REQUIRED |
| manage | `supplier_quality.manage_supplierquality_qa` | Y | — | — | Y | APPROVAL REQUIRED |
| checklist_publish | `checklists.manage_checklist` | Y | — | — | Y | APPROVAL REQUIRED |
| master_data | `master_data.manage_fgproduct` | Y | Y | — | — | APPROVAL REQUIRED |
| master_data | `organizations.manage_shift` | Y | Y | — | — | APPROVAL REQUIRED |
| record | `scheduling.record_checklisttask` | Y | Y | Y | — | APPROVAL REQUIRED (APR-007) |
| submit | `scheduling.record_checklisttask` (same) | Y | Y | Y | — | APPROVAL REQUIRED |
| correction | `scheduling.record_checklisttask` (same) | Y | Y | Y | — | APPROVAL REQUIRED |
| supervisor_review | `reviews.review_checklistsubmission` | Y | Y | Y | — | APPROVAL REQUIRED (APR-008) |
| qa_review | `quality.qa_review_checklistsubmission` | Y | Y | Y | — | APPROVAL REQUIRED (APR-009) |
| audit_access | `security_audit.view_securityauditevent` | — | — | — | Y | APPROVAL REQUIRED |
| system_administration | Django `is_superuser` (not a Permission row) | — | — | — | Y | Break-glass only |

## Separation reminders

| Must not auto-imply | |
| --- | --- |
| manage → record | No |
| record → Supervisor review | No |
| Supervisor review → QA review | No |
| System Admin → business QA | No (pending APR-010 / SOD-04) |

## Approved business mappings found

**None.** Recorder / Supervisor / QA category → Role mappings remain empty configuration worksheets.

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

