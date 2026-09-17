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
| Asset | Maintainable physical identity | Assets | MaintainPro | tenant+assetTag | Retire/Dispose |
| Vehicle | Fleet extension of Asset | Fleet | MaintainPro | tenant+registration | Retire/Dispose |
| SparePart | Part catalog | Inventory | MaintainPro (+ ERP item map) | tenant+partNumber | Deactivate |
| Warehouse | Stock location | Inventory | MaintainPro (+ ERP warehouse map) | tenant+code | Deactivate |

## Work management

| Table | Purpose | Owner | SoT | Business key | Delete policy |
|-------|---------|-------|-----|--------------|---------------|
| MaintenanceRequest | Need capture / triage | Requests | MaintainPro | tenant+requestNumber | Close/Cancel |
| WorkOrder | Executable maintenance | Work Mgmt | MaintainPro | tenant+woNumber | Cancel (no hard delete) |
| WorkOrderStatusHistory | Lifecycle audit trail | Work Mgmt | MaintainPro | id | Append-only |
| PmPlan / PmPlanRevision | Recurring strategy + versioned config | Planning | MaintainPro | tenant+code / plan+revision | Retire; never rewrite published |
| PmOccurrence | One scheduled occurrence | Planning | MaintainPro | tenant+plan+generationKey | Skip/Defer/Complete |
| PmAutoGeneration | Idempotent WO generation ledger | Planning | MaintainPro | tenant+plan+generationKey | Append-only |

## Inventory ledger

| Table | Purpose | Owner | SoT | Business key | Delete policy |
|-------|---------|-------|-----|--------------|---------------|
| WarehouseItemBalance | On-hand / reserved / available | Inventory | MaintainPro operational | tenant+warehouse+part | Never manual edit |
| StockMovement | Immutable stock ledger | Inventory | MaintainPro | id | Reverse, never delete |
| StockCountSession / StockCountLine | Governed physical count | Inventory | MaintainPro | session id / session+part | Cancel; post via ledger |
| InventoryIdempotency | Retry-safe stock ops | Inventory | MaintainPro | tenant+key | Retain |

## Approvals / audit

| Table | Purpose | Owner | SoT | Notes |
|-------|---------|-------|-----|-------|
| ApprovalRequest / Step / Decision | Generic approval engine | Governance | MaintainPro | Separate from entity workflow status |
| AuditLog | Security/compliance trail | Security | MaintainPro | Append-only; no secrets |

See also: `DATABASE_OVERVIEW.md`, `STATUS_CATALOG.md`, `LEGACY_DISPOSITION.md`.
