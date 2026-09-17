# Data Model

Primary schema: `prisma/schema.prisma` (SQL Server).  
Integrity audit: `docs/DATABASE_MAPPING_AUDIT.md`, `docs/DATABASE_HEALTH_REPORT.md`.

## Recent enterprise / integrity models

| Model | Purpose |
|-------|---------|
| OrganizationUnit | Recursive COMPANY/BRANCH/… hierarchy |
| WorkflowDefinition / WorkflowVersion | Versioned WO workflow |
| NumberingSequence | Tenant document numbering |
| TemporaryRepairRecord | Temporary repair + follow-up |
| VendorPortalAccess | Vendor user isolation |
| MeterCorrection | Meter correction (append reading on approve) |
| CustomFieldDefinition / CustomFieldValue | Controlled dynamic fields |
| SoDPolicy | Configurable segregation of duties |
| OutboundWebhook / Delivery | Outbound events |
| ConfigChangeHistory | Immutable config audit |
| DowntimeSegment / RcaCase / CapaAction | Reliability |
| WorkPermit / LotoRecord | Safety |
| ConditionMonitoringRule / Event | CBM |
| PmAutoGeneration | Deterministic PM duplicate key |

## Vehicle ↔ Asset

Vehicle may link to Asset via optional `assetId` (1:1). WorkOrder uses `assetId` and/or `vehicleId` on one engine.

## Reporting views

`20260917230000` + hardened in `20260917240000`: `vw_rpt_*` — always filter by `tenantId` in Power BI.

---

## ER diagrams (bounded contexts)

### Organization / Identity

```mermaid
erDiagram
  Tenant ||--o{ OrganizationUnit : has
  OrganizationUnit ||--o{ OrganizationUnit : parent
  Tenant ||--o{ Site : has
  Tenant ||--o{ Department : has
  Site ||--o{ FunctionalLocation : has
  FunctionalLocation ||--o{ FunctionalLocation : parent
  Tenant ||--o{ User : has
  Tenant ||--o{ TenantMembership : has
  OrganizationUnit }o--o| Site : siteId
  OrganizationUnit }o--o| Department : departmentId
```

### Maintenance Core

```mermaid
erDiagram
  Tenant ||--o{ MaintenanceRequest : owns
  Tenant ||--o{ WorkOrder : owns
  MaintenanceRequest }o--o| WorkOrder : converts
  WorkOrder }o--o| Asset : assetId
  WorkOrder }o--o| Vehicle : vehicleId
  WorkOrder ||--o{ WorkOrderStatusHistory : history
  WorkOrder ||--o{ WorkOrderAssignee : assignees
  WorkOrder }o--o| WorkflowVersion : startedWith
  WorkOrder ||--o{ DowntimeSegment : segments
```

### Workflow / Approval

```mermaid
erDiagram
  WorkflowDefinition ||--o{ WorkflowVersion : versions
  WorkOrder }o--o| WorkflowVersion : retains
  ApprovalRule ||--o{ ApprovalRuleLevel : levels
  ApprovalRequest }o--o| ApprovalRule : triggeredRule
  ApprovalRequest ||--o{ ApprovalStep : steps
  ApprovalStep ||--o{ ApprovalDecision : decisions
```

### Asset / Fleet

```mermaid
erDiagram
  Asset ||--o{ Asset : children
  Asset ||--o| Vehicle : linkedVehicle
  Asset ||--o{ AssetMeter : meters
  AssetMeter ||--o{ AssetMeterReading : readings
  AssetMeter ||--o{ MeterCorrection : corrections
  Vehicle ||--o{ VehicleTyre : tyres
  Vehicle ||--o{ VehicleBattery : batteries
  Vehicle ||--o{ VehicleDocument : documents
```

### Reliability / Safety

```mermaid
erDiagram
  WorkOrder ||--o{ DowntimeSegment : downtime
  WorkOrder ||--o{ RcaCase : rca
  RcaCase ||--o{ CapaAction : capa
  WorkOrder ||--o{ WorkPermit : permits
  WorkOrder ||--o{ LotoRecord : loto
  ConditionMonitoringRule ||--o{ ConditionEvent : events
  ConditionEvent }o--o| WorkOrder : mayCreate
```

### Parts / ERP

```mermaid
erDiagram
  SparePart ||--o{ PartRequest : requested
  WorkOrder ||--o{ PartRequest : needs
  PartRequest ||--o{ PartIssue : issues
  WorkOrder ||--o{ WorkOrderPart : lines
  SparePart ||--o{ WarehouseItemBalance : stock
  WarehouseItemBalance ||--o{ StockMovement : ledger
  Tenant ||--o{ ErpFieldMapping : mappings
```

### Vendor

```mermaid
erDiagram
  Supplier ||--o{ VendorRepairCase : repairs
  WorkOrder ||--o| VendorRepairCase : external
  VendorRepairCase ||--o{ VendorQuotation : quotes
  Supplier ||--o{ VendorPortalAccess : portalUsers
  User ||--o{ VendorPortalAccess : access
  Supplier ||--o{ VendorContract : contracts
```

### Audit / Documents / Notifications

```mermaid
erDiagram
  Tenant ||--o{ AuditLog : audits
  Tenant ||--o{ ConfigChangeHistory : configAudits
  WorkOrder ||--o{ EvidenceAttachment : evidence
  Tenant ||--o{ Notification : notifies
  Tenant ||--o{ CustomFieldDefinition : defines
  CustomFieldDefinition ||--o{ CustomFieldValue : values
```
