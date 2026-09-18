# Legacy Disposition

Process: hide UI → stop writes → export/backup → migrate → reconcile → remove runtime dependency → archive → drop only with approval.

| Area | Disposition | Notes |
|------|-------------|-------|
| FacilityIssue | MIGRATE → historical archive | MaintenanceRequest is canonical |
| MaintenanceSchedule (legacy) | MIGRATE → PmPlan | Preserve history |
| Farm operations app surfaces | HIDE / DEPRECATE | Farm equipment still via Asset/WO/PM |
| Cleaning workforce modules | HIDE / DEPRECATE | Not in final business IA |
| Billing / SaaS UX | HIDE if unused by deployment | |
| Delivery / QA / go-live tooling | Technical Admin only or hide | Not operator navigation |
| Predictive demo surfaces | HIDE | |
| Legacy FMS pages | Redirect / alias then remove | |
| Mock-only ERP models | Fail closed in production | |
| REJECTED request status | Legacy terminal | New closures use CLOSED + resolutionCode |
| Direct WO/Vehicle delete | Removed | Cancel / Dispose instead |

Do not drop tables until reconciliation evidence and owner approval exist.
