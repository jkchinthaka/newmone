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

- `flutter analyze`: No issues found
- `flutter test`: 12/12 passed
