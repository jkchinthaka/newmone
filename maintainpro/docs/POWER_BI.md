# Power BI / Reporting Layer

SQL Server views (tenant-filtered by `tenantId` column — always filter in Power BI/dataset):

- `vw_rpt_dim_date`
- `vw_rpt_dim_branch_site`
- `vw_rpt_fact_maintenance`
- `vw_rpt_fact_downtime`

Migration: `20260917230000_reporting_views`

KPI formulas remain governed in `apps/api/src/modules/reporting-kpis/kpi-definitions.ts` and `docs/KPI_DEFINITIONS.md`. Power BI measures must not redefine contradictory logic.
