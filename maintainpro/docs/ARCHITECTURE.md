# Architecture — MaintainPro Enterprise

Modular monolith (NestJS API + Next.js web + Flutter mobile) on Prisma + SQL Server.

## Core engines

| Engine | Location |
|--------|----------|
| Workflow | `modules/workflow-engine` + code state-machines fallback |
| Job readiness | `modules/job-readiness` (structured blockers) |
| Approvals | `modules/approvals` + delegation API |
| SoD / governance | `modules/enterprise-governance` |
| Reliability / safety | `modules/reliability` (downtime, RCA/CAPA, PTW, LOTO, CBM) |
| ERP | `modules/erp-integration` + Bileeta adapter/mock |
| Vendor portal | `modules/vendor-portal` |
| Numbering | `modules/numbering` |
| KPI / Power BI | `reporting-kpis` + `vw_rpt_*` views |

## Multi-tenancy & auth

JWT → TenantContext → Roles → Permissions. Entra SSO adapter is SSO-ready; production tenant is external.

## Offline

Service worker + localStorage/IndexedDB offline queue with conflict classification (`lib/offline/*`).

See also: WORKFLOW_ENGINE.md, APPROVAL_ENGINE.md, RBAC_AND_SCOPE.md, ERP_INTEGRATION.md, VENDOR_PORTAL.md, OFFLINE_PWA.md, POWER_BI.md, SECURITY.md.
