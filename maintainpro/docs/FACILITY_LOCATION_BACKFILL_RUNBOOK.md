# Facility Location Backfill Runbook

## Purpose

Safely plan migration from legacy `CleaningLocation` records to the new facility hierarchy (`Property → Building → Floor → Room`) without destructive writes by default.

This tooling:

- Matches locations to room candidates using tenant-scoped metadata only
- Reports confidence (`exact`, `likely`, `ambiguous`, `none`)
- Runs in **dry-run mode by default**
- Never deletes `CleaningLocation` records

## Commands

From `maintainpro/`:

```bash
# Dry-run for all tenants
npm run facility:backfill:dry

# Dry-run for one tenant
npm run facility:backfill:dry -- --tenant=<tenantObjectId>
```

From `maintainpro/apps/api/`:

```bash
npx tsx scripts/facility-location-backfill.ts
npx tsx scripts/facility-location-backfill.ts --tenant=<tenantObjectId>
```

## Apply mode (guarded)

Apply mode may update `FacilityIssue.roomId` for issues that:

- belong to the matched cleaning location (`locationId`)
- currently have `roomId = null`
- match an **exact** room candidate only

Both guards are required:

1. Environment: `ALLOW_FACILITY_BACKFILL_APPLY=true`
2. CLI flag: `--apply`

```bash
ALLOW_FACILITY_BACKFILL_APPLY=true npm run facility:backfill:apply -- --tenant=<tenantObjectId>
```

If either guard is missing, the command fails safely.

## Matching rules

Within the same tenant only:

- Compare `CleaningLocation.name` / `area` against `Room.name` / `Room.code`
- Compare `CleaningLocation.building` against `Building.name` / `Building.code`
- Compare `CleaningLocation.floor` against `Floor.name` / `levelNumber`

Confidence:

| Confidence | Meaning |
|---|---|
| `exact` | Single candidate with name/area + building + floor alignment |
| `likely` | Name/area match with partial building/floor metadata |
| `ambiguous` | Multiple candidates at the best confidence level |
| `none` | No candidate or missing tenant on location |

## Report fields

Each row includes:

- `cleaningLocationId`
- cleaning location display fields (`name`, `area`, `building`, `floor`)
- `candidateRoomId` / `candidateRoomLabel`
- `confidence`
- `reason`
- `warnings`

Summary totals include eligible issue counts and `issuesUpdated` (0 in dry-run).

## Pre-apply checklist

1. Run dry-run and export JSON report
2. Review all `ambiguous` and `none` rows manually
3. Confirm room hierarchy completeness for the tenant
4. Take DB backup / verify replication lag is acceptable
5. Enable `ALLOW_FACILITY_BACKFILL_APPLY=true` only for the maintenance window
6. Run apply with `--tenant=<id>` (avoid whole-platform apply unless explicitly approved)
7. Re-run dry-run and verify eligible counts dropped
8. Disable `ALLOW_FACILITY_BACKFILL_APPLY` after the window

## Rollback

- Apply mode only sets `FacilityIssue.roomId`; it does not delete locations
- Roll back by clearing incorrectly assigned `roomId` values from affected issues using a targeted admin/data script
- Keep the dry-run JSON report as the audit artifact

## Tests

Automated coverage:

- `apps/api/test/facility-location-backfill.spec.ts`
