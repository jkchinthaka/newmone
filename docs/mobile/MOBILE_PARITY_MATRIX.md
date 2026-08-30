# MaintainPro Mobile V2 — Parity Matrix

Source discovery from web 
avigation.ts, App Router pages, NestJS controllers, Prisma roles, FG Django controlled forms.
Authoritative main SHA: `2fd697e004da8524b6348c1ad2d33411a873a2a8`.

Status legend: `done` | `partial` | `ui` (shell only) | `hub` (discoverable in Module Hub, domain WIP) | `planned` | `api-gap` | `foundation`

| # | Web route | Web action | Backend endpoint | Method | Permission | Expected role | Mobile screen | Mobile action | Offline policy | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | /workspace | Open My Workspace | N/A (web composition) | - | - | ACTION_CENTER_ROLES | Home / Module shortcuts | View role shortcuts | cache | foundation |
| 2 | /action-center | View Action Center | GET /api/work-orders/action-required (+ domain) | GET | role-filtered | ACTION_CENTER_ROLES | Tasks | View priorities | cache | done |
| 3 | /work-orders?queue=my-tasks | My Tasks queue | GET /api/work-orders/queues/my-tasks | GET | work_orders.view_own|manage | TECHNICIAN,SUPERVISOR | Tasks / WO list | Open queue | cache | done |
| 4 | /work-orders?queue=waiting-parts | Waiting Parts | GET /api/work-orders/queues/waiting-parts | GET | work_orders.* | TECH/SUP/INV/MGR | Tasks | Open queue | cache | done |
| 5 | /work-orders?queue=waiting-evidence | Evidence Needed | GET /api/work-orders/queues/waiting-evidence | GET | work_orders.* | TECH/SUP/MGR | Tasks | Open queue | cache | done |
| 6 | /work-orders?queue=supervisor-verification | Pending Verification | GET /api/work-orders/queues/supervisor-verification | GET | work_orders.* | SUP/MGR/ADMIN | Tasks | Open queue | online | done |
| 7 | /work-orders?queue=high-risk | High Risk | GET /api/work-orders/queues/high-risk | GET | work_orders.* | MGR/SUP/ADMIN | Tasks | Open queue | cache | done |
| 8 | /work-orders?queue=triage | Triage Queue | GET /api/work-orders/queues/triage | GET | work_orders.* | MGR/SUP/ADMIN | Tasks | Open queue | cache | done |
| 9 | /dashboard | Dashboard | multiple domain aggregates | GET | dashboard.view | DASHBOARD_ROLES | Home | KPIs (role) | cache | ui |
| 10 | /work-orders | List/Create/Update WO | /api/work-orders | GET/POST/PATCH | work_orders.manage | TECH+ | WorkOrders | List/Detail/Create(createdById)/Start/Complete | draft notes; status online | done |
| 11 | /work-orders (detail) | Evidence upload | POST evidence/upload-request + confirm | POST | TECH+ roles | TECH+ | WO Detail | Capture/queue/upload/retry | pending local + online confirm | done |
| 12 | /work-orders (detail) | Status transition | PATCH /api/work-orders/:id/status | PATCH | work_orders.update_status | TECH+ | WO Detail | Start/Complete | online required | done |
| 12a | /work-orders (detail) | Parts list | GET /api/work-orders/:id/parts | GET | work_orders.* | TECH+ | WO Detail | Read-only parts | online/cache | done |
| 12b | /work-orders (detail) | Parts issue/return | PATCH/POST parts/:lineId/* | PATCH/POST | inventory.stock_issue | INV/TECH | — | Not on mobile (stock authoritative) | online | blocked |
| 12c | /work-orders (detail) | Activity timeline | GET /api/work-orders/:id/activity | GET | work_orders.* | TECH+ | WO Detail | Timeline | cache | done |
| 12d | /work-orders (detail) | Asset/vehicle history context | GET /api/work-orders/:id/history | GET | work_orders.* | TECH+ | — | Context API unused in UI yet | cache | partial |
| 13 | /assets | Assets CRUD | /api/assets | GET/POST/PATCH | assets.manage | TECH+ | Module Hub | Navigate | cache | hub |
| 14 | /assets/health | Asset health | domain health endpoints | GET | assets.manage | MGR/ASSET/ADMIN | Module Hub | Navigate | online | hub |
| 15 | /fleet/gate | Gate In/Out | POST /api/vehicles/:id/gate-in|gate-out | POST | gate.in.create|gate.out.create | SECURITY+ | Module Hub / Gate | Gate ops | online required | planned |
| 16 | /fleet | Fleet hub | /api/fleet + sockets /fleet | GET | fleet.manage | FLEET+ | Module Hub | Navigate | cache | hub |
| 17 | /vehicles | Vehicles list/detail | /api/vehicles | GET/POST/PATCH | vehicles.view | FLEET/DRIVER/TECH | Module Hub | Navigate | cache | hub |
| 18 | /vehicles/health | Vehicle health | analytics | GET | vehicles.view | MGR/FLEET/ADMIN | Module Hub | Navigate | online | hub |
| 19 | /vehicles/costs | Vehicle costs | cost analytics | GET | reports.vehicle_cost.view | MGR/FIN/ADMIN | Module Hub | Navigate | online | hub |
| 20 | /inventory | Inventory | /api/inventory | GET/POST | inventory.* | INV/PROC/MGR | Module Hub | Navigate | stock ops online | hub |
| 21 | /inventory/erp-import | ERP Stock Import | /api/inventory/erp-import* | POST | erp.import|inventory | ADMIN/MGR/INV | Module Hub | Navigate | online | hub |
| 22 | /inventory/warranty | Warranty | inventory warranty | GET | inventory.* | MGR/INV/ADMIN | Module Hub | Navigate | cache | hub |
| 23 | /operations/exceptions | Exceptions | /api/operations/* | GET | operations.view | MGR/ADMIN | Module Hub | Navigate | online | hub |
| 24 | /operations/sla | SLA risk | /api/operations/* | GET | operations.view | MGR/ADMIN | Module Hub | Navigate | online | hub |
| 25 | /operations/budget | Budget commitments | /api/operations/* | GET | reports.vehicle_cost.view | MGR/FIN/ADMIN | Module Hub | Navigate | online | hub |
| 26 | /procurement | Procurement | /api/suppliers + PO | GET/POST | purchase_orders.* | PROC/INV/MGR | Module Hub | Navigate | online | hub |
| 27 | /procurement/matching | PO matching | procurement matching | GET | purchase_orders.view | PROC/FIN/MGR | Module Hub | Navigate | online | hub |
| 28 | /fg | FG Digital Recording hub | FG SSO + Next/Django proxy | POST auth/fg-sso/* | fg.access | FG roles | Module Hub / FG | Open FG | draft offline | planned |
| 29 | /fg/records/new | CL18/CL24/CL30 create | FG Django/Next strangler | POST | fg.* | RECORDER+ | FG forms | Draft/Submit | draft offline; submit online | planned |
| 30 | /fg/review | Supervisor review | FG workflow | POST | fg.review* | SUPERVISOR | FG Review | Approve/Reject | online | planned |
| 31 | /fg/qa | QA verification | FG QA | POST | fg.qa* | QA | FG QA | Verify | online | planned |
| 32 | /maintenance/forecast | Maintenance forecast | maintenance/predictive | GET | - | MGR/TECH/ADMIN | Module Hub | Navigate | online | hub |
| 33 | /maintenance/job-codes | Job Codes | /api/job-codes | GET | - | MGR/SUP/ADMIN | Module Hub | Navigate | cache | hub |
| 34 | /utilities | Utilities | /api/utilities | GET | utilities.manage | MGR/FAC/ADMIN | Module Hub | Navigate | cache | hub |
| 35 | /compliance | Compliance | /api/compliance | GET | compliance.view | COMP/MGR/ADMIN | Module Hub | Navigate | cache | hub |
| 36 | /accidents | Accidents | /api/accidents | GET/POST | accidents.* | COMP/MGR/ADMIN | Module Hub | Draft/Submit | draft offline | hub |
| 37 | /insurance-claims | Insurance Claims | /api/insurance-claims | GET/POST | insurance_claims.* | COMP/MGR/ADMIN | Module Hub | Navigate | draft offline | hub |
| 38 | /traffic-fines | Traffic Fines | /api/traffic-fines | GET/POST | traffic_fines.* | COMP/FLEET/MGR | Module Hub | Navigate | draft offline | hub |
| 39 | /reports | Reports | /api/reports | GET | reports.* | MGR+ | Module Hub | Navigate | online | hub |
| 40 | /reports/maintenance-exceptions | Maintenance Exceptions | fraud/exceptions | GET | reports.* | MGR+ | Module Hub | Navigate | online | hub |
| 41 | /reports/fraud-control | Fraud & Control | /api/fraud-control | GET | reports.* | MGR+ | Module Hub | Navigate | online | hub |
| 42 | /reports/management-intelligence | 360 Management Intelligence | /api/management-intelligence | GET | dashboard_analytics.view | MGR/FIN/ADMIN | Module Hub | Navigate | online | hub |
| 43 | /admin | Admin Console | /api/admin /users /roles | GET | users.* | ADMIN | Module Hub | Navigate | online | hub |
| 44 | /qa | QA & Incidents | /api/qa | GET/POST | qa.* | ADMIN | Module Hub | Navigate | online | hub |
| 45 | /delivery-readiness | Delivery Readiness | /api/delivery-readiness | GET | delivery.* | ADMIN | Module Hub | Navigate | online | hub |
| 46 | /go-live | Go-Live Control | /api/go-live | GET | go_live.* | ADMIN | Module Hub | Navigate | online | hub |
| 47 | /erp | ERP Integration | /api/erp-integration | GET | erp.* | ADMIN | Module Hub | Navigate | online | hub |
| 48 | /post-go-live | Post-Go-Live | /api/post-go-live | GET | hypercare.* | ADMIN | Module Hub | Navigate | online | hub |
| 49 | /system-health | System Health | GET /health* | GET | ADMIN | ADMIN | Diagnostics | Health check | online | partial |
| 50 | /predictive-ai | AI Assistant | /api/predictive-ai | GET/POST | predictive_insights.view | MGR/ADMIN | Module Hub | Navigate | online | hub |
| 51 | /master-data | Master Data | /api/departments /people | GET | - | ADMIN/MGR | Module Hub | Navigate | online | hub |
| 52 | /notifications | Notifications | /api/notifications + WS /notifications | GET/PATCH | - | auth | Alerts | List/Read | cache | ui |
| 53 | /billing | Billing | /api/billing | GET | - | ADMIN/FIN | Module Hub | Navigate | online | hub |
| 54 | /settings | Settings | /api/settings | GET/PATCH | settings.* | ADMIN/MGR | Settings | View/Edit prefs | local prefs | ui |
| 55 | /facilities | Facilities | /api/facilities | GET | facilities.* | FAC+ | Module Hub | Navigate | cache | hub |
| 56 | /facilities/reports | Facility Reports | facilities reports | GET | facilities.* | FAC+ | Module Hub | Navigate | online | hub |
| 57 | /cleaning | Cleaning Overview | /api/cleaning | GET | cleaning.* | CLEANER+ | Module Hub | Navigate | cache | hub |
| 58 | /cleaning/issues | Facility Issues | facility_issues | GET/POST | facility_issues.* | CLEANER+ | Module Hub | Draft issue | draft offline | hub |
| 59 | /cleaning/scan | Scan QR | operations/scan-lookup | POST | operations.scan_lookup|cleaning | CLEANER+ | Scan | Resolve QR | online resolve | ui |
| 60 | /cleaning/visits | Visits | cleaning visits | GET/POST | cleaning.* | CLEANER+ | Module Hub | Navigate | draft offline | hub |
| 61 | /cleaning/sign-off | Sign-off Queue | cleaning sign-off | GET/POST | cleaning.* | CLEANER+ | Module Hub | Navigate | online | hub |
| 62 | /cleaning/analytics | Analytics | cleaning analytics | GET | cleaning.* | FAC/MGR | Module Hub | Navigate | online | hub |
| 63 | /cleaning/locations | Locations | cleaning locations | GET | cleaning.* | FAC/MGR | Module Hub | Navigate | cache | hub |
| 64 | /farm | Farm Dashboard | /api/farm | GET | - | FARM+ | Module Hub | Navigate | cache | hub |
| 65 | /farm/fields | Fields & Map | /api/farm | GET | - | FARM+ | Module Hub | Navigate | cache | hub |
| 66 | /farm/crops | Crops | /api/farm | GET | - | FARM+ | Module Hub | Navigate | cache | hub |
| 67 | /farm/harvest | Harvest | /api/farm | GET/POST | - | FARM+ | Module Hub | Navigate | draft offline | hub |
| 68 | /farm/livestock | Livestock | /api/farm | GET | - | FARM+ | Module Hub | Navigate | cache | hub |
| 69 | /farm/irrigation | Irrigation | /api/farm | GET/POST | - | FARM+ | Module Hub | Navigate | draft offline | hub |
| 70 | /farm/spray-logs | Spray Logs | /api/farm | GET/POST | - | FARM+ | Module Hub | Navigate | draft offline | hub |
| 71 | /farm/soil-tests | Soil Tests | /api/farm | GET/POST | - | FARM+ | Module Hub | Navigate | draft offline | hub |
| 72 | /farm/weather | Weather | /api/farm | GET | - | FARM+ | Module Hub | Navigate | cache | hub |
| 73 | /farm/workers | Workers | /api/farm | GET | - | FARM+ | Module Hub | Navigate | cache | hub |
| 74 | /farm/attendance | Attendance | /api/farm | GET/POST | - | FARM+ | Module Hub | Navigate | draft offline | hub |
| 75 | /farm/finance | Finance | /api/farm | GET | - | FARM+ | Module Hub | Navigate | online | hub |
| 76 | /farm/traceability | Traceability | /api/farm | GET | - | FARM+ | Module Hub | Navigate | cache | hub |
| 77 | /home (legacy FMS) | Legacy FMS Archive | legacy read-only | GET | ADMIN | SUPER_ADMIN,ADMIN | Module Hub Archive | Read-only | online | hub |
| 78 | /login | Login | POST /api/auth/login | POST | public | * | Login | Authenticate | online | done |
| 79 | /notifications | Push device register | POST /api/notifications/push/devices | POST | auth | * | Alerts | Register FCM | online | planned |
| 80 | scan universal | Scan lookup | POST /api/operations/scan-lookup | POST | operations.scan_lookup | ops | Scan | Resolve ID | online | ui |
| 81 | global | Session refresh | POST /api/auth/refresh | POST | public | * | Session | Refresh tokens | N/A | done |
| 82 | global | Tenant switch | POST/GET tenants | GET | membership | * | Profile | Switch tenant | online | partial |
| 83 | mobile-only | Draft Center | local Drift | - | - | * | Drafts | Manage drafts | local | done |
| 84 | mobile-only | Sync Center | outbox drain | - | - | * | Sync | Retry sync | local | done |
| 85 | mobile-only | Diagnostics | GET /health | GET | - | * | Diagnostics | Support info | mixed | done |
| 86 | mobile-only | Bootstrap BFF | GET /api/mobile/bootstrap | GET | auth | * | Startup | Aggregate | online | api-gap |

## Totals
- Rows: 86
- Completed (done): 5
- Partial: 5
- Hub/UI placeholders: 68
- Planned / API gaps: 8

## Hidden / reachable web routes (not all in sidebar)
Also discovered under App Router: `/accept-invite`, `/register`, `/forgot-password`, `/splash`, `/qr/report-issue`, `/support/*`, `/change-requests`, `/releases`, `/admin/users|people|roles|tenants|invitations`, `/fg/*` subroutes, `/go-live/*`, `/erp/*`, `/post-go-live/*`, `/delivery-readiness/*`, `/qa/*`, legacy `(fms)`: `/machinery`, `/service`, `/vehicle`, `/pending-requests`, `/reports/job-costing`.

## FG form codes (Django `controlled_forms.py`)
- `NMS/PPU/CL/18` Product Dispatch — independent occurrence
- `NMS/PPU/CL/24` Daily Cleaning Verification — one per day
- `NMS/PPU/CL/30` Freezer Truck Inspection — independent occurrence
- `NMS/PPU/CL/39` room-scoped one-per-day

NestJS has **no** FG CRUD module — mobile FG must use FG SSO + Next/Django recording APIs.

