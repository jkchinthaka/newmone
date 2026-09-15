# Phase 8 — Canonical Maintenance Planning Integration

**Branch:** `maintainpro/integration-v1`  
**Baseline:** `maintainpro/phase-07-approval-engine` @ `b871a8da7d2b5f8782f39ff6e9719622ae55aa25`  
**Historical reference tip:** `origin/maintainpro/phase-08-maintenance-planning` @ `844f1764ea27ce92d3705711b574c709680c6a13`  
**Date:** 2026-09-15

## Objective

One generic PM / meter / checklist / inspection / calibration / compliance engine on top of canonical Phase 3–7 (Site/FL, Assets, Requests, Work Orders, Approvals).

Historical Phase 8 is **reference only** — not merged wholesale, not force-pushed.

## Historical comparison matrix

| Component | Disposition |
|-----------|-------------|
| `trigger-engine.ts` | **REUSE CLEAN** |
| `meter-validation.ts` | **REUSE CLEAN** |
| `compliance-status.ts` | **REUSE CLEAN** (+ `deriveComplianceLabel` VALID/DUE_SOON) |
| Prisma Pm*/AssetMeter*/Checklist*/Inspection*/Calibration*/ComplianceRequirement | **PORT WITH CHANGES** — Site/FL/domain/priority/workType; WO PM FKs; ChecklistExecution; InspectionFinding |
| `planning.service` auto-WO / FAIL corrective | **PORT WITH CHANGES** — must use `WorkOrdersService.create` |
| Raw `prisma.workOrder.create` | **DISCARD** |
| Free-text-only `PmPlan.location` | **PORT** — retained legacy + Site/FL FKs |
| `UtilityMeter` / cleaning checklists / vehicle ComplianceService | **KEEP SEPARATE** (not PM substitutes) |

## Architecture

### PM + revisions
`PmPlan` + `PmPlanRevision` with immutable snapshots. Edits bump `currentRevision` and close prior revision effectiveTo.

### Triggers
`CALENDAR | METER | EXPIRY | CONDITION | EVENT`  
Combine: `EARLIEST` (OR / whichever first) or `ALL` (AND).

### Duplicate prevention
`PmAutoGeneration` unique `(tenantId, planId, generationKey)` + open-WO check + create idempotency key `pm:{planId}:{generationKey}`. Handles P2002 races.

### Meters
`AssetMeter` / `AssetMeterReading` — multi-meter per asset/vehicle. Legacy `Asset.meterReading` retained; dry-run backfill script: `apps/api/scripts/migrate-legacy-asset-meters.ts`.

### Checklist
Versioned `ChecklistTemplate` + items; `ChecklistExecution` stores template revision snapshot.

### Inspection / Calibration / Compliance
Inspection PASS / OBSERVATION / FAIL → findings; FAIL prefers Maintenance Request then corrective WO.  
Calibration FAIL → `CALIBRATION_CORRECTIVE` WO via Phase 6 service.  
`ComplianceRequirement` with derived status (CURRENT/DUE/GRACE/EXPIRED) and labels VALID/DUE_SOON.

### Work Order / Approval
All generated WOs go through Phase 6 `WorkOrdersService.create` (numbering, placement, audit, Phase 7 `syncCreateTimeApprovals`). PM fields set post-create: `pmPlanId`, `pmPlanRevision`, `pmTriggerSource`, `pmOccurrenceKey`.

## API (selected)

- `GET/POST /planning/pm-plans`
- `PUT /planning/pm-plans/:id/revise`
- `POST /planning/pm-plans/:id/auto-wo`
- `GET /planning/due-work`
- `POST /planning/meters`, `POST /planning/meters/:id/readings`
- `POST /planning/inspections`, `POST /planning/calibrations`, `POST /planning/compliance`

## UI

`/maintenance/plans` — responsive PM list + evaluate/auto-WO.

## Permissions

`planning.view`, `planning.manage` (aliases to work_orders manage/plan).
