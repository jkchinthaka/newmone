# MaintainPro Mobile V2 — Progress

## Control block

| Field | Value |
|---|---|
| AUTHORITATIVE_MAIN_SHA | `2fd697e004da8524b6348c1ad2d33411a873a2a8` |
| BRANCH | `feature/mobile-v2` |
| DRAFT_PR | https://github.com/jkchinthaka/newmone/pull/28 |
| CURRENT_PHASE | WO vertical slice quality gate met; FG CL30 blocked at SSO/session boundary |
| LAST_VERIFIED_IMPLEMENTATION_SHA | `da96125` (evidence) / `252b51f` (parts+activity) / `b3946b0` (tests) |
| PRODUCTION_MUTATION | NO |
| PRODUCTION_DEPLOYMENT | NO |

Progress SHA rule: do **not** create commits solely to refresh HEAD pointers in this file.

## CI triage (Priority 0)

### Docker Build Check — production structure fixture

- **Error:** `DJANGO_ALLOWED_HOSTS is required`
- **Reproduced locally:** yes
- **Diff vs origin/main (compose/fixture):** none
- **main also failing** since PR #25 FG compose restore
- **Verdict:** pre-existing / unrelated to Mobile V2 — documented, not bypassed

### Release Validation — WO-CONTRACT-004

- **Verdict:** Mobile V2 regression — **fixed** (`createdById` datasource restored)

## Completed

- [x] WO queues, list, search/filter, detail, notes, start/`TECHNICIAN_COMPLETED`
- [x] Evidence upload pipeline + pending local retention
- [x] Parts read-only + activity timeline
- [x] Role-aware actions + in-flight guards
- [x] 31 flutter tests + WO create contract selftest
- [x] FG integration boundary documented (`MOBILE_FG_INTEGRATION.md`)
- [x] FG Hub screen (SSO probe only; CL30 mutations blocked)

## Incomplete / next

- [ ] Additive Nest `/api/mobile/fg/*` session proxy (required for CL30 mutations)
- [ ] Then FG CL30 Recorder → Supervisor → QA on mobile
- [ ] Gate In/Out
- [ ] Parts issue/return (intentionally blocked on mobile)
- [ ] `/api/mobile/bootstrap` etc.

## API gaps

1. No `/api/mobile/fg/*` — **blocks native CL30**
2. No `/api/mobile/bootstrap`
3. No static OpenAPI without Nest boot
4. WO HTTP Idempotency-Key not server-enforced
5. Evidence `uploadUrl` often null in mock mode (matches web)
6. Parts stock mutations not on mobile (intentional)

## Test results

```
flutter analyze → No issues found
flutter test → 31/31 passed
work-order-create-contract.selftest → PASS
```

## Next exact action

Implement additive Nest `/api/mobile/fg/*` proxy (session jar server-side) then resume CL30 UI.
