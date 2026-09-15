# Phase 11 — Company-wide Domain Coverage

**Status:** Integrated  
**Branch:** `maintainpro/integration-v1`  
**Baseline SHA:** `3e96648e504409ae4fb6af7fbb1d5a5bfeee2e8f`  
**Historical reference:** `origin/maintainpro/phase-11-domain-coverage` @ `e0899df` (REFERENCE ONLY — not rewritten)  
**Integration date:** 2026-09-15

---

## Purpose

Configure the **same** shared Asset / WO / PM / Inspection / Calibration / Compliance / Parts / Vendor
engines across all company maintenance domains. No duplicate engine modules are registered.

Domain profiles are **configuration metadata keyed by `AssetDomain.code`** — they describe which
KPIs apply, default flags, suggested PM templates, compliance types, safety hints, and scope
boundaries for each domain. They are NOT separate NestJS modules or maintenance engines.

---

## Architecture decision

`DomainProfile` is configuration metadata — NOT a separate maintenance engine.

```
AssetDomain.code → resolveDomainProfile(code, tenantOverride)
                 = { ...staticDefaults[code], ...(domain.profile || {}) }
```

Implementation:
1. `prisma/schema.prisma` — added `profile Json?` on `AssetDomain` (tenant overrides)
2. `apps/api/src/modules/asset-taxonomy/domain-profiles.ts` — static defaults for all domains
3. `AssetTaxonomyService` — `listDomainProfiles()`, `getDomainProfileForCode()`, `updateDomainProfile()`
4. `AssetTaxonomyController` — `GET /asset-taxonomy/domain-profiles`, `GET /asset-taxonomy/domain-profiles/:code`, `PATCH /asset-taxonomy/domains/:id/profile`
5. Folded into existing `AssetTaxonomyModule` — no separate `DomainCoverageModule`

---

## Domain codes (HEAD source of truth)

All existing `DEFAULT_ASSET_DOMAINS` codes are preserved. Three new codes added:

| Code | Name | Notes |
|------|------|-------|
| `HVAC` | HVAC | New split from legacy combined |
| `REFRIGERATION` | Refrigeration | New split from legacy combined |
| `PLUMBING` | Plumbing | New |
| `HVAC_REFRIGERATION` | HVAC / Refrigeration (Legacy) | Kept; backwards-compat |

### Alias map (historical Phase 11 keys → HEAD codes)

| Historical key | HEAD code |
|---------------|-----------|
| `BUILDING_CIVIL` | `FACILITY_CIVIL` |
| `OUTLETS_BRANCHES` | `OUTLET_EQUIPMENT` |
| `SECURITY_EQUIPMENT` | `SECURITY` |
| `LAB_EQUIPMENT` | `LABORATORY` |
| `CALIBRATION_EQUIPMENT` | `CALIBRATION` |
| `SOLAR_ENERGY` | `ENERGY_SOLAR` |

Use `normalizeDomainCode(aliasOrCode)` to resolve either form.

---

## All V1 domain profiles

| Domain | Allows location-only | Downtime default | Key KPIs |
|--------|---------------------|-----------------|---------|
| PLANT_MACHINERY | No | Yes | MTTR, MTBF, AVAILABILITY, DOWNTIME |
| MECHANICAL | No | Yes | MTTR, MTBF, AVAILABILITY, DOWNTIME |
| ELECTRICAL | No | Yes | MTTR, AVAILABILITY, DOWNTIME, REPEAT_DEFECTS |
| UTILITIES | Yes | Yes | AVAILABILITY, DOWNTIME, SPEND |
| HVAC_REFRIGERATION | No | Yes | MTTR, AVAILABILITY, SERVICE_COMPLIANCE |
| HVAC | No | Yes | MTTR, AVAILABILITY, SERVICE_COMPLIANCE |
| REFRIGERATION | No | Yes | AVAILABILITY, DOWNTIME, SERVICE_COMPLIANCE |
| FACILITY_CIVIL | **Yes** | No | BACKLOG_AGE, CONDITION, SPEND, REPEAT_DEFECTS |
| PLUMBING | **Yes** | No | BACKLOG_AGE, REPEAT_DEFECTS, SPEND |
| WATER_WASTEWATER | No | Yes | AVAILABILITY, DOWNTIME, COMPLIANCE_DUE |
| FLEET | No | No | COST_PER_KM, AVAILABILITY, SERVICE_COMPLIANCE, FUEL_EFFICIENCY |
| MATERIAL_HANDLING | No | Yes | MTTR, MTBF, AVAILABILITY |
| FARM_INFRASTRUCTURE | Yes | No | AVAILABILITY, SPEND, CONDITION |
| OUTLET_EQUIPMENT | **Yes** | No | BACKLOG_AGE, SPEND, SERVICE_COMPLIANCE |
| FIRE_SAFETY | No | No | COMPLIANCE_DUE, COMPLIANCE_EXPIRED, COMPLIANCE_COMPLETION |
| SECURITY | No | No | AVAILABILITY, SERVICE_COMPLIANCE |
| IT_HARDWARE | No | No | MTTR, AVAILABILITY, SPEND |
| LABORATORY | No | No | COMPLIANCE_DUE, AVAILABILITY |
| CALIBRATION | No | No | COMPLIANCE_DUE, COMPLIANCE_EXPIRED, COMPLIANCE_COMPLETION |
| KITCHEN_CANTEEN | No | No | AVAILABILITY, SERVICE_COMPLIANCE, SPEND |
| ENERGY_SOLAR | Yes | No | AVAILABILITY, DOWNTIME, SPEND |
| TOOLS_MOULDS_JIGS | No | No | AVAILABILITY, CONDITION, SPEND |
| EXTERNAL_INFRASTRUCTURE | **Yes** | No | BACKLOG_AGE, CONDITION, SPEND |
| OTHER | Yes | No | SPEND, BACKLOG_AGE |

> **Building / Civil = location-only work allowed** — `allowsLocationOnlyWork: true`, `downtimeApplicableDefault: false`, KPIs without MTBF.

---

## Shared-engine rule

**Every domain uses the same shared engines. No domain gets its own engine module.**

- Work Orders → `WorkOrdersModule`
- PM / Scheduling → `PlanningModule`
- Inspection / Calibration → shared PM types
- Compliance → shared compliance types
- Parts → `MaintenanceSupplyModule`
- Vendor / Contract → same supplier/vendor entities

`assertSharedEngineReuse()` in `domain-profiles.ts` returns `{ duplicateEngine: false }` — used in tests.

---

## Scope boundaries

| Domain | Boundary |
|--------|----------|
| Farm (`FARM_INFRASTRUCTURE`) | Physical farm infrastructure only — NOT crop, livestock, harvest, finance, or EHS |
| IT (`IT_HARDWARE`) | Physical hardware maintenance only — NOT password resets, email, access/IT helpdesk, or LIMS |
| Outlets (`OUTLET_EQUIPMENT`) | Outlet treated as Site entity — AC, chiller, freezer, electrical, plumbing, CCTV, signage. Does NOT include a separate outlet ticketing or POS system |

---

## Out of scope (Phase 11 V1)

- Crop / livestock / harvest / EHS management (Farm)
- IT helpdesk / LIMS / software lifecycle (IT)
- Outlet ticketing / POS system (Outlets)
- Phase 12+ KPI dashboard redesign
- Granular per-domain navigation items (primary nav stays simple)

---

## Files changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added `profile Json?` to `AssetDomain` |
| `apps/api/src/modules/asset-taxonomy/domain-profiles.ts` | **New** — all 24 profiles + helpers |
| `apps/api/src/modules/asset-taxonomy/domain-defaults.ts` | Added HVAC, REFRIGERATION, PLUMBING; expanded categories + attribute examples |
| `apps/api/src/modules/asset-taxonomy/asset-taxonomy.service.ts` | Added `listDomainProfiles`, `getDomainProfileForCode`, `updateDomainProfile`; enriched `listDomains`; seeded attribute definitions |
| `apps/api/src/modules/asset-taxonomy/asset-taxonomy.controller.ts` | Added 3 endpoints: `GET domain-profiles`, `GET domain-profiles/:code`, `PATCH domains/:id/profile` |
| `apps/api/src/modules/work-orders/work-orders.service.ts` | `create()` now inherits `domainId` from linked asset |
| `apps/api/src/database/permission-catalog.ts` | Added `domains.view`, `domains.manage` |
| `apps/api/src/common/guards/permissions.guard.ts` | Added aliases for `domains.view`, `domains.manage` |
| `apps/web/lib/asset-taxonomy-api.ts` | Added `DomainProfileSummary` type + 3 API helpers |
| `apps/web/app/(dashboard)/admin/asset-masters/page.tsx` | Domain profile summary panel when domain selected |
| `apps/api/test/domain-coverage-phase11.spec.ts` | **New** — 33 test cases |
| `docs/PHASE_11_DOMAIN_COVERAGE.md` | **New** — this file |
| `docs/IMPLEMENTATION_LOG.md` | Updated |
| `docs/BRANCH_RECOVERY_AND_INTEGRATION.md` | Updated |
| `maintainpro/_p11_extract/` | Deleted (extract served its purpose) |

---

## Remaining risks / manual checks

- Run `npx prisma validate && npx prisma generate` before deploying (new `profile` field)
- Seed new domains in existing tenants via `POST /asset-taxonomy/seed-defaults`
- `FACILITY_CIVIL` and `EXTERNAL_INFRASTRUCTURE` already allow location-only WOs via existing `assertWorkOrderAssetRules` — verify no regression in Phase 6 tests
- Domain profile overrides via `PATCH /asset-taxonomy/domains/:id/profile` are merged JSON — no deep validation beyond what the service applies
