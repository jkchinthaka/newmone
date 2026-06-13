# MaintainPro Production Readiness TODO

## Status Legend: NOT_STARTED | IN_PROGRESS | BLOCKED | DONE | VERIFIED | NEEDS_REVIEW
## Priority Legend:
- P0 = critical security / data-leak blocker
- P1 = production blocker
- P2 = core product professionalism
- P3 = business expansion module
- P4 = advanced / future module

## Known Issues / Blockers
- `SEC-006` tenant-isolation final sweep is **DONE** (2026-06-12). Continue monitoring on new modules.
- Role-aware dashboard replacement (original dashboard UX scope) is **DONE** via `DASH-001` (2026-06-12).

## Next Recommended Phase
- Phase 2 UI/UX foundation can start now (navigation, auth UX refinements, reusable tables/states, responsive polish).

| ID | Priority | Area | Task | Status | Files/Modules | Verification | Notes |
|---|---|---|---|---|---|---|---|
| SEC-001 | P0 | Security/Auth | Remove demo credentials from login | DONE | apps/web/app/(auth)/login/page.tsx | Manual UI check, web build | Removed public sign-up link; login shows invitation-only guidance with no displayed credentials. |
| SEC-002 | P0 | Security/Auth | Persistent hashed refresh tokens + rotation | DONE | apps/api/src/modules/auth/auth.service.ts, auth.controller.ts, prisma/schema.prisma | `npm run test` (api), `npm run typecheck`, `npm run build --workspace @maintainpro/api` | Added `RefreshToken` model + hashed token persistence, rotation, logout, logout-all. |
| SEC-003 | P0 | Security/Auth | Secure password reset token flow | DONE | auth.service.ts, auth.module.ts, prisma/schema.prisma | `npm run test --workspace @maintainpro/api`, `npm run typecheck`, `npm run lint`, `npm run build --workspace @maintainpro/api` | Added hashed one-time reset tokens (15 min), generic response, email link dispatch, session revocation, audit log. Follow-up: web `/reset-password` page is still missing. |
| SEC-004 | P0 | Security/Auth | Per-endpoint throttling + lockout | DONE | auth.controller.ts, invitations.controller.ts, auth.service.ts, prisma/schema.prisma | `npm run test --workspace @maintainpro/api`, `npm run typecheck`, `npm run lint`, `npm run build --workspace @maintainpro/api` | Added per-endpoint throttles (auth + invitation creation) and 15-min lockout after 5 failed logins with reset on successful login. |
| SEC-005 | P1 | Security/Auth | Gate public self-registration | DONE | auth.service.ts, env.validation.ts, auth-register.spec.ts | `npm run test --workspace @maintainpro/api`, `npm run typecheck`, `npm run lint`, `npm run build --workspace @maintainpro/api` | Added production-safe registration gating: invitation-only by default; prod requires explicit second opt-in (`ALLOW_PUBLIC_REGISTRATION_IN_PRODUCTION=true`). |
| SEC-006 | P0 | Security/Tenancy | Full tenant isolation audit/fix | DONE | vehicles, work-orders, fleet, notifications + existing modules | `npm run test --workspace @maintainpro/api`, isolation tests | Final sweep closed 5 high-risk gaps; SUPER_ADMIN cross-tenant access is explicit via null tenant or X-Tenant-Id header. |
| SEC-007 | P0 | Security/Tenancy | Fix Utilities meters tenant leak | DONE | utilities.service.ts | `npm run test --workspace @maintainpro/api` (`utilities-tenant-isolation.spec.ts`) | Added tenant filter to bill-meter hydration query to avoid cross-tenant meter metadata joins. |
| SEC-008 | P0 | Security/Platform | Protect Swagger + readiness endpoints | DONE | apps/api/src/main.ts, bootstrap/readiness-guard.ts, bootstrap/swagger-guard.ts | `npm run test --workspace @maintainpro/api` (`readiness-guard.spec.ts`, `swagger-guard.spec.ts`) | Verified production protection: readiness requires admin JWT or API key; Swagger is prod opt-in and basic-auth protected. |
| SEC-009 | P0 | Security/Auth | Reject inactive users in login/jwt/refresh | DONE | auth.service.ts, jwt.strategy.ts | `npm run test --workspace @maintainpro/api` (`jwt-strategy.spec.ts`, auth suites) | Login, JWT validation, and refresh all block inactive users. |
| SEC-010 | P1 | Security/Web | Move refresh token to HttpOnly cookie + CSRF | DONE | web auth-storage/api-client, api auth | `npm run test --workspace @maintainpro/api`, `npm run typecheck`, `npm run lint`, `npm run build --workspace @maintainpro/api` | Refresh/logout cookie flows now require CSRF double-submit validation; web no longer stores refresh token in localStorage and performs cookie-based refresh with CSRF header. |
| SEC-011 | P0 | Security/Realtime | Authenticate websocket + tenant rooms | DONE | notifications.gateway.ts, fleet.gateway.ts, fleet.service.ts | `npm run test --workspace @maintainpro/api`, `npm run typecheck`, `npm run lint`, `npm run build --workspace @maintainpro/api` | Added JWT + active-user socket auth for notifications/fleet namespaces and tenant-scoped room routing to prevent cross-tenant event broadcasts. |
| SEC-012 | P1 | Security/Platform | Surface queue/redis failures in health | DONE | main.ts, health.service.ts, notifications queue/service, system health UI | `npm run test --workspace @maintainpro/api`, `npm run typecheck`, `npm run lint`, `npm run build --workspace @maintainpro/api` | Added QueueHealthService with Redis/queue status tracking, safe error surfacing, readiness integration, structured queue failure logging, and direct notification fallback when queue dispatch fails. |
| SEC-013 | P1 | Security/Config | Disable unsafe production mock behavior | DONE | env.validation.ts, billing/erp/notifications/health/system-health UI | `npm run test --workspace @maintainpro/api`, `npm run typecheck`, `npm run lint`, `npm run build --workspace @maintainpro/api` | Added explicit integration modes, production mock blocking, misconfigured/mock/disabled visibility in readiness + system health UI, and integration-mode validation tests. |
| WEB-001 | P1 | Web/Auth | Fix `/register` Suspense build blocker | DONE | apps/web/app/(auth)/register/page.tsx, register/register-form-card.tsx | `npm run build --workspace @maintainpro/web`, `npm run build`, `npm run typecheck`, `npm run lint`, `npm run test --workspace @maintainpro/api`, `npm run build --workspace @maintainpro/api` | Resolved Next.js prerender failure by moving `useSearchParams` to a client child wrapped in `<Suspense>` from a server page; invite-token registration behavior preserved. |
| UX-001 | P2 | UX/Brand | Standardize MaintainPro branding | DONE | lib/branding.ts, brand/auth components, auth pages, layout, manifest | Manual UI audit, `npm run build --workspace @maintainpro/web`, full build | Centralized MaintainPro product identity across auth pages, app metadata, and PWA manifest; legacy FMS labels removed from login marketing panel. |
| UX-002 | P2 | UX/Auth | Rebuild enterprise login page | DONE | apps/web/app/(auth)/login/page.tsx, auth components | Manual responsive test, web/full build | Professional enterprise login with accessible form, password toggle, invitation-only guidance, no public sign-up link or demo credentials. |
| UX-003 | P2 | UX/Auth | Change Username to Work Email behavior | DONE | login/page.tsx, lib/login-identifier.ts, e2e/auth.spec.ts | Manual UI test, web/full build, e2e auth | Email-only login aligned with backend `LoginDto`; removed silent production alias; optional dev alias via `NEXT_PUBLIC_LOGIN_DEV_LOCAL_ALIAS`. |
| UX-004 | P2 | UX/Nav | Role-based login redirect routing | DONE | login/page.tsx, register-form-card.tsx, lib/role-redirect.ts | Manual role test, web/full build, `role-redirect.spec.ts` | Centralized post-login role landing map; auth success no longer redirects to legacy `/home`. |
| UX-005 | P2 | UX/Routing | Clean up legacy `/home` default routing | DONE | splash, fms/home, maintenance redirect, maintenance-job shell | Manual QA, web/full build, role-redirect tests | Removed `/home` as default destination; retained legacy FMS workspace with archive labelling and dashboard CTA. |
| UX-006 | P2 | UX/Nav | Professional responsive role-aware navigation | DONE | lib/navigation.ts, layout/sidebar/topbar/mobile-nav | Manual responsive QA, web/full build, navigation.spec.ts | Centralized nav config with role visibility, mobile drawer, active states, MaintainPro branding. |
| UX-007 | P2 | UX/Nav | Breadcrumbs on deep pages | DONE | components/ui/breadcrumbs.tsx, lib/breadcrumbs.ts, high-impact pages | Manual UI test, breadcrumbs.spec.ts | Reusable Breadcrumbs + route helper; rolled out to work orders, assets, inventory, procurement, fleet, vehicles, reports, system health. |
| UX-008 | P2 | UX/Nav | Global command palette | DONE | lib/command-palette.ts, command-palette UI, global-command-palette, topbar/layout | Manual keyboard QA, command-palette.spec.ts, web/full build | Role-aware navigation-only palette (Ctrl/Cmd+K + topbar trigger); reuses UX-006 nav visibility; no backend search or mutating commands. |
| UX-009 | P2 | UX/Tables | Reusable data-table + rollout | DONE | components/ui/data-table.tsx, work-orders/inventory/procurement tables | Manual table QA, web/full build, data-table.spec.ts | Shared DataTable baseline with mobile cards; rolled out to Work Orders, Inventory, Procurement. Assets follow-up tracked as UX-009B. |
| UX-009B | P2 | UX/Tables | Migrate Assets table to DataTable baseline | DONE | components/assets/assets-table.tsx, assets-management-page.tsx | Manual Assets table QA, web/full build, assets-table.spec.ts | Partial migration: shared DataTable + mobile cards; column picker, server pagination, row actions, inline status prompts, selection preserved. Motion row animations simplified. |
| UX-010 | P2 | UX/Dialogs | Replace window.prompt/confirm/alert | DONE | components/ui/confirm-dialog.tsx, prompt-dialog.tsx, use-*-dialog hooks, high-impact pages | Grep + manual UI test, dialog-validation.spec.ts | Professional ConfirmDialog/PromptDialog + Sonner toasts; all 10 native dialog usages replaced across 7 files. |
| UX-011 | P2 | UX/States | Standard loading/error/empty/success states | DONE | components/ui/page-state.tsx, core list pages | Manual route QA, web/full build, page-state.spec.ts | Reusable page states applied to dashboard, work orders, inventory, procurement, system health, assets, reports. |
| UX-012 | P2 | UX/Mobile | Mobile responsiveness + PWA improvements | DONE | layout, data-table, assets-table, auth pages, manifest/pwa-metadata | Manual device QA, mobile-pwa.spec.ts, web/full build | Mobile card overflow/action polish, Assets row menu bottom sheet on small screens, touch targets, viewport/PWA metadata alignment, breadcrumb/dialog/toast mobile safety. |
| UX-013 | P2 | UX/A11y | WCAG 2.1 AA improvements | DONE | auth/layout/nav/data-table/dialogs/page-state | Manual a11y QA, accessibility.spec.ts, web/full build | Core shell ARIA semantics: nav aria-current/expanded, breadcrumb labels, table scope/sort/keyboard rows, dialog validation links, auth form labels/status. |
| UX-014 | P2 | UX/Locale | Sri Lanka localization readiness | DONE | lib/localization.ts, lib/ui-copy.ts, inventory/work-orders/reports/procurement/assets/dashboard rollout | Manual locale QA, localization.spec.ts, web/full build | en-LK/Asia/Colombo/LKR formatting helpers; English UI default; limited high-impact rollout; no full translation or backend changes. |
| DASH-001 | P2 | UX/Dashboard | Role-aware dashboard content | DONE | lib/dashboard-roles.ts, components/dashboard/*, dashboard/page.tsx | Manual role QA, dashboard-roles.spec.ts, web/full build | Role-specific dashboard composition using existing APIs only; no backend changes or fake metrics. |
| ADMIN-001 | P2 | Admin | Dedicated /admin console | DONE | app/(dashboard)/admin, lib/admin-console.ts, navigation/command palette | Manual admin RBAC QA, admin-console.spec.ts, web/full build | Read-only admin foundation with section placeholders; ADMIN/SUPER_ADMIN nav visibility; no user/tenant/RBAC mutations. |
| ADMIN-002A | P2 | Admin | Read-only Users & Access view | DONE | admin/users route, GET /admin/users, admin-users UI | Manual admin users QA, admin-users*.spec.ts, web/full build | Sanitized read-only user list; ADMIN tenant-scoped; SUPER_ADMIN cross-tenant; no mutations. |
| ADMIN-002B | P2 | Admin | Safe deactivate/reactivate user flow | DONE | PATCH /admin/users/:id/status, admin users UI actions | Manual status QA, admin-users-status.spec.ts, web/full build | Status-only mutation with RBAC, tenant scope, self/super-admin protections; sanitized DTO; ConfirmDialog UX. |
| ADMIN-002C | P2 | Admin | Harden legacy user management paths | DONE | users.service.ts, PATCH /users/:id/status, GET /users DTO | Manual settings/admin QA, users-legacy-hardening.spec.ts, web/full build | Shared status protections; PublicUserResponse allowlist; legacy paths aligned with ADMIN-002B. |
| ADMIN-003A | P2 | Admin | Read-only tenant admin workspace | DONE | GET /admin/tenants, /admin/tenants UI | Manual tenant QA, admin-tenants*.spec.ts, web/full build | SUPER_ADMIN cross-tenant list; ADMIN own-tenant profile; sanitized DTO; no mutations. |
| ADMIN-003B | P2 | Admin | Read-only invitation review | DONE | GET /admin/invitations, /admin/invitations UI | Manual invitation QA, admin-invitations*.spec.ts, web/full build | TenantInvitation review; token excluded; ADMIN tenant-scoped; no mutations. |
| ADMIN-003C | P2 | Admin | Harden legacy invitation list responses | DONE | GET /tenants/:id/invitations DTO | Manual settings/billing QA, invitations-legacy-hardening.spec.ts, web/full build | Strip tokens from legacy list; preserve create mutation link behavior. |
| ADMIN-003D | P2 | Admin | Controlled invitation create + POST hardening | DONE | POST /admin/invitations, admin create UI | Manual invitation create QA, admin-invitations-create.spec.ts, web/full build | Token-free create DTO; one-time invitationLink panel; ADMIN tenant-scoped. |
| ADMIN-004A | P2 | Admin | Read-only roles & permissions matrix | DONE | GET /admin/roles-permissions, /admin/roles UI | Manual roles matrix QA, admin-roles*.spec.ts, web/full build | Global permission catalog + tenant-scoped roles; coverage matrix; no mutations. |
| ADMIN-004B | P2 | Admin | Harden legacy role/permission read responses | DONE | roles.service.ts, GET /roles, GET /roles/permissions | Manual settings/admin QA, roles-legacy-hardening.spec.ts, web/full build | PublicRoleResponse/PublicPermissionResponse allowlists; Settings-compatible summaries. |
| BUILD-001 | P2 | Facility | Building/facility module planning | DONE | docs/BUILDING_FACILITY_MODULE_PLAN.md | Plan review, no runtime changes | Audit complete; reuse vs new-build documented; BUILD-002 next. |
| BUILD-002 | P2 | Facility | Schema foundation + facility roles seed | DONE | prisma/schema, roles seed | Schema + RBAC tests, prisma validate | Property/Building/Floor/Room models; FACILITY_MANAGER/BUILDING_SUPERVISOR in RoleName. |
| SMART-OPS-001 | P2 | Smart Ops | Product excellence sprint — Action Center + briefing + QR/evidence foundations | DONE | action-center, morning-briefing, qr-readiness, evidence-timeline, docs | Manual role QA, action-center.spec.ts, qr-readiness.spec.ts, web/full build, API tests | Role-aware Action Center from existing APIs; no fake metrics; facility post-login route fix. |
| BUILD-003 | P2 | Facility | Facility hierarchy API module | DONE | facility module, GET/POST /facilities/* | Tenant isolation tests, web/full build | Hierarchy CRUD only; no issue/WO bridge yet. |
| BUILD-004 | P2 | Facility | Facility hierarchy web UI | DONE | `/facilities`, facilities-api, navigation | Manual UI QA, facilities-web-config.spec.ts, web/full build | Hierarchy browser; FacilityIssue migration deferred to BUILD-005. |
| BUILD-005 | P2 | Facility | FacilityIssue migration foundation | DONE | FacilityIssue schema, cleaning issue API | facility-issues-room-link.spec.ts, prisma validate, API tests | Nullable roomId + category; IssueSeverity reused; CleaningLocation preserved. |
| BUILD-006 | P2 | Facility | Issue reporting UI + room selector | DONE | cleaning/issues UI, facility-issue-ui.ts | Manual UI QA, facility-issue-ui.spec.ts, web/full build | Optional room/category; legacy location preserved. |
| BUILD-007 | P2 | Facility | Issue → Work Order bridge | DONE | facility issues, WO module | facility-issue-work-order-bridge.spec.ts, API/web/full build | Nullable `workOrderId` on FacilityIssue; bridge via WorkOrdersService.create; duplicate blocked. |
| BUILD-008 | P2 | Facility | Authenticated QR issue reporting | DONE | qr-readiness, facilities hierarchy | qr-issue-reporting.spec.ts, web/full build | `/qr/report-issue` route; room QR links in `/facilities`; public scan deferred. |
| BUILD-009 | P2 | Facility | Facility dashboard + reporting | DONE | facilities dashboard API, `/facilities/reports` | facility-dashboard.spec.ts, web/full build | Real tenant-scoped KPIs; overdue from `slaTargetAt`; no fake metrics. |
| BUILD-010 | P2 | Facility | CleaningLocation → Room backfill tooling | DONE | backfill matcher + CLI script | facility-location-backfill.spec.ts | Dry-run default; apply requires `ALLOW_FACILITY_BACKFILL_APPLY=true` + `--apply`. |
| OPS-002 | P2 | Smart Ops | SLA/aging heatmap | DONE | `/facilities/reports/aging`, aging API | facility-aging.spec.ts, web/full build | Real issue/WO aging buckets; overdue from `slaTargetAt`; no fake metrics. |
| OPS-003 | P2 | Smart Ops | Duplicate issue detection | DONE | duplicate-check API + issue/QR UI warnings | duplicate-facility-issues.spec.ts, facility-issue-duplicates.spec.ts | Advisory only; deterministic local matching; no auto-merge/block. |
| NOTIFY-001 | P2 | Notifications | Email/SMS production setup foundation | DONE | notification readiness + templates | notification-readiness.spec.ts | Readiness only; no real send; docs/NOTIFICATION_PROVIDER_SETUP.md. |
| ERP-001 | P3 | ERP | ERP inventory integration foundation | DONE | InventoryErpAdapter + readiness | erp-inventory-adapter.spec.ts | Disabled/no-op adapter; no live HTTP; docs/ERP_INVENTORY_INTEGRATION_PLAN.md. |
| DEPLOY-001 | P1 | Platform | Production deployment readiness package | DONE | deployment readiness service + checklist | deployment-readiness.spec.ts | Honest checklist/helper only; no deploy automation. |
| ADMIN-002 | P2 | Admin | Full user management | NOT_STARTED | users/admin modules + UI | Manual CRUD | |
| ADMIN-003 | P2 | Admin | Tenant invitation UI | NOT_STARTED | invitations module + UI | Manual invite flow | |
| ADMIN-004 | P2 | Admin | Role/permission matrix | NOT_STARTED | roles/permissions UI + API | Manual permission tests | |
| ADMIN-005 | P2 | Admin | Tenant-aware RBAC | NOT_STARTED | tenancy/membership/rbac | Multi-tenant tests | |
| ADMIN-006 | P2 | Admin | Operational roles support | NOT_STARTED | RoleName/rbac | Role mapping test | |
| ADMIN-007 | P2 | Admin | Approval authority levels | NOT_STARTED | approvals/budgets | Approval workflow test | |
| ADMIN-008 | P2 | Admin | Feature flags per tenant | NOT_STARTED | entitlements/settings | Manual toggle test | |
| ADMIN-009 | P2 | Admin | System health dashboard | NOT_STARTED | health endpoints + admin UI | Manual integration checks | |
| WO-001 | P2 | Work Orders | Full lifecycle workflow | NOT_STARTED | work-orders module + UI | E2E manual test | |
| WO-002 | P2 | Work Orders | Extend statuses/fields + transition rules | NOT_STARTED | prisma/schema.prisma, work-orders service | API + validation tests | |
| WO-003 | P2 | Work Orders | Professional detail page | NOT_STARTED | work-order UI pages/components | Manual UI test | |
| WO-004 | P2 | Work Orders | SLA engine | NOT_STARTED | work-orders module | SLA tests | |
| WO-005 | P2 | Work Orders | Smart technician assignment | NOT_STARTED | work-orders module | Assignment tests | |
| WO-006 | P2 | Work Orders | Time tracking | NOT_STARTED | work-orders module/UI | Manual workflow test | |
| WO-007 | P2 | Work Orders | Parts usage integration | NOT_STARTED | work-orders + inventory | Inventory deduction tests | |
| WO-008 | P2 | Work Orders | Cost tracking | NOT_STARTED | work-orders + budgeting | Cost calculation tests | |
| WO-009 | P2 | Work Orders | Supervisor verification stage | NOT_STARTED | work-orders | Role workflow test | |
| WO-010 | P2 | Work Orders | Requester confirmation + reopen | NOT_STARTED | work-orders/requester | Manual workflow test | |
| WO-011 | P2 | Work Orders | Work order activity timeline model | NOT_STARTED | prisma + work-orders | API tests | |
| REQ-INTAKE | P2 | Facility Requests | Repair request intake field set/categories | NOT_STARTED | facility issue models/UI | Manual submit test | |
| FAC-001 | P3 | Facility | Property->Building->Floor->Room->Asset hierarchy | NOT_STARTED | prisma/schema + facility modules | Schema + API tests | |
| FAC-002 | P3 | Facility | Building master data | NOT_STARTED | facility API/UI | Manual CRUD | |
| FAC-003 | P3 | Facility | Floor/zone/room management | NOT_STARTED | facility API/UI | Manual CRUD | |
| FAC-004 | P3 | Facility | Building asset register categories | NOT_STARTED | facility API/UI | Manual CRUD | |
| FAC-005 | P3 | Facility | Building asset detailed fields | NOT_STARTED | facility API/UI | Manual CRUD | |
| FAC-006 | P3 | Facility | Public repair request portal | NOT_STARTED | public routes + API | Manual submit/track | |
| FAC-007 | P3 | Facility | Issue categories | NOT_STARTED | facility issue schema/API | Schema/API tests | |
| FAC-008 | P3 | Facility | Building repair workflow | NOT_STARTED | facility + work-orders | E2E workflow test | |
| FAC-009 | P3 | Facility | Building dashboard KPIs | NOT_STARTED | facility dashboard UI/API | Manual KPI validation | |
| FAC-010 | P3 | Facility | Building reports | NOT_STARTED | reports module + UI | Manual report checks | |
| PM-001 | P3 | PM | PM plans | NOT_STARTED | maintenance module | Manual + API tests | |
| PM-002 | P3 | PM | PM schedule config | NOT_STARTED | maintenance module/UI | Manual CRUD | |
| PM-003 | P3 | PM | PM auto-scheduler cron | NOT_STARTED | maintenance scheduler | Cron verification | |
| PM-004 | P3 | PM | PM calendar view | NOT_STARTED | web PM UI | Manual UI test | |
| PM-005 | P3 | PM | PM compliance reports | NOT_STARTED | reports module | Manual report checks | |
| CLN-001 | P3 | Cleaning | Cleaning area setup | NOT_STARTED | cleaning module/UI | Manual CRUD | |
| CLN-002 | P3 | Cleaning | Checklist template builder API/UI | NOT_STARTED | cleaning template model/service/UI | Manual workflow test | |
| CLN-003 | P3 | Cleaning | Cleaning schedules | NOT_STARTED | cleaning module/UI | Manual schedule test | |
| CLN-004 | P3 | Cleaning | Cleaner workflow | NOT_STARTED | cleaning mobile/web | Manual E2E | |
| CLN-005 | P3 | Cleaning | Supervisor verification | NOT_STARTED | cleaning service/UI | Manual approval flow | |
| CLN-006 | P3 | Cleaning | Cleaning alerts/reports | NOT_STARTED | cleaning analytics + notifications | Manual alert/report check | |
| UTL-001 | P3 | Utilities | Extend meter types | NOT_STARTED | UtilityType enum + API/UI | Schema/API tests | |
| UTL-002 | P3 | Utilities | Meter reading enhancements | NOT_STARTED | meter models/services/UI | Manual + API tests | |
| UTL-003 | P3 | Utilities | Utility bill tracking + overdue cron | NOT_STARTED | utility bill services/UI | Cron + manual checks | |
| UTL-004 | P3 | Utilities | Utility anomaly detection | NOT_STARTED | utilities + notifications + facility issue | Rules test | |
| UTL-005 | P3 | Utilities | Utility reports | NOT_STARTED | reports module | Manual report checks | |
| INV-001 | P3 | Inventory | Item master + PartCategory | NOT_STARTED | inventory schema/API/UI | Schema/API tests | |
| INV-002 | P3 | Inventory | Stock control improvements | NOT_STARTED | stock models/services/UI | Manual stock tests | |
| INV-003 | P3 | Inventory | Parts issue to work order | NOT_STARTED | inventory + work-orders | E2E workflow test | |
| INV-004 | P3 | Procurement | Procurement workflow | NOT_STARTED | procurement models/services/UI | E2E workflow test | |
| INV-005 | P3 | Procurement | RFQ/Quotation/GRN entities + PO tax/currency | NOT_STARTED | procurement schema/services | Schema/API tests | |
| INV-006 | P3 | Inventory | Inventory/procurement reports | NOT_STARTED | reports module | Manual report checks | |
| VEN-001 | P3 | Vendor | Vendor master + vendor models | NOT_STARTED | vendor schema/services | Schema/API tests | |
| VEN-002 | P3 | Vendor | Vendor portal route group/auth | NOT_STARTED | apps/web/app/(vendor), vendor auth | Manual portal tests | |
| VEN-003 | P3 | Vendor | Vendor job workflow | NOT_STARTED | vendor + work-orders | E2E workflow test | |
| VEN-004 | P3 | Vendor | Vendor performance | NOT_STARTED | vendor analytics/UI | Manual KPI checks | |
| BUD-001 | P3 | Budgeting | Budget/BudgetLine/CostEntry models | NOT_STARTED | budgeting schema/services/UI | Schema/API tests | |
| BUD-002 | P3 | Budgeting | Cost centers | NOT_STARTED | budgeting models/UI | Manual checks | |
| BUD-003 | P3 | Budgeting | Budget vs actual | NOT_STARTED | budgeting module/UI | Manual calculations | |
| BUD-004 | P3 | Budgeting | Approval limits | NOT_STARTED | budgeting/approval module | Approval tests | |
| BUD-005 | P3 | Budgeting | Budget alerts/reports | NOT_STARTED | budgeting reports + alerts | Manual + cron checks | |
| SAFE-001 | P3 | Compliance/Safety | Inspection models | NOT_STARTED | compliance schema/services | Schema/API tests | |
| SAFE-002 | P3 | Compliance/Safety | Checklist builder | NOT_STARTED | compliance UI/API | Manual checks | |
| SAFE-003 | P3 | Compliance/Safety | Failed inspection => corrective WO | NOT_STARTED | compliance + work-orders | E2E test | |
| SAFE-004 | P3 | Compliance/Safety | Permit-to-work workflow | NOT_STARTED | permit models/services/UI | Manual checks | |
| SAFE-005 | P3 | Compliance/Safety | Certificate expiry + safety logs | NOT_STARTED | compliance scheduler/models | Cron tests | |
| DOC-001 | P3 | Documents | File upload service (R2/S3) | NOT_STARTED | common/services/file-upload.service.ts | Upload integration test | |
| DOC-002 | P3 | Documents | Upload validation + endpoint + web uploader | NOT_STARTED | files endpoint + ui file-upload | Manual upload tests | |
| DOC-003 | P3 | Documents | Document categories | NOT_STARTED | document schema/UI | Manual checks | |
| DOC-004 | P3 | Documents | Document/Version/Link models | NOT_STARTED | prisma + docs module | Schema/API tests | |
| DOC-005 | P3 | Documents | Document lifecycle + pages | NOT_STARTED | docs module + web routes | Manual workflow test | |
| REP-001 | P3 | Reports | Operations command dashboard | NOT_STARTED | reports module/UI | Manual KPI checks | |
| REP-002 | P3 | Reports | Executive dashboard | NOT_STARTED | reports module/UI | Manual KPI checks | |
| REP-003 | P3 | Reports | KPI drill-down | NOT_STARTED | dashboards + list pages | Manual navigation test | |
| REP-004 | P3 | Reports | Branded exports PDF/XLSX | NOT_STARTED | reports export services | Export verification | |
| REP-005 | P3 | Reports | Scheduled report delivery | NOT_STARTED | scheduler + notifications | Cron/email checks | |
| REP-006 | P3 | Reports | Queue-based heavy report generation | NOT_STARTED | reports + Bull queue | Job processing checks | |
| REP-007 | P3 | Reports | Power BI export endpoints + analytics pages | NOT_STARTED | reports API + analytics UI | API/manual checks | |
| MOB-001 | P4 | Mobile | Align Flutter endpoints/contracts | NOT_STARTED | apps/mobile/lib + api | Manual mobile API tests | |
| MOB-002 | P4 | Mobile | Technician mobile screens | NOT_STARTED | mobile work orders | Manual device test | |
| MOB-003 | P4 | Mobile | Cleaner mobile screens | NOT_STARTED | mobile cleaning | Manual device test | |
| MOB-004 | P4 | Mobile | Requester mobile screens | NOT_STARTED | mobile requester routes | Manual device test | |
| MOB-005 | P4 | Mobile | Offline-first synchronization | NOT_STARTED | mobile offline core | Offline sync test | |
| MOB-006 | P4 | Mobile | Push routing + device token model | NOT_STARTED | notifications + mobile push | Push test | |
| REQ-001 | P4 | Requester | Requester dashboard | NOT_STARTED | apps/web/app/(requester) | Manual UI test | |
| REQ-002 | P4 | Requester | Submit request flow | NOT_STARTED | requester UI/API | Manual submit test | |
| REQ-003 | P4 | Requester | QR reporting flow | NOT_STARTED | requester + qr workflow | Manual QR test | |
| REQ-004 | P4 | Requester | Track/confirm/reopen/rate with privacy | NOT_STARTED | requester UI/API | Manual workflow test | |
| AI-001 | P4 | Predictive/AI | Audit predictive-ai module + disabled handling | NOT_STARTED | predictive-ai module, UI | Manual + config test | |
| AI-002 | P4 | Predictive/AI | Rule engine cron (R1-R6) | NOT_STARTED | predictive scheduler/services | Rule verification | |
| AI-003 | P4 | Predictive/AI | High-cost asset detection | NOT_STARTED | predictive services | API tests | |
| AI-004 | P4 | Predictive/AI | Asset criticality score | NOT_STARTED | predictive services | API tests | |
| AI-005 | P4 | Predictive/AI | Replacement recommendation | NOT_STARTED | predictive services/UI | Manual + API tests | |
| AI-006 | P4 | Predictive/AI | Inventory demand prediction | NOT_STARTED | predictive + inventory | API tests | |
| AI-007 | P4 | Predictive/AI | Predictive dashboard | NOT_STARTED | predictive UI | Manual checks | |
| AI-008 | P4 | Predictive/AI | AI Copilot integration | NOT_STARTED | copilot module/UI | Manual + safety checks | |
| FARM-001 | P4 | Farm | Decide retain/feature-flag farm module | NOT_STARTED | farm API/UI + entitlements | Product decision + QA | |
| FARM-002 | P4 | Farm | If retained, extend farm UI/features | NOT_STARTED | farm pages/services | Manual module QA | |
| PERF-001 | P2 | Performance | Profile/fix slow login | NOT_STARTED | auth + DB | Timed benchmark | |
| PERF-002 | P2 | Performance | Readiness/Swagger timeout improvements | NOT_STARTED | main.ts, health/readiness | Timed benchmark | |
| PERF-003 | P2 | Performance | Caching for dashboards/master data | NOT_STARTED | services + redis | Cache hit tests | |
| PERF-004 | P2 | Performance | Pagination on heavy endpoints | NOT_STARTED | multiple modules | API pagination tests | |
| PERF-005 | P2 | Performance | Server-side dashboard aggregation | NOT_STARTED | backend dashboard services | API payload/perf checks | |
| PERF-006 | P2 | Performance | Frontend lazy loading & fetch optimization | NOT_STARTED | apps/web | Lighthouse/manual checks | |
| PERF-007 | P2 | DevOps | CI/CD workflows | NOT_STARTED | .github/workflows | CI run checks | |
| PRO-001 | P4 | Professional | Global audit trail coverage | NOT_STARTED | all critical services | Audit verification | |
| PRO-002 | P4 | Professional | Duplicate issue detection | NOT_STARTED | facility/work-order services | Manual + API tests | |
| PRO-003 | P4 | Professional | Root-cause analysis workflow | NOT_STARTED | work-orders schema/UI | Manual workflow test | |
| PRO-004 | P4 | Professional | Emergency mode + escalation tree | NOT_STARTED | new module | Manual workflow test | |
| PRO-005 | P4 | Professional | Digital signatures | NOT_STARTED | workflow modules/UI | Manual signature flow | |
| PRO-006 | P4 | Professional | Data retention/legal hold | NOT_STARTED | audit/log/doc modules | Policy verification | |
| PRO-007 | P4 | Professional | Backup/DR operationalization | NOT_STARTED | db backup/health/docs | Restore drill | |
| PRO-008 | P4 | Professional | Localization EN/SI/TA readiness | NOT_STARTED | frontend/mobile i18n | Manual locale checks | |
| PRO-009 | P4 | Professional | Dark mode | NOT_STARTED | Tailwind/theme layer | Manual UI checks | |
| PRO-010 | P4 | Professional | Knowledge base structure | NOT_STARTED | docs module/UI | Manual content workflow | |
| PRO-011 | P4 | Professional | Soft delete on major entities | NOT_STARTED | schema/services | Schema/API tests | |
| PRO-012 | P4 | Professional | Global search API endpoint | NOT_STARTED | search API + UI consumers | API + permission tests | |
