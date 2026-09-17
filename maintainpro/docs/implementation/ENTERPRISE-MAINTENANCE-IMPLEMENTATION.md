# Enterprise Maintenance Implementation Ledger

Branch: `maintainpro/phase-15-sqlserver-migration`  
Updated: 2026-09-17

## Auth (P0)

| Item | Status | Notes |
|------|--------|-------|
| Compact browser JWT (no permission arrays in cookies) | IMPLEMENTED | `dc841dc6`; `auth.types.ts` claims = sub/email/role/tenantId |
| DB-authoritative PermissionsGuard | IMPLEMENTED | Unchanged; JWT perms ignored |

## Unified job engine

| Item | Status | Notes |
|------|--------|-------|
| jobDomain MACHINERY/SERVICE/VEHICLE | IMPLEMENTED | Schema + create/list/convert + domain UI lanes |
| Shared WO lifecycle | IMPLEMENTED | Existing Phase 6 engine |
| Domain-filtered nav/dashboard | IMPLEMENTED | `/maintenance/jobs/*` |

## Admin configuration

| Item | Status | Notes |
|------|--------|-------|
| Job categories (MAIN/SUB by domain) | IMPLEMENTED | `MaintenanceJobCategory` + admin UI |
| Priority SLA rules | IMPLEMENTED | `PrioritySlaRule` + editable admin UI |
| SLA rules wired into WO deadline calc | IMPLEMENTED | `WorkOrdersService.slaHours` → `resolveCompletionHours` |
| Fault / cause / remedy code CRUD | IMPLEMENTED | `MaintenanceAnalysisCode` + `/admin/fault-codes` |
| Hold / delay reason masters | IMPLEMENTED | `MaintenanceReasonCode` + `/admin/reason-codes`; WO hold uses DB |
| Config change history | IMPLEMENTED | `ConfigChangeHistory` + `/admin/config-history` |
| Feature flags per tenant | PARTIAL | AppSetting toggles; no FeatureFlag model |
| Work template snapshot on WO | PARTIAL | ChecklistExecution now written; JobCode still not linked |
| Checklist template versioning + Admin UI | IMPLEMENTED | revise bumps version; `/admin/checklist-templates` |
| Dynamic forms | ARCHITECTURE READY | ChecklistTemplateItem types |
| Warranty lifecycle admin | DEFERRED | Models/fleet exist; full recovery workflow later |
| Vendor portal | DEFERRED | Restricted access design later |
| Offline PWA sync | DEFERRED | |

## History / audit

| Item | Status |
|------|--------|
| WorkOrderStatusHistory | IMPLEMENTED |
| AuditLog admin | IMPLEMENTED |
| ConfigChangeHistory | IMPLEMENTED |

## Commits (this mission)

- `ee10fdd9` feat(db): jobDomain + maintenance config models
- `3f8f7dd3` feat(maintenance): unify machinery/service/vehicle jobs
- `53e3faed` feat(web): maintenance + advanced admin navigation
- `8f6b64c0` feat(admin): config history, reason/fault codes, SLA-driven WO deadlines
- _(pending)_ feat(planning): checklist template revise + WO execution snapshots

## Validation (this batch)

- `db:generate` — pass
- `db:migrate:deploy` — `20260917190000_config_history_and_reason_codes` applied
- `db:seed` ×2 — pass
- `typecheck` (api + web) — pass
- focused tests: `maintenance-config-sla`, `planning-phase08`, `job-domain.util`, `auth-cookie-size` — pass

## Config-driven proof

Admin changes `PrioritySlaRule.completionMinutes` → `resolveCompletionHours` returns minutes/60 → WO `IN_PROGRESS` sets `slaDeadline` from that value. Covered by `maintenance-config-sla.spec.ts`. History records actor/reason/before/after/version.

Checklist revise creates new version; prior `ChecklistExecution.templateSnapshot` remains frozen (`planning-phase08.spec.ts`).
