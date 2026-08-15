# Phase 03C — Role Governance

**Document status:** Technical governance complete; **business role approval pending**
**Phase status:** `PHASE 03C BUSINESS ROLE APPROVAL PENDING`
**Date:** 2026-08-10

## Purpose

Formalize **technical permissions** versus **proposed business responsibilities** without declaring company authority. Role templates and permission catalogues are configuration tools — not approved Nelna org charts.

## What Phase 03C delivered (technical)

1. Permission catalogue (`apps/access_control/permission_catalogue.py`) + [PERMISSION_MATRIX.md](../security/PERMISSION_MATRIX.md)
2. Configurable empty `RoleTemplate` model (optional `business_category_hint` — documentation only)
3. Governance services with audit: template create/permissions, `apply_role_template_to_role`, `set_role_permissions`
4. SoD decision register (docs only — PENDING / EVIDENCE REQUIRED)
5. Permission matrix + Phase 03C operational role governance docs
6. Tests for catalogue, templates, permission separation, assignment windows, audit

## Explicit non-goals / prohibitions

- No seeded real employee assignments
- No seeded “approved” Nelna roles named after AI examples
- No auto-grant of permissions
- No invented APPROVED SoD enforcement policy
- No change to manage / record / supervisor / QA separation

## Proposed business categories (PROPOSED — NOT APPROVED)

These labels are **suggestions for owner discussion only**. They are **not** seeded Roles and **not** company-approved.

| Proposed category | Suggested technical permissions (NOT APPROVED) | Notes |
| --- | --- | --- |
| Operator | `scheduling.record_checklisttask` (+ view as needed) | APR-007 |
| Stores | `scheduling.record_checklisttask` (+ view as needed) | APR-007 |
| Supervisor | `reviews.review_checklistsubmission` | APR-008; SoD PENDING |
| QA Officer | `quality.qa_review_checklistsubmission` and/or record — **owner decision** | APR-009; do not assume both |
| QA Manager | QA review + checklist manage suggestions only | APPROVAL REQUIRED |
| Site Manager | Broad view/manage suggestions only | APPROVAL REQUIRED |
| System Administrator | Staff/admin + scoped roles; superuser break-glass | APPROVAL REQUIRED |
| Management | View-oriented suggestions only | APPROVAL REQUIRED |
| Auditor | Audit view suggestions only | APPROVAL REQUIRED |

## RoleTemplate usage

- Default catalogue: **empty** (migration does not seed templates)
- `business_category_hint` is documentation only — never approval evidence
- `apply_role_template_to_role` copies permissions onto an existing `Role` only — **no user assignment**
- Assignment still uses `assign_role` / `ScopedRoleAssignment` with `valid_from` / `valid_until` effective windows

## SoD

See [SOD_DECISION_REGISTER.md](SOD_DECISION_REGISTER.md). All listed SoD questions remain **PENDING / EVIDENCE REQUIRED**. Architecture retains distinct actor fields for future enforcement without inventing policy.

## Approval items

- APR-007 / APR-008 / APR-009 / APR-010 — EVIDENCE REQUIRED
- APR-040 — RoleTemplate catalogue content / owner approval — EVIDENCE REQUIRED

## Related

- [OPERATIONAL_PERMISSION_MATRIX.md](../business/OPERATIONAL_PERMISSION_MATRIX.md)
- [PHASE_03C_OPERATIONAL_ROLE_GOVERNANCE.md](../business/PHASE_03C_OPERATIONAL_ROLE_GOVERNANCE.md)
- [CHECKLIST_RECORDER_ROLE_MAPPING.md](../business/CHECKLIST_RECORDER_ROLE_MAPPING.md)
- [APPROVAL_REGISTER.md](APPROVAL_REGISTER.md)
