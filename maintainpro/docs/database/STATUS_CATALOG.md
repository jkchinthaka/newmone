# Status Catalog

Human labels preferred in UI. Technical codes for APIs/DB.

## MaintenanceRequest

| Status | Operator label | Terminal? | Notes |
|--------|----------------|-----------|-------|
| NEW | New | No | Intake |
| UNDER_REVIEW | Under Review | No | Triage |
| NEEDS_INFORMATION | Needs Information | No | Waiting on requester |
| APPROVED | Accepted | No | Ready to convert |
| CONVERTED_TO_WO | Converted to Work Order | Yes | Linked WO exists |
| CLOSED | Closed | Yes | Use `resolutionCode` for outcome |
| CANCELLED | Cancelled | Yes | |
| REJECTED | Rejected (legacy) | Yes | Prefer CLOSED + resolution |

### resolutionCode (with CLOSED)

RESOLVED_WITHOUT_WO | DUPLICATE | NOT_MAINTENANCE | INVALID | CANCELLED

## WorkOrder

OPEN → PLANNED → ASSIGNED → IN_PROGRESS → WORK_COMPLETED → VERIFIED → CLOSED

Exceptions: ON_HOLD, REWORK_REQUIRED, CANCELLED. OVERDUE is derived. COMPLETED is legacy.

## PmPlan

DRAFT → VALIDATE → (APPROVAL) → ACTIVE ↔ PAUSED → RETIRED

## PmOccurrence

SCHEDULED | GENERATED | DEFERRED | SKIPPED | COMPLETED | MISSED

WO creation alone does not complete an occurrence.

## StockCountSession

DRAFT → OPEN → COUNTING → REVIEW → APPROVED → POSTED | CANCELLED

## Inventory movement types

IN, OUT, RETURN, TRANSFER_IN, TRANSFER_OUT, ADJUSTMENT_IN, ADJUSTMENT_OUT, ADJUSTMENT, REVERSAL

REVERSAL applies opposite signed impact of `reversalOf.type`.
