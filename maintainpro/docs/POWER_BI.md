# Power BI / Reporting Layer

SQL Server views (tenant-filtered by `tenantId` column — always filter in Power BI/dataset):

- `vw_rpt_dim_date`
- `vw_rpt_dim_branch_site` (includes optional `OrganizationUnit` attributes)
- `vw_rpt_fact_maintenance`
- `vw_rpt_fact_downtime`

Migrations: `20260917230000_reporting_views`, hardened in `20260917240000_database_integrity_hardening`

KPI formulas remain governed in `apps/api/src/modules/reporting-kpis/kpi-definitions.ts` and `docs/KPI_DEFINITIONS.md`. Power BI measures must not redefine contradictory logic.

## Power BI security model

Views **include `tenantId`** and exclude null-tenant rows, but they are **not** SQL Server RLS-protected by default.

Mandatory controls:

1. Power BI dataset / gateway must apply a **tenant filter** (or use a per-tenant dataset).
2. Service accounts must not receive unfiltered cross-tenant access in shared workspaces without RLS roles.
3. Organization filters should use `Site` / `OrganizationUnit` dimensions in RLS or report filters.

Until BI-platform RLS is configured, multi-tenant workspace access remains an **operational external dependency**.
