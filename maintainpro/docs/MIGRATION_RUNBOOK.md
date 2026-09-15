# Migration Runbook — MaintainPro

**Branch:** `maintainpro/integration-v1`  
**Version:** Phase 14  
**Date:** 2026-09-15  

---

## ⚠️ Critical Rules

1. **Always dry-run first** — every script supports `--dry-run` mode. Review the output before applying.
2. **Take a database backup before any `--apply` run.** Use `npm run db:backup:resync -- --dry-run` to verify backup health first.
3. **Prisma MongoDB has no SQL migration files.** `db:migrate` is an alias for `db:push`. There are no rollback migration files — only backup-based rollback.
4. **Run from the `maintainpro/` directory** unless noted otherwise.
5. **Coordinate with the business owner** for data migrations that change user-visible records (facility issues → requests, etc.).

---

## Step 0 — Pre-migration checklist

```bash
# 1. Verify backup is healthy
npm run db:backup:verify

# 2. Take a fresh backup snapshot
npm run db:backup:resync -- --dry-run
npm run db:backup:resync

# 3. Validate Prisma schema
npm run db:generate
npx prisma validate --schema ./prisma/schema.prisma

# 4. Confirm environment (never run apply against production without sign-off)
echo $DATABASE_URL | head -c 50  # spot-check: should be Atlas staging URL
```

---

## Step 1 — `db:push` for Phase 8–13 models

Must run before any data migration scripts.

```bash
# From maintainpro/
npm run db:push
npm run db:generate
```

**Verify:** Check Atlas collections for PmPlan, AssetMeter, WorkOrderCostSnapshot, VendorContract, VehicleTyre, VehicleBattery, DomainProfile, AdminCatalogRule.

---

## Step 2 — Vehicle → Asset links

**Script:** `apps/api/scripts/migrate-vehicle-asset-links.ts`  
**Purpose:** Links existing Vehicle records to their corresponding Asset records via `Vehicle.assetId`. Phase 4 introduced the Vehicle↔Asset link; pre-existing vehicles may have null `assetId`.

```bash
cd apps/api

# Dry run — review output; no writes
npx ts-node scripts/migrate-vehicle-asset-links.ts --dry-run

# Apply after review
npx ts-node scripts/migrate-vehicle-asset-links.ts --apply
```

**Expected:** Each vehicle matched to an asset; unmatched vehicles listed for manual review.  
**Risk:** LOW — adds a foreign-key reference; no existing data deleted.

---

## Step 3 — Legacy asset meter backfill

**Script:** `apps/api/scripts/migrate-legacy-asset-meters.ts`  
**Purpose:** Creates `AssetMeter` and `AssetMeterReading` records from legacy meter data stored elsewhere (e.g. in WO notes or custom fields). Phase 8 introduced the structured meter model.

```bash
cd apps/api

# Dry run
npx ts-node scripts/migrate-legacy-asset-meters.ts --dry-run

# Apply
npx ts-node scripts/migrate-legacy-asset-meters.ts --apply
```

**Expected:** AssetMeter records created for assets with historical meter data; readings backfilled.  
**Risk:** MEDIUM — write to new collections; no deletion. Verify `computeOverdueCount` still correct after backfill.

---

## Step 4 — FacilityIssue → MaintenanceRequest migration

**Script:** `apps/api/scripts/migrate-facility-issues-to-requests.ts`  
**Purpose:** Converts legacy `FacilityIssue` records to `MaintenanceRequest` records. Phase 5 introduced `MaintenanceRequest` as the canonical request entity.

> **Write-stop policy:** After this migration, the `FacilityIssue.create` path should remain open for a transitional period with a deprecation notice, then closed after all integrations confirmed migrated.

```bash
cd apps/api

# Dry run — shows what will be created/mapped
npx ts-node scripts/migrate-facility-issues-to-requests.ts --dry-run

# Apply after business owner review
npx ts-node scripts/migrate-facility-issues-to-requests.ts --apply
```

**Expected:** All open FacilityIssues converted; existing assignees and history preserved; IDs mapped for deduplication.  
**Risk:** HIGH — modifies user-visible records. Requires business sign-off. Test on staging first.

---

## Step 5 — Facility hierarchy migration

**Script:** `apps/api/scripts/migrate-facility-hierarchy.ts`  
**Purpose:** Migrates flat facility data to the Phase 3 organization hierarchy model (Site → Building → Floor → Room / FunctionalLocation).

```bash
cd apps/api

# Dry run
npx ts-node scripts/migrate-facility-hierarchy.ts --dry-run

# Apply
npx ts-node scripts/migrate-facility-hierarchy.ts --apply
```

**Expected:** FunctionalLocation records created matching legacy flat structure.  
**Risk:** MEDIUM — additive; does not delete legacy records.

---

## Step 6 — Asset.location backfill

**Script:** `apps/api/scripts/facility-location-backfill.ts`  
**Purpose:** Backfills `Asset.functionalLocationId` from the legacy `Asset.location` string field using fuzzy matching to FunctionalLocation records created in Step 5.

```bash
cd apps/api

# Dry run — review match quality; check ambiguous matches
ALLOW_FACILITY_BACKFILL_APPLY=false npx ts-node scripts/facility-location-backfill.ts

# Apply exact matches only (ALLOW_FACILITY_BACKFILL_APPLY=true required)
ALLOW_FACILITY_BACKFILL_APPLY=true npx ts-node scripts/facility-location-backfill.ts --apply
```

**Expected:** Assets with exact location name matches get `functionalLocationId` set. Ambiguous/unmatched listed for manual review.  
**Risk:** LOW for exact matches. Ambiguous matches must NOT be auto-applied.

---

## Step 7 — Asset taxonomy domain defaults seed

**Purpose:** Seeds default `DomainProfile` records for all recognized domain codes (FLEET_VEHICLE, PLANT_MACHINERY, FACILITY_CIVIL, etc.) if not already present.

```bash
# Via seed script (idempotent)
npm run db:seed
```

Or manually via admin console: Admin > Asset Masters > Domain Profiles.

---

## Post-migration verification

```bash
# 1. Re-run Prisma validate
npx prisma validate --schema ./prisma/schema.prisma

# 2. Run API tests
npm run test

# 3. Check health endpoint
curl https://<staging>/health
curl https://<staging>/health/readiness

# 4. Verify backup sync
npm run db:backup:verify

# 5. Spot-check collections in Atlas console:
#    - MaintenanceRequest: count matches old FacilityIssue count (+ new)
#    - AssetMeter: records exist for migrated assets
#    - Vehicle: all records have assetId set (or documented as unmatched)
```

---

## Rollback

Rollback for MongoDB is backup-based (no SQL migration files):

```bash
# Restore from backup — see PRODUCTION_ROLLBACK_RUNBOOK.md
# CRITICAL: this is a full restore; coordinate with operator
```

See `docs/remediation/PRODUCTION_ROLLBACK_RUNBOOK.md` and `docs/ROLLBACK_RUNBOOK.md`.

---

## Notes

- `MaintenanceSchedule` is retained alongside `PmPlan` until PmPlan rollout is verified on production. No migration needed for this phase.
- Soft-retired module models (Farm, Cleaning, Billing, QA, GoLive, PredictiveAi) are NOT migrated this phase. See `DATA_DISPOSITION_REPORT.md`.
- `FacilityIssue` create path remains OPEN for the transitional period. Document write-stop date when agreed with business owner.
