# 03 Requirements traceability

| Rule | Entry points checked | Enforcement |
| --- | --- | --- |
| Current role, not token role | JWT validate, tenant guard | Database `User.role` |
| Tenant membership | Tenant guard | Required unless current role is `SUPER_ADMIN` |
| No generic verify/close | `updateStatus`, `bulkStatus` | Forbidden. Dedicated actions remain |
| Maker-checker | `verifySupervisor` | Existing segregation check. Not re-audited line by line this session |
| Closed content | `WorkOrdersService.update` | `assertClosedRecordContentEditable` |
| Status concurrency | `updateStatus` | Required `expectedVersion` plus `updateMany` |
| Stock over-issue | `assertVerifiedIssueAllowed` | Present. SQL integration not run this session |

Alternate paths not fully rechecked after the version change: assignment, parts, attachments, notes, background jobs, imports.
