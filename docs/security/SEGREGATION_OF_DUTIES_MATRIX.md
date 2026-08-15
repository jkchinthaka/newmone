# Segregation of Duties Matrix

**Status:** Technical proposal for company decision.
**Final company policy:** **BUSINESS APPROVAL REQUIRED** — do not treat this matrix as approved Nelna policy.

## Roles in scope

| Role | Typical FG actions (technical) |
| --- | --- |
| Recorder | Create/edit drafts; submit records |
| Supervisor | Approve / return submissions |
| QA | RELEASE / HOLD / REJECT (where applicable) |
| Admin | User/config administration (not substitute for QA decisions) |
| Business Owner | Policy approval; go-live authorization |
| IT Support | Infrastructure, backups, access provisioning under ticket |

## Combination evaluation

| Combination | Risk | Proposed technical stance | Company decision |
| --- | --- | --- | --- |
| Recorder + Supervisor | Self-approval of own work | Discourage; block if policy requires | BUSINESS APPROVAL REQUIRED |
| Supervisor + QA | Dual control collapse | Discourage for same org scope | BUSINESS APPROVAL REQUIRED |
| Recorder + QA | Self-release risk | Discourage / block if policy requires | BUSINESS APPROVAL REQUIRED |
| Admin + business approval | Privileged override of quality decisions | Separate break-glass; audit all | BUSINESS APPROVAL REQUIRED |
| IT Support + QA | Infrastructure vs quality decision | IT must not perform QA release | BUSINESS APPROVAL REQUIRED |
| Shared accounts | Non-repudiation failure | **Forbidden** | BUSINESS APPROVAL REQUIRED (confirm) |

## Enforcement notes (technical)

- Application RBAC is organization-scoped and deny-by-default.
- Admin model state transitions for NCR/RCA/CAPA/Hold are restricted (readonly critical fields) to reduce silent bypass.
- Formal SoD enforcement rules (hard blocks vs warnings) require written company policy evidence before coding additional blocks under feature freeze.

## Approval

| Field | Value |
| --- | --- |
| Business Owner | |
| QA | |
| IT | |
| Date | |
| Approved policy reference | |
| Status | **AWAITING BUSINESS APPROVAL** |
