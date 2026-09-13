# Route and Module Disposition (Phase 0)

**Baseline:** `origin/main` @ `290bf3a`

---

## Backend modules

| Module | Decision | Reason |
|--------|----------|--------|
| auth, tenancy, users, roles, invitations, admin, audit, settings, notifications, queues | KEEP | Platform |
| entitlements, billing | KEEP code / HIDE UX for Nelna | SaaS packaging |
| assets, maintenance, work-orders, job-codes, evidence*, work-order-taxonomy* | KEEP / MERGE evidence+taxonomy into WO | Core CMMS |
| inventory, suppliers, departments, bulk-import, erp-integration | KEEP | Spare parts + ERP boundary |
| vehicles, fleet, drivers*, fuel*, trips*, vehicle-documents*, accidents, insurance-claims, traffic-fines, compliance | KEEP / MERGE starred into Fleet | Fleet |
| driver-intelligence, fraud-control, management-intelligence, reports, operations, enterprise-ops | REFACTOR | Reports / secondary |
| facilities, utilities | KEEP | Facility maintenance |
| cleaning | RETIRE UX / KEEP equipment path later | Workforce ops out of scope |
| farm/* (11) | RETIRE UX | Ops out; infra via Assets |
| predictive-ai | HIDE V1 | Rules/history first |
| qa, delivery-readiness, go-live, post-go-live | RETIRE from business Admin | Technical/project tooling |
| people, workforce | KEEP / MERGE | People & access |
| enterprise-ops PM bits | MERGE into maintenance later | |

---

## Frontend routes (major)

### KEEP → target nav

| Route | Target |
|-------|--------|
| `/action-center` | **Home** (canonical) |
| `/qr/report-issue` | Requests |
| `/work-orders` | Work Orders |
| `/maintenance/job-codes`, `/maintenance/forecast` | Preventive Maintenance |
| `/assets` | Assets |
| `/fleet`, `/fleet/gate`, `/vehicles*` | Fleet |
| `/inventory*`, `/procurement*` | Spare Parts |
| `/reports*` | Reports |
| `/admin/people|users|roles|invitations|bulk-imports` | Admin |
| `/erp*` | Admin → ERP |
| `/system-health`, `/settings`, `/notifications` | Technical Admin / Secondary |
| `/compliance`, `/accidents`, `/insurance-claims`, `/traffic-fines` | Fleet secondary |
| `/facilities`, `/utilities` | Assets/Facilities secondary |

### MERGE / redirect (Phase 1)

| Route | Action |
|-------|--------|
| `/workspace` | → Home |
| `/dashboard` | → Home (keep widgets) |
| `/maintenance` | Already redirects dashboard → Home |
| `/home`, FMS legacy (`/machinery*`, `/vehicle*`, `/service*`, `/pending-requests`) | HIDE/REMOVE |

### HIDE / RETIRE from normal nav (Phase 1)

| Area | Routes |
|------|--------|
| Farm ops | `/farm/*` |
| Cleaning workforce | `/cleaning/*` |
| FG embedded | `/fg/*` (SSO handoff may remain for external FG) |
| Billing UX | `/billing` |
| Predictive AI | `/predictive-ai` |
| QA/Delivery/Go-Live/Post-Go-Live | `/qa/*`, `/delivery-readiness/*`, `/go-live/*`, `/post-go-live/*`, `/releases`, `/support/*` (or Technical Admin only) |

Authorization must remain server-side even when nav is hidden.

---

## Target main navigation

1. Home  
2. Requests  
3. Work Orders  
4. Preventive Maintenance  
5. Assets  
6. Fleet  
7. Spare Parts  
8. Reports  
9. Admin  

Secondary: Notifications, Profile.

---

## Admin console disposition

### Current (software-delivery heavy)
People, QA, Delivery Readiness, Go-Live, ERP, Post-Go-Live, Users, Tenants, Invitations, Roles, Bulk Imports, System Health, Audit via Settings, Billing.

### Target business Admin
Overview · Organization · Assets & Master Data · People & Access · Maintenance Setup · Approval Rules · Fleet Setup · Vendors & Contracts · ERP & Spare Parts · Notifications & Escalations · Data Quality · Audit  

### Target technical Admin (separate permission)
API · DB · Queue · Storage · ERP · Email/SMS · Backups · Errors · App version (`/system-health`)

Phase 1: clean landing cards only — full Phase 12 rebuild later.

---

## Navigation source files

- `apps/web/lib/navigation.ts` — ~70 items across workspace/core/operations/compliance/reports/admin/cleaning/farm/legacy  
- `apps/web/lib/admin-console.ts` — admin cards  
- `apps/web/lib/role-redirect.ts` — post-login → `/action-center`
