# MaintainPro Mobile V2 — QA Matrix

**Base SHA:** `2fd697e004da8524b6348c1ad2d33411a873a2a8`

## Continuous gates (every milestone)

```bash
cd maintainpro/apps/mobile
flutter format --set-exit-if-changed .
flutter analyze
flutter test
```

## Test layers

| Layer | Coverage target |
|---|---|
| Unit | Outbox state machine, nav policy, token refresh lock, payload hash |
| Widget | Login, shell tabs, empty/error/loading components |
| Golden | Status chips / shell (optional) |
| Contract | Auth + work-order DTO shape vs API envelope `{ success, data, message }` |
| Integration | Login → home → WO list (against local/UAT only) |
| RBAC | Role × module visibility + negative API expectations |
| Tenant | User A drafts invisible to User B on shared device |
| Offline | Kill during save, reboot with draft, offline→online drain |

## Required failure scenarios

| Scenario | Expected |
|---|---|
| Network drop mid-save | Draft retained `LOCAL_DRAFT`/`QUEUED` |
| Double-tap Save | Single operation / idempotent |
| Timeout then retry | No duplicate critical record |
| App killed mid-save | Draft restored |
| App killed mid-image upload | Upload resumes or safe retry |
| Restart with pending draft | Sync Center shows pending |
| Reboot with pending draft | Persisted |
| Token expiry during form | Refresh or re-auth; outbox preserved |
| Token expiry during sync | Pause drain; resume after refresh |
| Tenant switch | Vault isolation; no bleed |
| Shared device user switch | Isolation |
| Permission removed while open | Actions disappear; API 403 handled |
| Concurrent edit | Conflict UI on 409 |
| API 400/401/403/409/429/500 | Mapped user messages + retry where safe |
| Storage full | Explicit error; no silent data loss claim |
| Clock manipulated | Server time still used for business stamps |
| Low bandwidth | Progressive load; timeouts graceful |
| Offline → online | Automatic drain |
| App upgrade with unsynced drafts | Migration preserves outbox |

## NFR (provisional)

| Metric | Target |
|---|---|
| Confirmed draft loss | 0 |
| Retry-created duplicate critical tx | 0 |
| Cross-tenant exposure | 0 |
| Unauthorized critical mutations | 0 |
| Crash-free pilot sessions | ≥ 99.5% |
| Cold usable launch | ~≤ 3s on agreed low-end device |
| Cached primary screen | ~≤ 1s perceived |
| Constrained-network dashboard | ~≤ 4s where backend allows |

Do not fabricate performance numbers.

## UI quality gate (per screen)

Mobile-first, no horizontal overflow, text scaling, empty/loading/error, validation, keyboard, one-handed, tablet shell, semantic status, role visibility, no hardcoded business placeholders, no debug chrome in release UX.

## Latest automated run (this session)

- `flutter analyze`: clean
- `flutter test`: **81/81** passed (includes gate + **fleet** models/api/rbac/list tests)
- Nest: `vehicles-phase2.service` tripEnd IN_PROGRESS rejection + prior gate/FG suites — passed where run

## Gate failure scenarios (automated / expected)

| Scenario | Expected |
|---|---|
| Offline Gate Out/In | Blocked — "Gate authorization requires connection" |
| Double-tap Gate Out | InFlightGuard + Idempotency-Key → single movement |
| Forged approvedByUserId | Server ignores; approver = actor with `gate.override.approve` |
| Unauthorized override | 403 Forbidden |
| Missing override reason | 400 |
| Meter lower than authoritative | 400 from Nest |
| Device clock / occurredAt | Ordinary users: server time only |
| Timeout after commit | Recheck eligibility/movements — do not claim failure blindly |
| Stale two-device Gate Out | Second blocked by vehicle status policy |

## Fleet failure scenarios (automated / expected)

| Scenario | Expected |
|---|---|
| Offline trip start/end | Blocked — connection required; no outbox |
| Offline fuel / meter | Blocked — connection required; no outbox |
| Double-tap trip / meter | InFlightGuard only — **no** server Idempotency-Key |
| Double-tap / retry fuel | Same `clientActionId` → Nest returns existing fuel log |
| Trip end non-IN_PROGRESS | Nest 400; mobile End disabled without active trip |
| Trip body with occurredAt | Client strips; Nest owns timestamps |
| Drivers list as DRIVER/MANAGER | 403 / hub hides Drivers (SUPER_ADMIN/ADMIN/ASSET_MANAGER only) |
| Driver unassign | Blocked — no API; do not fake client-side |
| Meter below authoritative | 400 from Nest |
| Timeout after trip/fuel commit | Re-fetch trips/fuel-logs before claiming failure |
| Health chip | Maps `serviceStatus` + alerts only — not a new scoring model |
