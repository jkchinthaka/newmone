# Master readiness — 2026-08-18 closure

Date: 2026-08-18
Branch: `fix/live-production-remediation`

## Git truth

| Checkpoint | SHA | On current branch? |
|---|---|---|
| Inventory engine | `bc5c82a00a8fa61ba70f399ca1204357cde194c3` | YES |
| FG Next.js UI | `2213a2f32649afdfd8299a6e51f4d08b9f1b6dbf` | YES |
| Frontend unification | `795b13b3c3f7c5f8d4c6ec93b8747eb499ffa387` | YES |
| WO approval vs reservation | `d74789a195377bc190583dc3d16f1471ada46a7b` | YES |
| Django FG subtree + occurrence tokens + security pins | `0eab98fa` | YES |

`d74789a1` / `795b13b3` / `da98a337` are ancestors of current HEAD. Not stranded.

## Inventory

Engine: `apps/api/src/modules/inventory/inventory-transaction.engine.ts`

Available stock remains on-hand − reserved. Approval of a work-order part request is **not** physical reservation. When reservation fails, approval may still succeed with `procurementRequired=true` and `reservedQuantity=0`. `partIsPhysicallyAvailable()` encodes that rule.

### Disposable Mongo

Prior PASS (2026-08-18) used schema at inventory-engine time. Later Prisma commits `51bba3fc` and `20d7061f` changed schema. That prior disposable validation is **stale**. Not re-run in this gate (`DISPOSABLE_MONGO_URL` unset; production Atlas / `nelna-mongodb-dev:27017` not used).

## FG Digital Records

`FG_NEXTJS_UI_ENABLED` / `NEXT_PUBLIC_FG_NEXTJS_UI_ENABLED` remain **false**.

Django lives at `maintainpro/systems/fg-digital-recording/` on this branch.

| Form | Intended | Django Daily Records / JSON API |
|---|---|---|
| CL18 | MULTIPLE independent records/day + occurrence token | date + occurrence token |
| CL24 | ONE record/day | date only |
| CL30 | MULTIPLE independent records/day + occurrence token | date + occurrence token |

Targeted Django pytest (Python 3.13, local FG postgres `127.0.0.1:5433` / redis `127.0.0.1:6380`): **19 passed** (`test_nextjs_json_api`, `test_controlled_daily_records`, `test_daily_records_completion`).

`release/fg-erp-combined-candidate` was not force-pushed. Origin still has three Mongo bootstrap commits that branch does not. Occurrence-token Django changes were extracted onto this branch instead of merging the full diverged branch.

## Security

Production `npm audit --omit=dev`: **critical=0**. Direct pins: `websocket-driver@0.7.5`, `fast-xml-parser@5.11.0` with npm overrides. Dev-only `concurrently` / `shell-quote` criticals remain outside the production tree.

Historical Git credential exposure: **PENDING_EXTERNAL_ACTION**. History was not rewritten.

## Production

PRODUCTION_CHANGED=NO
Schema not pushed to production.
`FG_NEXTJS_UI_ENABLED` not toggled in production.
No fake production smoke data.
FG_LIVE_BROWSER_SMOKE=MANUAL_VALIDATION_PENDING
BUSINESS_UAT_SIGNOFF=PENDING
