# MaintainPro Mobile V2 — Progress

## Control block

| Field | Value |
|---|---|
| AUTHORITATIVE_MAIN_SHA | `2fd697e004da8524b6348c1ad2d33411a873a2a8` |
| BRANCH | `feature/mobile-v2` |
| DRAFT_PR | https://github.com/jkchinthaka/newmone/pull/28 |
| CURRENT_PHASE | Vehicles/Fleet vertical |
| LAST_VERIFIED_IMPLEMENTATION_SHA | c9b1bd8 / a28d6c0 / 0cceca7 |
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
- [x] Fleet hub + vehicles list/detail (Nest `/api/vehicles/*`)
- [x] Trip start/end (online-only; Nest `tripEnd` rejects non-`IN_PROGRESS`)
- [x] Fuel log + fuel analytics (online; `clientActionId` UUID)
- [x] Meter reading (online; InFlightGuard only)
- [x] Drivers list/detail (partial — Nest role-gated SUPER_ADMIN/ADMIN/ASSET_MANAGER)
- [x] Android platform scaffolding regenerated + core library desugaring for local launch
- [x] Flutter tests 81/81 (includes fleet); analyze clean (this run)

## Incomplete / next

- [ ] Live FG UAT — needs non-prod `FG_API_INTERNAL_URL` (+ Redis in prod-like)
- [ ] Live Gate multi-device / device-clock UAT on non-prod
- [ ] Camera Universal Scan wiring
- [ ] Remaining FG CL18 / CL24 after FG UAT
- [ ] Driver unassign — **blocked** (no Nest unassign API)
- [ ] Live fleet map
- [ ] Full vehicle cost reports beyond fuel-analytics
- [ ] `/api/mobile/bootstrap` aggregation

## API gaps

1. Live FG E2E not runnable without approved non-prod FG config
2. WO Idempotency-Key still not server-enforced for WO mutations
3. Trips / meter: no server Idempotency-Key (client InFlightGuard only); fuel uses `clientActionId`
4. Driver unassign endpoint missing
5. Drivers directory restricted to SUPER_ADMIN / ADMIN / ASSET_MANAGER (FLEET_MANAGER etc. get 403)
6. OpenAPI static export still runtime-only
7. Baseline Docker compose fixture `DJANGO_*` missing vars still failing on main (unrelated)

## FG UAT blocker (exact)

No local `maintainpro/.env` or `apps/api/.env` with `FG_API_INTERNAL_URL`.  
Do not guess production URL. Fleet/Gate continue independently.

## Platform note (local launch)

Android folder regenerated; `isCoreLibraryDesugaringEnabled = true` + `desugar_jdk_libs` so Flutter plugins requiring Java 8+ APIs build/run locally.

## Next exact action

Commit fleet + Nest `tripEnd` IN_PROGRESS guard; fill `LAST_VERIFIED_*` SHAs; keep PR #28 draft; when non-prod FG URL is provided, run FG UAT checklist.
