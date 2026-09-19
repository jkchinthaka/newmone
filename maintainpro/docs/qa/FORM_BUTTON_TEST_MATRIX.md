# Form & Button Test Matrix

**Phase 2 branch:** `maintainpro/final-acceptance-phase2`
**Baseline:** PR #43 `ad4ec4e2`
**Legend:** PASS = exercised with evidence · PARTIAL = API/suite · OPEN = not claimed · EXTERNAL = third party

## Priority mutation forms

| ID | Module | UI surface | Method | Endpoint | Status | Evidence |
|----|--------|------------|--------|----------|--------|----------|
| F-AUTH-01 | Auth | `/login` | POST | `/api/auth/login` | PASS | seed users + a11y smoke |
| F-REQ-01 | Requests | `/requests/new` | POST | `/api/maintenance-requests` | PASS | Phase2 journeys + SQL |
| F-REQ-02 | Requests | review/approve/convert | POST | `/api/maintenance-requests/:id/*` | PASS | Phase2 regression |
| F-WO-01 | Work orders | create | POST | `/api/work-orders` | PASS | Phase2 lifecycle |
| F-WO-02 | Work orders | status/assign/verify/close | PATCH/POST | `/api/work-orders/:id/*` | PASS | full lifecycle + QR |
| F-WO-03 | Work orders | queues | GET | `/api/work-orders/queues` | PASS | warm 154ms |
| F-PM-01 | Planning | PM plans | POST | `/api/planning/pm-plans` | PASS | Phase2 + snapshot fix |
| F-INV-01 | Inventory | stock in/out | POST | `/api/inventory/parts/:id/stock-*` | PASS | SQL quantityInStock + movement |
| F-INV-02 | Inventory | stock counts | POST | `/api/inventory/stock-counts*` | PASS | POSTED + dup reject |
| F-PO-01 | Procurement | PO list | GET | `/api/inventory/purchase-orders` | PASS | repo-owned list (no Bileeta) |
| F-APR-01 | Approvals | inbox | GET | `/api/approvals/inbox` | PASS | Phase2 |
| F-VEH-01 | Vehicles | list | GET | `/api/vehicles` | PASS | Phase2 |
| F-GATE-01 | Fleet | eligibility | GET | `/api/fleet-lifecycle/vehicles/:id/gate-eligibility` | PASS | Phase2 |
| F-SAFE-01 | Safety | work permits | GET | `/api/work-permits` | PASS | Phase2 |
| F-REL-01 | Reliability | policy | GET | `/api/reliability/policy` | PASS | Phase2 |
| F-NTF-01 | Notifications | list/WS | GET/WS | `/api/notifications` | PASS | PR #43 preserved |

## Lifecycle actions

| Action | Status | Evidence |
|--------|--------|----------|
| Plan / Assign / Start / Hold / Resume / Complete / Verify / Close | PASS | P2-wo-* |
| Cancel | PASS | P2-wo-cancel |
| Invalid transition from CLOSED | PASS | P2-wo-invalid-from-closed |
| Unauthorized verify | PASS | P2-wo-unauthorized-verify |
| QR verify before complete | PASS | P2-wo-qr-verify |

## Coverage notes

- Exhaustive click of every control on all 192 pages is **not** claimed.
- Operational mutation paths above are Phase 2 proven via API=SQL scripts.
