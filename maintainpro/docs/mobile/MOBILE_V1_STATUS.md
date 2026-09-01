# MaintainPro Mobile V2 — V1 Fast-Track Status

Last updated: 2026-09-01 (branch `feature/mobile-v2`, PR #28 DRAFT)

## V1_STATUS=PARTIAL — core + Admin + Reports implemented; live FG UAT + release polish pending

| Area | Status |
|------|--------|
| AUTH | PASS — Nest JWT, same users as Web |
| HOME_TASKS | PASS |
| WORK_ORDERS | PASS |
| GATE | PASS |
| FLEET_CORE | PARTIAL — unassign + enterprise health read; assign UI deferred |
| ASSETS_PM | PASS (read + PM schedules) |
| INVENTORY | PARTIAL — safe read scope; mutations BLOCKED_SERVER_SAFETY |
| FACILITIES | PARTIAL — read + issue online submit; cleaning/meter write blocked |
| COMPLIANCE | PARTIAL — read + accident report online |
| NOTIFICATIONS | PARTIAL — list, badge, FCM registration (Firebase config optional) |
| FCM | PARTIAL — device register/unregister wired; delivery needs Firebase + push provider |
| CAMERA_SCAN | PARTIAL — camera + `POST /operations/scan-lookup` |
| FG_CL18 | IMPLEMENTED — BFF + Flutter recorder |
| FG_CL24 | IMPLEMENTED — BFF + Flutter recorder |
| FG_CL30 | IMPLEMENTED |
| FG_CL39 | IMPLEMENTED — BFF + Flutter recorder |
| FG_CL30_LIVE_UAT | BLOCKED_EXTERNAL_CONFIG — `FG_API_INTERNAL_URL` |
| DRAFT_SYNC | PARTIAL — local drafts + sync center; no auto-replay without idempotency |
| RBAC | PASS — widget + policy tests |
| TENANT_ISOLATION | PARTIAL — API enforced; shared-device tests partial |
| ANDROID_VISUAL_UAT | PARTIAL — emulator boot verified; full role walkthrough pending |
| ANDROID_RELEASE_READINESS | PARTIAL — debug signing; applicationId still `com.example.*` |

## Full Admin Console (V1 REQUIRED)

| Field | Status |
|-------|--------|
| FULL_ADMIN_CONSOLE_STATUS | PARTIAL — hub + source-backed modules wired; user create/edit/role assign not on mobile |
| ADMIN_USERS_STATUS | PARTIAL — list, search, detail, activate/deactivate (online + confirm) |
| ADMIN_PEOPLE_STATUS | PARTIAL — list/search + detail via `GET /people` |
| ADMIN_ROLES_STATUS | PARTIAL — roles list + permission catalog (read-only) |
| ADMIN_PERMISSIONS_STATUS | PARTIAL — server catalog search/grouping; no client-side mutation |
| ADMIN_TENANTS_STATUS | PARTIAL — list/overview; no destructive tenant ops |
| ADMIN_INVITATIONS_STATUS | PARTIAL — list + invite (online); resend/revoke not exposed in Nest admin module |
| ADMIN_SETTINGS_STATUS | PARTIAL — links to existing `/settings` hub (org settings server-authoritative) |
| ADMIN_MASTER_DATA_STATUS | PARTIAL — departments list; other master entities via existing hubs |
| ADMIN_AUDIT_STATUS | PASS — read-only list + detail sheet (`GET /audit-logs`) |
| ADMIN_SYSTEM_HEALTH_STATUS | PASS — `/health` + `/health/readiness` safe abstraction |
| ADMIN_RBAC_STATUS | PASS — UI gate SUPER_ADMIN/ADMIN; Nest 401/403 authoritative |
| ADMIN_TENANT_ISOLATION | PARTIAL — tenant from session/header; live multi-tenant UAT pending |
| ADMIN_CRITICAL_MUTATION_POLICY | PASS — activate/deactivate + invite online-only with confirmation |

## Advanced Management Reports (V1 REQUIRED)

| Field | Status |
|-------|--------|
| ADVANCED_REPORTS_STATUS | PARTIAL — hub + server-backed screens; date/export filters partial |
| MANAGEMENT_DASHBOARD_STATUS | PASS — `GET /reports/dashboard` KPI cards |
| OPERATIONS_REPORTS_STATUS | PARTIAL — module reports + maintenance exceptions |
| ASSET_REPORTS_STATUS | PARTIAL — via `reports/assets` module screen |
| INVENTORY_REPORTS_STATUS | PARTIAL — via `reports/inventory` module screen |
| PROCUREMENT_REPORTS_STATUS | PARTIAL — financials/operations modules where API overlaps |
| FLEET_REPORTS_STATUS | PARTIAL — fuel-analytics, vehicle-cost, driver-intelligence modules |
| FACILITIES_REPORTS_STATUS | PARTIAL — facilities aging report |
| COMPLIANCE_REPORTS_STATUS | PARTIAL — deep-link to compliance hub |
| FG_REPORTS_STATUS | PARTIAL — deep-link to FG hub (CL18–CL39) |
| USER_ACTIVITY_REPORT_STATUS | PARTIAL — `reports/user-activity` module |
| FINANCIAL_REPORTS_STATUS | PARTIAL — `reports/financials` + management profitability summary |
| SYSTEM_REPORTS_STATUS | PARTIAL — `reports/system-logs` + ERP monitoring |
| REPORT_EXPORT_STATUS | DEFERRED_WEB_FIRST — `reports.export` binary download not wired on mobile |
| REPORT_RBAC_STATUS | PASS — `reports.view` / `reports.*` permission gate + role bypass for ADMIN |
| REPORT_TENANT_ISOLATION | PARTIAL — API enforced; live UAT pending |
| REPORT_API_GAPS | Export endpoints; some module date-range filters UI not yet on all screens |

## DEFERRED_TO_V1_1 (optional only)

Farm (if not in tenant scope), live Fleet GPS map (no feed), AI Assistant, billing, report binary export UX, desktop parity screens.

**Admin Console and Advanced Reports are NOT deferred.**

## SERVER_BLOCKERS

- Inventory stock mutations (idempotency/concurrency gaps)
- Cleaning completion / meter write (no proven safe contract)
- Facility/accident outbox auto-replay (no server idempotency)
- Admin invitation resend/revoke (no admin controller endpoints found)

## EXTERNAL_BLOCKERS

- FG live Nest↔Django UAT (`FG_API_INTERNAL_URL` non-prod)
- FCM delivery (Firebase + push provider credentials)

## Tests

118 Flutter PASS / 0 failed (2026-09-01) — includes admin/reports widget tests

## Release gates (not UAT-ready yet)

```
AUTH=PASS
HOME_TASKS=PASS
WORK_ORDERS=PASS
GATE=PASS
FLEET_CORE=PARTIAL
ASSETS_PM=PASS
INVENTORY_SAFE_SCOPE=PARTIAL
FACILITIES_SAFE_SCOPE=PARTIAL
COMPLIANCE=PARTIAL
NOTIFICATIONS=PARTIAL
CAMERA_SCAN=PARTIAL
FG_CL18=IMPLEMENTED
FG_CL24=IMPLEMENTED
FG_CL30=IMPLEMENTED
FG_CL39=IMPLEMENTED
FULL_ADMIN_CONSOLE=PARTIAL
ADVANCED_MANAGEMENT_REPORTS=PARTIAL
ADMIN_RBAC=PASS
ADMIN_TENANT_ISOLATION=PARTIAL
REPORT_RBAC=PASS
REPORT_TENANT_ISOLATION=PARTIAL
DRAFT_SYNC=PARTIAL
SHARED_DEVICE=PARTIAL
ANDROID_VISUAL_UAT=PARTIAL
TESTS=PASS
```

PRODUCTION_MUTATION=NO · PRODUCTION_DEPLOYMENT=NO · PR #28 DRAFT
