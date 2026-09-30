# Data Dictionary (MaintainPro)

Owner: Platform / Domain modules. Values are engineering documentation — business limits remain owner-confirmed.

## How to read

Each entry: purpose, owner module, source of truth, keys, lifecycle/delete policy.

## Core masters

| Table | Purpose | Owner | SoT | Business key | Delete policy |
|-------|---------|-------|-----|--------------|---------------|
| Tenant | Multi-tenant root | Platform | MaintainPro | id | Archive only |
| User / TenantMembership | Identity & access | Identity | MaintainPro (+ IdP when configured) | email / membership | Deactivate |
| Site / FunctionalLocation | Organizational & location tree | Organization | MaintainPro | tenant+code | Retire |
| Asset | Maintainable physical identity | Assets | MaintainPro | tenant+assetTag | Retire/Dispose. Inactive, retired, and disposed assets are not selectable for new requests. |
| Vehicle | Fleet extension of Asset | Fleet | MaintainPro | tenant+registration | Retire/Dispose. New rows default to AVAILABLE. Existing blank status stays blank and cannot gate out until a person sets a real status. |
| GpsLocation | Historical vehicle position samples | Fleet | MaintainPro | id | Retain. Live Map is retired and no longer reads this table. Vehicle history may still query it. |
| SparePart | Part catalog | Inventory | MaintainPro catalog; Bileeta owns stock quantity | tenant+partNumber | Deactivate |
| Warehouse | Stock location | Inventory | MaintainPro (+ ERP warehouse map) | tenant+code | Deactivate |

## Work management

| Table | Purpose | Owner | SoT | Business key | Delete policy |
|-------|---------|-------|-----|--------------|---------------|
| MaintenanceRequest | Need capture / triage | Requests | MaintainPro | tenant+requestNumber | Close/Cancel |
| WorkOrder | Executable maintenance | Work Mgmt | MaintainPro | tenant+woNumber | Cancel (no hard delete) |

Phase 04 dashboard reads these existing columns. No new table or migration in that pass.

| Column | Used for |
| --- | --- |
| WorkOrder.tenantId | Every dashboard count is tenant-scoped |
| WorkOrder.status | Open load, unplanned (OPEN), in progress, on hold, verification (TECHNICIAN_COMPLETED), rework |
| WorkOrder.jobDomain | Machinery / Service / Vehicle cards, and the matching job lanes |
| WorkOrder.technicianId | Unassigned queue: status OPEN or PLANNED and technicianId null. Assignment sets status ASSIGNED. |
| WorkOrder.dueDate | Overdue when still in the open status set and the date is past |
| WorkOrder.priority | Critical open work |
| WorkOrder.version | Optimistic concurrency on status updates (existing) |
| PmPlan.nextDueAt | PM due within 7 days |
| MaintenanceRequest.status | Requests in NEW, UNDER_REVIEW, or APPROVED |
| WorkOrderPart.lineStatus / pendingReturnQuantity / requestedQuantity / issuedQuantity and PartIssue | Waiting-parts membership shared with the work-order queue. Issuing a part records work-order usage, quantity, cost snapshot, and a pending `DomainEventOutbox` row (`WORK_ORDER_PART_CONSUMPTION`). It does not write `SparePart.quantityInStock` or warehouse balances. |
| WorkOrderLabourEntry | One open labour session per technician. Created when assigned work starts. Corrections are stored on the same row. |
| EvidenceAttachment | Linked to the work order and tenant. Upload requires a configured storage mode and `STORAGE_UPLOADS_ENABLED`. Local MinIO upload is not verified. |
| WorkOrderStatusHistory | Lifecycle audit trail | Work Mgmt | MaintainPro | id | Append-only |
| PmPlan / PmPlanRevision | Recurring strategy + versioned config | Planning | MaintainPro | tenant+code / plan+revision | Retire; never rewrite published |
| PmOccurrence | One scheduled occurrence | Planning | MaintainPro | tenant+plan+generationKey | Skip/Defer/Complete |
| PmAutoGeneration | Idempotent WO generation ledger | Planning | MaintainPro | tenant+plan+generationKey | Append-only. Claimed before the work order is created. |
| WorkOrder PM occurrence | One work order per PM due key | Planning | MaintainPro | filtered unique tenant+plan+pmOccurrenceKey | Null keys stay excluded so ordinary work orders are unaffected. |

## Inventory ledger

| Table | Purpose | Owner | SoT | Business key | Delete policy |
|-------|---------|-------|-----|--------------|---------------|
| WarehouseItemBalance | On-hand cache by warehouse | Inventory | Bileeta for quantity; MaintainPro stores the last applied balance | tenant+warehouse+part | Never manual edit |
| StockMovement | Immutable stock ledger | Inventory | MaintainPro | id | Reverse, never delete |
| StockCountSession / StockCountLine | Governed physical count | Inventory | MaintainPro | session id / session+part | Cancel; post via ledger |
| InventoryIdempotency | Retry-safe stock ops | Inventory | MaintainPro | tenant+key | Retain |

## Approvals / audit

| Table | Purpose | Owner | SoT | Notes |
|-------|---------|-------|-----|-------|
| ApprovalRequest / Step / Decision | Generic approval engine | Governance | MaintainPro | Separate from entity workflow status |
| AuditLog | Security/compliance trail | Security | MaintainPro | Append-only; no secrets |

See also: `DATABASE_OVERVIEW.md`, `STATUS_CATALOG.md`, `LEGACY_DISPOSITION.md`.

## System ownership (Phase 07)

| Concern | Owner | MaintainPro role |
| --- | --- | --- |
| Stock quantity | Bileeta | `SparePart.quantityInStock` is an ERP mirror. Approved work-order issue, reservation, and return do not change it. ERP stock sync apply is the writer. |
| Part master | MaintainPro, with `erpCode` pointing at Bileeta | Catalog, classification, and technician alias stay local. |
| Work-order consumption | MaintainPro | `PartIssue` and `WorkOrderPart.issuedQuantity` record the quantity used. |
| Costing | MaintainPro | Issued quantity times `PartRequest.unitCostSnapshot` / line `unitCost`. |
| ERP reconciliation | Bileeta, once posted | `DomainEventOutbox` stays `PENDING` or `FAILED` until processed. Those states are not success. |
