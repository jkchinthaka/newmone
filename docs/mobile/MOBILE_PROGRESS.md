# MaintainPro Mobile V2 — Progress

## Control block

| Field | Value |
|---|---|
| AUTHORITATIVE_MAIN_SHA | `2fd697e004da8524b6348c1ad2d33411a873a2a8` |
| BRANCH | `feature/mobile-v2` |
| DRAFT_PR | https://github.com/jkchinthaka/newmone/pull/28 |
| CURRENT_PHASE | Work Order vertical slice complete (quality gate); FG CL30 next |
| LAST_VERIFIED_IMPLEMENTATION_SHA | _(set at commit time to the WO evidence/parts/history implementation commit — not a self-referential progress-only SHA)_ |
| PRODUCTION_MUTATION | NO |
| PRODUCTION_DEPLOYMENT | NO |

Progress SHA rule: do **not** create commits solely to refresh HEAD pointers in this file.

## CI triage (Priority 0)

### Docker Build Check — `Validate compose config (production structure fixture)`

- **Error:** `required variable DJANGO_ALLOWED_HOSTS is missing a value`
- **Reproduced locally:** same error with fixture `.env`
- **Diff vs `origin/main`:** none for `docker-compose*.yml` or `.env.production.structure-fixture.example`
- **Evidence:** `main` Docker Build Check also failing since PR #25 (`restore-fg-compose-wiring`) — runs `33261622166`, `33267900779`, `33293735976`
- **Verdict:** **B — pre-existing / unrelated to Mobile V2**
- **Action taken:** documented only; no fixture/secret-validation bypass on this branch

### Release Validation — `WO-CONTRACT-004`

- **Error:** Flutter create path missing `createdById` (file moved during V2 scaffold)
- **Verdict:** **A — Mobile V2 regression**
- **Fix:** restored `apps/mobile/lib/features/work_orders/data/datasources/work_orders_remote_datasource.dart` with `createdById` on create; selftest passes

## Completed (this resume)

- [x] CI triage with evidence
- [x] WO-CONTRACT-004 fix
- [x] Evidence upload pipeline (pick/compress/local pending → upload-request → optional bytes → confirm → delete local after success)
- [x] Parts read-only on WO detail
- [x] Activity timeline on WO detail
- [x] Field detail UX sections + role-aware actions + in-flight guards
- [x] Tests: 31 mobile + WO create contract selftest

## Incomplete / next

- [ ] Parts issue/return (blocked: stock mutations online-authoritative; not inventing client stock)
- [ ] Optional GET `:id/history` context panel
- [ ] FG CL30 vertical (Recorder → Supervisor → QA) via real SSO/Django contracts
- [ ] Gate In/Out
- [ ] `/api/mobile/*` BFF (additive)
- [ ] Static OpenAPI export

## Parity snapshot

| Metric | Approx |
|---|---|
| Rows total | 86 (+4 WO detail sub-rows 12a–12d) |
| Done | queues/list/detail/notes/evidence/parts-RO/activity + foundation screens |
| Partial | dashboard UI, history context, hub domains |
| Blocked | WO parts issue/return on mobile; OpenAPI static; `/api/mobile/*` |

## API gaps

1. No `/api/mobile/*` aggregation
2. No static `contracts/openapi.json` without Nest boot
3. Work-order HTTP `Idempotency-Key` not server-enforced (evidence uses `clientGeneratedId` dedupe)
4. Evidence `uploadUrl` often null in mock storage — confirm-after-request matches web
5. FG recording not in Nest — SSO + Django/Next only
6. Parts stock mutations not exposed on mobile (intentional)

## Test results (latest verified run)

```
flutter analyze → No issues found
flutter test → 31/31 passed
node scripts/test/work-order-create-contract.selftest.mjs → all PASS
```

## Next exact action

Begin FG CL30 against Django + FG SSO + Next `/fg` contracts (no parallel FG backend).
