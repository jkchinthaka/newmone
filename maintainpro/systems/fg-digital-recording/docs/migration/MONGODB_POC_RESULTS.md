# MongoDB POC Results (DB-02)

**Document status:** Engineering evidence — **not** business approval / **not** cutover authorization  
**Date:** 2026-08-10  
**Baseline SoR:** PostgreSQL (ADR-002)  
**Backend under test:** Official `django-mongodb-backend==5.2.3` (Django 5.2.16)  
**Environment:** Local Docker replica set via `compose.mongo-poc.yaml` (`nelnaPocRs`, host `127.0.0.1:27027`)  
**Settings module:** `config.settings.mongo_poc` (isolated; **not** application default)  
**Code under test:** `apps/mongo_poc` mirror models/services (intentionally simplified)

## Executive status

```
STATUS: MONGODB POC PARTIAL — ISOLATED INVARIANTS PASSED; FULL APPLICATION NOT PROVEN — DO NOT MIGRATE
```

**DB-03 must not proceed.** Cutover requires:

1. Full application port / redesign of `select_for_update`, nested savepoints, `prefetch_related`, Subquery/OuterRef selectors, CheckConstraints, and stock `auth.User` AutoField
2. Owner decision **APR-020**
3. Explicit status line: `STATUS: MONGODB POC PASSED — DB-03 MAY PROCEED` after production-path proof

Silence from stakeholders is **not** approval.

## How this POC was run

```powershell
docker compose -f compose.mongo-poc.yaml up -d
$env:DJANGO_SETTINGS_MODULE = "config.settings.mongo_poc"
$env:MONGODB_URI = "mongodb://127.0.0.1:27027/?replicaSet=nelnaPocRs&directConnection=true&retryWrites=true&w=majority"
$env:MONGODB_DATABASE = "nelna_fg_mongo_poc"
uv sync --group mongo-poc
uv run pytest apps/mongo_poc -m mongo_poc -v
```

Default CI / host pytest remains on PostgreSQL (`config.settings.test`) and **ignores** Mongo POC collection.

## Guarantee results

| # | Guarantee | Result | Evidence / notes |
| --- | --- | --- | --- |
| 1 | Django startup on official Mongo backend | **PASS** | `test_django_uses_mongodb_backend`; `manage.py` migrations against RS |
| 2 | Employee-code uniqueness | **PASS_WITH_REFACTOR** | Normalized `employee_code_normalized` + unique `(org, code)`; PG uses `Lower()` expression index |
| 3 | Organization isolation | **PASS** | Same employee code allowed in different orgs |
| 4 | Checklist version uniqueness/concurrency | **PASS_WITH_REFACTOR** | Max+1 + unique retry; **no** `select_for_update` / nested savepoints |
| 5 | Task uniqueness | **PASS** | Concurrent create → one task (`test_concurrent_task_create`) |
| 6 | One record per task | **PASS** | OneToOne + IntegrityError idempotent start |
| 7 | Immutable submission | **PASS** | Header + children; `is_immutable=True` |
| 8 | Response snapshot (incl. sample_index + calculation_context) | **PASS** | Unique `(submission, item_key, sample_index)`; JSON context stored |
| 9 | SupervisorReview uniqueness | **PASS** | Concurrent starts → one row |
| 10 | Correction uniqueness | **PASS** | Concurrent starts → one row |
| 11 | Submission N+1 concurrency | **PASS_WITH_REFACTOR** | Unique `(record, number)` + **TransientTransactionError / WriteConflict retry** required |
| 12 | QAReview uniqueness | **PASS** | Concurrent starts → one row; supervisor link checked |
| 13 | Atomic rollback | **PASS** | Forced abort after header → zero submissions/responses (`django_mongodb_backend.transaction.atomic`) |
| 14 | Idempotent duplicate requests | **PASS** | Unique `(scope, key)` + fetch-on-conflict |
| 15 | Migration / schema evolution | **PASS_WITH_REFACTOR** | POC migrations create indexes; **production PG migrations must not be replayed blindly on Mongo** |
| 16 | Admin compatibility | **PASS_WITH_REFACTOR** | Read-only `ModelAdmin` policy verified; stock `auth.User` AutoField **unsupported** — custom user / ObjectId PK required before AdminSite |
| 17 | Real queue/query compatibility | **NOT_TESTED** | Production QA selectors (`OuterRef`/`Subquery`/`prefetch_related`) not ported |
| 18 | Docker integration (app default on Mongo) | **NOT_TESTED** | Only isolated `compose.mongo-poc.yaml` RS; default `compose.yaml` remains PostgreSQL |

## Production-path guarantees (explicitly not claimed)

| Area | Result | Why |
| --- | --- | --- |
| Full pytest suite on Mongo | **NOT_TESTED** | SoR remains PostgreSQL |
| `django.db.transaction.atomic` equivalence | **FAIL** (as expected) | Backend documents Django atomic as **no-op**; must use `django_mongodb_backend.transaction.atomic` |
| `select_for_update` parity | **FAIL** (unsupported) | Requires redesign everywhere used (~46 call sites per DB-01) |
| Nested savepoints | **FAIL** (unsupported) | Outer atomic only |
| Login lockout under concurrency | **NOT_TESTED** | Needs Redis/versioned update redesign |
| Live AdminSite with auth | **NOT_TESTED** | AutoField blocker |

## Go / no-go (architecture options)

| Option | Verdict | Reason |
| --- | --- | --- |
| A — Mechanical table→collection | **NO-GO** | Locks/savepoints/prefetch/subquery gaps |
| B — Targeted redesign (unique + txn retry + selective embed) | **CONDITIONAL** | Isolated proofs support the *pattern*; full app port still required |
| C — Keep PostgreSQL SoR | **RECOMMENDED until APR-020** | Current production path remains proven |

## Security / secrets

- No Atlas credentials committed
- `.env.example` documents `MONGODB_URI` / `MONGODB_DATABASE` placeholders only
- Optional uv group `mongo-poc` — not required for default CI

## Decision for overnight / DB-03

**DB-03 SKIPPED.**  
Recorded status for cutover gate:

```
STATUS: MONGODB POC FAILED FOR CUTOVER — DO NOT MIGRATE
```

(Rationale: critical *production-path* guarantees remain FAIL or NOT_TESTED even though isolated mirror invariants passed.)
