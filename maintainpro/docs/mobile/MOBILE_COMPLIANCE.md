# Mobile V2 — Compliance / Safety

## Source contracts (Nest)

| Surface | Endpoint | Permission |
|---------|----------|------------|
| Fleet compliance summary | `GET /api/compliance/summary` | `compliance.view` |
| Expiring documents | `GET /api/compliance/expiring-documents?days=` | `compliance.view` |
| Vehicle compliance eval | `GET /api/compliance/vehicles/:vehicleId` | `compliance.view` |
| Vehicle document detail | `GET /api/vehicle-documents/:id` | `vehicle_documents.view` |
| Per-vehicle documents | `GET /api/vehicles/:vehicleId/documents` | `vehicle_documents.view` |
| Accidents list/detail | `GET /api/accidents`, `GET /api/accidents/:id` | `accidents.view` |
| Accident report | `POST /api/accidents` | `accidents.report` |
| Insurance claims | `GET /api/insurance-claims`, `/:id` | `insurance_claims.view` |
| Traffic fines | `GET /api/traffic-fines`, `/:id` | `traffic_fines.view` |

Compliance status and expiring/expired states are **server-derived** (`ComplianceService.evaluate`).

## Mobile routes

- `/compliance` hub
- `/compliance/documents/expiring`, `/compliance/documents/:id`
- `/compliance/accidents`, `/compliance/accidents/:id`, `/compliance/accidents/report`
- `/compliance/insurance-claims`, `/compliance/insurance-claims/:id`
- `/compliance/traffic-fines`, `/compliance/traffic-fines/:id`

## Read vs blocked mutations

| Operation | Mobile V2 |
|-----------|-----------|
| Compliance summary / expiring docs | READ |
| Document detail + vehicle deep link | READ |
| Accidents list/detail + WO link | READ |
| Accident report | **PARTIAL_ONLINE_ONLY** (local draft; no auto-replay) |
| Insurance claims list/detail | READ |
| Claim approval/status | **BLOCKED** (financial; `insurance_claims.approve`) |
| Traffic fines list/detail | READ |
| Fine payment | **BLOCKED** (`traffic_fines.payment`) |
| Document verify/upload | **BLOCKED** (audit/idempotency unproven for mobile queue) |

## Integration

- Accident / claim detail → `/work-orders/:id` when `workOrderId` present
- Document / accident / fine detail → `/fleet/vehicles/:id`

## Idempotency gaps

- `POST /accidents` — no idempotency key; mobile does not enqueue create
- `POST /traffic-fines` — same (report flow deferred)
- Claim approval and fine payment — online-only on web
