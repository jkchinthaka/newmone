# MaintainPro Production Readiness TODO

## Status Legend
NOT_STARTED | IN_PROGRESS | BLOCKED | DONE | VERIFIED | NEEDS_REVIEW | DEFERRED

## Priority Legend
- P0 = critical security / data-leak blocker
- P1 = production blocker
- P2 = core product professionalism
- P3 = business expansion module
- P4 = advanced / future module

## Audit baseline (2026-06-12)
This table was populated from a Phase 0 code audit (see chat for full report). Statuses
reflect what exists TODAY. Several premises in the original task brief do not match the
current codebase and are flagged with `** DISCREPANCY **` in Notes — see audit summary.

---

## Phase 1 — Security & Production Blockers (P0/P1)

| ID | Priority | Area | Task | Status | Files/Modules | Verification | Notes |
|---|---|---|---|---|---|---|---|
| SEC-001 | P0 | Auth UI | Remove public demo credentials from login page | VERIFIED | apps/web/app/(auth)/login/page.tsx | grep audit of login/register pages and components for "demo"/hardcoded creds — none found | Confirmed: login page has no hardcoded credentials, demo banners, or autofill values; only links to /register and /forgot-password. No code change needed. |
| SEC-002 | P0 | Auth | Fix in-memory refresh token storage (Prisma RefreshToken model, hashed, rotation) | NOT_STARTED | apps/api/src/modules/auth/auth.service.ts:18-19, prisma/schema.prisma | jest + manual refresh/logout test | Confirmed `refreshTokenStore = new Map(...)` |
| SEC-003 | P0 | Auth | Secure password reset (PasswordResetToken model, hashed, 15-min expiry, no leakage) | NOT_STARTED | auth.service.ts:230-247, prisma/schema.prisma | jest + manual reset flow | **CRITICAL**: raw token currently returned in API response (line 244), no email sent |
| SEC-004 | P0 | Auth | Per-endpoint @Throttle on login/register/forgot-password/refresh/invitations | NOT_STARTED | auth.controller.ts, invitations module | manual brute-force test | Only global 100req/60s throttle exists; no per-endpoint limits |
| SEC-005 | P1 | Auth | Gate public self-registration behind AppSetting ALLOW_PUBLIC_REGISTRATION (default false) | NOT_STARTED | auth.controller.ts:21-27, auth.service.ts:70-74, AppSetting | manual register attempt | Confirmed open, hardcodes TECHNICIAN role |
| SEC-006 | P0 | Tenancy | Audit all findMany/findFirst/update/delete across modules for tenantId scoping | NOT_STARTED | apps/api/src/modules/** | grep audit + tenant isolation tests | Broad task; SEC-007 is one concrete instance found |
| SEC-007 | P0 | Tenancy | Fix UtilitiesService tenant leak (meters, meter, allReadings, bills, etc.) | DONE | apps/api/src/modules/utilities/{utilities.service.ts,utilities.controller.ts}, test/utilities-tenant-isolation.spec.ts | jest test/utilities-tenant-isolation.spec.ts (8/8 pass) + tsc --noEmit pass | Fixed all 9 service methods (meters/meter/createMeter/updateMeter/addReading/readings/allReadings/consumptionChart/bills/createBill/bill/payBill/overdue/analytics) to scope by tenantId; controller now passes req.user.tenantId |
| SEC-008 | P0 | Backend | Protect Swagger (/api/docs) by NODE_ENV/auth; gate detailed /health/readiness | DONE | apps/api/src/main.ts, src/bootstrap/{readiness-guard,swagger-guard}.ts, src/config/env.validation.ts, test/{readiness-guard,swagger-guard}.spec.ts | jest test/readiness-guard.spec.ts test/swagger-guard.spec.ts (20/20 pass) + tsc --noEmit pass | Swagger now off by default in prod (opt-in via SWAGGER_ENABLED + Basic Auth via SWAGGER_USER/SWAGGER_PASSWORD); /health & / stay public+minimal (getPublicHealth already minimal); /health/readiness now requires ADMIN/SUPER_ADMIN bearer token or X-Readiness-Key==READINESS_API_KEY in prod |
| SEC-009 | P0 | Auth | Reject inactive users in jwt.strategy.ts validate() | DONE | apps/api/src/modules/auth/jwt.strategy.ts, test/jwt-strategy.spec.ts | jest test/jwt-strategy.spec.ts (3/3 pass) + tsc --noEmit pass | validate() now loads user by id, throws UnauthorizedException if missing/inactive |
| SEC-010 | P1 | Frontend Auth | Move refresh token to HttpOnly cookie, wire to existing setAuthCookies | NOT_STARTED | apps/web/lib/auth-storage.ts, api-client.ts; auth.controller.ts:104-130 | manual login/refresh + XSS review | setAuthCookies() already implemented backend-side, unused by frontend |
| SEC-011 | P0 | Realtime | Authenticate WebSocket gateways + tenant rooms | NOT_STARTED | notifications.gateway.ts, fleet.gateway.ts | manual: cross-tenant socket test | NotificationsGateway already JWT-auths (partial); **FleetGateway has NO auth and broadcasts globally — new critical finding** |
| SEC-012 | P1 | Backend | Surface Redis/Bull queue health in Admin > System Health | NOT_STARTED | apps/api/src/main.ts, system-health page | manual: stop redis, check admin UI | main.ts already logs warnings gracefully (not silent); needs UI surfacing |
| SEC-013 | P1 | Backend | Explicit flags for ERP mock / push-noop / SMS-noop in production + ALLOW_PUBLIC_REGISTRATION env | NOT_STARTED | env.validation.ts | manual: prod env validation | ERP_SYNC_PROVIDER, PUSH_PROVIDER_ENABLED, SMS_ENABLED already exist; ALLOW_PUBLIC_REGISTRATION missing |

## Phase 2 — Branding, Login, Navigation, UI/UX Foundation (P2)

| ID | Priority | Area | Task | Status | Files/Modules | Verification | Notes |
|---|---|---|---|---|---|---|---|
| UX-001 | P2 | Branding | Standardize "MaintainPro — Enterprise Maintenance & Facility Operations Platform" branding everywhere | NOT_STARTED | login, layout, manifest, mobile pubspec, emails | manual scan | PWA manifest & mobile pubspec already say "MaintainPro" ✅; login heading says "Login"/"Maintenance Job workspace" — needs fix |
| UX-002 | P2 | Login | Rebuild login page (split brand/form layout, enterprise grade) | NOT_STARTED | apps/web/app/(auth)/login/page.tsx | manual UI + responsive check | |
| UX-003 | P2 | Login | Fix "Username" field confusion / silent @maintainpro.local append | NOT_STARTED | login/page.tsx:15-18 | manual UI check | Confirmed `normalizeLogin()` appends domain silently |
| UX-004 | P2 | Routing | Role-based post-login routing (remove /home legacy default) | NOT_STARTED | login/page.tsx:68, role→route map | manual login per role | Confirmed redirects to `/home` (legacy FMS, exists under (fms) route group) |
| UX-005 | P2 | Dashboard | Role-aware dashboards (replace Driver-Intelligence-only dashboard) | NOT_STARTED | apps/web/app/(dashboard)/dashboard/page.tsx | manual per-role check | Confirmed dashboard is 100% driver-intelligence today, USD hardcoded in formatCurrency (line 57) |
| UX-006 | P2 | Navigation | Role/permission-aware responsive sidebar (desktop/tablet/mobile drawer) | NOT_STARTED | components/layout/sidebar.tsx | manual responsive + role check | Confirmed sidebar is desktop-only (`xl:block`), static, not role-aware, ~35 items unfiltered |
| UX-007 | P2 | Navigation | Breadcrumbs on deep pages | NOT_STARTED | new component + page integration | manual UI check | None exist today |
| UX-008 | P2 | Navigation | Global command palette (Ctrl+K) | NOT_STARTED | new component | manual UI check | None exist today |
| UX-009 | P2 | Tables | Reusable data-table component + apply across all list pages | NOT_STARTED | new components/ui/data-table.tsx + ~12 modules | manual per-module check | No generic table exists; each module has bespoke table |
| UX-010 | P2 | UI states | Replace window.prompt/confirm/alert with modals/dialogs | NOT_STARTED | 10 confirmed call sites (see audit) | manual UI check | Sites: job-codes, departments, notifications(x2), vehicles(x2), vehicle documents(x2), work-orders-page(x2) |
| UX-011 | P2 | UI states | Build EmptyState/ErrorState/LoadingSkeleton/PageHeader/ConfirmDialog/DetailDrawer/FilterBar/MobileCardList + loading/error/not-found per route | NOT_STARTED | components/ui/* | manual per-page check | Only partial StatePanel exists (reports only) |
| UX-012 | P2 | Mobile | Mobile responsiveness (tables→cards, drawer nav, touch targets, PWA offline cache) | NOT_STARTED | sidebar, tables, sw.js | manual device/responsive test | sw.js + manifest exist; sidebar/tables not mobile-ready |
| UX-013 | P2 | A11y | WCAG 2.1 AA pass (ARIA, keyboard nav, focus trap, contrast) | NOT_STARTED | global | manual a11y audit | |
| UX-014 | P2 | i18n/locale | Sri Lanka localization readiness (DD/MM/YYYY, LKR, Asia/Colombo, EN/SI/TA scaffolding) | NOT_STARTED | global formatters | manual check | Money fields are Float (see SCHEMA-001); CropCycle already uses *Lkr field naming convention |

## Phase 3 — Admin Console & RBAC (P2)

| ID | Priority | Area | Task | Status | Files/Modules | Verification | Notes |
|---|---|---|---|---|---|---|---|
| ADMIN-001 | P2 | Admin | Dedicated /admin console (SUPER_ADMIN/ADMIN only) | NOT_STARTED | apps/web/app/(admin)/ (new) | manual: role-gated access | No /admin route group exists; `/master-data`, `/system-health`, `/settings` are scattered |
| ADMIN-002 | P2 | Admin | User management (invite, bulk import, sessions, audit timeline) | NOT_STARTED | users module + UI | manual CRUD test | `users` module exists in API; UI scope TBD |
| ADMIN-003 | P2 | Admin | Invitation system UI on top of TenantInvitation model | NOT_STARTED | invitations module (API exists) + new UI | manual invite flow | TenantInvitation model + `invitations` API module confirmed to exist; no UI found |
| ADMIN-004 | P2 | Admin | Role/permission matrix UI | NOT_STARTED | roles module + new UI | manual matrix edit | `roles`/Permission/RoleName exist (17 roles); PermissionsGuard + COMPATIBLE_PERMISSION_ALIASES exist backend-side |
| ADMIN-005 | P2 | Admin | Tenant-aware RBAC (per-tenant roles, dept/site scoping) | NOT_STARTED | TenantMembership, roles | manual multi-tenant test | TenantMembership + TenantMembershipRole enum exist |
| ADMIN-006 | P2 | Admin | Operational role set alignment (FACILITY_MANAGER, BUILDING_SUPERVISOR, CLEANER, etc.) | NOT_STARTED | RoleName enum, RolesGuard | schema + grep audit | Current RoleName enum is fleet/farm-oriented (FLEET_MANAGER, FARM_OWNER, AGRONOMIST, VETERINARIAN, etc.) — facility-ops roles from brief mostly absent |
| ADMIN-007 | P2 | Workflow | Approval authority levels by role/dept/cost-center | NOT_STARTED | new — depends on Budget/cost-center models (BUD-002) | manual approval test | PartRequestApproval/PurchaseOrderApproval exist as a pattern to extend |
| ADMIN-008 | P2 | Admin | Per-tenant feature flags (Fleet/Facility/Cleaning/Farm/Vendor/AI/etc.) | NOT_STARTED | Entitlement/AppSetting models + admin UI | manual toggle test | Entitlement (FEATURE/LIMIT) model + entitlements module already exist — likely reusable |
| ADMIN-009 | P2 | Admin | System Health dashboard (API/DB/Redis/queue/SMTP/SMS/push/storage/WS/backup) | NOT_STARTED | system-health page (exists, scope TBD) + main.ts health data | manual check | `/system-health` page already exists — needs audit of current coverage |

## Phase 4 — Work Order & Repair Request Lifecycle (P2)

| ID | Priority | Area | Task | Status | Files/Modules | Verification | Notes |
|---|---|---|---|---|---|---|---|
| WO-001 | P2 | Work Orders | Full lifecycle Request→...→Closed | NOT_STARTED | work-orders module (api+web) | manual lifecycle walkthrough | Current WorkOrderStatus only has 6 values (OPEN, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED, OVERDUE) |
| WO-002 | P2 | Schema | Extend WorkOrderStatus enum + add verification/photo/RCA fields | NOT_STARTED | prisma/schema.prisma WorkOrder | prisma validate + migration | Confirmed missing: completionNote, beforePhotos, afterPhotos, verifiedAt/By, verificationNote, rejectionReason, rootCause, correctiveAction, preventiveAction, closedAt, reopenedAt/Reason. actualHours already present |
| WO-003 | P2 | Work Orders | Work order detail page rebuild (full info + timeline + comments + docs) | NOT_STARTED | apps/web/app/(dashboard)/work-orders | manual UI check | |
| WO-004 | P2 | Work Orders | SLA engine (priority/category SLA, breach alerts, compliance reports) | NOT_STARTED | work-orders module | manual + cron test | WorkOrder already has slaDeadline/slaBreached fields |
| WO-005 | P2 | Work Orders | Technician assignment by skill/role/location/availability/workload | NOT_STARTED | work-orders module | manual assignment test | |
| WO-006 | P2 | Work Orders | Time tracking (assign/start/pause/resume/complete + delay reason) | NOT_STARTED | work-orders module | manual test | |
| WO-007 | P2 | Inventory link | Parts usage on WO (deduct stock, cost calc, insufficient-stock override) | NOT_STARTED | work-orders + inventory modules | manual test | WorkOrderPart, StockMovement models exist |
| WO-008 | P2 | Costing | Cost tracking (labor/parts/vendor/utility/cost center/budget line) | NOT_STARTED | work-orders module + Budget (BUD models, not yet built) | manual test | estimatedCost/actualCost exist as Float (see SCHEMA money issue) |
| WO-009 | P2 | Work Orders | Supervisor verification step before close | NOT_STARTED | work-orders module | manual test | depends on WO-002 fields |
| WO-010 | P2 | Work Orders | Requester confirmation + reopen flow | NOT_STARTED | work-orders module | manual test | depends on WO-002 fields |
| WO-011 | P2 | Work Orders | WorkOrderActivity timeline model + logging on every action | NOT_STARTED | new Prisma model + service hooks | manual: verify timeline entries | AuditLog exists generally; dedicated WO activity timeline does not |
| REQ-INTAKE | P2 | Repair requests | Repair request intake fields/categories | NOT_STARTED | FacilityIssue model + UI | manual submit test | FacilityIssue exists but lacks category enum from brief and building/floor/room FKs (see FAC-001) |

## Phase 5 — Facility & Building Maintenance Module (P3)

> **DISCREPANCY**: This phase assumes a Property→Building→Floor→Room→Asset hierarchy that
> does NOT exist in the current schema. The current "facility" concept is `CleaningLocation`
> + `FacilityIssue` (cleaning-oriented, not a general building asset register). Building
> this phase as specified is a substantial net-new data model + module, not an extension.
> Recommend explicit go/no-go discussion before starting (see audit summary).

| ID | Priority | Area | Task | Status | Files/Modules | Verification | Notes |
|---|---|---|---|---|---|---|---|
| FAC-001 | P3 | Schema | Property/Building/Floor/Room/BuildingAsset/BuildingMaintenanceLog models + FKs + enums + soft delete | NOT_STARTED | prisma/schema.prisma | prisma validate | None of these models exist today |
| FAC-002 | P3 | Facility | Building master data CRUD | NOT_STARTED | new module + UI | manual CRUD | depends on FAC-001 |
| FAC-003 | P3 | Facility | Floor/zone/room management + QR | NOT_STARTED | new module + UI | manual CRUD | depends on FAC-001 |
| FAC-004 | P3 | Facility | Building asset register categories | NOT_STARTED | new module + UI | manual CRUD | depends on FAC-001 |
| FAC-005 | P3 | Facility | Building asset detail fields (warranty, condition, criticality, TCO) | NOT_STARTED | new module + UI | manual CRUD | depends on FAC-001 |
| FAC-006 | P3 | Public portal | Public building repair request portal (/request, QR-driven, no login) | NOT_STARTED | new public route group | manual public submit + track | depends on FAC-001, REQ-INTAKE |
| FAC-007 | P3 | Facility | Issue categories (Electrical/Plumbing/HVAC/etc.) | NOT_STARTED | FacilityIssue + enum | schema check | |
| FAC-008 | P3 | Facility | Building repair workflow (report→review→WO→assign→...→close/reopen) | NOT_STARTED | depends on WO phase + FAC-001 | manual lifecycle test | |
| FAC-009 | P3 | Facility | Building dashboard KPIs | NOT_STARTED | new dashboard | manual check | |
| FAC-010 | P3 | Facility | Building reports (cost, SLA, utility, cleaning, inspection compliance) | NOT_STARTED | reports module | manual check | |

## Phase 6 — Preventive Maintenance (P3)

| ID | Priority | Area | Task | Status | Files/Modules | Verification | Notes |
|---|---|---|---|---|---|---|---|
| PM-001 | P3 | PM | PM plan catalog (AC, generator, fire ext., electrical panel, etc.) | NOT_STARTED | maintenance module | manual check | MaintenanceSchedule/MaintenanceType/MaintenanceFrequency models/enums already exist as base |
| PM-002 | P3 | PM | PM schedule config (asset/location, frequency, checklist, auto-create flag) | NOT_STARTED | maintenance module | manual CRUD | |
| PM-003 | P3 | PM | PM auto-scheduler @Cron daily 6am | NOT_STARTED | maintenance module | manual cron test | |
| PM-004 | P3 | PM | PM calendar view + filters | NOT_STARTED | apps/web maintenance UI | manual UI check | |
| PM-005 | P3 | PM | PM compliance reports | NOT_STARTED | reports module | manual check | |

## Phase 7 — Cleaning Management (P3)

| ID | Priority | Area | Task | Status | Files/Modules | Verification | Notes |
|---|---|---|---|---|---|---|---|
| CLN-001 | P3 | Cleaning | Cleaning area setup (building/floor/zone, frequency, assignment, QR) | PARTIAL | CleaningLocation model + cleaning module/UI | manual CRUD | CleaningLocation, frequency enums, /cleaning/locations page already exist |
| CLN-002 | P3 | Cleaning | Checklist template builder (pass/fail, photo/comment required) | NEEDS_REVIEW | CleaningChecklistTemplate model + cleaning.service.ts (70KB) | manual: create/edit template via UI | **DISCREPANCY**: model exists and cleaning.service.ts has substantial logic already — need to verify exactly what's exposed via controller/UI before treating as "build both from scratch" |
| CLN-003 | P3 | Cleaning | Cleaning schedules (daily/weekly/monthly/deep/etc.) | PARTIAL | CleaningLocation + CleaningFrequencyUnit/CleaningShift enums | manual check | enums already exist |
| CLN-004 | P3 | Cleaning | Cleaner workflow (my tasks, QR scan, checklist, photo proof) | PARTIAL | /cleaning/scan, /cleaning/visits pages exist | manual e2e as CLEANER role | CleaningVisit model + QR_SCAN method exist; verify mobile parity |
| CLN-005 | P3 | Cleaning | Supervisor verification (approve/reject/redo) | PARTIAL | /cleaning/sign-off page exists | manual e2e as supervisor | CleaningVisitStatus has PENDING_VERIFICATION/APPROVED/REJECTED |
| CLN-006 | P3 | Cleaning | Alerts/reports (missed cleaning, compliance, performance) | PARTIAL | /cleaning/analytics exists | manual check | verify coverage vs brief |

## Phase 8 — Utility Tracking (P3)

| ID | Priority | Area | Task | Status | Files/Modules | Verification | Notes |
|---|---|---|---|---|---|---|---|
| UTL-001 | P3 | Utilities | Extend UtilityType enum (Diesel, Generator fuel, Solar, Chilled water) | NOT_STARTED | prisma/schema.prisma | prisma validate | Current enum only: ELECTRICITY, WATER, GAS |
| UTL-002 | P3 | Utilities | Meter reading enrich (photo proof, abnormal flag, read-by) | NOT_STARTED | UtilityMeter/MeterReading models + UI | manual check | MeterReading has `images`/`notes` already; missing readBy/abnormal flag |
| UTL-003 | P3 | Utilities | Bill tracking + auto-OVERDUE @Cron | NOT_STARTED | UtilityBill model (exists) + cron | manual cron test | UtilityBill model + BillStatus enum already exist |
| UTL-004 | P3 | Utilities | Anomaly detection → FacilityIssue + notify | NOT_STARTED | utilities module + predictive rules | manual test | ties into AI-002 R5 |
| UTL-005 | P3 | Utilities | Utility reports | NOT_STARTED | reports module | manual check | |

## Phase 9 — Inventory & Procurement (P3)

| ID | Priority | Area | Task | Status | Files/Modules | Verification | Notes |
|---|---|---|---|---|---|---|---|
| INV-001 | P3 | Inventory | PartCategory model + item master categories | NOT_STARTED | prisma/schema.prisma, SparePart | prisma validate | SparePart.category is currently a free-text String, no PartCategory model |
| INV-002 | P3 | Inventory | Stock control enrich (StockCount/StockCountItem, bin location) | NOT_STARTED | new models + inventory module | manual check | StockMovement (IN/OUT/ADJUSTMENT/RETURN) exists |
| INV-003 | P3 | Inventory | Parts issue to WO (request→approve→issue→deduct→cost) | PARTIAL | PartRequest/PartRequestApproval/PartIssue models exist | manual e2e | Verify UI coverage in work-orders |
| INV-004 | P3 | Procurement | Full procurement workflow (request→RFQ→quotation→PO→GRN→stock) | NOT_STARTED | new RFQ/Quotation/GoodsReceipt models | manual e2e | PurchaseOrder + approval workflow (operational/finance) already exist; RFQ/Quotation/GoodsReceipt missing |
| INV-005 | P3 | Procurement | Extend PurchaseOrder with VAT(18%)/currency LKR + new entities | NOT_STARTED | prisma/schema.prisma | prisma validate | PurchaseOrder.totalAmount is Float (see money-field issue) |
| INV-006 | P3 | Inventory | Inventory/procurement reports | NOT_STARTED | reports module | manual check | |

## Phase 10 — Vendor / Contractor Portal (P3)

> **DISCREPANCY**: No `Vendor`/`VendorUser`/`VendorContract`/`VendorJob`/`VendorInvoice`/
> `VendorDocument` models exist. The schema uses a `Supplier` model for procurement
> suppliers, which is a different concept (no separate vendor auth/portal). This phase is
> net-new.

| ID | Priority | Area | Task | Status | Files/Modules | Verification | Notes |
|---|---|---|---|---|---|---|---|
| VEN-001 | P3 | Vendor | Vendor master + new models (Vendor, VendorUser, VendorContract, VendorJob, VendorInvoice, VendorDocument) | NOT_STARTED | prisma/schema.prisma + new module | prisma validate | Supplier model exists but is procurement-only, no portal auth |
| VEN-002 | P3 | Vendor | Vendor portal route group (apps/web/app/(vendor)/) + separate VendorUser JWT | NOT_STARTED | new route group + auth | manual login as vendor | |
| VEN-003 | P3 | Vendor | Vendor job workflow (assign→accept→...→invoice→close) | NOT_STARTED | new module | manual e2e | |
| VEN-004 | P3 | Vendor | Vendor performance metrics + internal /vendors pages | NOT_STARTED | new module + UI | manual check | |

## Phase 11 — Budgeting & Cost Control (P3)

> No `Budget`/`BudgetLine`/`CostEntry` models exist — net-new.

| ID | Priority | Area | Task | Status | Files/Modules | Verification | Notes |
|---|---|---|---|---|---|---|---|
| BUD-001 | P3 | Budget | Budget/BudgetLine/CostEntry models + enums | NOT_STARTED | prisma/schema.prisma | prisma validate | |
| BUD-002 | P3 | Budget | Cost centers (dept/building/asset-category/vendor/project) | NOT_STARTED | new models | manual check | Department model already exists as a base |
| BUD-003 | P3 | Budget | Budget vs actual tracking | NOT_STARTED | new module + UI | manual check | |
| BUD-004 | P3 | Budget | Approval limits by user/role/dept/work-type | NOT_STARTED | new module | manual test | |
| BUD-005 | P3 | Budget | Alerts/reports (80%/100% over-budget) | NOT_STARTED | new module + cron | manual test | |

## Phase 12 — Compliance & Safety (P3)

> No general InspectionTemplate/InspectionRecord/PermitToWork/ComplianceCertificate/
> SafetyEquipment models exist (only farm-domain compliance via TraceabilityRecord and
> vehicle-domain via VehicleDocument/AccidentReport/InsuranceClaim/TrafficFine). Net-new
> for facility/asset compliance.

| ID | Priority | Area | Task | Status | Files/Modules | Verification | Notes |
|---|---|---|---|---|---|---|---|
| SAFE-001 | P3 | Compliance | Inspection models (InspectionTemplate/Item, InspectionRecord/Item) | NOT_STARTED | prisma/schema.prisma | prisma validate | |
| SAFE-002 | P3 | Compliance | Checklist builder (pass/fail, risk level, required photo/comment) | NOT_STARTED | new module + UI | manual check | |
| SAFE-003 | P3 | Compliance | Failed inspection → auto HIGH-priority corrective WO | NOT_STARTED | new module + work-orders | manual test | |
| SAFE-004 | P3 | Compliance | Permit-to-work model + approval flow | NOT_STARTED | new PermitToWork model + module | manual test | |
| SAFE-005 | P3 | Compliance | Certificates + expiry cron (ComplianceCertificate/Renewal, SafetyEquipment, SafetyInspectionLog) | NOT_STARTED | new models + cron | manual cron test | AccidentReport exists as extension point for incident reporting |

## Phase 13 — Document Management (P3)

> No generic Document/DocumentVersion/DocLink models or file-upload service exist
> (only VehicleDocument with plain URL strings, and Cloudinary/MinIO env vars present
> but no `file-upload.service.ts`).

| ID | Priority | Area | Task | Status | Files/Modules | Verification | Notes |
|---|---|---|---|---|---|---|---|
| DOC-001 | P3 | Documents | File upload service (R2/S3-compatible) | NOT_STARTED | new common/services/file-upload.service.ts | manual upload test | CLOUDINARY_*/MINIO_* env vars exist; no file-upload.service.ts found |
| DOC-002 | P3 | Documents | Upload validation + POST /files/upload + frontend file-upload.tsx | NOT_STARTED | new endpoint + component | manual upload test | |
| DOC-003 | P3 | Documents | Document categories | NOT_STARTED | Document model | schema check | |
| DOC-004 | P3 | Documents | Document/DocumentVersion/DocLink models + linking | NOT_STARTED | prisma/schema.prisma | prisma validate | |
| DOC-005 | P3 | Documents | Document lifecycle (versions, expiry, permissions, audit) + pages | NOT_STARTED | new module + UI | manual check | |

## Phase 14 — Reports, Dashboards, Power BI (P3)

| ID | Priority | Area | Task | Status | Files/Modules | Verification | Notes |
|---|---|---|---|---|---|---|---|
| REP-001 | P3 | Reports | Operations command dashboard | NOT_STARTED | reports module + UI | manual check | reports module + /reports pages already exist (driver-intelligence, job-costing, etc.) |
| REP-002 | P3 | Reports | Executive dashboard | NOT_STARTED | reports module + UI | manual check | |
| REP-003 | P3 | Reports | Drill-down from KPI to filtered records | NOT_STARTED | UI | manual check | |
| REP-004 | P3 | Reports | Branded PDF/XLSX exports (logo, LKR, tenant, timezone) | NOT_STARTED | reports module | manual export check | |
| REP-005 | P3 | Reports | Scheduled report delivery (@Cron daily/weekly/monthly email) | NOT_STARTED | reports + notifications modules | manual cron test | |
| REP-006 | P3 | Reports | Move heavy report generation to Bull queue (Cloudflare 50ms limit) | NOT_STARTED | reports module | manual job test | Bull/Redis infra already present (queues elsewhere) |
| REP-007 | P3 | Reports | Power BI export endpoints + /analytics pages (recharts) | NOT_STARTED | reports module + UI | manual check | |

## Phase 15 — Mobile Technician App / PWA (P4)

| ID | Priority | Area | Task | Status | Files/Modules | Verification | Notes |
|---|---|---|---|---|---|---|---|
| MOB-001 | P4 | Mobile | Align Flutter endpoints with backend (tenancy, notifications, compliance, predictive-ai, work-orders, password reset field name) | NOT_STARTED | apps/mobile/lib | manual API contract diff | Mobile sends `password` (not `newPassword`) on reset — confirm against backend DTO once SEC-003 is built |
| MOB-002 | P4 | Mobile | Technician screens (jobs, start/pause/complete, photos, QR, checklist, signature, offline queue) | PARTIAL | apps/mobile/lib/features/work_orders | manual e2e on device | Offline queue (Hive) + dio client with token refresh already implemented as base infra |
| MOB-003 | P4 | Mobile | Cleaner screens (tasks, QR scan, checklist, photo proof) | PARTIAL | apps/mobile/lib/features/cleaning | manual e2e on device | |
| MOB-004 | P4 | Mobile | Requester mobile flow | NOT_STARTED | apps/mobile/lib | manual e2e | depends on REQ phase |
| MOB-005 | P4 | Mobile | Offline-first sync (sqflite/Hive cache, conflict handling, banner) | PARTIAL | apps/mobile/lib/core/offline | manual offline test | offline_queue.dart + offline_sync.dart already implemented |
| MOB-006 | P4 | Mobile | Push notifications (FCM/APNs, DeviceToken model) | PARTIAL | push_notifications_provider.dart | manual push test | FCM client fully implemented; confirm `/notifications/push/devices` endpoint + DeviceToken model exist server-side (not confirmed in audit) |

## Phase 16 — Requester Portal (P4)

| ID | Priority | Area | Task | Status | Files/Modules | Verification | Notes |
|---|---|---|---|---|---|---|---|
| REQ-001 | P4 | Requester | Requester dashboard (status buckets) | NOT_STARTED | new (requester) route group | manual check | |
| REQ-002 | P4 | Requester | Submit request form | NOT_STARTED | new route group | manual submit | |
| REQ-003 | P4 | Requester | QR reporting (auto-fill location) | NOT_STARTED | depends on FAC-001/003 | manual scan test | |
| REQ-004 | P4 | Requester | Track/comment/confirm/reopen/rate, privacy-limited view | NOT_STARTED | new route group | manual check | |

## Phase 17 — Predictive Maintenance & AI (P4)

| ID | Priority | Area | Task | Status | Files/Modules | Verification | Notes |
|---|---|---|---|---|---|---|---|
| AI-001 | P4 | AI | Audit predictive-ai module; mark DISABLED if no LLM key | NOT_STARTED | predictive-ai module | manual check | predictive-ai module + PredictiveLog + CopilotConversation/Message/ExchangeLog models exist |
| AI-002 | P4 | AI | Rule engine @Cron daily 2am (R1-R6) | NOT_STARTED | predictive-ai module | manual cron test | |
| AI-003 | P4 | AI | High-cost asset detection | NOT_STARTED | predictive-ai module | manual check | |
| AI-004 | P4 | AI | Asset criticality score | NOT_STARTED | predictive-ai module | manual check | |
| AI-005 | P4 | AI | Replacement recommendation | NOT_STARTED | predictive-ai module | manual check | |
| AI-006 | P4 | AI | Inventory demand prediction | NOT_STARTED | predictive-ai module | manual check | |
| AI-007 | P4 | AI | Predictive dashboard | NOT_STARTED | apps/web | manual check | |
| AI-008 | P4 | AI | AI Copilot (Claude integration via ANTHROPIC_API_KEY) + pages | NOT_STARTED | predictive-ai module + UI | manual check | RapidAPI copilot key exists in env; Copilot* models exist; not yet wired to Claude per CLAUDE.md guidance |

## Phase 18 — Farm Module Decision (P4)

> **DISCREPANCY**: Audit found Farm module has 16 Prisma models, full API services, AND
> 13 web UI pages already integrated into the sidebar (`/farm`, `/farm/fields`,
> `/farm/crops`, `/farm/harvest`, `/farm/livestock`, `/farm/irrigation`,
> `/farm/spray-logs`, `/farm/soil-tests`, `/farm/weather`, `/farm/workers`,
> `/farm/attendance`, `/farm/finance`, `/farm/traceability`). The "Farm has ZERO web UI"
> premise is FALSE for this codebase state. Decision is really: keep as-is (it's a
> selling point for SL agribusiness clients), or feature-flag it per tenant for
> non-farm/pure-facility tenants.

| ID | Priority | Area | Task | Status | Files/Modules | Verification | Notes |
|---|---|---|---|---|---|---|---|
| FARM-001 | P4 | Farm | Decide retain vs feature-flag farm module | NEEDS_REVIEW | app.module.ts, sidebar.tsx, Entitlement model | manual decision + toggle test | Farm UI already fully built — recommend feature-flag via existing Entitlement model rather than removal |
| FARM-002 | P4 | Farm | If retained: polish/extend farm reports | DEFERRED | apps/web/app/(dashboard)/farm | manual check | pending FARM-001 decision |

## Phase 19 — Performance & Deployment (P2 mixed)

| ID | Priority | Area | Task | Status | Files/Modules | Verification | Notes |
|---|---|---|---|---|---|---|---|
| PERF-001 | P2 | Perf | Fix slow login (4.45s) — profile bcrypt/DB/cold start | NOT_STARTED | auth.service.ts | manual timing test | not yet profiled |
| PERF-002 | P2 | Perf | Fix readiness/Swagger timeout (30s) | NOT_STARTED | main.ts | manual timing test | ties into SEC-008 |
| PERF-003 | P2 | Perf | Redis caching for dashboards/master data (5-min TTL) | NOT_STARTED | various services | manual check | Redis already in infra (Bull) |
| PERF-004 | P2 | Perf | Pagination on all heavy endpoints | NOT_STARTED | various modules | manual check | needs per-module audit |
| PERF-005 | P2 | Perf | Server-side dashboard aggregation | NOT_STARTED | various modules | manual check | |
| PERF-006 | P2 | Perf | Frontend lazy-load charts, remove unneeded refetchInterval, next/image, error boundaries | NOT_STARTED | apps/web | manual check | |
| PERF-007 | P2 | CI/CD | GitHub Actions: install/lint/typecheck/test/build + deploy workflow | NOT_STARTED | .github/workflows/ | CI run | Only docker-image.yml exists today |

## Phase 20 — Professional Extras (P4)

| ID | Priority | Area | Task | Status | Files/Modules | Verification | Notes |
|---|---|---|---|---|---|---|---|
| PRO-001 | P4 | Audit | Ensure every critical service calls AuditService | NOT_STARTED | all modules | grep audit + spot tests | AuditLog model + audit module exist |
| PRO-002 | P4 | Workflow | Duplicate issue detection | NOT_STARTED | new logic | manual test | |
| PRO-003 | P4 | Workflow | Root cause analysis fields/flow | NOT_STARTED | depends on WO-002 | manual test | |
| PRO-004 | P4 | Workflow | Emergency mode + escalation tree | NOT_STARTED | new module | manual test | |
| PRO-005 | P4 | Workflow | Digital signatures | NOT_STARTED | new component + storage | manual test | |
| PRO-006 | P4 | Compliance | Data retention / legal hold | NOT_STARTED | various models | manual check | |
| PRO-007 | P4 | Ops | Backup & DR runbook visibility | NOT_STARTED | system-health + docs | manual check | DUAL_DATABASE_REPLICATION.md + db:backup:* scripts already exist as base |
| PRO-008 | P4 | i18n | EN/Sinhala/Tamil readiness | NOT_STARTED | global | manual check | overlaps UX-014 |
| PRO-009 | P4 | UI | Dark mode (Tailwind dark:) | NOT_STARTED | apps/web | manual check | |
| PRO-010 | P4 | Content | Knowledge base structure | NOT_STARTED | new module | manual check | |
| PRO-011 | P4 | Schema | Soft delete (deletedAt/deletedBy) on major entities | NOT_STARTED | prisma/schema.prisma | prisma validate | Confirmed: no deletedAt/deletedBy fields anywhere; uses archivedAt/status instead |
| PRO-012 | P4 | Search | Global search endpoint GET /search | NOT_STARTED | new module | manual test | |

---

## Cross-cutting schema issue (tracked separately, referenced by many tasks above)

| ID | Priority | Area | Task | Status | Files/Modules | Verification | Notes |
|---|---|---|---|---|---|---|---|
| SCHEMA-001 | P1 | Schema | Convert all monetary fields from Float to Decimal @db.Decimal(12,2), default LKR | NOT_STARTED | prisma/schema.prisma (~25 fields across WorkOrder, PurchaseOrder*, UtilityBill, Asset, Vehicle, SparePart, FuelLog, CropCycle, AccidentReport, InsuranceClaim, TrafficFine) | prisma validate + migration + recalculation tests | All money fields confirmed Float today |
