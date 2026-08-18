# Phase 03C — Operational Role Governance

**Document status:** Technical governance package — **not** company role approval  
**Phase:** 03C  
**Authority separation:** TECHNICALLY SUPPORTED ≠ BUSINESS APPROVED  
**Related:** [APPROVAL_REGISTER.md](../governance/APPROVAL_REGISTER.md) APR-007/008/009/010/040; [CHECKLIST_RECORDER_ROLE_MAPPING.md](CHECKLIST_RECORDER_ROLE_MAPPING.md); [AUTHENTICATION_AND_ACCESS_CONTROL.md](../security/AUTHENTICATION_AND_ACCESS_CONTROL.md)

## Purpose

Formalize the relationship between **technical Django permissions** and **proposed business responsibilities** without inventing Nelna authority from Claude/Gemini examples.

This phase:

- Inventories current permissions and scopes
- Documents proposed business categories as **PROPOSED only**
- Tracks segregation-of-duties (SoD) questions as **PENDING** until owners respond
- Adds empty configurable `RoleTemplate` architecture (no employee assignment seed)
- Preserves deny-by-default and capability separation already in code

## TECHNICALLY SUPPORTED vs BUSINESS APPROVED

| Class | Meaning |
| --- | --- |
| **TECHNICALLY SUPPORTED** | Permission exists; RBAC evaluation works; templates can copy permission sets |
| **BUSINESS APPROVED** | Named owner mapped a Nelna job/category to a Role + scope with recorded APR evidence |

No Business Approved mappings exist yet for recorder / Supervisor / QA categories (APR-007/008/009 remain **EVIDENCE REQUIRED**).

## Object scope model

Assignments use `ScopedRoleAssignment` with optional:

| Scope field | Meaning |
| --- | --- |
| Organization | Org-wide grant within that organization |
| Site | Requires organization; site must belong to organization |
| Department | Requires organization; site rules apply when set |
| (all null) | System-wide technical grant (break-glass / platform ops) |

Effective window fields `valid_from` / `valid_until` already exist (Phase 03). Inactive or outside-window assignments grant nothing.

## Technical permission matrix

Source of truth in code: `apps/access_control/permission_catalogue.py`.

| Bucket | Technical permission(s) | Notes |
| --- | --- | --- |
| view | Django default `view_*` where used | Does not imply manage/record/review |
| manage | `scheduling.manage_checklisttask`, module manage_* | Does **not** imply record |
| record | `scheduling.record_checklisttask` | Draft entry |
| submit | same as record (no separate codename) | Documented as distinct capability |
| correction | same as record | Ownership locking **EVIDENCE REQUIRED** |
| Supervisor review | `reviews.review_checklistsubmission` | Does **not** imply record or QA |
| QA review | `quality.qa_review_checklistsubmission` | Does **not** imply Supervisor/record |
| master-data | `master_data.manage_fgproduct`, `organizations.manage_shift` | |
| checklist publish | `checklists.manage_checklist` | Publish ≠ content approval |
| audit access | `security_audit.view_securityauditevent` (default view) | No custom export perm in 03C |
| system administration | Django `is_superuser` | Break-glass; not business QA authority |

### Hard technical separations (preserved)

- `manage` ≠ `record`
- `record` ≠ Supervisor review
- Supervisor review ≠ QA review
- System Admin / superuser ≠ business QA authority (unless a future approved policy says otherwise)

No auto-grant of permissions. Templates never create `ScopedRoleAssignment`.

## Proposed business categories (NOT approved)

| Proposed category | Status | Approved mapping |
| --- | --- | --- |
| Operator / Production Employee | PROPOSED | No |
| Stores Employee | PROPOSED | No |
| Supervisor | PROPOSED | No |
| QA Officer | PROPOSED | No |
| QA Manager | PROPOSED | No |
| Site Manager | PROPOSED | No |
| System Administrator | PROPOSED | No |
| Management | PROPOSED | No |
| Auditor | PROPOSED | No |

Do **not** create Django Roles named after these labels as if they were Nelna-approved.

## Segregation of duties questions (all PENDING)

| Question | Response | Status |
| --- | --- | --- |
| Can a recorder review their own submission? | (none) | **PENDING** |
| Can a Supervisor act as QA for the same submission? | (none) | **PENDING** |
| Can QA record production checks? | (none) | **PENDING** |
| Can System Admin make QA disposition? | (none) | **PENDING** |
| Can a user publish checklist definitions and approve their own content? | (none) | **PENDING** |
| Can specification editor approve their own change? | (none) | **PENDING** |

Application code does **not** invent SoD enforcement while APR-010 remains open. Actor fields remain distinct so future policy can be enforced without schema redesign.

## Role template architecture

`RoleTemplate`:

- Empty by default (no seed)
- `business_status`: `PROPOSED` | `PENDING_OWNER_APPROVAL` | `OWNER_APPROVED`
- `OWNER_APPROVED` requires `evidence_reference`
- Optional `business_category_hint` (proposed label only)
- Services: create/update template, set permissions, create Role from template
- **Never** auto-assigns users

## Audit events (03C)

| Event | When |
| --- | --- |
| `ROLE_ASSIGNED` / `ROLE_REVOKED` | Existing assignment lifecycle |
| `ROLE_PERMISSIONS_SET` | Role permission set / copy from template |
| `ROLE_TEMPLATE_CREATED` | Template created |
| `ROLE_TEMPLATE_UPDATED` | Template metadata updated |
| `ROLE_TEMPLATE_PERMISSIONS_SET` | Template permission set changed |

Metadata excludes secrets and free-text passwords. Permission lists are codenames only.

## Exit / remaining blockers

Technical foundation for 03C is deliverable. **Business role approval remains pending** until APR-007/008/009/010 (and APR-040 for any OWNER_APPROVED template) receive named owner evidence.
