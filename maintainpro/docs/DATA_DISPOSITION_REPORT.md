# Data Disposition Report — MaintainPro

**Branch:** `maintainpro/integration-v1`  
**Version:** Phase 14  
**Date:** 2026-09-15  

This report defines the official disposition for every data model area with ambiguous status. Use this as the single source of truth for "can we remove X?" decisions.

**Disposition codes:**
- **KEEP** — Active production model; must not be removed or deprecated.
- **RETAIN TEMPORARILY** — Has existing data or active write paths; migration planned before removal.
- **BLOCKED FROM REMOVAL** — Cannot be removed without completing a specific prerequisite; removal without proof is prohibited.
- **SOFT-RETIRED** — Module registered, routes active for existing data, but no new feature investment; write-stop policy applies.

---

## Section 1 — FacilityIssue

| Aspect | Disposition | Notes |
|--------|-------------|-------|
| `FacilityIssue` model (Prisma) | **RETAIN TEMPORARILY** | Existing open tickets; migration to `MaintenanceRequest` not yet applied |
| `FacilityIssue.create` API path | **RETAIN TEMPORARILY** | Must stay open during transitional period; document write-stop date after migration |
| Migration script | `migrate-facility-issues-to-requests.ts` | Dry-run required; business sign-off required before `--apply` |
| Removal prerequisite | Migration script applied + verified; no unresolved FacilityIssue references | |

> **Policy:** FacilityIssue create path remains but carries a deprecation notice. After migration, route should redirect to MaintenanceRequest. Do not remove the model until `FacilityIssue.count() == 0` in production or all records confirmed migrated/archived.

---

## Section 2 — Farm Module Models

| Model | Disposition | Notes |
|-------|-------------|-------|
| `Crop`, `Field`, `Harvest`, `Livestock` | **SOFT-RETIRED** | Historical data retained; no new writes after business sign-off |
| `FarmWorker`, `SprayLog`, `IrrigationLog` | **SOFT-RETIRED** | Same |
| `SoilTest`, `WeatherLog`, `TraceabilityRecord` | **SOFT-RETIRED** | Same |
| `FarmFinance` | **SOFT-RETIRED** | Same |
| `AppModule` registration (CropsModule, FieldsModule, etc.) | **RETAIN** | Do not unregister; routes serve historical data |
| Removal prerequisite | Business owner sign-off; data archived/exported; migration script if needed | |

---

## Section 3 — Cleaning Module

| Aspect | Disposition | Notes |
|--------|-------------|-------|
| `CleaningVisit`, `CleaningLocation` models | **SOFT-RETIRED** | Active routes; historical data |
| `CleaningModule` registration in `AppModule` | **RETAIN** | Do not unregister |
| `cleaning.*` permissions | **RETAIN** in `PERMISSION_CATALOG` | |
| Removal prerequisite | Business decision + data migration/archive | |

---

## Section 4 — Billing Module

| Aspect | Disposition | Notes |
|--------|-------------|-------|
| `BillingModule` and its models | **SOFT-RETIRED** | No active billing workflows in current scope |
| `AppModule` registration | **RETAIN** | Do not unregister |
| Removal prerequisite | Business decision to sunset; data export | |

---

## Section 5 — QA / GoLive / PostGoLive Modules

| Module | Disposition | Notes |
|--------|-------------|-------|
| `QaModule` | **SOFT-RETIRED** | Legacy QA workflows; not part of Phase 0–14 core scope |
| `GoLiveModule` | **SOFT-RETIRED** | Legacy delivery tracking; soft-deprioritized in Admin Console (Phase 12) |
| `PostGoLiveModule` | **SOFT-RETIRED** | Legacy hypercare tracking |
| `DeliveryReadinessModule` | **SOFT-RETIRED** | Same |
| All `AppModule` registrations | **RETAIN** | Routes serve historical data |
| `qa.*`, `go_live.*`, `delivery.*` permissions | **RETAIN** in catalog | |

---

## Section 6 — PredictiveAI Module

| Aspect | Disposition | Notes |
|--------|-------------|-------|
| `PredictiveAiModule` | **SOFT-RETIRED** | Feature gate not triggered in current scope; placeholder |
| Models | **RETAIN TEMPORARILY** | No confirmed data yet; low risk |
| Removal prerequisite | Business decision; verify no tenant data before drop | |

---

## Section 7 — MaintenanceSchedule vs PmPlan

| Model | Disposition | Notes |
|-------|-------------|-------|
| `PmPlan` | **KEEP** | Phase 8 canonical PM model; active PM engine |
| `MaintenanceSchedule` | **RETAIN TEMPORARILY** | Legacy alongside PmPlan; retained until PmPlan rollout verified on production |
| Removal of `MaintenanceSchedule` | **BLOCKED FROM REMOVAL** | Must confirm no active references in production tenant data before removal |

---

## Section 8 — Asset.location (legacy string field)

| Aspect | Disposition | Notes |
|--------|-------------|-------|
| `Asset.location` (string field) | **RETAIN TEMPORARILY** | Pre-Phase-3 sites use this; Phase 3 introduced `FunctionalLocation` |
| `Asset.functionalLocationId` | **KEEP** | Phase 3 canonical field |
| Migration script | `facility-location-backfill.ts` | Backfills `functionalLocationId` from `location` string |
| Removal of `Asset.location` | **BLOCKED FROM REMOVAL** | Must run backfill script and verify 100% of assets have `functionalLocationId` set |

---

## Section 9 — TECHNICIAN_COMPLETED / OVERDUE Status Compatibility

| Aspect | Disposition | Notes |
|--------|-------------|-------|
| `TECHNICIAN_COMPLETED` WO status | **KEEP** | Phase 6 canonical tech-completion step; UI label "Completed" for technicians |
| `OVERDUE` derived status | **KEEP** | Derived server-side from `dueAt < now AND status NOT IN [CLOSED, CANCELLED]`; never stored as a DB field |
| Closed WO with past `dueAt` | **NOT overdue** | See `isTerminalStatus()` in `kpi-definitions.ts`; `phase14-hardening.spec.ts` enforces this invariant |
| Legacy status names (ASSET_MANAGER, MECHANIC roles) | **RETAIN** | Legacy role names still referenced in permission aliases; see `COMPATIBLE_PERMISSION_ALIASES` in `permissions.guard.ts` |

---

## Section 10 — Cost Snapshot Immutability

| Aspect | Disposition | Notes |
|--------|-------------|-------|
| `WorkOrderCostSnapshot` | **KEEP** | Immutable cost record captured at WO close |
| Live unit prices in `SparePartClassification` | Mutable but never retroactively applied to closed WOs | |
| Policy | Cost KPIs use `snapshotTotal`, not live prices | Enforced in `kpi-definitions.ts` (`MAINTENANCE_COST` sourceFields) |

---

## Summary Table

| Model / Feature | Disposition | Prerequisite for Change |
|-----------------|-------------|------------------------|
| FacilityIssue (model + create path) | RETAIN TEMPORARILY | Migration + business sign-off |
| Farm models | SOFT-RETIRED | Business sign-off + data export |
| Cleaning models | SOFT-RETIRED | Business sign-off |
| Billing models | SOFT-RETIRED | Business sign-off |
| QA/GoLive/PostGoLive models | SOFT-RETIRED | Business sign-off |
| PredictiveAi models | SOFT-RETIRED | Verify no tenant data |
| MaintenanceSchedule | RETAIN TEMPORARILY | PmPlan full rollout verified |
| Asset.location (string) | RETAIN TEMPORARILY | Backfill script run + 100% coverage |
| TECHNICIAN_COMPLETED status | KEEP | — |
| OVERDUE (derived) | KEEP | — |
| WorkOrderCostSnapshot | KEEP | — |
| PmPlan and all Phase 8–13 models | KEEP | — |
