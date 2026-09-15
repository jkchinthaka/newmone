# MaintainPro Production Readiness Report

**Document version:** Phase 14 canonical  
**Branch:** `maintainpro/integration-v1`  
**Canonical Git SHA:** `ea7801cd72dfe43f044823bd3dafd2dc21d35ff5`  
**Phase 13 baseline:** `dacae29be806ed627babfb485f139f199828ef6f`  
**Historical tip (reference):** `ce38e89` (`maintainpro/phase-14-production`)  
**Report date:** 2026-09-15  

---

## Executive Verdict

> **READY FOR STAGING UAT**

The platform has completed Phases 0–14 on `maintainpro/integration-v1`. Core engines for PM/meters/inspection/calibration/compliance, parts/ERP boundary/costs/vendors/contracts, fleet lifecycle, domain coverage, admin governance, and role/KPI reporting are implemented and unit-tested.

**This verdict does NOT mean unconditionally production-ready.** Several operator-owned items remain open blockers before production go-live. See [Go-Live Blockers](#go-live-blockers).

---

## Scope Delivered (Phases 0–13)

| Phase | Focus |
|-------|-------|
| 0 | Current-state audit; identified legacy models and scope |
| 1 | Scope cleanup; RBAC/PBAC foundation; multi-tenant middleware |
| 2 | Responsive web baseline; PWA shell; mobile-first DataTable |
| 3 | Organization hierarchy; functional locations; site/building/room model |
| 4 | Universal asset engine; asset taxonomy; vehicle↔asset link |
| 5 | Maintenance requests; triage; FacilityIssue → MaintenanceRequest bridge |
| 6 | Work order core lifecycle; TECHNICIAN_COMPLETED; OVERDUE derivation |
| 7 | Approval engine; threshold rules; override with audit trail |
| 8 | PM plans; calendar/meter/combined triggers; inspection; calibration; compliance; auto-WO |
| 9 | Parts classification; cost snapshots; vendor contracts; ERP honesty boundary |
| 10 | Fleet lifecycle; tyre/battery; gate policy; accident → repair → claim chain |
| 11 | Company domain profiles; shared WO/PM/parts/vendor engine across all domains |
| 12 | Admin governance; admin safety guards; data-quality rules; permission sync |
| 13 | Role home; KPI formula registry (v1); versioned KPI definitions |

---

## Database

### Added (retained, require `db:push`)

PmPlan, PmRevision, PmTrigger, PmAutoGeneration, AssetMeter, AssetMeterReading, ChecklistTemplate, ChecklistItem, WorkOrderChecklist, InspectionRecord, CalibrationRecord, ComplianceRequirement, SparePartClassification fields, PartIssue return/cost snapshot fields, WorkOrderCostSnapshot, VendorContract, VendorContact, WorkOrderExecutionMode, Vehicle.assetId, VehicleTyre, VehicleBattery, DomainProfile, AdminCatalogRule.

### KEEP (active production models)

All Phase 0–14 models above; all WO, asset, fleet, inventory, approval, audit models.

### RETAIN TEMPORARILY (migration required before removal)

| Model/Field | Reason | Action |
|-------------|--------|--------|
| `FacilityIssue` | Active create path; some unresolved tickets | Run `migrate-facility-issues-to-requests.ts` dry-run first; validate; then cut over |
| `Asset.location` (legacy string field) | Pre-Phase-3 sites use string location | Run `migrate-facility-hierarchy.ts` + `facility-location-backfill.ts` |
| Farm models (`Crop`, `Field`, `Harvest`, `Livestock`, etc.) | Soft-retired; historical data | Migrate or archive after business sign-off |
| `MaintenanceSchedule` | Legacy alongside `PmPlan` | Retain until `PmPlan` full rollout verified |

### BLOCKED FROM REMOVAL (do not remove without proof)

| Item | Reason |
|------|--------|
| Soft-retired module models (Cleaning, Billing, QA/GoLive, PredictiveAi) | Existing data; active routes; migration not complete |
| `FacilityIssue` create path | Migrate-first policy; must not silently break requesters |

### SAFE TO REMOVE

**None confirmed this phase.** No destructive cleanup without: backup verification on non-production restore + dependency audit.

---

## Migration Scripts

See `docs/MIGRATION_RUNBOOK.md` for ordered dry-run-first execution steps.

| Script | Purpose |
|--------|---------|
| `apps/api/scripts/migrate-vehicle-asset-links.ts` | Link existing vehicles to asset records |
| `apps/api/scripts/migrate-legacy-asset-meters.ts` | Backfill AssetMeter records for legacy meter data |
| `apps/api/scripts/migrate-facility-issues-to-requests.ts` | Convert FacilityIssue → MaintenanceRequest |
| `apps/api/scripts/migrate-facility-hierarchy.ts` | Migrate flat facility data to hierarchy model |
| `apps/api/scripts/facility-location-backfill.ts` | Backfill Asset.location → linked FunctionalLocation |

---

## Security Summary

| Area | Status | Evidence |
|------|--------|----------|
| JWT authentication | PASS | `auth-throttling.spec.ts`, `auth-login-lockout.spec.ts` |
| RBAC role guards | PASS | `rbac-authorization.spec.ts`, `permissions.guard.spec.ts` |
| Tenant isolation | PASS | `cross-tenant-isolation.spec.ts`, `operational-cross-tenant-isolation.spec.ts` |
| Admin safety guards | PASS | `admin-governance-phase12.spec.ts`, `phase14-hardening.spec.ts` |
| Sensitive field stripping | PASS | `phase14-hardening.spec.ts` — `sanitizeSystemResponse` |
| ERP mock safety | PASS | `phase14-hardening.spec.ts` — `erpSyncOutcome` |
| Rate throttling | PASS | `auth-throttling.spec.ts`, `bff-client-ip-throttle.spec.ts` |
| No secrets in commits | PASS | No `.env` or credential files committed |
| HTTPS / TLS | OPERATOR — **NOT VERIFIED** | Edge/load-balancer HTTPS termination is operator-configured |
| Secret rotation | OPERATOR — **NOT VERIFIED** | Production JWT secret, DB passwords to be rotated before go-live |

---

## Reliability Summary

| Area | Status | Evidence |
|------|--------|----------|
| Auto-WO duplicate prevention | PASS | `PmAutoGeneration.openWoCheck` in planning engine |
| Cost snapshot immutability | PASS | `phase14-hardening.spec.ts` — snapshotTotal source field |
| Gate override audit fields | PASS | `fleet-lifecycle-phase10.spec.ts` |
| Queue/ERP degradation | PASS | `queue-health-readiness.spec.ts`, existing Redis retry strategy |
| Database replication | PASS (logic) | `database-replication.spec.ts` |

---

## Performance Summary

| Area | Status |
|------|--------|
| WO list indexes (`tenantId+status`, `dueDate`, `pmPlanId`) | In schema |
| Compliance `expiresAt` index | In schema |
| Meter readings `(meterId, recordedAt)` index | In schema |
| Vehicle `registrationNo` / `assetId` indexes | In schema |
| Pagination on all list endpoints | Required — unbounded select-all is prohibited |
| Load testing on staging | OPERATOR — not executed this phase |

---

## Backup / Restore

> **NOT EXECUTED in this phase — OPEN BLOCKER / OPERATOR_ACTION_REQUIRED**

The dual-DB replication architecture is implemented (`database-replication.spec.ts`). A live restore drill on a production clone has **not** been performed.

This is a **mandatory blocker** before production go-live. See `docs/remediation/BACKUP_AND_RECOVERY_ARCHITECTURE.md` and `docs/remediation/DISASTER_RECOVERY_RUNBOOK.md`.

---

## UAT Status

| Category | Status |
|----------|--------|
| Automated acceptance map (items 1–29) | **PASS** — see `phase14-acceptance-map.spec.ts` |
| Hardening invariants (20+ tests) | **PASS** — see `phase14-hardening.spec.ts` |
| Manual browser UAT (items 30–32) | **OUTSTANDING** — requires staging environment |
| Backup/restore drill (item 33) | **OUTSTANDING — OPERATOR BLOCKER** |

---

## Integrations

| Integration | Status |
|-------------|--------|
| MongoDB Atlas (primary) | **REQUIRES OPERATOR `db:push`** for Phase 8–13 models on staging/production Atlas cluster |
| MongoDB backup (replication) | Logic implemented; live replication not verified |
| Bileeta ERP (Inventory) | **BLOCKER** — credentials not validated live; mock mode used; see `ERP_INVENTORY_INTEGRATION_PLAN.md` |
| SMTP email notifications | **NOT LIVE** — requires production SMTP credentials |
| SMS notifications | **NOT LIVE** — requires production SMS provider credentials |
| Redis queue | Degrades gracefully if unavailable; production Redis not provisioned/confirmed |
| MinIO / Cloudflare R2 (evidence storage) | Env-gated; not validated with production bucket |
| RapidAPI (QR / Street View) | Optional; env-gated |

---

## Go-Live Blockers

The following items **must** be resolved before production cutover:

| # | Blocker | Owner | Priority |
|---|---------|-------|----------|
| 1 | Backup/restore drill on production clone | Operator | **CRITICAL** |
| 2 | Live `db:push` for Phase 8–13 models on Atlas staging | Operator/DBA | **CRITICAL** |
| 3 | Bileeta ERP production credentials + apply allowlist | Business/IT | **CRITICAL** |
| 4 | SMTP/SMS production provider credentials | IT | HIGH |
| 5 | Business master data (PM frequencies, temperature limits, Nelna-specific) | Business owner | HIGH |
| 6 | Manual browser UAT pass (items 30–32) | QA/Business | HIGH |
| 7 | CI green on `integration-v1` before merge to `main` | Engineering | HIGH |
| 8 | HTTPS TLS termination at edge (Render/Nginx/Cloudflare) | Operator | HIGH |
| 9 | Production secret rotation (JWT, DB passwords) | Operator | HIGH |
| 10 | Load test / soak test on staging | Engineering/Operator | MEDIUM |

---

## Main Branch Merge Recommendation

> **NO** — do not merge `maintainpro/integration-v1` to `main` until all CRITICAL and HIGH blockers are resolved and CI is green.

---

## References

- `docs/PHASE_14_PRODUCTION.md` — Phase 14 scope and disposition
- `docs/MIGRATION_RUNBOOK.md` — ordered migration script execution
- `docs/DATA_DISPOSITION_REPORT.md` — model-level disposition table
- `docs/UAT_RUNBOOK.md` — manual UAT scenarios
- `docs/GO_LIVE_CHECKLIST.md` — full go-live gate checklist
- `docs/remediation/GO_LIVE_GATES.md` — gate definitions
- `docs/remediation/PRODUCTION_DEPLOYMENT_RUNBOOK.md` — deployment steps
- `docs/remediation/PRODUCTION_ROLLBACK_RUNBOOK.md` — rollback procedure
