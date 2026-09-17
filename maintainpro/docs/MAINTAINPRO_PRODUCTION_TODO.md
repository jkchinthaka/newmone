# MaintainPro Production TODO — Remaining Actions Only

**Updated:** 2026-09-17  
**Branch:** `maintainpro/final-enterprise-closure`  
**Scope:** Only items that remain after final enterprise engineering closure. Delivered engineering work is not listed.

Status legend: OPEN | EXTERNAL | HUMAN | CUTOVER

| ID | Owner | Status | Task |
|----|-------|--------|------|
| EXT-ERP-01 | ERP vendor + IT | EXTERNAL | Provide production Bileeta read credentials; run `npm run erp:check` against live endpoint |
| EXT-ENTRA-01 | IT administrator | EXTERNAL | Register Microsoft Entra app + configure SSO secrets for production |
| EXT-NOTIFY-01 | DevOps / IT | EXTERNAL | Configure production SMTP and SMS credentials; validate allowlisted UAT send |
| EXT-PBI-01 | BI administrator | EXTERNAL | Deploy Power BI dataset, apply tenant RLS filters on `vw_rpt_*`, validate with service account |
| EXT-SQL-01 | DevOps | EXTERNAL | Provision staging/production SQL Server; wire `DATABASE_URL`; confirm backup share permissions |
| HUM-UAT-01 | Human UAT tester | HUMAN | Execute Gate-1 11-role UAT from `docs/UAT_RUNBOOK.md`; fill pass/fail + sign-off (do not fake) |
| HUM-UAT-02 | Stakeholders | HUMAN | Visual/browser operational acceptance on staging |
| HUM-APPROVAL-01 | Management | HUMAN | Written approval for production cutover |
| CUT-01 | DevOps + DBA | CUTOVER | Irreversible SQL Server cutover per `docs/SQLSERVER_CUTOVER_ROLLBACK.md` (not agent-executed) |
| CUT-02 | DBA | CUTOVER | Retain Mongo migration source until signed cutover + successful reconciliation (`npm run db:reconcile`) |
| CUT-03 | DevOps | CUTOVER | DNS / traffic cutover only after Gate-1 PASS and backup drill evidence |

## Explicitly closed by engineering (do not re-open as NOT_STARTED)

- SQL Server schema/migrations, Supplier.tenantId required, money Decimal conversion, asset hierarchy cycle trigger
- Empty-database migrate+seed proof, upgrade migrate on MaintainProDev, backup/restore drill tooling
- CI SQL Server migration gate, compose defaults for SQL Server primary, `db:push` refused for prod path
- API URL fail-closed without silent production fallback
- Workflow/readiness/vendor/offline/governance modules already on phase-15 tip

## Validation commands (local closure evidence)

```bash
npm run db:migrate:deploy
npm run db:seed
npm run typecheck
npm run lint
npm run test
npm run db:reconcile
npm run erp:check
npm run db:sqlserver:drill
```
