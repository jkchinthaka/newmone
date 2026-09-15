# Phase 4 — Universal Asset Engine

## Baseline

- Source branch: `maintainpro/phase-03-organization-locations`
- Source SHA: `b8d53ff9de9d84188edcccd455e435a40828dec5`
- Phase 4 branch: `maintainpro/phase-04-universal-assets`
- Phase 8–14 were **not** merged, cherry-picked, or rewritten

## Objective

One universal Asset registry for all maintenance domains (plant, HVAC, fleet, farm, IT, etc.) with configurable Domain → Category → Type taxonomy, Site/FunctionalLocation links, movement history, hierarchy, and lifecycle — without separate per-domain asset engines.

## Existing Asset functionality reused

- `assetTag` (global unique; QR identity preserved)
- name, description, manufacturer, model, serialNumber
- legacy `category` enum (compatibility)
- condition, status (extended carefully)
- department / departmentId
- free-text `location` (deprecated, retained)
- meterReading, lastServiceDate, nextServiceDate (compatibility only)
- warrantyExpiry, purchase/financial fields
- QR generate/validate/download
- bulk import / bulk actions / documents
- work-order and maintenance-log relations
- existing Assets API module and web Assets UI surface

## Architecture

```text
MaintenanceDomain (AssetDomain)
    ↓
AssetCategoryMaster
    ↓
AssetTypeMaster → AssetAttributeDefinition[]
    ↓
Asset (universal registry)
    ↔ Site / FunctionalLocation (Phase 3)
    ↔ Department (business ownership)
    ↔ parentAsset / childAssets
    ↔ Vehicle.assetId (optional Phase 4 link; Phase 10 owns fleet depth)
```

### Physical Asset ≠ Functional Location

Functional Location is a spatial slot (Phase 3). Asset is the maintainable physical identity. Moving an asset writes `AssetLocationHistory` and updates current site/FL; the slot remains.

### Custom attributes

Stored as validated `Asset.customAttributes` Json. Server validates against active `AssetAttributeDefinition` for the type. Arbitrary keys rejected.

### Asset tag uniqueness

**Kept globally unique** (`assetTag @unique`). Tenant partitioning remains elsewhere. Changing to tenant-scoped uniqueness was deferred to avoid unsafe Mongo uniqueness migration and QR non-determinism.

## Database

### Models added

- `AssetDomain`
- `AssetCategoryMaster` (name avoids enum collision with `AssetCategory`)
- `AssetTypeMaster`
- `AssetAttributeDefinition`
- `AssetLocationHistory`
- enums: `AssetCriticality`, `AssetAttributeDataType`
- status additions: `DRAFT`, `OUT_OF_SERVICE`

### Asset fields added

- domainId, categoryMasterId, typeMasterId
- siteId, functionalLocationId
- parentAssetId, responsiblePersonId
- criticalityLevel, customAttributes, commissionedAt
- retiredAt, retirementReason, isActive

### Vehicle

- optional unique `assetId` → Asset (1:1)

### Legacy retained

- `category` enum
- free-text `location`
- string `criticality`
- meterReading / service dates

### Indexes

tenantId composites for site, FL, domain, category, type, parent, criticality, serial, isActive

### Migration script

`apps/api/src/scripts/phase04-asset-backfill.ts` — dry-run default, tenant-aware, seeds taxonomy, maps deterministic legacy categories, reports ambiguous/unresolved location/vehicle-without-asset. Does not invent criticality or overwrite free-text location.

## Lifecycle

`DRAFT | ACTIVE | INACTIVE | UNDER_MAINTENANCE | OUT_OF_SERVICE | RETIRED | DISPOSED`

- Retire ≠ delete; requires reason; blocks open WOs and active children
- Dispose requires reason; preserves history
- Soft archive via `archivedAt` retained for compatibility

## Movement

`POST /assets/:id/move` creates history then updates current site/FL. Bulk `ASSIGN_SITE_LOCATION` uses the same path. Silent site/FL overwrite via PATCH is blocked.

## Legacy migration

| Source | Strategy |
|--------|----------|
| AssetCategory enum | Deterministic map → domain/category codes; ambiguous flagged |
| free-text location | Retained; unresolved if no site/FL |
| incomplete assets | Allowed as DRAFT / nullable masters |
| criticality string | Optional map to criticalityLevel; never invent CRITICAL |

## Vehicle integration (now vs Phase 10)

**Now:** `Vehicle.assetId` optional link + API `POST /assets/:id/link-vehicle`; preserve registration history; no destructive merge.

**Deferred to Phase 10:** full fleet engine, automatic Vehicle→Asset mass creation, vehicle-specific UX/workflows.

## API

### Asset taxonomy (`/asset-taxonomy`)

- seed-defaults, domains/categories/types/attributes CRUD, deactivate, can-delete check

### Assets (extended)

- filters: site, FL, domain, categoryMaster, type, criticality, isActive
- move, movements, parent, children, retire, dispose, link-vehicle
- data-quality hooks, legacy-categories migration

## Admin / UX

- `/admin/asset-masters` — Domain/Category/Type admin
- Admin console section linked
- Asset list API returns taxonomy + site/FL summaries
- Detail API returns locationPath, children, legacy aliases
- Phase 2 responsive shell preserved (no nav regression)

## QR / Bulk

- QR scan URL format unchanged (`/assets?assetId=`)
- assetTag uniqueness validation preserved
- Bulk import still uses existing endpoint; new master codes supported via create/update fields
- Bulk site/location requires move reason + history

## Known limitations

- Full attribute-definition admin UI is API-ready; page focuses on Domain/Category/Type
- Asset detail remains drawer-centric on existing Assets page (extended payload ready)
- Free-text location not auto-mapped without deterministic FL codes
- Multi-meter / PM engine deferred to Phase 8
- Report Issue / Request engine deferred to Phase 5
- Global assetTag uniqueness unchanged intentionally

## Phase 5 dependencies

Phase 5 may assume:

- stable Asset id/tag
- siteId + functionalLocationId on Asset
- locationPath on detail
- status/criticality fields

Do not start Phase 5 until this branch tip is pushed and accepted.
