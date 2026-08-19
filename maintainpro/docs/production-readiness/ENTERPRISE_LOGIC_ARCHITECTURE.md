# Enterprise logic architecture

MaintainPro operational rules live in the NestJS domain layer. Next.js and Flutter are presentation only.

```text
FRONTEND
    → APPLICATION SERVICES
    → CENTRAL POLICIES (`apps/api/src/modules/policies`)
    → DOMAIN TRANSACTIONS
    → AUDIT / LEDGER
    → DATABASE
    → ERP / EXTERNAL SYSTEMS
```

## Central rules

Typed policy functions return `{ allowed, code, reason, severity, metadata }`. Fail-closed when tenant context is missing. User-facing text is mapped from codes in `policy-codes.ts`.

Covered decisions: vehicle gate-out, driver/trip, fuel, work-order start/complete/reopen/transition, stock reserve/issue/adjust/transfer/import, ERP apply/replay, PM advance, meter rollback, part compatibility, procurement recommendation, SLA, approval matrix, technician dispatch, PTW, budget, vendor eligibility, offline revalidation.

## State machines

Explicit machines in `policies/state-machines.ts` reuse existing enums for work orders, purchase orders, part requests, ERP reconciliation, accidents, claims, fines, and assets. Controllers must not invent extra statuses.

## Organization policy

Tenant `AppSetting` key `enterprise.policy` overrides defaults (SLA percents, holidays, PTW strictness, approval limits, emergency budget bypass). Missing budget configuration is `INSUFFICIENT_DATA`, not a silent zero.

## Inventory

Warehouse identity is `tenant + warehouse + item` (`WarehouseItemBalance`). `AVAILABLE = ON_HAND - RESERVED`. All consuming paths must use `InventoryTransactionEngine`. Historical stock is reversed, never deleted.

## ERP reconciliation

`ErpReconciliationMismatch` is the case record. Detection never auto-adjusts stock. Existing statuses map as OPEN=DETECTED, REVIEWED=INVESTIGATING, ACCEPTED=NO_ACTION, CORRECTED=SOURCE_CORRECTED/APPROVED_ADJUSTMENT. Sample mismatches are not seeded unless `ERP_SEED_SAMPLE_MISMATCHES=1`. Unknown ERP identities remain `MAPPING_REQUIRED`.

## PM + forecast

Default advance policy is `ACTUAL_COMPLETION` (completed date/mileage/hours + interval). `FIXED_SCHEDULE` is explicit on `MaintenanceSchedule.advancePolicy`. Forecasts store `INSUFFICIENT_DATA` when usage coverage is too thin. Upcoming job parts feed procurement.

## Notifications / escalation

`DomainNotificationService` maps domain events onto the existing `Notification` model (IN_APP/EMAIL). Dedup key + cooldown prevent job spam. SLA warning/breach/escalation percentages come from organization policy (default 75/100/125).

## Cost / budget / health / warranty / procurement / exceptions

Cost allocation reads live WO/parts/fuel/fines/accidents/claims. Cost/km is null without a valid distance. `BudgetCommitment` materializes approved open POs. Health scores (vehicle and asset) are deterministic and are not a gate rule. Warranty opportunities are exceptions, not automatic POs. Procurement writes recommendations only; PO vs GRN matching does not invent invoices. `BusinessException` rows are resolved or ignored with reason, never deleted.

## Events / outbox

`DomainEventOutbox` is the tenant-scoped reliable event log. It is distinct from `ReplicationOutbox` (primary→backup Mongo). Consumers are idempotent on `tenantId+eventId`. In-process hooks still run (`onWorkOrderCompleted`, `onWorkOrderTransition`, `onGateResult`) plus the existing Redis/Bull notification queue.

## Ledgers

Authoritative histories: inventory `StockMovement`, cost allocation (derived from source documents), `AuditLog`. Balances are materialized; repairs use reversal/adjustment.

## Offline

Flutter already queues `CLIENT_ACTION_ID`. Server fuel logging accepts `clientActionId` for safe replay. Stock availability is always revalidated server-side.

## Testing / deployment

Policy unit tests do not need Mongo. Schema additions require `prisma generate` and a disposable Mongo `db push` before production. Do not push schema to production from this worktree.

Warehouse identity is `tenant + warehouse + item` (`WarehouseItemBalance`). `AVAILABLE = ON_HAND - RESERVED`. All consuming paths must use `InventoryTransactionEngine`. Historical stock is reversed, never deleted.

## ERP reconciliation

`ErpReconciliationMismatch` is the case record. Detection never auto-adjusts stock. Existing statuses map as OPEN=DETECTED, REVIEWED=INVESTIGATING, ACCEPTED=NO_ACTION, CORRECTED=SOURCE_CORRECTED/APPROVED_ADJUSTMENT. Sample mismatches are not seeded unless `ERP_SEED_SAMPLE_MISMATCHES=1`.

## PM + forecast

Default advance policy is `ACTUAL_COMPLETION` (completed date/mileage/hours + interval). `FIXED_SCHEDULE` is explicit on `MaintenanceSchedule.advancePolicy`. Forecasts store `INSUFFICIENT_DATA` when usage coverage is too thin. Upcoming job parts feed procurement.

## Notifications / escalation

`DomainNotificationService` maps domain events onto the existing `Notification` model (IN_APP/EMAIL). Dedup key + cooldown prevent job spam. SLA warning/breach/escalation percentages are env-configurable.

## Cost / health / warranty / procurement / exceptions

Cost allocation reads live WO/parts/fuel/fines/accidents/claims. Cost/km is null without a valid distance. Health scores are deterministic and are not a gate rule. Warranty opportunities are exceptions, not automatic POs. Procurement writes recommendations only; conversion uses the existing purchase-order workflow. `BusinessException` rows are resolved or ignored with reason, never deleted.

## Events

In-process hooks (`EnterpriseOpsService.onWorkOrderCompleted`, `onGateResult`) plus existing Redis/Bull notification queue. No extra broker.

## Testing / deployment

Policy unit tests do not need Mongo. Schema additions require `prisma generate` and a disposable Mongo `db push` before production. Do not push schema to production from this worktree.
