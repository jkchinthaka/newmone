# Defect Register — Final Acceptance

**Branch:** `maintainpro/final-acceptance-validation`

| ID | Module | Sev | Steps | Expected | Actual | Root cause | Files | Fix | Retest | Status |
|----|--------|-----|-------|----------|--------|------------|-------|-----|--------|--------|
| FA-001 | Maintenance requests / RBAC | P1 | Login as MANAGER → POST `/maintenance-requests` | 201 create | 403 PERMISSION_DENIED | Seed gave `facility_issues.manage` but create alias only accepted `facility_issues.report` / `cleaning.report_issue` | `permissions.guard.ts`, `seed.ts` | Expand aliases; add explicit MR perms to MANAGER/SUPERVISOR | Journey 13/13 PASS | CLOSED |
| FA-002 | Maintenance requests / SQL | P1 | Create second request while first still unconverted | 201 | 409 unique on MaintenanceRequest | SQL Server UNIQUE on nullable `workOrderId` allows only one NULL | `prisma/migrations/20260919140000_*`, `schema.prisma` | Filtered unique index WHERE workOrderId IS NOT NULL (also FacilityIssue) | Journey create MR-00002 PASS | CLOSED |

## Previously remediated (PR #42)

Action Center aggregates, facility 403 routing, finance/procurement content, timeout parsing, nav badge RBAC — do not re-open without regression evidence.
