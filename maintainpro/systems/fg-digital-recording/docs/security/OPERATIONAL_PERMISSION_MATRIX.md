# Operational Permission Matrix

**Document status:** Phase 03C technical matrix — **TECHNICALLY SUPPORTED** only
**Created:** 2026-08-10
**Authority:** Catalogue `apps/access_control/permission_catalogue.py`
**Not:** Business-approved role chart, SoD policy, or employee assignment list

## Status vocabulary

| Label | Meaning |
| --- | --- |
| **TECHNICALLY SUPPORTED** | Permission string exists on a Django model (custom or default) and is evaluated via scoped RBAC |
| **BUSINESS APPROVED** | Named owner written approval mapping the permission to a Nelna responsibility — **none recorded here** |
| **PENDING** | SoD / policy question open; silence ≠ answer |

Django `is_superuser` is **not** a business QA authority and is listed only as a break-glass technical bypass.

## Scope dimensions

Assignments may be:

| Scope | Meaning |
| --- | --- |
| Organization | Covers sites/departments in that organization |
| Site | Covers that site and its departments |
| Department | Covers that department only |
| system-wide | Organization/site/department all unset — covers all scopes |

Inactive roles, inactive assignments, future `valid_from`, and expired `valid_until` grant **nothing** (fail closed).

## Capability separation (hard rules)

| Rule | Technical meaning |
| --- | --- |
| manage ≠ record | `scheduling.manage_checklisttask` does not grant `scheduling.record_checklisttask` |
| assign ≠ permission | `scheduling.assign_checklisttask` never grants view/manage/record (Phase 07G) |
| record ≠ Supervisor review | `scheduling.record_checklisttask` does not grant `reviews.review_checklistsubmission` |
| Supervisor review ≠ QA review | `reviews.review_checklistsubmission` does not grant `quality.qa_review_checklistsubmission` |
| Django superuser ≠ business QA | `is_superuser` bypasses checks technically; it is **not** approved QA disposition authority |

Submit and correction currently use the same technical permission as record (`scheduling.record_checklisttask`). SoD ownership locks remain **PENDING**.

## Matrix

| Capability | Permission (`app_label.codename`) | Organization | Site | Department | system-wide | Status |
| --- | --- | --- | --- | --- | --- | --- |
| View checklist task | `scheduling.view_checklisttask` | Yes | Yes | Yes | Yes (via system-wide assignment) | TECHNICALLY SUPPORTED |
| View checklist template | `checklists.view_checklisttemplate` | Yes | — | — | Yes | TECHNICALLY SUPPORTED |
| View FG product | `master_data.view_fgproduct` | Yes | — | — | Yes | TECHNICALLY SUPPORTED |
| View shift | `organizations.view_shift` | Yes | Yes | Yes | Yes | TECHNICALLY SUPPORTED |
| View Supervisor review object | `reviews.view_supervisorreview` | Yes | Yes | Yes | Yes | TECHNICALLY SUPPORTED |
| Manage checklist task | `scheduling.manage_checklisttask` | Yes | Yes | Yes | Yes | TECHNICALLY SUPPORTED |
| Assign / reassign / unassign task ownership | `scheduling.assign_checklisttask` | Yes | Yes | Yes | Yes | TECHNICALLY SUPPORTED |
| Manage / publish checklist definition | `checklists.manage_checklist` | Yes | — | — | Yes | TECHNICALLY SUPPORTED |
| Manage FG product (master data) | `master_data.manage_fgproduct` | Yes | — | — | Yes | TECHNICALLY SUPPORTED |
| Manage shift | `organizations.manage_shift` | Yes | Yes | Yes | Yes | TECHNICALLY SUPPORTED |
| Manage CAPA | `capa.manage_capa` | Yes | — | — | Yes | TECHNICALLY SUPPORTED |
| Manage nonconformance | `nonconformance.manage_nonconformance` | Yes | — | — | Yes | TECHNICALLY SUPPORTED |
| Manage supplier quality (QA) | `supplier_quality.manage_supplierquality_qa` | Yes | — | — | Yes | TECHNICALLY SUPPORTED |
| View supplier quality (Procurement) | `supplier_quality.view_supplierquality_procurement` | Yes | — | — | Yes | TECHNICALLY SUPPORTED |
| Record checklist responses | `scheduling.record_checklisttask` | Yes | Yes | Yes | Yes | TECHNICALLY SUPPORTED |
| Submit checklist (technical) | `scheduling.record_checklisttask` | Yes | Yes | Yes | Yes | TECHNICALLY SUPPORTED |
| Correction / resubmission (technical) | `scheduling.record_checklisttask` | Yes | Yes | Yes | Yes | TECHNICALLY SUPPORTED |
| Supervisor review | `reviews.review_checklistsubmission` | Yes | Yes | Yes | Yes | TECHNICALLY SUPPORTED |
| QA final disposition | `quality.qa_review_checklistsubmission` | Yes | Yes | Yes | Yes | TECHNICALLY SUPPORTED |
| Audit event view | `security_audit.view_securityauditevent` | — | — | — | Yes (typical) | TECHNICALLY SUPPORTED |
| System administration (Django) | `__django_superuser__` (not a Permission row) | — | — | — | Yes | TECHNICALLY SUPPORTED (break-glass) |

Notes:

- “Yes” under a scope column means a `ScopedRoleAssignment` at that scope (or broader covering scope) can grant the permission when the Role holds it.
- Checklist **publish** is not a separate permission; publishing uses `checklists.manage_checklist`.
- Admin UI access (`is_staff`) is orthogonal to operational permissions and is not a substitute for QA/Supervisor authority.

## Related

- [PHASE_03C_OPERATIONAL_ROLE_GOVERNANCE.md](../business/PHASE_03C_OPERATIONAL_ROLE_GOVERNANCE.md)
- [AUTHENTICATION_AND_ACCESS_CONTROL.md](AUTHENTICATION_AND_ACCESS_CONTROL.md)
- [CHECKLIST_RECORDER_ROLE_MAPPING.md](../business/CHECKLIST_RECORDER_ROLE_MAPPING.md)
- [ADR-007-SCOPED-RBAC.md](../architecture/ADR-007-SCOPED-RBAC.md)
- APR-007..010, APR-040 (role templates) in [APPROVAL_REGISTER.md](../governance/APPROVAL_REGISTER.md)

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

