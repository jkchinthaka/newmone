# MaintainPro Mobile V2 — Fleet / Vehicles Integration

**Domain:** Fleet hub, vehicles, trips, fuel, meter, drivers  
**Authoritative systems:** Nest `VehiclesService` + `DriversController` + Prisma (no mobile BFF, no Django)

## Architecture

```
Flutter (Bearer MaintainPro JWT)
  → GET  /api/vehicles                    (list + summary + alerts)
  → GET  /api/vehicles/:id                (detail)
  → GET  /api/vehicles/:id/trips|fuel-logs|meter-logs|gate-movements|fuel-analytics
  → POST /api/vehicles/:id/trip-start     (online, InFlightGuard)
  → POST /api/vehicles/:id/trip-end       (online, InFlightGuard; status must be IN_PROGRESS)
  → POST /api/vehicles/:id/fuel-log       (online; body clientActionId UUID)
  → POST /api/vehicles/:id/meter-reading  (online, InFlightGuard)
  → POST /api/vehicles/:id/assign-driver  (online; vehicles.edit)
  → GET  /api/drivers                     (role-gated — see below)
```

Gate remains a separate vertical at `/gate` (see `MOBILE_GATE_INTEGRATION.md`). Fleet routes live under `/fleet…`.

## Online mutation policy

| Mutation | Outbox? | Client guard | Server idempotency |
|---|---|---|---|
| Trip start | **Never** | `InFlightGuard` | **None** (no Idempotency-Key) |
| Trip end | **Never** | `InFlightGuard` | **None** |
| Meter reading | **Never** | `InFlightGuard` | **None** |
| Fuel log | **Never** | `InFlightGuard` + stable UUID | Optional `clientActionId` (service dedupes) |
| Assign driver | **Never** | online check | N/A |

Do **not** send `occurredAt` / `startTime` / `endTime` from the phone for trips — Nest owns timestamps.

Offline UX: banner + disabled submit; message that trip/fuel/meter/assign require connection.

## Idempotency gaps

1. **Trips & meter** — Nest has no Idempotency-Key handling. Double-tap / retry after timeout can create duplicates if the first request already committed. Mitigation: `InFlightGuard` only. After timeout, re-fetch trips/meter logs before claiming failure.
2. **Fuel** — send a screen-lifetime UUID as `clientActionId`; Nest returns the existing log on duplicate. Still online-only.
3. **Unassign** — no Nest endpoint; cannot queue or fake unassign on device.

## tripEnd IN_PROGRESS fix

Nest `VehiclesService.tripEnd` now rejects trips whose status is not `TripStatus.IN_PROGRESS` (`BadRequestException`). Mobile end-trip UI only offers End when listTrips finds an in-progress trip (`status` contains `IN_PROGRESS`).

## Drivers role blocker

`GET /api/drivers` (+ detail) is `@Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")`.  
Fleet hub hides Drivers nav unless role matches. Other roles with `vehicles.view` still use vehicles/trips/fuel; drivers directory returns 403 (handled as elevated-role empty/forbidden UI).

## Unassign blocker

`POST /vehicles/:id/assign-driver` exists; **no unassign / clear-driver API**. Mobile must not invent a client-only unassign. Tracked as api-gap until Nest adds it.

## Health & costs (partial)

- **Health:** maps server `serviceStatus` + alerts summary only (overdue→Critical, dueSoon→Attention). No new mobile health algorithm.
- **Costs:** vehicle detail shows `fuel-analytics` (liters, cost, L/100km, cost/km). Full `/vehicles/costs` report surface not ported.

## Flutter screens

| Route | Screen |
|---|---|
| `/fleet` | Hub — summary, alerts, Vehicles / Drivers / Gate links |
| `/fleet/vehicles` | List (search/status) |
| `/fleet/vehicles/:id` | Detail + ops + history tabs |
| `…/trip-start`, `…/trip-end` | Online trip forms |
| `…/fuel`, `…/meter` | Online fuel / meter forms |
| `/fleet/drivers`, `/fleet/drivers/:id` | Role-gated directory |

## Permissions (UI)

| Key | Use |
|---|---|
| `vehicles.view` | Hub, list, detail, analytics read |
| `vehicles.operate` | Trip / fuel / meter actions |
| `vehicles.edit` | Assign driver |
| Gate perms | Deep-link to `/gate/vehicle/:id` when held |

UI hide ≠ security; Nest RBAC remains authoritative.

## Gaps / known limits

- Live fleet map not on mobile (hub/planned)
- Drivers directory role set narrower than fleet managers on web
- No driver unassign
- Trips/meter idempotency server gap
- Camera Universal Scan still WIP for vehicle resolve
