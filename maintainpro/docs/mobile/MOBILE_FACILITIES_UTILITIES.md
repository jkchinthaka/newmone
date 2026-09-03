# Mobile V2 — Facilities / Cleaning / Utilities

## Source contracts (Nest)

| Surface | Endpoint | Permission / role |
|---------|----------|-------------------|
| Properties | `GET /api/facilities/properties` | `facilities.view` + FAC roles |
| Buildings / floors / rooms | `GET /api/facilities/*` hierarchy | `facilities.view` |
| Facility issues | `GET /api/cleaning/issues`, `GET /api/cleaning/issues/:id` | `facility_issues.view` (+ expanded read roles) |
| Cleaning locations | `GET /api/cleaning/locations` | `cleaning.view` |
| Utility meters | `GET /api/utilities/meters`, `GET /api/utilities/meters/:id` | `utilities.manage` |
| Meter readings | `GET /api/utilities/meters/:id/readings` | `utilities.manage` |
| Work order link | `FacilityIssue.workOrderId` → existing WO detail route | `work_orders.view` |

**Not on Nest for mobile V2:** generic facility scan resolver (cleaning has location QR on web only). Work orders have no `facilityId` — link via issue `workOrderId`.

## Mobile routes

- `/facilities` hub
- `/facilities/rooms`, `/facilities/rooms/:id`
- `/facilities/issues`, `/facilities/issues/:id`
- `/facilities/cleaning`
- `/facilities/issues/report`
- `/facilities/cleaning/visits`

Nav policy maps legacy module keys `cleaning` and `utilities` to the facilities hub subtree.

## Read vs blocked mutations

| Operation | Mobile V2 |
|-----------|-----------|
| Rooms/properties browse + search | READ |
| Issues list/detail + WO deep link | READ |
| Cleaning locations browse | READ |
| Meters + reading history | READ |
| Issue create/report | **PARTIAL_ONLINE_ONLY** — local draft + online submit; duplicate-check UX; no outbox auto-replay (no server idempotency) |
| Cleaning visits | READ (`GET /cleaning/visits`) |
| Cleaning visit sign-off / completion | **BLOCKED** (no proven idempotency/retry) |
| Meter reading entry | **BLOCKED** (monotonic validation + retry semantics unproven for mobile queue) |
| Issue status transitions | **BLOCKED** |
| Hierarchy edits | **BLOCKED** |

## Offline policy

- **Cache OK (future):** room list/detail snapshot, cleaning locations, meter list/history.
- **Online required:** issue submission, cleaning completion, meter entry, status changes, WO transitions.
- **LOCAL_DRAFT (planned):** facility issue report — not queued in this slice.

## RBAC / tenant

Flutter hides cards when permissions missing; Nest enforces `JwtAuthGuard` + `TenantContextGuard` + role/permission guards on every endpoint. Tenant from `X-Tenant-Id` / JWT — never from request body.

## Idempotency / concurrency gaps

- Cleaning visit completion and meter POST lack documented idempotency keys for mobile replay.
- Issue create has no client-side idempotency contract documented for offline outbox.

Document as **gaps** until server audit adds keys or duplicate-safe semantics.
