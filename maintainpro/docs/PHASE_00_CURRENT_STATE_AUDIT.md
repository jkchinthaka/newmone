# Phase 0 — Current State Audit

**Date:** 2026-09-14  
**Repository:** `jkchinthaka/newmone`  
**Branch:** `maintainpro/phase-00-audit`  
**Baseline SHA:** `290bf3a0fb43eb92e55eae530d5bb57e762c7d37` (`origin/main`)  
**Scope:** Audit and preparation only — **no business feature implementation**, **no destructive DB drops**.

---

## 1. Start safely

| Check | Result |
|-------|--------|
| Remote | `https://github.com/jkchinthaka/newmone.git` |
| Working tree | Clean before branch create |
| Started from | `origin/main` @ `290bf3a` |
| `.gitignore` | Covers `.env*`, `node_modules`, builds, uploads, private imports |
| Force push / history rewrite | Not used |

---

## 2. Baseline validation

| Command | Result | Notes |
|---------|--------|-------|
| `npm run db:generate` | **PASS** | Prisma 5.22.0 |
| `npm run typecheck` | **PASS** | api + web |
| `npm run lint` | **PASS** | alias of typecheck |
| `npm run test --workspace @maintainpro/api` | **PASS** | 174 suites passed, 1 skipped; **1247** tests passed, 10 skipped |
| `npm run build --workspace @maintainpro/api` | **PASS** | |
| `npm run build --workspace @maintainpro/web` | **PASS** | Next.js 14; 146 routes |

### Pre-existing failures
None observed on clean `origin/main` for the commands above.

### Introduced failures
None (Phase 0 is documentation-only).

---

## 3. Architecture snapshot

MaintainPro is a **modular NestJS + Next.js + Flutter** monorepo under `maintainpro/` with:

- **Prisma/MongoDB** single schema (~137 models, ~148 enums)
- **Multi-tenant** root (`Tenant` + `X-Tenant-Id`)
- Strong CMMS/fleet/inventory cores
- Large **adjacent product surfaces**: Farm ops, Cleaning workforce, FG SSO bridge, SaaS billing, QA/Delivery/Go-Live tooling, Predictive AI

FG Digital Recording is a **separate Django system** under `systems/fg-digital-recording/` — not Prisma models in MaintainPro core.

---

## 4. Product boundary (final target)

### In scope
Company-wide maintenance & fleet CMMS: assets, facilities, utilities maintenance, PM, WO, inspections/compliance, spare parts usage + Bileeta boundary, fleet admin, vendors/contracts for maintenance, reports, maintenance admin.

### Out of normal product scope
Full ERP, FG product UI, full Farm Operations, HR, accounting, IT helpdesk, cleaning workforce ops, SaaS billing UX, software release/go-live management, predictive AI as primary UX.

Farm **infrastructure** (pumps, irrigation equipment, sheds, machinery) remains maintainable via Asset/WO engines.

---

## 5. Critical structural findings

1. **Asset ↔ Vehicle duplication** — parallel masters; soft `assetTag` only.  
2. **Location fragmentation** — free-text + Property/Building/Floor/Room + CleaningLocation + Warehouse + Field.  
3. **People models** — User / Employee / Driver / FarmWorker.  
4. **Inventory import duality** — `InventoryImport*` vs `ErpImport*`.  
5. **MaintenanceSchedule** missing `tenantId` (isolation via asset/vehicle).  
6. **Home UX overlap** — Action Center + Workspace + Dashboard + legacy `/home`.  
7. **Admin console** mixes business admin with delivery/go-live/QA clutter.  
8. **Role explosion** — 29 `RoleName` values.  
9. **Flutter** not pilot-certified; PWA is intended primary field client.  
10. **Phases 8–14 feature branches exist on remote** but are **not on `main`** — Phase 0 baseline does not include them.

---

## 6. Related documents

| Doc | Purpose |
|-----|---------|
| `DATA_MODEL_DISPOSITION.md` | Every model KEEP/REFACTOR/MIGRATE/REMOVE |
| `ROUTE_AND_MODULE_DISPOSITION.md` | API modules + web routes + nav map |
| `TARGET_ARCHITECTURE.md` | Target CMMS architecture |
| `MIGRATION_RISK_REGISTER.md` | Risks and mitigations |

---

## 7. Phase 0 acceptance

| Criterion | Status |
|-----------|--------|
| Codebase inspected | YES |
| DB models classified | YES |
| Backend modules classified | YES |
| Frontend routes classified | YES |
| Mobile plan documented | YES |
| Product boundaries documented | YES |
| Reusable modules identified | YES |
| Destructive risks identified | YES |
| Baseline tests/build recorded | YES |
| No business data deleted | YES |
| Docs committed + branch pushed | *(this commit)* |

**Readiness for Phase 1:** YES
