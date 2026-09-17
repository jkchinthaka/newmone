# Database Overview

**Updated:** 2026-09-18  
**Provider:** Microsoft SQL Server via Prisma  
**Application root:** `maintainpro/`

## Purpose

This folder documents MaintainPro’s SQL Server data model so developers and DBAs can understand ownership, lifecycle, and integrity without reading every service.

## Authoritative sources

| Artifact | Role |
|----------|------|
| `prisma/schema.prisma` | Canonical schema |
| `prisma/migrations/*` | Forward-only SQL Server migrations |
| `docs/DATABASE_MAPPING_AUDIT.md` | Domain mapping |
| `docs/DATABASE_HEALTH_REPORT.md` | Integrity status |
| `docs/DATA_MODEL.md` | Mermaid ERDs by bounded context |

## Domain map (high level)

| Domain | Key tables | Source of truth notes |
|--------|------------|------------------------|
| Platform | Tenant, FeatureFlag, NumberingSequence | Tenant is root |
| Identity | User, Role, Membership | Permission-based access |
| Organization | OrganizationUnit, Site, Department, FunctionalLocation | Recursive units; cycle-protected |
| Assets | Asset, AssetMeter, AssetMeterReading | Asset ≠ FunctionalLocation |
| Requests | MaintenanceRequest (+ History) | Canonical request capture |
| Work | WorkOrder (+ Status/Hold/Labour history) | Canonical execution |
| PM | PmPlan, PmPlanRevision, PmTrigger, **PmOccurrence**, PmAutoGeneration | Plan ≠ Occurrence ≠ WO |
| Inventory | SparePart, WarehouseItemBalance, StockMovement, **StockCountSession/Line** | Ledger-driven; count posts via adjustments only |
| Fleet | Vehicle (+ Asset link), Gate, Accident, Claim, Fine | Shared WO engine |
| Safety | WorkPermit, LotoRecord | Start/close gates |
| Reliability | DowntimeSegment, RcaCase, CapaAction | Policy-driven |
| ERP | ErpFieldMapping, ErpImport*, ErpReconciliationMismatch | Provider-agnostic mapping |
| Audit | AuditLog, SecurityEvent, ConfigChangeHistory | Append-only |

## Integrity rules (summary)

- Money: `Decimal(18,2)` (rates may use 18,4)
- FK delete: `NoAction` (no cascade chains on business history)
- Tenant-owned business rows: `tenantId` required
- Optimistic concurrency: `version` on Asset, WorkOrder, MaintenanceRequest
- Asset hierarchy + OrgUnit: DB cycle triggers
- Supplier.tenantId required

## Related catalogs

- `DATA_DICTIONARY.md` — table-level purpose
- `STATUS_CATALOG.md` — lifecycle enums vs derived states
- `LEGACY_DISPOSITION.md` — FacilityIssue, Farm, Cleaning, Billing soft-retired paths

## Migration practice

```bash
npm run db:migrate:deploy   # empty or upgrade
npm run db:seed             # idempotent
# Never db:push for staging/production
```
