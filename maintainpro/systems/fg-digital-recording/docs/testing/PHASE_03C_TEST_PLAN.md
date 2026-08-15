# Phase 03C Test Plan — Operational role governance

**Document status:** Engineering test plan — **not** business role approval  
**Phase:** 03C  
**Coverage gate:** ≥80% on `apps.access_control` governance modules

## Cases

| ID | Case | Expectation |
| --- | --- | --- |
| 03C-T01 | Permission catalogue | Known keys present; buckets separate record/review/QA |
| 03C-T02 | RoleTemplate create | Defaults PROPOSED; no user assignment |
| 03C-T03 | OWNER_APPROVED | Requires evidence_reference |
| 03C-T04 | Create role from template | Copies permissions; zero ScopedRoleAssignment |
| 03C-T05 | Cross-org denial | Org A grant does not cover Org B |
| 03C-T06 | Expired / inactive assignment | Grants nothing |
| 03C-T07 | manage ≠ record | |
| 03C-T08 | record ≠ Supervisor/QA | |
| 03C-T09 | Supervisor ≠ QA | |
| 03C-T10 | Assign/revoke audit | ROLE_ASSIGNED / ROLE_REVOKED |
| 03C-T11 | Template/role permission audit | ROLE_TEMPLATE_* / ROLE_PERMISSIONS_SET |
| 03C-T12 | Escalation | Record-only user does not gain QA without assignment |
| 03C-T13 | SoD register | All questions PENDING |

## Out of scope

- Enforcing SoD while APR-010 is open
- Seeding Nelna-approved roles or employee assignments
