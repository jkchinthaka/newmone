# Vehicle master import readiness — 2026-08-19

## Source

Local/private workbook (not committed):

`C:\PrivateImports\MaintainPro_Vehicle_Master_Import.xlsx`

Copied from `C:\Users\chint\Videos\MaintainPro_Vehicle_Master_Import.xlsx`.

Sheet: `Vehicle_Master_Import` — **265** rows.

## Preview (no DB writes)

```text
TOTAL_ROWS=265
VALID_ROWS=222
WARNING_ROWS=222
REJECTED_ROWS=43
NEW_VEHICLES=222
EXISTING_VEHICLES_TO_UPDATE=0
DUPLICATE_REGISTRATIONS=2
DUPLICATE_VINS=41
UNKNOWN_FUEL=10
MISSING_MAKE=30
MISSING_YEAR=265 (manufacture year absent; purchase-year fallback / unverified placeholder)
NAMED_ASSET_OR_EQUIPMENT=20
GATE_HISTORY_IMPORT=DEFERRED_INSUFFICIENT_DATA
```

Rejected rows are mostly duplicate VINs within the workbook (and 2 duplicate registrations). Valid rows preserve unmapped source fields under `Vehicle.customFields`.

## Architecture

- MaintainPro `Vehicle` is the sole master.
- FG Django `MaintainProReferenceService.search_vehicles` reads Mongo Vehicle collection (no FG vehicle catalog).
- Eligibility for **new** FG records is backend-authoritative (`AVAILABLE`/`IN_USE`; blocks `OUT_OF_SERVICE`/`UNDER_MAINTENANCE`/`DISPOSED`).
- CL30 restricts lookup to `type=TRUCK`.
- Frontend no longer treats a fake `ACTIVE` status as required.
- Registration search supports hyphen/space variants via flexible regex + `customFields.search.normalizedRegistration`.

## Commands

```bash
npx tsx apps/api/scripts/import-vehicle-master.ts --preview
# after disposable Mongo + DATABASE_URL:
npx tsx apps/api/scripts/import-vehicle-master.ts --apply
```

## Gates

- Jest `vehicle-master-import.spec.ts`: PASS (9)
- FG Django `test_vehicle_reference.py`: PASS (10)
- Typecheck api+web: PASS
- Tenant audit: PASS (fail-closed `requireTenantId` on import apply + FG lookup)
- Disposable Mongo apply: **BLOCKED** (Docker Desktop API unavailable this session)
- Production import: **NOT APPLIED**
