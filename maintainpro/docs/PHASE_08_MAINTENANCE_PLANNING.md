# Phase 8 — PM, Meters, Inspection, Calibration & Compliance

**Branch:** `maintainpro/phase-08-maintenance-planning`  
**Status:** Implemented (generic planning engine)

## Objective

One generic planning / inspection / compliance engine for every maintenance domain — not fleet-only or utilities-only duplicates.

## Delivered

### Preventive Maintenance (`PmPlan`)
- Plan + revision history (`PmPlanRevision`) with effective dating
- Asset / vehicle / location / team / estimated duration / required parts
- Checklist template link, grace period, auto-WO flag
- Last completion + next due fields

### Trigger engine (`trigger-engine.ts`)
- `CALENDAR` | `METER` | `EXPIRY` | `CONDITION` | `EVENT`
- Combine modes: `EARLIEST` (OR / whichever first) and `ALL` (AND)
- Example: 500 hours **OR** 3 months → EARLIEST with METER + CALENDAR

### Meters (`AssetMeter` / `AssetMeterReading`)
- Running hours, mileage, cycles, production count, custom units
- Reading history with source (user/device/import/system), user, device, timestamp
- Stale detection, backwards rejection, suspicious jump warning

### Checklist templates
- Item types: checkbox, pass/fail, yes/no, numeric, text, photo, dropdown, meter reading, signature (justified flag)
- Required, unit, min/max, version, effective dates

### Inspection / Calibration / Compliance
- Inspection templates + scheduled/ad-hoc inspections with PASS / OBSERVATION / FAIL
- FAIL → corrective WO
- Calibration records with tolerance, certificate, pass/fail, corrective action
- Generic `ComplianceRequirement` for insurance, revenue licence, emission, fire, calibration, warranty, statutory, service agreement, and future `typeKey`s

### Auto-WO + duplicate prevention
- `POST /planning/pm-plans/:id/auto-wo`
- Blocks when open WO already exists for plan
- `PmAutoGeneration` unique `(tenantId, planId, generationKey)` window key

## API surface

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/planning/pm-plans` | Create PM plan + triggers + rev 1 |
| PUT | `/planning/pm-plans/:id/revise` | Revision with history |
| GET | `/planning/pm-plans/:id/revisions` | Revision history |
| POST | `/planning/pm-plans/:id/auto-wo` | Evaluate + auto-create WO |
| POST | `/planning/meters/:id/readings` | Record meter reading |
| POST | `/planning/inspections` | Complete inspection |
| POST | `/planning/calibrations` | Record calibration |
| POST | `/planning/compliance` | Upsert compliance requirement |

## Tests

`apps/api/test/planning-phase08.spec.ts` covers:
- date / meter / expiry / combined triggers
- auto-WO + duplicate prevention
- revision history
- stale meter + suspicious jump
- inspection FAIL / calibration FAIL corrective WO

## Notes / ASSUMPTIONS

- Nelna-specific PM frequencies are **not** hardcoded; intervals are configurable.
- Legacy `MaintenanceSchedule` remains supported; new work should prefer `PmPlan`.
- Vehicle document compliance module remains; generic engine complements it for non-fleet subjects.
