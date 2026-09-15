# Phase 10 — Fleet Lifecycle (Tyres, Batteries, Assignments, Gate Engine)

## Baseline & history

| Ref | SHA | Notes |
|-----|-----|-------|
| Baseline (clean HEAD) | `465c73d3616480eb796ebc382b2840cc84331b77` | Phase 9 tip; Phase 10 implemented on top |
| Historical tip (REFERENCE ONLY) | `96fbe49` | `_p10_extract/` contains extracted source; do NOT merge wholesale |

## Vehicle ↔ Asset extension

- `Vehicle.assetId` (unique, nullable) links a Vehicle to an Asset in the asset register.
- Mileage is tracked via `AssetMeter` type `MILEAGE` (Phase 8 meter engine), upserted per vehicle via `ensureMileageMeter`.
- Migration script: `apps/api/scripts/migrate-vehicle-asset-links.ts` — dry-run default, `--apply` creates Asset records and links.

## New schema models

| Model | Purpose |
|-------|---------|
| `VehicleTyre` | Per-wheel-position tyre lifecycle. `isActive=true` = fitted. Each install creates a new row; moves deactivate old + create new. |
| `VehicleBattery` | Battery install history. Replace deactivates old and creates new. |
| `VehicleAssignment` | Driver handover history. `isCurrent=true` = active assignment. |
| `TyreCondition` (enum) | `NEW, GOOD, FAIR, POOR, RETREAD, DISPOSED` |

## Gate engine (backend-authoritative)

The gate engine is split into two concerns:

1. **Read-only eligibility** (`FleetLifecycleService.evaluateGateEligibility`):
   - Returns `{ allowed, blockedReasons, warnings, evaluatedRules }`.
   - `warnings` (PM due soon, doc expiring soon) do NOT block — surfaced to operator.
   - Used by the fleet page and `GET fleet-lifecycle/vehicles/:id/gate-eligibility`.

2. **Write path** (`VehiclesService.gateOut` in `vehicles.service.ts`):
   - Authoritative gate movement recording.
   - Uses existing `canVehicleGateOut` policy from Phase 4/5.
   - **Do NOT create competing gate-out routes.**

### Gate override + Approval Engine (Phase 7 integration)

When `blocked && allowOverride`, the gate override path in `vehicles.service.gateOut` now:

1. Calls `approvalsService.ensureApprovalRequired(GATE_OVERRIDE, BEFORE_GATE_OVERRIDE, vehicleId)`.
2. If approval is PENDING → throws `APPROVAL_REQUIRED` with `approvalRequestId`.
3. If no approval rule configured (or approved) → proceeds to `assertGateOverrideApprover`.
4. Existing `assertGateOverrideApprover` check is preserved as a second layer.

This implements four-eyes principle: a separate authorized user must approve the override before the gate releases.

### Vehicle.gateBlocked flag

`Vehicle.gateBlocked Boolean @default(false)` + `gateBlockReason String?` — set by ops to hard-block a vehicle from gate-out regardless of other checks. Surfaces as `BLOCK_FLAG` in eligibility decisions.

## Module: `apps/api/src/modules/fleet-lifecycle/`

| File | Purpose |
|------|---------|
| `fleet-policies.ts` | Pure-function policies (side-effect-free, unit-testable) |
| `fleet-lifecycle.service.ts` | Business logic: backfill, meters, tyre/battery/assignment lifecycle, eligibility, fuel/cost analytics |
| `fleet-lifecycle.controller.ts` | REST API under `/fleet-lifecycle/*` |
| `fleet-lifecycle.module.ts` | NestJS module; imports PrismaModule + ApprovalsModule (forwardRef) |

## Permissions (Phase 10)

```
fleet.view, fleet.vehicle.manage, fleet.service.manage, fleet.inspection.perform,
fleet.tyre.manage, fleet.battery.manage, fleet.fuel.record, fleet.driver.manage,
fleet.assignment.manage, fleet.document.manage, fleet.accident.manage,
fleet.claim.manage, fleet.fine.manage, gate.check, gate.record, gate.override
```

Legacy aliases in `COMPATIBLE_PERMISSION_ALIASES`:
- `fleet.*` → `fleet.manage` / `vehicles.operate` / existing equivalents during rollout.
- `gate.check` → `gate.out.create` / `gate.in.create` / `vehicles.operate`.

## API routes

| Method | Path | Permission |
|--------|------|-----------|
| GET | `/fleet-lifecycle/overview` | `fleet.view` |
| POST | `/fleet-lifecycle/vehicles/backfill-assets?dryRun=` | `fleet.vehicle.manage` |
| POST | `/fleet-lifecycle/vehicles/:id/ensure-mileage-meter` | `fleet.vehicle.manage` |
| GET | `/fleet-lifecycle/vehicles/:id/gate-eligibility?driverId=` | `gate.check` |
| POST | `/fleet-lifecycle/tyres/install` | `fleet.tyre.manage` |
| POST | `/fleet-lifecycle/tyres/:id/move` | `fleet.tyre.manage` |
| POST | `/fleet-lifecycle/tyres/:id/remove` | `fleet.tyre.manage` |
| POST | `/fleet-lifecycle/batteries/install` | `fleet.battery.manage` |
| POST | `/fleet-lifecycle/batteries/:id/replace` | `fleet.battery.manage` |
| POST | `/fleet-lifecycle/vehicles/:id/assign-driver` | `fleet.assignment.manage` |
| POST | `/fleet-lifecycle/assignments/:id/return` | `fleet.assignment.manage` |
| GET | `/fleet-lifecycle/fuel-efficiency` | `fleet.view` |
| GET | `/fleet-lifecycle/cost-per-km` | `fleet.view` |
| POST | `/fleet-lifecycle/accidents/:id/link-repair` | `fleet.accident.manage` |

## Migration

```bash
# Dry-run (default): inspect vehicles without assetId
cd maintainpro
npx ts-node apps/api/scripts/migrate-vehicle-asset-links.ts

# Apply: create Asset records and link vehicles
npx ts-node apps/api/scripts/migrate-vehicle-asset-links.ts --apply

# Single tenant
npx ts-node apps/api/scripts/migrate-vehicle-asset-links.ts --tenant <tenantId> --apply
```

## Tyre disposition matrix

| Action | Result |
|--------|--------|
| `installTyre` | Creates new active row; blocks if position occupied |
| `moveTyre` | Deactivates old (removedAt, removedMileage), creates new row at new position preserving serial |
| `removeTyre` | Sets `isActive=false`, `removedAt` |
| `replaceBattery` | Deactivates old with `failureReason`, creates new active row |

## Web

- `/fleet` page: overview summary cards (8 KPIs) + secondary nav links + fleet map below.
- `/fleet/tyres` route added to nav (alias of `/fleet`).
- `lib/fleet-lifecycle-api.ts`: axios helper for overview, gate eligibility, tyre/battery install, driver assignment, fuel efficiency.
