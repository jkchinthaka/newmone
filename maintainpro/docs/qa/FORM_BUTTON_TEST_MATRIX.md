# Form & Button Test Matrix

**Branch:** `maintainpro/final-acceptance-validation`  
**Baseline:** PR #42 merge `5687cb2a`  
**Inventory source:** App Router pages (192), Nest controllers (~68 + farm), `docs/audits/form-endpoint-contract-matrix.md`  
**Legend:** PASS = exercised this session with evidence · PARTIAL = covered by automated suite / prior evidence · OPEN = not fully exercised this session · BLOCKED = external

## Priority mutation forms

| ID | Module | UI surface | Method | Endpoint | Open | Validate | AuthZ | Submit | SQL persist | Audit | Reload | Double-submit | Status | Evidence |
|----|--------|------------|--------|----------|------|----------|-------|--------|-------------|-------|--------|---------------|--------|----------|
| F-AUTH-01 | Auth | `/login` | POST | `/api/auth/login` | | | | | cookie session | | | | PASS | Browser QA + seed users |
| F-AUTH-02 | Auth | `/register` | POST | `/api/auth/register` | | | | | | | | | PARTIAL | Unit/API coverage |
| F-REQ-01 | Requests | `/requests/new` | POST | `/api/maintenance-requests` | | | | | `MaintenanceRequest` | history | | | OPEN | Journey script target |
| F-REQ-02 | Requests | `/requests/[id]` review/accept/convert | PATCH/POST | `/api/maintenance-requests/:id/*` | | | | | request+WO linkage | | | | OPEN | Journey script target |
| F-WO-01 | Work orders | `/work-orders` create modal | POST | `/api/work-orders` | | | | | `WorkOrder` | status history | | | OPEN | Journey script target |
| F-WO-02 | Work orders | status actions | PATCH | `/api/work-orders/:id/status*` | | | | | status+history | | | | OPEN | Journey script target |
| F-WO-03 | Work orders | queues summary | GET | `/api/work-orders/queues` | | | | | count aggregates | n/a | | | PASS | PR #42 + aggregate script |
| F-INV-01 | Inventory | `/inventory` stock in/out | POST | `/api/inventory/*` | | | | | `StockMovement`+balance | | | | PARTIAL | API inventory tests |
| F-INV-02 | Inventory | `/inventory/stock-counts` | POST | `/api/inventory/stock-counts*` | | | | | session/lines/ledger | | | | PARTIAL | API tests |
| F-PO-01 | Procurement | `/procurement` | POST | `/api/inventory` PO routes | | | | | `PurchaseOrder` | | | | PARTIAL | API PO tests |
| F-APR-01 | Approvals | `/approvals/[id]` | POST | `/api/approvals/*` | | | | | `ApprovalDecision` | | | | PARTIAL | Approvals API tests |
| F-AST-01 | Assets | `/assets` | POST/PATCH | `/api/assets` | | | | | `Asset` | | | | PARTIAL | Assets tests |
| F-VEH-01 | Vehicles | `/vehicles` | POST/PATCH | `/api/vehicles` | | | | | `Vehicle` | | | | PARTIAL | Vehicle tests |
| F-GATE-01 | Fleet | `/fleet/gate` | POST | `/api/vehicles/:id/gate-*` | | | | | `VehicleGateMovement` | | | | PARTIAL | Fleet/security tests |
| F-CLN-01 | Cleaning | `/cleaning/issues` | POST | `/api/cleaning/issues` | | | | | `FacilityIssue` | | | | PARTIAL | Facility issue tests |
| F-ADM-01 | Admin | `/admin/users` | POST | `/api/users` | | | | | `User` | | | | PARTIAL | admin-users tests |
| F-NTF-01 | Notifications | `/notifications` + WS | GET/WS | `/api/notifications`, `/notifications` | | | cookie | | `Notification` | | | | PASS | Role-matrix WS handshake |

## Important actions (sample)

| Action | Primary surfaces | Visibility = API | DB mutation | Status |
|--------|------------------|------------------|-------------|--------|
| Create / Save / Submit | requests, WO, inventory, admin | RBAC gated | yes | PARTIAL |
| Approve / Reject | approvals, WO | RBAC gated | yes | PARTIAL |
| Assign / Start / Hold / Complete / Verify / Close | work-orders | status machine | yes | OPEN (full lifecycle) |
| Search / Filter / Sort / Paginate | major lists | server-side where implemented | no | PARTIAL |
| Import / Export / Upload | inventory import, bulk-import, evidence | RBAC | yes | PARTIAL |
| Cancel (UI dismiss) | dialogs | no write expected | none | OPEN |

## Coverage notes

- Full exhaustive button enumeration across 192 pages is **not** claimed complete in this session.
- Automated API suite covers large portions of DTO/RBAC/tenant mutation paths (see `E2E_ACCEPTANCE_RESULTS.md`).
- Critical journey UI→API→SQL proofs are tracked in `UI_API_DB_MAPPING_MATRIX.md` and the acceptance scripts under `scripts/`.
