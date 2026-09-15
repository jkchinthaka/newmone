# Phase 6 — Work Order Core & Execution Engine

**Branch:** `maintainpro/phase-06-work-orders`  
**Baseline:** `maintainpro/phase-05-requests-triage` @ `6b5948032d2226b7938bbac52ea4931db79110d6`  
**Date:** 2026-09-15

## Objective

Make Work Order the authoritative executable maintenance record, evolving the existing engine rather than rewriting it.

## Current → Target status mapping

| Phase 6 concept | Implementation |
|-----------------|----------------|
| OPEN | `OPEN` |
| PLANNED | `PLANNED` (new) |
| ASSIGNED | `ASSIGNED` (new); also set on legacy `assign` from OPEN/PLANNED |
| IN_PROGRESS | `IN_PROGRESS` |
| ON_HOLD | `ON_HOLD` + hold history |
| COMPLETED (tech done) | `TECHNICIAN_COMPLETED` (UI label: **Completed**) |
| Return for correction | `REWORK_REQUIRED` → back to `IN_PROGRESS` |
| VERIFIED | `VERIFIED` (new; supervisor verify) |
| CLOSED | `CLOSED` (new; final truth) |
| CANCELLED | `CANCELLED` |
| OVERDUE | **Derived** (`dueAt < now && !terminal`); legacy enum value retained for historical rows |
| Legacy closed | `COMPLETED` still terminal synonym of CLOSED |

## Transitions (server-enforced)

```
OPEN → PLANNED | ASSIGNED | IN_PROGRESS | ON_HOLD | CANCELLED
PLANNED → ASSIGNED | IN_PROGRESS | CANCELLED
ASSIGNED → IN_PROGRESS | ON_HOLD | CANCELLED
IN_PROGRESS → ON_HOLD | TECHNICIAN_COMPLETED | CANCELLED
ON_HOLD → IN_PROGRESS | CANCELLED
TECHNICIAN_COMPLETED → VERIFIED | REWORK_REQUIRED | CLOSED/COMPLETED (admin emergency)
VERIFIED → CLOSED
REWORK_REQUIRED → IN_PROGRESS | CANCELLED
```

Prefer action endpoints (`assign`, `verify-supervisor`, `close`, status actions) over arbitrary PATCH.

## Timestamps

Added: `failedAt`, `reportedAt`, `acknowledgedAt`, `technicianArrivedAt`, `repairStartedAt`, `repairCompletedAt`, `productionResumedAt`, `closedAt`.  
`repairStartedAt` / `repairCompletedAt` set idempotently on start/complete.

## Hold / Downtime / RCA

- Hold reason codes + `WorkOrderHoldHistory` (episodes preserved)
- Optional downtime fields (`downtimeApplicable`, start/end, reason)
- `MaintenanceAnalysisCode` FAILURE/CAUSE/REMEDY + snapshots on WO
- Safety metadata (PPE, LOTO, hot work, height, isolation, confined space, permit)

## Assignment

Reuses `WorkOrderAssignee` + `Employee` + legacy `technicianId`. Assigning from OPEN/PLANNED moves status to ASSIGNED.

## Numbering

`WO-{year}-{####}` via max-sequence + P2002 retry (not bare `count()+1`).

## Asset / Location

At least one of `assetId` / `vehicleId` / `functionalLocationId`. PREVENTIVE/INSPECTION/etc. still require asset or vehicle. Phase 5 MR conversion passes site/FL into create.

## Request linkage

Preserved: `MaintenanceRequest.workOrderId` ↔ WO.

## Permissions added

`work_orders.plan|assign|start|hold|resume|complete|verify|close|cancel|reopen|correct`  
(`manage` / `update_status` retained)

## UI

- `/work-orders/my` — My Jobs (mobile cards + desktop table)
- Status human labels updated

## Phase 7 hooks

`workOrderApprovalExtensionPoint()` is a no-op extension point for START/REOPEN/HIGH_COST/VENDOR.

## Phase 8–14

Not merged or rewritten.
