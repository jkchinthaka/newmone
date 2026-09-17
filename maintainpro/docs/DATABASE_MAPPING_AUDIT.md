# Database Mapping Audit

Branch: `maintainpro/phase-15-sqlserver-migration`  
Schema source of truth: `prisma/schema.prisma` + `prisma/migrations/*`  
Updated: 2026-09-17 (integrity hardening `20260917240000`)

Status legend for Delete Rule: **NoAction** = SQL Server `ON DELETE NO ACTION` (no destructive cascades found in schema — 0 Cascade FKs).

---

## Domain mapping tables

| Domain | Tables/Models | Primary Key | Tenant Scope | Parent Relation | Important FKs | Unique Rules | Delete Rule | History/Audit | Indexes |
| ------ | ------------- | ----------- | ------------ | --------------- | ------------- | ------------ | ----------- | ------------- | ------- |
| Organization | Tenant, OrganizationUnit, Site, Department, FunctionalLocation | cuid `id` | Required on all org units | OrgUnit.parentId; Dept.parentId; FL.parentId under Site | Site→Tenant; FL→Site; OrgUnit→Site/Dept optional | `(tenantId,code)` OrgUnit/Site/Dept; `(tenantId,id)` OrgUnit | NoAction | ConfigChangeHistory for masters | tenant+status, parent |
| Identity | User, TenantMembership, Invitation | cuid | Membership.tenantId | User via membership | Role assignments | `(tenantId,userId)` membership | NoAction | SecurityEvent | tenant |
| RBAC | Role, permissions (JSON/keys), SoDPolicy | cuid | tenantId | — | SoDPolicy.tenantId | `(tenantId,code)` SoD | NoAction | AuditLog | tenant |
| Configuration | PrioritySlaRule, MaintenanceJobCategory, TenantFeatureFlag, ConfigChangeHistory, CustomFieldDefinition/Value | cuid | tenantId | Feature effective window | — | `(tenantId,code)`, `(tenantId,code,version)` templates | NoAction | ConfigChangeHistory **immutable trigger** | tenant+entity |
| Workflow | WorkflowDefinition, WorkflowVersion; runtime via WorkOrder.workflowVersionId + WorkOrderStatusHistory | cuid | tenantId on def/version | Version→Definition | WO→WorkflowVersion FK | `(tenantId,code)` def; `(definitionId,version)` | NoAction | StatusHistory | tenant+status |
| Approval | ApprovalRule, ApprovalRuleLevel, ApprovalRequest/Step/Decision, ApprovalDelegation | cuid | tenantId | Request→Rule | triggeredRuleVersion + ruleSnapshot | rule keys | NoAction | Decisions append | tenant |
| Maintenance Request | MaintenanceRequest, MaintenanceRequestHistory | cuid | tenantId | — | asset/vehicle/site/dept; workOrderId | `(tenantId,requestNumber)` | NoAction | History table | tenant+status |
| Work Order | WorkOrder, Assignee, HoldHistory, Labour, StatusHistory, CostSnapshot | cuid | **required** tenantId | Request 1:1 optional; PM plan | asset, vehicle, site, FL, vendor, workflowVersion | `(tenantId,woNumber)`, `(tenantId,id)` | NoAction | StatusHistory, HoldHistory | technician, dueDate, asset+status |
| Asset | Asset, taxonomy masters, AssetLocationHistory, AssetMeter | cuid | required | parentAssetId (unbounded depth) | site, FL, dept, type masters | `(tenantId,assetTag)`, `(tenantId,id)` | NoAction | location history; retiredAt | site/FL/domain |
| Fleet | Vehicle (+ Asset link), Tyre, Battery, Assignment, Gate, Documents | cuid | required | Vehicle.assetId 1:1 optional | driver, department | `(tenantId,registrationNo)` | NoAction | assignment history | status, nextService |
| PM | PmPlan, PmTrigger, PmAutoGeneration | cuid | tenantId | Plan→Asset/Vehicle | generation → WorkOrder | `(tenantId,planId,generationKey)` | NoAction | generation rows | due meters |
| Meter | AssetMeter, AssetMeterReading, MeterCorrection | cuid | tenantId | Meter→Asset/Vehicle | Correction→Meter FK | `(tenantId,id)` meter | NoAction | Readings append; Correction SoD | meter+recordedAt |
| CBM | ConditionMonitoringRule, ConditionEvent | cuid | tenantId | Rule→Asset | Event→WO/Request | `(tenantId,dedupeKey)` events | NoAction | Events | tenant |
| Reliability | RcaCase, CapaAction, analysis codes | cuid | tenantId | RCA→WO/Asset | CAPA→RCA | — | NoAction | Case history | tenant |
| Downtime | DowntimeSegment | cuid | tenantId | Segment→WO (many) | asset | — | NoAction | Multi-segment | WO+time |
| Safety | WorkPermit, LotoRecord (+ WO safety flags) | cuid | tenantId | Permit/LOTO→WO | — | `(tenantId,permitNumber)` | NoAction | Permit lifecycle | tenant |
| Parts | SparePart, WarehouseItemBalance, PartRequest, PartIssue, WorkOrderPart, StockMovement | cuid | PartRequest.tenantId **required** | Request→WO+Part | Issue→Request | `(tenantId,partNumber)` | NoAction | StockMovement ledger | balances |
| ERP Mapping | ErpFieldMapping, ErpImport*, ErpReconciliationMismatch, ErpMockSyncRun | cuid | tenantId | Mapping bridge | — | source/target unique | NoAction | sync attempts | tenant |
| Vendor | Supplier (=Vendor), VendorRepairCase, Quotation, Invoice, Contract, VendorPortalAccess | cuid | Supplier.tenantId nullable legacy risk → app enforced | Repair→WO+Supplier | PortalAccess→Supplier+User | `(tenantId,vendorCode)`, portal unique | NoAction | quotations | tenant |
| Documents | EvidenceAttachment | cuid | tenantId | entity link | WO etc. | — | NoAction | soft `deletedAt` | entity |
| Notifications | Notification | cuid | tenantId | user | — | — | NoAction | delivery fields | tenant |
| Audit | AuditLog, SecurityEvent, ConfigChangeHistory | cuid | tenantId | — | — | — | NoAction | **DB triggers block UPDATE/DELETE** | entity+time |
| Reporting | `vw_rpt_*` views | n/a | **tenantId column required in facts/dims** | Site↔OrgUnit | — | n/a | n/a | KPI defs in app | consumer must filter |

---

## Canonical organization

```
Tenant
 └─ OrganizationUnit (COMPANY | BRANCH | DIVISION | …)  [recursive parentId]
 └─ Site  (operational facility; may link OrgUnit.siteId)
      └─ FunctionalLocation (recursive under site)
 └─ Department (recursive)
 └─ User.branchScope (legacy string label — prefer OrgUnit/Site FKs for new work)
```

Cycle prevention: app helpers for Asset/FL/Dept; **DB trigger** rejects OrgUnit self-parent and cross-tenant parent.

---

## Vehicle ↔ Asset

**Chosen model:** Vehicle is a first-class fleet entity with **optional 1:1** `Vehicle.assetId → Asset`. Shared maintenance engine is WorkOrder (`assetId` and/or `vehicleId`). Do not duplicate WO logic.

---

## Workflow / Approval runtime

| Concern | Implementation |
|---------|----------------|
| Workflow version retention | `WorkOrder.workflowVersionId` FK + status history (no separate WorkflowInstance table) |
| Approval version retention | `ApprovalRequest.triggeredRuleVersion` + `ruleSnapshot` |
| Publishing new version | Does not rewrite historical WO/approval snapshots |

---

## Parts quantity trail

| Stage | Storage |
|-------|---------|
| Requested / approved / issued | `PartRequest` quantities |
| Reserved / issued / used / returned | `WorkOrderPart` + `WarehouseItemBalance` / `SparePart.reservedQuantity` |
| Issue / return | `PartIssue.quantity` / `quantityReturned` |
| Ledger | `StockMovement` |

Concurrency: conditional `updateMany` in inventory engine (tested).

---

## Cross-tenant protection

1. Application: `assertTenantEntityExists` on create/link paths  
2. Database: triggers `trg_WorkOrder_tenant_refs`, `trg_MaintenanceRequest_tenant_asset`, `trg_MeterCorrection_tenant_meter`, `trg_PartRequest_tenant_wo`, `trg_OrganizationUnit_tenant_parent`  
3. Note: Prisma cannot express optional composite FKs when `tenantId` is required and `assetId` nullable — triggers are the SQL Server-safe enforcement.

---

## Decimal precision (money)

Core CMMS/fleet/vendor/insurance/fines/budget: **`DECIMAL(18,2)`**.  
Meters/telemetry may remain Float. Farm LKR Float fields remain **MEDIUM** debt (non-core CMMS).
