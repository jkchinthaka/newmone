# Database Mapping Audit

Branch: `maintainpro/final-enterprise-closure`  
Schema source of truth: `prisma/schema.prisma` + `prisma/migrations/*`  
Updated: 2026-09-17 (final closure `20260917250000`)

Status legend for Delete Rule: **NoAction** = SQL Server `ON DELETE NO ACTION` (0 Cascade FKs in Prisma).

---

## Domain mapping tables

| Domain | Tables/Models | Tenant Scope | Notes |
| ------ | ------------- | ------------ | ----- |
| Organization | Tenant, OrganizationUnit, Site, Department, FunctionalLocation | Required | Recursive OrgUnit; cycle DB protection |
| Identity / RBAC | User, TenantMembership, Role, SoDPolicy | Membership scoped | Permission + role guards |
| Configuration | PrioritySlaRule, FeatureFlag, ConfigChangeHistory, CustomField* | tenantId | Immutable config history triggers |
| Workflow | WorkflowDefinition/Version; WO.workflowVersionId + StatusHistory | tenantId | No separate WorkflowInstance |
| Approval | ApprovalRule/Request/Step/Decision/Delegation | tenantId | Version + snapshot pinned |
| Request / WO | MaintenanceRequest, WorkOrder (+ assignees, holds, labour) | required | NoAction FKs; concurrency versioning |
| Asset / Fleet | Asset, Vehicle, tyre/battery/gate | required | Asset cycle DB trigger; Vehicle optional Asset link |
| PM / Meter / CBM | PmPlan/Trigger/AutoGen, AssetMeter/Reading, MeterCorrection, Condition* | tenantId | Append-only readings; correction SoD |
| Reliability / Safety | RcaCase, CapaAction, WorkPermit, LotoRecord, DowntimeSegment | tenantId | CAPA lifecycle; permit/LOTO gates |
| Parts / ERP | SparePart, PartRequest, PartIssue, StockMovement, ErpFieldMapping | PartRequest.tenantId required | Provider-agnostic ERP mapping |
| Vendor | Supplier, VendorRepairCase, Quotation, Invoice, VendorPortalAccess | Supplier.tenantId **required** | Portal tenant trigger |
| Documents / Notify / Audit | EvidenceAttachment, Notification, AuditLog, SecurityEvent | tenantId | Audit append-only triggers |
| Reporting | `vw_rpt_*` | tenantId NOT NULL on facts | Power BI must filter / RLS EXTERNAL |

---

## Canonical organization

```
Tenant → OrganizationUnit (recursive) → Site → FunctionalLocation
       → Department (recursive)
```

## Vehicle ↔ Asset

Vehicle optional 1:1 `assetId`; shared maintenance via WorkOrder (`assetId` and/or `vehicleId`).

## Parts quantity trail

Requested → Reserved → Issued → Consumed → Returned (distinct quantities; reservation-aware stock).

## Final closure migrations

| Migration | Purpose |
|-----------|---------|
| `20260917240000_database_integrity_hardening` | Tenant FK triggers, money Decimal, audit immutability |
| `20260917250000_final_closure_supplier_money_asset_cycle` | Supplier.tenantId NOT NULL, remaining money Decimal, Asset cycle + VendorPortalAccess tenant triggers |

## Residual risks

| Risk | Severity | Disposition |
|------|----------|-------------|
| Power BI production RLS | EXTERNAL | Views expose tenantId |
| Live Mongo↔SQL reconcile | EXTERNAL | Tooling + fixtures complete |
| Quarantine Supplier tenant | LOW | Unresolvable legacy rows only |
