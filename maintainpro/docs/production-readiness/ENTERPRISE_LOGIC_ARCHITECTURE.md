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

Covered decisions: vehicle gate-out, work-order start/complete/reopen, stock reserve/issue/adjust/transfer/import, ERP apply/replay, PM advance, meter rollback, part compatibility, procurement recommendation create.

## Inventory

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
