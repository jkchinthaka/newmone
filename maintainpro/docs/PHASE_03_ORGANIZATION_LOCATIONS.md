# Phase 3 — Organization, Sites & Functional Locations

**Date:** 2026-09-15  
**Branch:** `maintainpro/phase-03-organization-locations`  
**Phase 2 source:** `maintainpro/phase-02-responsive-pwa` @ `e18a58c`  
**Out of scope:** Universal Asset Engine (Phase 4), Request/WO/Approval engines, Phase 8–14.

---

## Architecture decisions

### Organization = Tenant (backend)

- Backend partition remains `tenantId` / `Tenant`.
- UI labels this **Organization**.
- No duplicate Organization table.

### Site

Major physical company location (`FACTORY`, `FARM`, `OUTLET`, `WAREHOUSE`, `OFFICE`, `WORKSHOP`, `OTHER`).  
Stable `@@unique([tenantId, code])`. Soft deactivate via `isActive`.

### FunctionalLocation

Self-referencing tree under a Site. Flexible types (BUILDING, FLOOR, ZONE, AREA, PRODUCTION_LINE, ROOM, …).  
`@@unique([tenantId, siteId, code])`. Optional `departmentId` (business dimension — not hierarchy).

### Department

Existing `Department` master retained. Not a physical location node. Optional association only.

### Legacy Property → Building → Floor → Room

**Retained.** Bridged by idempotent migration via `legacyPropertyId` / `legacyBuildingId` / `legacyFloorId` / `legacyRoomId`.  
Legacy `/api/facilities/*` remains for compatibility. Authoritative master is Site + FunctionalLocation.

### Free-text `Asset.location`

Never overwritten in Phase 3. Classification endpoint reports exact / ambiguous / missing for Phase 4.

---

## API (`/api/organization`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/organization/summary` | Organization (Tenant) summary + counts |
| GET/POST | `/organization/sites` | List/create sites |
| GET/PATCH | `/organization/sites/:id` | Get/update/deactivate |
| GET/POST | `/organization/locations` | List/create locations |
| GET | `/organization/locations/tree?siteId=` | Hierarchy tree |
| GET | `/organization/locations/:id` | Detail + path + Phase 4 placeholders |
| GET | `/organization/locations/:id/children` | Children |
| PATCH | `/organization/locations/:id` | Update/deactivate |
| POST | `/organization/locations/:id/move` | Controlled move + audit reason |
| GET | `/organization/data-quality` | Hierarchy DQ hooks |
| POST | `/organization/migrations/facility-hierarchy` | Dry-run/apply legacy bridge |
| GET | `/organization/migrations/free-text-locations` | Non-destructive classification |

Permissions: `organization.view|manage`, `locations.view|manage` (aliased to `facilities.*` for existing roles).

CLI dry-run/apply: `apps/api/scripts/migrate-facility-hierarchy.ts`

---

## Admin UI

`/admin/organization` — sites list, create, functional location tree, add child, move, deactivate, migration dry-run.  
Departments remain at `/master-data/departments`.

---

## Indexes

- Site: `@@unique([tenantId, code])`, tenant/isActive/type/legacyPropertyId
- FunctionalLocation: `@@unique([tenantId, siteId, code])`, parent/site/type/legacy* indexes

---

## Phase 4 dependencies

- Attach `Asset.functionalLocationId`
- Asset movement between locations
- Open WO / history counts on location detail
- Resolve classified free-text locations intentionally

---

## Limitations

- Migration apply requires explicit admin API call / CLI flag (no automatic prod apply)
- FacilityIssue still references legacy Room
- No bulk import adapter yet (contract: Site/Location codes) — Phase 12
- Seed does not invent Nelna site inventory
