# MaintainPro V1 — Master Scope & Implementation Status

**Last updated:** 2026-09-15  
**Canonical product branch (Phases 0–14):** `maintainpro/integration-v1`  
**Canonical remote tip (Phase 14 product + master SoT):** `c54d7824ad42da0cd33c9c3a49dd5f7d0a6d2ed1`  
**Phase 15 branch:** `maintainpro/phase-15-sqlserver-migration`  
**Primary database target (engineering):** Microsoft SQL Server — **live rehearsal completed on disposable `MaintainProDev`; cutover not production-validated**  
**MongoDB:** retained as migration **source** (not deleted; fixture + production paths preserved)  
**Production readiness verdict:** READY FOR STAGING UAT (Mongo integration-v1); SQL Server staging UAT **READY TO START** (disposable rehearsal PASS; production dump + HTTP UAT still required)  
**Main merge recommendation:** NO

> **If Cursor chat context is lost, read this file FIRST before any further implementation.**  
> Do not guess the current phase or source SHA when this file contains the answer.

---

## 15. Current Next Action

**Current canonical phase:** Phase 15A complete on `maintainpro/phase-15-sqlserver-migration` (live disposable SQL validation + migration rehearsal)

**Next required action:**

1. Run SQL Server **staging UAT** against a non-production staging instance with a real Mongo snapshot (not only the fixture)
2. Complete HTTP login / full workflow smoke with production-like bcrypt credentials
3. Operator sign-off on reconciliation + backup/restore against staging
4. Keep Mongo snapshot frozen for rollback until cutover acceptance
5. Do **NOT** production cutover or merge to `main` without sign-off

**Do NOT start another product phase automatically.**  
**Do NOT merge to `main` automatically.**

**Phase 15 branch:** `maintainpro/phase-15-sqlserver-migration`  
**Phase 15A baseline remote tip:** `0a6a96d98eee8e6a84a08ab6222eddf17b05a479`  
**Phase 15A final remote tip:** `f6f5c7172afde88bc3e4116d649831f7a4f18e62`  
**Phase 15 source HEAD (product):** `c54d7824ad42da0cd33c9c3a49dd5f7d0a6d2ed1`

---

## 1. Product Identity

**MaintainPro — Nelna Maintenance & Fleet Management System**

MaintainPro is the company-wide maintenance operational system for Nelna.

It manages anything the company owns or operates that requires:

* inspection
* servicing
* repair
* calibration
* replacement
* certification
* preventive maintenance
* maintenance history

---

## 2. System Boundaries

### MaintainPro owns

* Maintenance Requests
* Work Orders
* Preventive Maintenance
* Assets
* Functional Locations
* Maintenance Inspections
* Calibration
* Compliance
* Fleet Maintenance
* Fleet Administration
* Maintenance Parts Usage
* Vendors / Contracts
* Maintenance Costs
* Approvals
* Maintenance Reporting
* Maintenance Administration

### Bileeta ERP owns

* official stock
* item master where authoritative
* purchasing
* PO
* GRN
* finance/accounting

### HR owns

* employee master truth

### FG System owns

* Finished Goods operational records

MaintainPro must NOT become:

* full ERP
* HR system
* accounting system
* full Farm Operations system
* Finished Goods system
* general IT helpdesk
* software release/go-live platform

---

## 3. Final Architecture

### Production Client

ONE responsive:

`Next.js Web Application + PWA`

Flutter is not the final production client (mobile repo may remain for experiments; PWA is the V1 production client).

### Core Lifecycle

Asset / Functional Location

→ Maintenance Request

→ Triage

→ Approval where required

→ Work Order

→ Plan

→ Assign

→ Execute

→ Labour / Parts / Cost / Downtime / Evidence

→ Complete

→ Supervisor Verify

→ Close

→ History / Reports

---

## 4. Main Navigation

* Home (`/action-center`)
* Requests
* Work Orders
* Preventive Maintenance
* Assets
* Fleet
* Spare Parts
* Reports
* Admin

Do not reintroduce a large sidebar with separate domain modules.

---

## 5. Supported Maintenance Domains

* Plant & Machinery
* Mechanical
* Electrical
* Utilities
* HVAC
* Refrigeration
* Building / Civil
* Plumbing
* Water / Wastewater
* Fleet
* Material Handling
* Farm Infrastructure
* Outlets / Branches
* Fire / Safety Equipment
* Security Equipment
* IT Hardware
* Lab Equipment
* Calibration / Metrology
* Kitchen / Canteen Equipment
* Solar / Energy
* Tools / Moulds / Jigs
* External Infrastructure
* Other configurable domains

All domains reuse the same core maintenance engine (`DomainProfile` = configuration metadata on `AssetDomain.code`, not a separate Nest engine).

---

## 6. Canonical Git Strategy

Repository:

`https://github.com/jkchinthaka/newmone.git`

Default branch:

`main`

Canonical implementation order:

Phase 0  
→ Phase 1  
→ Phase 2  
→ Phase 3  
→ Phase 4  
→ Phase 5  
→ Phase 6  
→ Phase 7  
→ `maintainpro/integration-v1`  
→ canonical Phase 8  
→ Phase 9  
→ Phase 10  
→ Phase 11  
→ Phase 12  
→ Phase 13  
→ Phase 14  

Historical Phase 8–14 branches must NOT be rewritten. They are reference branches only.

Final integrated production candidate:

`maintainpro/integration-v1`

Do not merge to `main` until final CI/UAT/readiness checks pass.

---

## 7. Phase Status Table

| Phase | Name | Branch | Baseline SHA | Final SHA | Status | Tests | Notes |
| ----- | ---- | ------ | ------------ | --------- | ------ | ----- | ----- |
| 0 | Freeze / Audit | `maintainpro/phase-00-audit` | `290bf3a` (main) | `f78d465b30bd97fc0cc80d18edcdf60b87d3e2f2` | COMPLETE | docs | Audit only |
| 1 | Scope Cleanup | `maintainpro/phase-01-scope-cleanup` | Phase 0 | `d954360ce5f3e39b80787cdeab807000fd7cdb73` | COMPLETE | | Soft-retired clutter from Admin/nav |
| 2 | Responsive PWA | `maintainpro/phase-02-responsive-pwa` | `d954360…` | `e18a58cde3179505101702fe1733bc353b088b33` | COMPLETE | | PWA foundation |
| 3 | Organization / Locations | `maintainpro/phase-03-organization-locations` | `e18a58c…` | `b8d53ff9de9d84188edcccd455e435a40828dec5` | COMPLETE | | Site / FL hierarchy |
| 4 | Universal Assets | `maintainpro/phase-04-universal-assets` | `b8d53ff…` | `a50b6b9624b1a0f281e20095badf453d7ab02fdb` | COMPLETE | API ~1281 | AssetDomain taxonomy; Vehicle.assetId prep |
| 5 | Requests / Triage | `maintainpro/phase-05-requests-triage` | `a50b6b9…` | `6b5948032d2226b7938bbac52ea4931db79110d6` | COMPLETE | API ~1295 | MaintenanceRequest; FacilityIssue retained |
| 6 | Work Order Core | `maintainpro/phase-06-work-orders` | `6b59480…` | `bb48180af64f9d5bae066f9c6428911450989585` | COMPLETE | API ~1304 | Canonical WO lifecycle; OVERDUE derived |
| 7 | Approval Engine | `maintainpro/phase-07-approval-engine` | `bb48180…` | `b871a8da7d2b5f8782f39ff6e9719622ae55aa25` | COMPLETE | API ~1313 | Configurable rules; GATE_OVERRIDE hook |
| 8 | Maintenance Planning | `maintainpro/integration-v1` | `b871a8da…` (Phase 7) | `9d18b598ab4acd31856c35a30a02757434a76c08` | COMPLETE | green | Historical ref `844f176…` |
| 9 | Parts / ERP / Vendors | `maintainpro/integration-v1` | `9d18b598…` | `465c73d3616480eb796ebc382b2840cc84331b77` | COMPLETE | 183 suites / 1340 tests | Historical ref `1562147…` |
| 10 | Fleet | `maintainpro/integration-v1` | `465c73d3…` | `3e96648e504409ae4fb6af7fbb1d5a5bfeee2e8f` | COMPLETE | 184 / 1402 | Historical ref `96fbe49…` |
| 11 | Domain Coverage | `maintainpro/integration-v1` | `3e96648e…` | `3694173d074f7255587910c1be29d3990279da6c` | COMPLETE | 185 / 1447 | Historical ref `e0899df…` |
| 12 | Admin / Governance | `maintainpro/integration-v1` | `3694173d…` | `15e5f67a60586543da453a82533a7b559b9072be` | COMPLETE | 186 / 1507 | Historical ref `df16071…` |
| 13 | UX / KPI / Reports | `maintainpro/integration-v1` | `15e5f67a…` | `dacae29be806ed627babfb485f139f199828ef6f` | COMPLETE | 187 / 1603 | Historical ref `4a8499c…` |
| 14 | Production Hardening | `maintainpro/integration-v1` | `dacae29b…` | `520189e35fc56688e33125e2d9f24d739b60b548` | COMPLETE | 189 / 1684 | Historical ref `ce38e89…`; READY FOR STAGING UAT |
| 15 | MongoDB → SQL Server | `maintainpro/phase-15-sqlserver-migration` | `c54d7824ad42da0cd33c9c3a49dd5f7d0a6d2ed1` | `0a6a96d98eee8e6a84a08ab6222eddf17b05a479` (+15A commits) | 15A REHEARSAL PASS | 191 suites / 1713 tests; migrate deploy + apply + restore PASS | Staging UAT next; prod cutover NO |

---

## 8. Phase Completion Record

### Phase 0 — Freeze / Audit

#### Baseline
* Source branch: `main`
* Source SHA: `290bf3a` (approx tip at audit start)

#### Final
* Branch: `maintainpro/phase-00-audit`
* Final remote SHA: `f78d465b30bd97fc0cc80d18edcdf60b87d3e2f2`

#### Completed
Architecture/audit documentation; no business feature code; no DB drops.

#### Known Limitations
Phase-brief assumptions may differ from code; confirmed in later phases.

#### Readiness
YES → Phase 1

---

### Phase 1 — Scope Cleanup

#### Baseline / Final
* Branch: `maintainpro/phase-01-scope-cleanup`
* Final SHA: `d954360ce5f3e39b80787cdeab807000fd7cdb73`

#### Completed
Business Admin IA cleanup; soft-retire Farm Ops / Cleaning / QA / Delivery / Go-Live / Billing / Predictive AI from primary product surface.

#### Readiness
YES → Phase 2

---

### Phase 2 — Responsive PWA

#### Baseline / Final
* Baseline: `d954360…`
* Final: `e18a58cde3179505101702fe1733bc353b088b33`

#### Completed
Responsive web + PWA foundation; offline queue patterns (honest limits retained later).

#### Readiness
YES → Phase 3

---

### Phase 3 — Organization / Locations

#### Baseline / Final
* Baseline: `e18a58c…`
* Final: `b8d53ff9de9d84188edcccd455e435a40828dec5`

#### Completed
Organization, Sites, Functional Locations; location-only maintenance placement foundation.

#### Readiness
YES → Phase 4

---

### Phase 4 — Universal Assets

#### Baseline / Final
* Baseline: `b8d53ff…`
* Final: `a50b6b9624b1a0f281e20095badf453d7ab02fdb`

#### Completed
Universal Asset registry; Domain / Category / Type / attributes; Vehicle↔Asset optional unique link; QR foundation.

#### Tests
API suite ~1281 tests (phase record).

#### Readiness
YES → Phase 5

---

### Phase 5 — Requests / Triage

#### Baseline / Final
* Baseline: `a50b6b9…`
* Final: `6b5948032d2226b7938bbac52ea4931db79110d6`

#### Completed
Canonical `MaintenanceRequest` lifecycle; triage/approve/convert; FacilityIssue retained with migration bridge.

#### Tests
API suite ~1295 tests.

#### Known Limitations
FacilityIssue still creatable via cleaning until write-stop + migration complete.

#### Readiness
YES → Phase 6

---

### Phase 6 — Work Order Core

#### Baseline / Final
* Baseline: `6b59480…`
* Final: `bb48180af64f9d5bae066f9c6428911450989585`

#### Completed
Canonical WO lifecycle; labour; downtime; RCA fields; OVERDUE derived; TECHNICIAN_COMPLETED compatibility retained (UI: Completed).

#### Tests
API suite ~1304 tests.

#### Readiness
YES → Phase 7

---

### Phase 7 — Approval Engine

#### Baseline / Final
* Baseline: `bb48180…`
* Final: `b871a8da7d2b5f8782f39ff6e9719622ae55aa25`

#### Completed
Configurable ApprovalRule/Request/Step; multi-level; emergency override; WO/asset hooks; GATE_OVERRIDE hook reserved for fleet.

#### Tests
API suite ~1313 tests.

#### Readiness
YES → create `integration-v1` and Phase 8

---

### Phase 8 — Maintenance Planning Integration

#### Baseline
* Source branch: Phase 7 tip / `maintainpro/integration-v1` start
* Source SHA: `b871a8da7d2b5f8782f39ff6e9719622ae55aa25`
* Historical reference: `origin/maintainpro/phase-08-maintenance-planning` @ `844f1764ea27ce92d3705711b574c709680c6a13`

#### Final
* Branch: `maintainpro/integration-v1`
* Final remote SHA: `9d18b598ab4acd31856c35a30a02757434a76c08`

#### Completed
PM plans/triggers (calendar/meter/combined); meters; checklists; inspections; calibration; compliance expiry engine; WO generation via Phase 6 service; `/maintenance/plans`.

#### Database
PmPlan*, AssetMeter*, Inspection*, Calibration*, ComplianceRequirement*, checklist templates; dual keys during vehicle bridge.

#### Reused
Phase 6 WO create; Phase 7 approvals where configured.

#### Known Limitations
Legacy meter fields transitional; FacilityIssue still present.

#### Readiness
YES → Phase 9

---

### Phase 9 — Parts / ERP / Vendors

#### Baseline
* Source SHA: `9d18b598ab4acd31856c35a30a02757434a76c08`
* Historical: `origin/maintainpro/phase-09-parts-erp-vendors` @ `15621477a85f9da65b78247d38b1ccfe110e81e5`

#### Final
* Final remote SHA: `465c73d3616480eb796ebc382b2840cc84331b77`

#### Completed
SparePart classification; issue/return/consumption math; immutable `WorkOrderCostSnapshot`; ERP item/warehouse mapping; Supplier-as-Vendor; VendorContract → ComplianceRequirement; repair warranty; `/maintenance-supply`; mock ERP never production success.

#### Tests
Full API: 183 suites / 1340 passed / 10 skipped; Phase 9: 31 tests; web build PASS.

#### Known Limitations
Issue primarily via inventory engine; full vendor performance dashboards deferred.

#### Readiness
YES → Phase 10

---

### Phase 10 — Fleet

#### Baseline
* Source SHA: `465c73d3616480eb796ebc382b2840cc84331b77`
* Historical: `origin/maintainpro/phase-10-fleet` @ `96fbe4967d76d559af317048384673c65da3a4f6`

#### Final
* Final remote SHA: `3e96648e504409ae4fb6af7fbb1d5a5bfeee2e8f`

#### Completed
Vehicle = Asset extension; tyre/battery/assignment lifecycle; gate eligibility (read-only) + vehicles.service gate write; GATE_OVERRIDE Approvals; fuel/cost-per-km helpers; accident→WO chain; fleet overview; vehicle→asset backfill script.

#### Tests
Full API: 184 / 1402; Phase 10: 42 tests; web build PASS.

#### Known Limitations
Deep tyre/battery dedicated pages light; Flutter fleet depth not expanded.

#### Readiness
YES → Phase 11

---

### Phase 11 — Domain Coverage

#### Baseline
* Source SHA: `3e96648e504409ae4fb6af7fbb1d5a5bfeee2e8f`
* Historical: `origin/maintainpro/phase-11-domain-coverage` @ `e0899df3e9342b8adff2055a2fd6e9010ca44a74`

#### Final
* Final remote SHA: `3694173d074f7255587910c1be29d3990279da6c`

#### Completed
DomainProfile metadata on AssetDomain; KPI/downtime/location-only applicability; HVAC/REFRIGERATION/PLUMBING seeds; WO domainId inheritance; Admin asset-masters profile panel; no per-domain engines.

#### Tests
Full API: 185 / 1447; Phase 11: 45 tests; web build PASS.

#### Known Limitations
Request/WO UI domain pre-filters light; RCA filtering by profile is suggestion metadata.

#### Readiness
YES → Phase 12

---

### Phase 12 — Admin / Governance

#### Baseline
* Source SHA: `3694173d074f7255587910c1be29d3990279da6c`
* Historical: `origin/maintainpro/phase-12-admin-governance` @ `df160719c3a10454010345948219ebcf07d70e14`

#### Final
* Final remote SHA: `15e5f67a60586543da453a82533a7b559b9072be`

#### Completed
AdminGovernance module; overview signals; Data Quality center; Audit page; last-admin / self-lockout / tech open-WO deactivation guards; business vs technical Admin (`/system-health`); no go-live clutter restored.

#### Tests
Full API: 186 / 1507; Phase 12: 60 tests; web build PASS.

#### Known Limitations
Notification send-test UX light; DQ is navigate-to-fix (no blind auto-fix).

#### Readiness
YES → Phase 13

---

### Phase 13 — UX / KPI / Reports

#### Baseline
* Source SHA: `15e5f67a60586543da453a82533a7b559b9072be`
* Historical: `origin/maintainpro/phase-13-ux-reports` @ `4a8499c54cdac7add77d0034673b2d2fc2872394`

#### Final
* Final remote SHA: `dacae29be806ed627babfb485f139f199828ef6f`

#### Completed
Versioned KPI registry (`KPI_FORMULA_VERSION` `2026-09-15.v1`); role-aware Home cards on `/action-center`; manager KPI strip; MTTR/MTBF/PM compliance/cost snapshot/cost-per-km fixtures; N/A ≠ 0; existing `/reports` retained.

#### Tests
Full API: 187 / 1603; Phase 13: 96 tests; web build PASS.

#### Known Limitations
Action Center client aggregation incremental; MTBF needs operating/meter data; export polish deferred to existing reports module.

#### Readiness
YES → Phase 14

---

### Phase 14 — Production Hardening

#### Baseline
* Source SHA: `dacae29be806ed627babfb485f139f199828ef6f`
* Historical: `origin/maintainpro/phase-14-production` @ `ce38e896bbb996f0d39e52e1ad0718d7f6a225ab`

#### Final
* Final remote SHA: `520189e35fc56688e33125e2d9f24d739b60b548`

#### Completed
Acceptance map + hardening tests; `PHASE_14_PRODUCTION.md`; `PRODUCTION_READINESS_REPORT.md`; `UAT_RUNBOOK.md`; `GO_LIVE_CHECKLIST.md`; `MIGRATION_RUNBOOK.md`; `DATA_DISPOSITION_REPORT.md`; deploy/rollback aliases; **no destructive schema deletes**.

#### Database
No models removed. Soft-retired modules remain registered. FacilityIssue / legacy location / dual meter stores retained until migration proof.

#### Tests (Phase 14 tip session)
* prisma validate: PASS
* API typecheck: PASS
* Web typecheck: PASS
* Phase 14 tests: 81 passed
* Full API Jest: 189 suites, 1684 passed, 10 skipped
* Web production build: PASS
* API production build: PASS
* Manual UAT: NOT performed in this phase

#### Known Limitations / Blockers
* Backup/restore drill NOT EXECUTED (OPEN BLOCKER)
* Live Bileeta credentials not validated (OPEN BLOCKER)
* Target Mongo `db:push` / migration apply not proven in this phase
* Manual role/device UAT outstanding
* Soft-retired modules still in AppModule
* FacilityIssue still creatable via cleaning path

#### Git
* Commits: `c32f3f93`, `abccc1dd`, `ea7801cd`, `520189e3`
* Push: `origin/maintainpro/integration-v1`
* Remote tip: `520189e35fc56688e33125e2d9f24d739b60b548`

#### Readiness
YES for **staging UAT** — NOT production-ready; main merge NO

#### Next Phase
Operator staging UAT + restore drill + Bileeta validation + migration dry-run — then PR to `main` only after sign-off.

---

### Phase 15 — MongoDB → Microsoft SQL Server Migration

#### Baseline
* Source branch: `maintainpro/integration-v1`
* Source SHA: `c54d7824ad42da0cd33c9c3a49dd5f7d0a6d2ed1`
* Phase branch: `maintainpro/phase-15-sqlserver-migration`
* Phase 15A baseline remote tip: `0a6a96d98eee8e6a84a08ab6222eddf17b05a479`
* Prisma: `5.22.0` (no major upgrade)

#### Completed (engineering + Phase 15A live rehearsal)
* Full Mongo compatibility audit
* Schema converted to `provider = "sqlserver"`
* ObjectId/`_id`/`auto()` removed; `NVarChar(36)` + `cuid()`
* RolePermission, UserSkill, and related junctions with compound upserts
* Json + scalar lists → `NVarChar(Max)` JSON text
* Enums → String + `prisma-enums.ts` client shim
* All FK cascades softened to NoAction
* Selected money fields → `Decimal(18,2)`
* Initial migration deployed to disposable `MaintainProDev` (185 tables / 379 FKs / 1011 indexes)
* Pipeline hardened: ObjectId/Date/Decimal/JSON/junction/collection mapping + dry-run quality gate
* Dry-run / apply / second-apply idempotency: `criticalFailures=0`
* Reconciliation filled: `docs/SQLSERVER_DATA_RECONCILIATION.md`
* Backup → restore to `MaintainProDev_Drill` executed (marker proof)
* Prisma SQL data-plane smoke: 17/17 PASS
* Jest: 191 suites passed / 1713 tests passed (10 skipped)

#### Database
* Models added: RolePermission, UserSkill, JobCodeRequiredPart, PmPlanRequiredPart, TraceabilitySprayLink, VendorContractAsset, VendorContractSite
* Legacy PostgreSQL migrations archived under `prisma/migrations_legacy_postgresql/`
* Mongo source **not** deleted
* Disposable SQL: `MaintainProDev` + drill restore DB; app login `maintainpro_app` (credentials local only)

#### Tests / gates
* `prisma validate` / `generate` / `migrate deploy` PASS on SQL Server 2022 Developer
* Live data apply + idempotency + backup/restore: **EXECUTED** (fixture Mongo → disposable SQL)
* HTTP full-workflow login smoke: deferred (fixture passwords ≠ bcrypt) — required on staging UAT

#### Known Limitations / Blockers for cutover
* Staging UAT with real Mongo snapshot not yet run
* Full HTTP RBAC role matrix against SQL not yet signed off
* Production cutover not performed; Mongo remains rollback source

#### Git
* Branch: `maintainpro/phase-15-sqlserver-migration`
* Phase 15A final remote tip: `f6f5c7172afde88bc3e4116d649831f7a4f18e62`
* Push: `origin/maintainpro/phase-15-sqlserver-migration`

#### Readiness
* Schema conversion: COMPLETE
* Migration rehearsal (disposable): PASS
* Reconciliation (fixture): PASS
* Backup/restore drill: PASS (executed)
* SQL Server staging UAT readiness: YES (start staging UAT)
* Ready for Production Cutover: NO
* Main merge: NO

#### Next Phase
SQL Server staging UAT + real snapshot reconciliation → cutover decision. Do not auto-start Phase 16.

---

## 9. Important Canonical Architecture Decisions

### Asset

One universal Asset registry.

`AssetDomain` → `AssetCategoryMaster` → `AssetTypeMaster` → `Asset`

Physical Asset is NOT Functional Location.

### Functional Location

Hierarchy:

Company → Site → Building / Zone → Department / Area → Production Line / Room → Functional Location

Location-based maintenance must work without requiring a physical Asset (Building/Civil, External Infrastructure).

### Maintenance Request

Ordinary users report problems through Maintenance Request.

At least Asset **OR** Functional Location is required.

Lifecycle: NEW → UNDER_REVIEW → APPROVED → CONVERTED_TO_WO (+ REJECTED / CANCELLED).

### Work Order

Canonical business lifecycle:

OPEN → PLANNED → ASSIGNED → IN_PROGRESS → ON_HOLD → COMPLETED → VERIFIED → CLOSED

CANCELLED is special terminal state.  
OVERDUE is derived (`dueAt`/`dueDate` < now AND not terminal).  
`TECHNICIAN_COMPLETED` may remain as compatibility status (UI label: Completed).

### Approval Engine

ONE common configurable approval engine for Critical WO, high-cost, Vendor Repair, Asset Retirement, WO Reopen, Closed Record Correction, Gate Override, Compliance Exception, Budget Exception.

### PM

Generic triggers: Calendar, Meter, Expiry, Condition, Event; combined triggers (e.g. 500 hours OR 3 months, whichever first).

### Fleet

Vehicle is an Asset extension (`Vehicle.assetId`). Do not create a second fleet maintenance engine.

### ERP

Bileeta remains official ERP truth. MaintainPro never fabricates stock or sync success. Mock mode must never report production success.

---

## 10. Historical Branch Recovery Rule

Historical reference branches (DO NOT rewrite):

| Branch | Tip (unchanged) |
|--------|-----------------|
| `maintainpro/phase-08-maintenance-planning` | `844f1764ea27ce92d3705711b574c709680c6a13` |
| `maintainpro/phase-09-parts-erp-vendors` | `15621477a85f9da65b78247d38b1ccfe110e81e5` |
| `maintainpro/phase-10-fleet` | `96fbe4967d76d559af317048384673c65da3a4f6` |
| `maintainpro/phase-11-domain-coverage` | `e0899df3e9342b8adff2055a2fd6e9010ca44a74` |
| `maintainpro/phase-12-admin-governance` | `df160719c3a10454010345948219ebcf07d70e14` |
| `maintainpro/phase-13-ux-reports` | `4a8499c54cdac7add77d0034673b2d2fc2872394` |
| `maintainpro/phase-14-production` | `ce38e896bbb996f0d39e52e1ad0718d7f6a225ab` |

For each: REUSE CLEAN / PORT WITH CHANGES / DISCARD REPLACE.  
Canonical Phase 0–7 architecture always wins conflicts.

---

## 11. Database Cleanup Rule

Never delete schema/models blindly.

Before removal: inventory → dependency check → backup → migration → reconciliation → runtime removal → tests → only then drop.

See `docs/DATA_DISPOSITION_REPORT.md` and `docs/MIGRATION_RUNBOOK.md`.

---

## 12. Production Readiness Rules

Final verdict must be one of:

* NOT READY
* READY FOR STAGING UAT ← **current**
* CONDITIONALLY READY FOR PRODUCTION
* PRODUCTION READY

`PRODUCTION READY` requires CI green, full regression, security, tenant isolation, migration validation, data-quality gate, backup verification, restore drill, required integration testing, manual UAT, and business/operator sign-off.

See `docs/PRODUCTION_READINESS_REPORT.md`.

---

## 13. Current Known External Dependencies

* Live / staging Bileeta credentials and endpoint
* ERP warehouse / item mapping data
* SMTP (and SMS if used)
* Production / staging MongoDB access + controlled `db:push`
* Production backup system + restore drill evidence
* File storage configuration (MinIO/Cloudinary/etc.)
* Final approval thresholds (tenant-configured, not hardcoded)
* User / site / asset master data for pilot
* Manual UAT users and devices
* CI green confirmation on release candidate

Never invent missing business configuration.

---

## 14. Current Known Limitations

* Manual browser/device UAT outstanding
* Offline evidence upload not fully supported (honest PWA limits)
* Real ERP validation pending credentials/environment
* Shared production DB schema push not yet performed
* Backup/restore drill pending (OPEN BLOCKER — not PASS)
* Soft-retired modules still registered in AppModule
* FacilityIssue still creatable via cleaning until write-stop
* Dual meter / legacy location fields retained during bridge
* Virus scanning unavailable — file MIME/size restrictions only

Remove limitations only when actually resolved.

---

## 16. Mandatory Update Rule

At the end of EVERY future phase:

1. Update phase table.
2. Add full final remote SHA.
3. Record commits.
4. Record exact test results.
5. Record database changes.
6. Record limitations.
7. Record readiness.
8. Update **Current Next Action** (section 15).
9. Commit this file with the phase documentation.
10. Push it with the canonical phase branch.

If Cursor chat context is lost, read this file FIRST before doing any more implementation.

Do not guess the current phase or source SHA when this file contains the answer.

---

## Related Canonical Docs

| Doc | Purpose |
|-----|---------|
| `docs/BRANCH_RECOVERY_AND_INTEGRATION.md` | Binding branch recovery rule |
| `docs/IMPLEMENTATION_LOG.md` | Chronological task log |
| `docs/PHASE_0*.md` … `PHASE_14_PRODUCTION.md` | Per-phase detail |
| `docs/KPI_DEFINITIONS.md` | KPI formulas |
| `docs/UAT_RUNBOOK.md` | Manual UAT |
| `docs/GO_LIVE_CHECKLIST.md` | Go-live gates |
| `docs/MIGRATION_RUNBOOK.md` | Ordered migrations |
| `docs/DATA_DISPOSITION_REPORT.md` | Model keep/retain/blocked |
| `docs/PRODUCTION_READINESS_REPORT.md` | Verdict + blockers |
| `docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md` | Deploy alias → remediation |
| `docs/ROLLBACK_RUNBOOK.md` | Rollback alias → remediation |
