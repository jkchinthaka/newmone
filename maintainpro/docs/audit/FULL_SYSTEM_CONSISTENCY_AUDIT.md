# MaintainPro — Full System Consistency Audit

**Audit branch:** `maintainpro/full-system-consistency-audit`  
**Baseline main:** `a0d2e9fe72e89eead8589a9811e62da8d298a4ee`  
**Audit date:** 2026-09-22  
**Scope:** UI → routing → forms → RBAC → API → lifecycle → SQL → audit → notifications → jobs → reports → browser console/network  

---

## Executive summary

MaintainPro is **functionally strong at the core CMMS path** (request → WO create HCI with domain stamping, asset picker contracts after PR #49, soft-cancel WOs, BFF silent refresh, media URL hardening, stock ledger immutability, ERP mock blocked in prod by default).  

Significant **consistency gaps** remain in:

1. **Information architecture** (nav groups, dead Tyres link, duplicate Inventory entries — partially fixed on this branch)  
2. **Work Order lifecycle UI** (full status dropdown / kanban without transition filters; client sanitizer was dropping PLANNED/ASSIGNED/VERIFIED/CLOSED — **fixed**)  
3. **API contract mismatches** outside EntityPicker (fleet gate, locations list, My Jobs — **fixed**)  
4. **Fleet gate** blank/unknown vehicle status previously allowed gate-out — **fixed fail-closed**  
5. **RBAC / discoverability** (inventory & facilities nav vs API; Safety modules aliased but not in nav; FLEET_MANAGER live-map)  
6. **PM status machine** incomplete vs catalog; WO uniqueness for PM occurrences soft  
7. **Performance** unbounded inventory catalog fetch  

**Verdict:** **SYSTEM FUNCTIONALLY STRONG — REMAINING ISSUES LISTED**

Repository-owned critical create/auth/picker paths are not release-blocked after this branch’s safe fixes. Full IA regroup, WO transition UX, PM uniqueness, and gate override attestation remain open.

---

## System status by area

| Area | Status | Notes |
|------|--------|-------|
| Auth / session / BFF refresh | Working | Cookie session; silent refresh latch; JWT not in localStorage |
| WO Direct Create HCI | Working | Domain lanes + EntityPicker contracts (assets search/limit) |
| Request → WO convert | Partially working | Sequential idempotent; concurrent race possible |
| WO lifecycle UI | Partially working | Backend machine OK; UI still offers illegal jumps (dropdown/kanban) |
| Planning vs create | Working | plannedStart omitted from Direct Create |
| PM plan → WO | Partially working | Soft uniqueness; status machine ≠ catalog |
| Assets / locations | Partially working | Facilities under `/admin/organization`; listLocations param fixed |
| Fleet / gate | Partially working | Blank status gate fixed; override approver attestation open; live-map RBAC |
| Inventory ledger | Working | Reversal-only; media URLs safe |
| Inventory scale | Scaling risk | Full catalog `findMany` |
| ERP | Partially working | Mock blocked in prod; `sandbox` mis-resolves to mock |
| Safety / PTW / LOTO | Not fully tested | Modules exist; not in primary Safety IA group |
| Reports | Partially working | Mis-grouped; some role mismatches |
| Navigation IA | Partially working | Dead Tyres + duplicate Inventory removed on this branch |
| Realtime | Working (prior) | Bounded reconnect; OFF usable |
| Automated coverage | Gaps | Transition UI, concurrent convert, PM uniqueness |

---

## Findings table

| ID | Module | Route / API | Role | Problem | Evidence | Expected | Actual | Sev | Category | Fix status | Biz confirm? |
|----|--------|-------------|------|---------|----------|----------|--------|-----|----------|------------|--------------|
| WO-01 | Work Orders | List/Kanban sanitize | All | Client dropped PLANNED/ASSIGNED/VERIFIED/CLOSED → OPEN | `work-orders/api.ts` | Pass through full enum | Was subset | P1 | Functional | **Fixed** | No |
| WO-02 | Work Orders | Status select / Kanban | Ops | UI offers all statuses without transition/reason gates | `work-order-table.tsx`, `kanban-board.tsx` | Only allowed next + reasons | Full list | P1 | HCI / Functional | Open | No |
| WO-03 | Work Orders | Complete modal | Tech/Supervisor | Posted `COMPLETED` breaking non-tech path | `work-orders-page.tsx` | `TECHNICIAN_COMPLETED` | Was COMPLETED | P1 | Functional | **Fixed** | No |
| WO-04 | Work Orders | Approval sanitize | All | Unknown approval → APPROVED | `api.ts` | Preserve NOT_REQUIRED | Coerced APPROVED | P2 | HCI | **Fixed** | No |
| NAV-01 | Nav | `/fleet/tyres` | Fleet | Dead route in menu | `navigation.ts` | Remove or ship page | 404 | P0 | HCI | **Fixed** (removed) | No |
| NAV-02 | Nav | `/inventory` ×2 | Parts | Duplicate menu destinations | `parts-requests` + `spare-parts` | Single entry | Duplicate | P0 | HCI | **Fixed** (removed parts-requests) | No |
| NAV-03 | Nav | Group taxonomy | All | Missing SAFETY / REPORTS / INVENTORY groups | `navigation.ts` | 9-group IA | Phase-1 tree | P1 | HCI | Open | Yes |
| NAV-04 | Nav | Facilities | Ops | Points to `/admin/organization` | `navigation.ts` | Ops facilities UX | Admin URL | P1 | HCI | Open | Yes |
| RBAC-01 | Inventory | Nav vs API | TECH/SUPERVISOR | Nav can show Inventory; API may 403 | PARTS_ROLES vs controller | Align | Mismatch | P0 | RBAC | Open | Yes |
| RBAC-02 | Facilities | `/admin/organization` | MANAGER etc. | Nav allows; page ADMIN-only | page gate | Align | Soft wall | P0 | RBAC | Open | Yes |
| RBAC-03 | Fleet | Live map | FLEET_MANAGER | Page visible; live-map denied | `fleet.controller` / `user-role` | Align policy | Denied | P1 | RBAC | Open | Yes |
| API-01 | Fleet gate | `GET /vehicles` | Gate | `limit` + wrong envelope | `fleet-gate-panel.tsx` | `pageSize` + items | Empty list | P1 | Functional | **Fixed** | No |
| API-02 | Org | `listLocations` | Ops | Sent `limit` | `organization-api.ts` | `pageSize` | Defaulted short page | P1 | Functional | **Fixed** | No |
| API-03 | My Jobs | Queue + fallback | Tech | `limit` / `mine` / envelope | `work-orders/my` | `pageSize` / `myAssignedOnly` | Broken list | P1 | Functional | **Fixed** | No |
| F-01 | Fleet gate | Gate-out | Security | Blank status allowed | `vehicle-policies` / service | Fail closed | Allowed | P0 | Security / Data | **Fixed** | Yes (backfill) |
| F-02 | Fleet gate | Override | Security | Client-supplied approver ID | `vehicles.service` | Attested approval | Trust client | P0 | Security | Open | Yes |
| F-03 | PM | Occurrence→WO | Planner | Soft uniqueness on WO key | schema / planning.service | Unique + txn | Race orphans | P1 | Data | Open | Yes |
| F-05 | PM | Plan status | Planner | No PAUSED; create→ACTIVE; no transition guard | planning.service | Catalog machine | Incomplete | P1 | Functional | Open | Yes |
| F-07 | Inventory | `GET /parts` | Inventory | Unbounded findMany | inventory.service | Paginate | Full catalog | P1 | Performance | Open | No |
| F-08 | ERP | `ERP_MODE=sandbox` | Admin | Falls through to mock | erp-sync-provider | Map sandbox | Mock | P1 | Integration | Open | Yes |
| REQ-01 | Requests | Owner cancel | Requester | UI UNDER_REVIEW cancel vs API NEW-only | requests/[id] | Align | Mismatch | P2 | Functional | Open | Yes |
| REQ-04 | Requests | Convert | Reviewer | Concurrent convert orphan WO | maintenance-requests.service | Serialize | Race | P2 | Data | Open | Yes |
| REQ-06 | Requests | List filter | All | Label “Approved” | requests/page | “Accepted” | Was Approved | P3 | HCI | **Fixed** | No |
| DOC-01 | Docs | STATUS_CATALOG | — | WORK_COMPLETED vs TECHNICIAN_COMPLETED | docs | Align | Drift | P2 | Docs | Open | No |

---

## Workflow matrix

| Workflow | Start | Steps | Expected finish | Actual | Result | Evidence |
|----------|-------|-------|-----------------|--------|--------|----------|
| Machinery WO create | `/maintenance/jobs/machinery` | Create → Asset picker → submit | OPEN + jobDomain=MACHINERY | HCI OK; picker `limit`/`search` | **PASS** | Prior PR #48/#49 + smoke |
| Vehicle WO create | `/maintenance/jobs/vehicle` | Vehicle picker | OPEN + VEHICLE | OK | **PASS** | |
| Service WO create | `/maintenance/jobs/service` | Location picker | OPEN + SERVICE | OK | **PASS** | |
| General WO domain chooser | `/work-orders` | Ask once → form | Domain locked | OK | **PASS** | |
| Request → convert | Requests detail | Review → Accept → Convert | One WO linked | Sequential OK; concurrent risk | **PARTIAL** | REQ-04 |
| WO status progression | List/Kanban | Valid next only | Governed transitions | UI offers illegal jumps | **PARTIAL** | WO-02 |
| Tech complete → verify | Complete modal | TECHNICIAN_COMPLETED | Supervisor verify | Fixed post status | **PASS** (post-fix) | WO-03 |
| Gate-out blank status | Fleet gate | Block | Block | Fixed fail-closed | **PASS** (post-fix) | F-01 |
| PM generate WO | Plans | One occurrence → one WO | Unique | Soft unique | **PARTIAL** | F-03 |
| Inventory stock out | Inventory | Ledger + balance | Immutable + reverse | OK at engine | **PASS** | |
| Login / refresh | `/login` | Expired access + refresh | Silent recover | Prior hardening | **PASS** | |
| Splash | `/splash` | Session → Action Center | Landing | By design | **PASS** | |

---

## API contract matrix

| Frontend | Backend | Match? | Fix |
|----------|---------|--------|-----|
| EntityPicker `/assets` search+limit | AssetListQueryDto | Yes | Keep (PR #49) |
| EntityPicker `/vehicles` q+pageSize | Vehicles list | Yes | Keep |
| EntityPicker `/organization/locations` q+pageSize | Locations | Yes | Keep |
| Fleet gate `/vehicles` | pageSize + `{items}` | **Was No → Fixed** | pageSize + items unwrap |
| `listLocations` | pageSize | **Was No → Fixed** | pageSize |
| My Jobs queue | pageSize + nested data | **Was No → Fixed** | pageSize + unwrap |
| My Jobs fallback `mine` | myAssignedOnly | **Was No → Fixed** | myAssignedOnly |
| WO list sanitize statuses | Full enum | **Was No → Fixed** | WORK_ORDER_STATUSES |

---

## RBAC matrix (representative)

| Role | Page | Action | UI | API | Result |
|------|------|--------|----|-----|--------|
| ADMIN | Most nav | CRUD | Visible | Allowed | OK |
| TECHNICIAN | Inventory (if nav) | Read | May show | Often 403 | **Mismatch** RBAC-01 |
| MANAGER | Facilities nav | View | Shows | Soft wall ADMIN | **Mismatch** RBAC-02 |
| FLEET_MANAGER | `/fleet` live map | GPS | Page open | Live-map denied | **Mismatch** RBAC-03 |
| MANAGER | Fleet live-map | — | Gated client | Denied API | Intentional client gate |
| VIEWER | Reports | Read | Conditional | Check REPORT_ROLES | Partial risk |
| SECURITY_OFFICER | Gate | Gate-out | Visible | Allowed | OK |

---

## Data-quality section

| Defect | Schema / data | Migration? | Biz confirm? |
|--------|---------------|------------|--------------|
| `Vehicle.status = ""` | Default blank string | Prefer NOT NULL + backfill | **Yes** — do not invent AVAILABLE |
| Soft PM WO occurrence key | Index only | Unique constraint | Yes |
| WO list sanitizer (historical) | Client | N/A | Fixed |

---

## Performance section

| Area | Finding | Class |
|------|---------|-------|
| Inventory parts GET | Unbounded findMany | **Scaling risk** |
| Part movement history | Unbounded | Needs optimization |
| Action Center / reports | Multiple parallel fetches | Acceptable short-term |
| EntityPicker | Debounced pageSize 20 | Acceptable |

---

## Accessibility section

Not fully axe-audited in this pass. Known strengths: EntityPicker listbox semantics; create forms min-height controls. Residual: status dropdowns lack transition explanation; native confirms on some admin cards.

---

## Remaining risks

1. Gate override client-asserted approver (P0 security)  
2. Inventory/Facilities nav vs API 403 (P0 RBAC UX)  
3. WO UI illegal transitions still offered (P1)  
4. PM uniqueness + status machine (P1)  
5. ERP sandbox→mock (P1)  
6. Unbounded inventory load (P1)  
7. IA regroup (product)  

---

## Fixes applied on this branch

1. WO status sanitizer uses full `WORK_ORDER_STATUSES`; approval includes `NOT_REQUIRED`  
2. Complete modal posts `TECHNICIAN_COMPLETED`  
3. Fleet gate vehicles: `pageSize` + items envelope  
4. Organization `listLocations`: `pageSize`  
5. My Jobs: `pageSize` / nested unwrap / `myAssignedOnly`  
6. Removed dead Tyres nav + duplicate Parts Requests nav  
7. Gate-out fail-closed on blank/unknown vehicle status (+ policy test)  
8. Request filter label Accepted  

---

## Console / network (spot)

Dev servers healthy (API `/health` 200, web 307→login). Full production matrix not re-run in this audit session; prior PR #47/#49 smokes were clean for core routes. Recommend post-merge `verify-runtime-hci-smoke` + entity-picker script.

---

## Release blockers (repository-owned)

| Item | Blocking? |
|------|-----------|
| WO create / entity picker contracts | No (fixed) |
| Auth refresh / cookies | No |
| Blank vehicle gate-out | No (fixed this branch) |
| Gate override attestation | **Yes if gate go-live** without approval wiring |
| Inventory nav 403 | **Yes for affected roles** until aligned |
| Full IA regroup | No (product) |

---

## Counts (section 34)

See final response.
