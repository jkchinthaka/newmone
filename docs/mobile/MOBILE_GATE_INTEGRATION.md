# MaintainPro Mobile V2 — Gate Integration

**Domain:** Fleet Gate In / Gate Out  
**Authoritative systems:** Nest `VehiclesService` + Prisma `VehicleGateMovement` (no Django)

## Architecture

```
Flutter (Bearer MaintainPro JWT)
  → GET  /api/vehicles?q=                  (search)
  → GET  /api/vehicles/:id                 (summary)
  → GET  /api/vehicles/:id/gate-eligibility (server policy preview)
  → POST /api/vehicles/:id/gate-out        (Idempotency-Key)
  → POST /api/vehicles/:id/gate-in         (Idempotency-Key)
  → GET  /api/vehicles/:id/gate-movements  (history)
```

Online required for Gate In/Out. Offline message: **Gate authorization requires connection**. No outbox queue for gate mutations.

## Security audit (this milestone)

| Check | Result |
|---|---|
| Client `allowOverride` alone authorizes? | **FIXED** — requires actor `gate.override.approve` (or SUPER_ADMIN) |
| Client `approvedByUserId` trusted? | **FIXED** — ignored for auth; `approvedById` = authenticated actor |
| Forged manager ID bypass? | **NO** — Forbidden without override permission |
| Override reason | Required when override path taken |
| `occurredAt` from phone | Ignored for ordinary gate users; only override/admin may supply, with ±24h / 30d bounds; else server `new Date()` |
| Meter | Server `canMeterReadingAdvance` / monotonic rules |
| Blocking | Status, overdue service, compliance, critical WOs — server reasons returned |
| Idempotency | Optional `Idempotency-Key` header → reconcile same movement |
| Tenant | Existing tenant scoping on vehicle/driver lookups |

## Permissions

| Key | Use |
|---|---|
| `vehicles.view` | Search, eligibility, movements |
| `gate.out.create` | Gate Out |
| `gate.in.create` | Gate In |
| `gate.override.approve` | Override blocked Gate Out (actor must hold this) |

UI hide is UX only; Nest RBAC remains authoritative.

## Flutter screens

| Route | Screen |
|---|---|
| `/gate` | Gate home — search / scan entry |
| `/gate/vehicle/:id` | Vehicle + eligibility + history |
| `/gate/vehicle/:id/out` | Gate Out form |
| `/gate/vehicle/:id/in` | Gate In form |

Override UI shown only when `eligibility.canOverride == true` **and** JWT lists `gate.override.approve`. Mobile never sends `approvedByUserId` or `occurredAt`.

## Gaps / known limits

- Camera Universal Scan still foundation (manual code / registration resolve)
- Driver picker is free-text driver ID (server validates)
- Live multi-device concurrency UAT not run in this session (server rejects duplicate IN_USE via status policy)
- Baseline Docker compose fixture failures remain on main (unrelated)
