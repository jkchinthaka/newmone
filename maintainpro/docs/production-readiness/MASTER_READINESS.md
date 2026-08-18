# Master readiness — pre-enterprise-master reconciliation

Date: 2026-08-18
Branch: `fix/live-production-remediation`
HEAD: `9fb5a20aab4606ce35e2fdd87fdc99f3750b3923` at start of this gate (later commits only if this gate lands code)

## Git truth

| Checkpoint | SHA | On current branch? |
|---|---|---|
| Inventory engine | `bc5c82a00a8fa61ba70f399ca1204357cde194c3` | YES |
| FG Next.js UI | `2213a2f32649afdfd8299a6e51f4d08b9f1b6dbf` | YES |

Classification: **both** inventory and FG Next.js are ancestors of current HEAD. No cherry-pick or merge was required.

## Inventory (verified from source)

Engine: `apps/api/src/modules/inventory/inventory-transaction.engine.ts`

| Capability | Source |
|---|---|
| Reservation / available = on-hand − reserved | `inventory-invariants.ts`, engine `reserve` |
| Negative-stock / reserved>on-hand guard | `assertStockInvariants` |
| Stock ledger | `StockMovement` |
| Transfers | engine `transfer` (paired TRANSFER_OUT / TRANSFER_IN) |
| Work Order integration | `reserveApprovedPartRequest` + issue consumeReservation |
| Excel import | `inventory-excel-import.service.ts` |
| ERP inventory import | same import path + `erp-inventory-adapter.spec.ts` |
| Idempotency claim-before-mutation | `beginIdempotency` create-then-P2002 revalidate |
| P2002 payload revalidation | engine + unit test |
| Reversal linkage | `reversalOfMovementId` / `quantityReversed` |
| Daily inventory | `inventory-daily.service.ts` |
| Inventory UI | `/inventory/import` and inventory section nav |

Tests at inventory commit `bc5c82a0` are still present (not deleted):

- `inventory-transaction.engine.spec.ts` (10 cases at commit; still 10)
- `inventory-invariants.spec.ts`
- `inventory-daily.spec.ts`
- `inventory-excel-parse.spec.ts`
- `tenant-uniqueness-inventory.spec.ts`
- `erp-inventory-adapter.spec.ts`

Governance-era full suite was 163 suites / 1132 tests. This gate adds WO availability + FG occurrence-token + optional disposable Mongo specs. A lower total would not be accepted merely because tests pass.

### Disposable Mongo

Target: local Docker `maintainpro-inv-validate-mongo` on `127.0.0.1:27037` only. Never production Atlas. Never `nelna-mongodb-dev` on 27017.

**DATABASE_DISPOSABLE_VALIDATION=PASS** (2026-08-18): `prisma validate`, `prisma generate`, `db push` (indexes including `WarehouseItemBalance` tenant+warehouse+part unique), engine concurrency (reserve/issue), transfer atomicity, same-key replay, mismatched-payload reject, concurrent duplicate import key, reversal + double-reversal block, WO-style reserve, daily aggregation. Prisma transactions against the disposable replica set served as application-DB startup proof. Full Nest HTTP listen was not required for this gate.

### WO approval vs reservation

**Unchanged behaviour:** if reservation fails after part-request approval, approval still succeeds with `procurementRequired=true` and `reservedQuantity=0`.

Modeled states:

- `PART_REQUEST_APPROVED`
- `STOCK_NOT_RESERVED`
- `PROCUREMENT_REQUIRED`

That combination **does not** mean the part is available. Issue already checks reserved/available stock. Helper `partIsPhysicallyAvailable()` documents the rule; tests prove `approval != reservation`.

Policy already encoded: keep approval success + procurement flag. Do not auto-fail approval for lack of stock.

## FG Digital Records

`FG_NEXTJS_UI_ENABLED` / `NEXT_PUBLIC_FG_NEXTJS_UI_ENABLED` remain **false**.

Django is **not** in this worktree. Authoritative occurrence-token machinery lives in Combined-Release / FG-Platform:

| Fact | Source |
|---|---|
| Occurrence key uniqueness `(org, template, occurrence_key)` | FG subtree squash `b7887991` from inner `475a1020`; `apps/scheduling/models.py` |
| Retry-stable manual tokens | `create_manual_schedule_occurrence` / `manual_occurrence_key` in `generation.py`; tests in `test_phase07e_recurring_schedules.py` |
| Daily Records open path | `ensure_controlled_daily_task` uses `batch_ref = {slug}-{date}` — **one task/day for every controlled form** including CL18/CL30 |
| Combined-Release JSON API | `2291aa08` wraps that daily path and currently reports CL18 multiplicity `one_per_day` |

**Domain correction (this gate, not the stale Next.js migration report):**

| Form | Intended | Current Django Daily Records / JSON API |
|---|---|---|
| CL18 | MULTIPLE independent records/day + occurrence token | one/day (stale surface) |
| CL24 | ONE record/day | one/day (matches) |
| CL30 | MULTIPLE independent records/day + occurrence token | one/day (stale surface) |

Next.js now sends a stable in-flight `occurrenceToken` for CL18/CL30 (retry/double-click/refresh reuse; new create after success mints a new token) and does **not** copy the stale `one_per_day` label. Django JSON API does not yet consume that token, so **contract parity is not proven**. Flag stays off.

### Combined-Release divergence

`release/fg-erp-combined-candidate`: **ahead 1** (`2291aa08` JSON API) **behind 3** (origin Mongo bootstrap/image: `f7728658`, `928e496b`, `48d96170`). File sets do not overlap. Safe strategy: ordinary merge of origin into the local JSON-API commit — **not performed** (no force-push, no reset, no rewrite). `FG_API_GITHUB_PUSH=BLOCKED_DIVERGED_HISTORY` until an operator merges.

## Gates (this reconciliation)

Observed locally on 2026-08-18:

- TYPECHECK=PASS
- LINT=PASS (`lint` aliases typecheck)
- RBAC=PASS (`npm run audit:rbac`, 697 routes, 0 violations)
- TENANT=PASS (`npm run audit:tenant`)
- FULL_TESTS=PASS (163 suites passed / 1 skipped disposable-mongo unless `DISPOSABLE_MONGO_URL` set; **1138 passed + 10 skipped = 1148**; prior governance baseline 1132 — count increased)
- BUILD=PASS (`npm run build`, Next.js 143 pages)
- FG_DJANGO_TESTS=NOT_RUN (Django requires Python 3.13; this environment has 3.14. Isolated Combined-Release pytest was not executed)
- FG_NEXTJS_TESTS=PASS (Jest mappers/contract/SSO); Playwright `fg-dashboard.spec.ts` remains skipped without `FG_E2E=1`
- FG_NEXTJS_CONTRACT_PARITY=NO (client occurrence tokens not consumed by Django Daily Records JSON API)
- READY_FOR_ENTERPRISE_LOGIC_V2=NO until Django honours CL18/CL30 occurrence tokens and Django tests are run

## Production

PRODUCTION_CHANGED=NO
Schema not pushed to production.
`FG_NEXTJS_UI_ENABLED` not toggled in production.
FG workers/beat not promoted.
No fake production smoke data.
