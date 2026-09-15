# Phase 13 — UX Reports & KPI Role Dashboards

**Baseline commit:** `15e5f67` (docs: document canonical phase 12 governance integration)  
**Historical reference:** `4a8499c` (origin/maintainpro/phase-13-ux-reports) — REFERENCE ONLY, not merged  
**Branch:** `maintainpro/integration-v1`  
**KPI formula version:** `2026-09-15.v1`

---

## What was delivered

### Backend module: `apps/api/src/modules/reporting-kpis/`

| File | Purpose |
|------|---------|
| `kpi-definitions.ts` | Centralized KPI formula registry + pure compute helpers |
| `role-home.ts` | Role archetype → quick-action card profiles |
| `reporting-kpis.service.ts` | Facade: listDefinitions, getDefinition, resolveHome, evaluateKpis |
| `reporting-kpis.module.ts` | NestJS module registration |
| `reporting-kpis.controller.ts` | REST endpoints at `/reporting-kpis` |

### API endpoints

| Method | Path | Auth |
|--------|------|------|
| GET | `/reporting-kpis` | `reports.view` |
| GET | `/reporting-kpis/:code` | `reports.view` |
| GET | `/reporting-kpis/home` | JWT role (any authenticated) |
| GET | `/reporting-kpis/home/:role` | JWT role |
| POST | `/reporting-kpis/overview` | `reports.view` |

### Web changes

- `apps/web/lib/reporting-kpis-api.ts` — axios helpers for all endpoints
- `apps/web/lib/role-home.ts` — client-side resolveRoleHome (mirrors backend)
- `apps/web/components/action-center/action-center-page.tsx` — added:
  - **RoleHomeCards** strip: role-aware quick-action cards at top of page
  - **KpiStrip**: WO_OVERDUE, WO_BACKLOG, PM_COMPLIANCE, MTTR compact badges for manager/admin roles

### Navigation constraint upheld

Single Home entry: `/action-center` (label "Home"). No Dashboard, Workspace, or Action Center competing primary nav items added.

---

## Role Home profiles

| Profile | Target roles | Key cards |
|---------|-------------|-----------|
| REQUESTER | REQUESTER, VENDOR, unknown | Report Issue, New Request, My Requests |
| TECHNICIAN | TECHNICIAN, MECHANIC | My Jobs, Due Today, Overdue, Waiting Parts |
| SUPERVISOR | SUPERVISOR, MAINTENANCE_SUPERVISOR | New Requests, Unassigned, Critical, Overdue, Approvals, PM Due |
| FLEET | FLEET_MANAGER, DRIVER, SECURITY_OFFICER | Fleet, Service Due, Doc Expiry, Blocks, Claims/Fines, Accidents |
| MANAGER | MANAGER, MAINTENANCE_MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER, ADMIN, SUPER_ADMIN | KPI Reports, Backlog, PM Compliance, Downtime, Cost, Repeat Failures, Mgmt Intel |
| MANAGEMENT_VIEWER | VIEWER, AUDITOR, FINANCE, FINANCE_APPROVER | All Reports (read-only), Mgmt Intel, Fleet Reports, Compliance |

**Overdue links:** `/work-orders` (base route). Overdue is a derived state (dueAt < now AND non-terminal) — there is no `?status=OVERDUE` server parameter. Frontend should apply `queue=overdue` if the queues engine supports it.

---

## Report catalog pointers

Existing report routes (no new primary nav added):

- `/reports` — main report hub (ReportsModule)
- `/reports/management-intelligence` — ManagementIntelligenceModule
- `/reports/maintenance-exceptions` — ReportsModule
- `/reports/fraud-control` — FraudControlModule

KPI overview values feed into action-center page (manager/admin roles).

---

## Phase 13 permissions added

```
reports.view.maintenance  → aliases: reports.view, reports.performance.view, reports.operations.view
reports.view.cost         → aliases: reports.view, reports.financials.view, cost.view
reports.view.fleet        → aliases: reports.view, reports.vehicle_cost.view, reports.fuel.view
reports.view.compliance   → aliases: reports.view, reports.assets.view, compliance.view
```

---

## Tests

`apps/api/test/reporting-kpis-phase13.spec.ts` — 35+ tests covering:
- KPI catalog meta (version, count, back-compat fields, emptyBehavior)
- Terminal status / overdue logic
- All compute helpers with exact fixture values
- Role home profiles and resolveRoleHome mapping
- Domain applicability (isKpiApplicableForDomain + domain-profiles isKpiApplicable)
- RBAC permission catalog
- Navigation shared Home invariant
- KPI payload security (no secrets)
