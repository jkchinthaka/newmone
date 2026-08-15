# User Roles

## Scope of this document

This document lists technical permission separations that exist in the repository. It does not claim approved Nelna job-title mappings.

Business role mappings remain:

- `EVIDENCE REQUIRED`
- `DECISION REQUIRED`
- `BLOCKED` for production use until approved

Authoritative references:

- [../security/PERMISSION_MATRIX.md](../security/PERMISSION_MATRIX.md)
- [../security/AUTHENTICATION_AND_ACCESS_CONTROL.md](../security/AUTHENTICATION_AND_ACCESS_CONTROL.md)
- [../governance/APPROVAL_REGISTER.md](../governance/APPROVAL_REGISTER.md)

## Non-negotiable technical separations

- `manage_checklisttask` does not imply `record_checklisttask`
- `record_checklisttask` does not imply supervisor review
- `review_checklistsubmission` does not imply QA review
- `qa_review_checklistsubmission` does not imply recorder or supervisor powers
- `assign_checklisttask` is ownership assignment only and does not grant broader RBAC
- Django `is_superuser` is not business QA authority by itself

## Technical capability buckets

| Technical capability | Example permission(s) | Status |
| --- | --- | --- |
| View tasks | `scheduling.view_checklisttask` | TECHNICALLY SUPPORTED |
| Manage tasks | `scheduling.manage_checklisttask` | TECHNICALLY SUPPORTED |
| Assign tasks | `scheduling.assign_checklisttask` | TECHNICALLY SUPPORTED |
| Record / submit / correct | `scheduling.record_checklisttask` | TECHNICALLY SUPPORTED |
| Supervisor review | `reviews.review_checklistsubmission` | TECHNICALLY SUPPORTED |
| QA review | `quality.qa_review_checklistsubmission` | TECHNICALLY SUPPORTED |
| Checklist publish/manage | `checklists.manage_checklist` | TECHNICALLY SUPPORTED |
| Product management | `master_data.manage_fgproduct` | TECHNICALLY SUPPORTED |
| Shift management | `organizations.manage_shift` | TECHNICALLY SUPPORTED |
| Audit viewing | `security_audit.view_securityauditevent` | TECHNICALLY SUPPORTED |
| Integration boundary ops | `integrations.manage_integrationboundary` | TECHNICALLY SUPPORTED |

## Business mappings

Current approved business mappings found in the repository:

- None

Open approvals include:

- APR-007 recorder mapping
- APR-008 supervisor mapping
- APR-009 QA mapping
- APR-010 segregation of duties
- APR-040 role-template governance for production use

## Practical handover rule

When configuring any environment beyond a developer workstation:

1. Treat technical permissions as a catalogue only.
2. Require written owner approval for role-to-permission mapping.
3. Keep create, review, and QA responsibilities separated unless approved evidence says otherwise.
4. Do not invent job titles or assign real users based on assumption.

## Related docs

- [WORKFLOW_GUIDE.md](WORKFLOW_GUIDE.md)
- [SECURITY_GUIDE.md](SECURITY_GUIDE.md)
- [BUSINESS_EVIDENCE_REQUIRED.md](BUSINESS_EVIDENCE_REQUIRED.md)
