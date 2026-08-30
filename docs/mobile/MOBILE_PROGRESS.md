# MaintainPro Mobile V2 — Progress

## Control block

| Field | Value |
|---|---|
| AUTHORITATIVE_MAIN_SHA | `2fd697e004da8524b6348c1ad2d33411a873a2a8` |
| BRANCH | `feature/mobile-v2` |
| DRAFT_PR | https://github.com/jkchinthaka/newmone/pull/28 |
| CURRENT_PHASE | Gate In/Out vertical + FG broker hardening |
| LAST_VERIFIED_IMPLEMENTATION_SHA | 30f4298 FG Redis / c91765c gate override / c95d987 Flutter Gate |
| FG_UAT_STATUS | `BLOCKED_BY_NON_PROD_CONFIG` |
| PRODUCTION_MUTATION | NO |
| PRODUCTION_DEPLOYMENT | NO |

Do not create commits solely to refresh HEAD pointers.

## Completed

- [x] WO vertical slice quality gate
- [x] Nest `/api/mobile/fg/*` session broker (allowlisted)
- [x] FG broker production Redis fail-closed (no silent memory fallback)
- [x] Gate override authorization hardened (`gate.override.approve` + actor as approver)
- [x] Gate eligibility endpoint + Idempotency-Key for gate-in/out
- [x] Flutter Gate home / vehicle / in / out (online-only)
- [x] Flutter tests 62/62; analyze clean (this run)

## Incomplete / next

- [ ] Live FG UAT — needs non-prod `FG_API_INTERNAL_URL` (+ Redis in prod-like)
- [ ] Live Gate multi-device / device-clock UAT on non-prod
- [ ] Camera Universal Scan wiring
- [ ] Remaining FG CL18 / CL24 after FG UAT
- [ ] `/api/mobile/bootstrap` aggregation

## API gaps

1. Live FG E2E not runnable without approved non-prod FG config
2. WO Idempotency-Key still not server-enforced for WO mutations
3. OpenAPI static export still runtime-only
4. Baseline Docker compose fixture `DJANGO_*` missing vars still failing on main (unrelated)

## FG UAT blocker (exact)

No local `maintainpro/.env` or `apps/api/.env` with `FG_API_INTERNAL_URL`.  
Do not guess production URL. Continue Gate independently.

## Next exact action

Push this run’s commits; keep PR #28 draft; when non-prod FG URL is provided, run FG UAT checklist; then FG CL18 or Fleet/Drivers as next vertical.
