# ADR-018 — Database Platform: MongoDB / Atlas Compatibility Assessment

**Status:** POC PARTIAL (isolated) — CUTOVER BLOCKED
**Date:** 2026-08-09 (updated 2026-08-10 after DB-02)
**Phase:** Architecture assessment (no production migration)
**Baseline commit:** `8ff44e2` DB-01; DB-02 evidence in [MONGODB_POC_RESULTS.md](../migration/MONGODB_POC_RESULTS.md)
**Supersedes:** Nothing. **Does not supersede** [ADR-002](ADR-002-POSTGRESQL-PRIMARY-DATABASE.md) until a later accepted decision with full-app POC evidence.
**Related:** APR-020, DEC-003, DL-044, RSK-G-001, [MONGODB_COMPATIBILITY_MATRIX.md](../migration/MONGODB_COMPATIBILITY_MATRIX.md), [MONGODB_POC_PLAN.md](../migration/MONGODB_POC_PLAN.md), [MONGODB_POC_RESULTS.md](../migration/MONGODB_POC_RESULTS.md), [POSTGRESQL_TO_MONGODB_MIGRATION_STRATEGY.md](../migration/POSTGRESQL_TO_MONGODB_MIGRATION_STRATEGY.md)

## Context

### Business request

The company has requested **MongoDB / MongoDB Atlas**.

### Engineering baseline

This greenfield system was engineered as a **modular Django monolith** with **PostgreSQL** as the authoritative operational store (ADR-002 / DEC-003):

- Relational identity, org scope, RBAC, tasks, drafts, immutable submissions, Supervisor/QA reviews
- Heavy use of foreign keys (`PROTECT` dominant), unique/check constraints, and multi-row ACID workflows
- Concurrency control centered on `transaction.atomic` + `select_for_update` + unique constraints + `IntegrityError` recovery
- Redis/Celery remain orthogonal (cache/jobs), not a substitute for operational integrity

### Assessment rule

Do **not** blindly replace `DATABASE_URL` / PostgreSQL settings with a MongoDB URI. Django MongoDB Backend is **not** a drop-in for PostgreSQL behavior.

Official Django MongoDB Backend (Django 5.2 docs) states, among other limits:

- Django’s native `django.db.transaction.atomic()` is a **no-op**; a backend-specific `atomic` API is required
- Nested savepoints / nested `atomic` blocks are **unsupported**
- `QuerySet.select_for_update()` is **unsupported**
- `QuerySet.prefetch_related()` is **unsupported**
- `ForeignKey` is only **partially** supported (prefer embedded models for performance; `$lookup` cost)
- `AutoField` / `BigAutoField` / `SmallAutoField` unsupported (ObjectId-oriented identity model)
- Migration DDL transactions unsupported; several dump/load commands unsupported
- Transactions require replica set or sharded cluster (Atlas qualifies; standalone does not)

Evidence URL (feature compatibility, v5.2):
https://www.mongodb.com/docs/languages/python/django-mongodb/v5.2/limitations-upcoming/

## Decision (current)

**Status = POC PARTIAL (isolated invariants) — DO NOT MIGRATE.**

1. PostgreSQL remains the **implemented system of record** on `main`.
2. MongoDB / Atlas remains a **company-requested platform change under assessment**, not an accepted replacement.
3. DB-02 isolated POC (`apps/mongo_poc` + `compose.mongo-poc.yaml` + official `django-mongodb-backend`) proved unique-index + Mongo `atomic` + WriteConflict retry patterns for **mirror** models — see [MONGODB_POC_RESULTS.md](../migration/MONGODB_POC_RESULTS.md).
4. **DB-03 cutover is blocked:** production-path guarantees (`select_for_update`, nested savepoints, `prefetch_related`, Subquery/OuterRef queues, stock `auth.User` AutoField, full suite on Mongo) remain FAIL or NOT_TESTED.
5. No production data migration, secret materialization, or wholesale model rewrite authorized by this ADR.

This ADR is **not ACCEPTED** as a platform switch. Acceptance requires full-application POC evidence plus written owner approval (APR-020).

## Repository evidence summary (audit)

Inventory snapshot at baseline (approximate; see matrix for detail):

| Pattern | Approx. scale (apps, excl. tests/migrations; 2026-08-10) | Risk vs MongoDB backend |
| --- | ---: | --- |
| Concrete models | Growing (incl. 06H/06I response sample_index + calculation links) | Relational graph not document-native |
| ForeignKey / OneToOne / M2M | High tens | Partial FK support; `$lookup` / redesign pressure |
| UniqueConstraint | 20+ (incl. response/sample uniqueness) | Often OK with unique indexes; functional/`Lower`/partial/`nulls_distinct` need POC |
| CheckConstraint | 4+ XOR typed-response checks | App-level validation may be required |
| `transaction.atomic` | ~68 service usages | Must migrate API; nested savepoints fail |
| `select_for_update` | ~46 | **Unsupported** — concurrency redesign mandatory |
| `prefetch_related` | ~23 | **Unsupported** — query redesign mandatory |
| `OuterRef`/`Subquery` | QA queue (~4) | **POC required** |
| `JSONField` | audit metadata + `calculation_context` | Partial support nuances — **POC for Decimal-safe historical context** |
| PostgreSQL `nulls_distinct=False` | Shift + ScopedRoleAssignment | Backend claims support — **POC required** |
| Functional `Lower()` constraints/indexes | Widespread CI uniqueness | **POC required** |

### Critical workflows depending on row locks + uniqueness

| Workflow | Technique today | Mongo impact |
| --- | --- | --- |
| Login lockout | `select_for_update` on user | Redesign (C/D) |
| Scoped assignment uniqueness | partial unique + `nulls_distinct=False` | E/POC |
| Checklist version allocation | lock + `Max` + nested atomic retry | Savepoints unsupported (C/D) |
| Task create idempotency | unique + IntegrityError return | B/E |
| Start record (1:1 task) | lock + O2O + IntegrityError | C (no row lock) |
| Draft save | lock record/responses | C |
| Submit + snapshot | lock + bulk_create + unique number | C/D |
| Supervisor review (1 per submission) | lock + O2O | C |
| Correction + next submission number | locks + `Max+1` + O2O | C/D |
| QA review (1 per submission + Supervisor link) | locks + dual O2O + latest Subquery | C/D |

## Options evaluated

### Option A — Relational-style Django models on official Django MongoDB Backend

Keep current model shapes roughly intact; change backend/engine; adapt transactions/concurrency.

| Dimension | Assessment |
| --- | --- |
| Integrity | Weaker without true FK enforcement parity; must lean on unique indexes + app rules |
| Transactions | Possible via backend `atomic`, but no savepoints; multi-doc txn cost/limits |
| Concurrency | **Broken as-written** without `select_for_update` redesign |
| Query complexity | `prefetch_related` removed; heavy `select_related` becomes `$lookup` |
| Reporting | Joins harder; exports/reporting redesign likely |
| Migrations | Existing PostgreSQL migrations are **not** portable as-is |
| Ops / Atlas | Feasible with Atlas discipline |
| Dev complexity | High (touch most services) |
| Business risk | High if rushed; food-safety workflow races |

### Option B — Document-oriented redesign (embedded immutable snapshots)

Preserve separate collections for identity/RBAC/tasks; embed submission responses and selected related snapshots inside submission documents; redesign review docs carefully.

| Dimension | Assessment |
| --- | --- |
| Integrity | Better for immutable snapshot locality; worse for cross-entity references unless carefully keyed |
| Transactions | Fewer multi-doc writes for submit path if embedded |
| Concurrency | Still need uniqueness for review/task/record; still no row locks |
| Query complexity | Better for submission detail; worse for relational admin/report joins |
| Migrations | Greenfield Mongo schema + dual-write/ETL if cutting over |
| Dev complexity | **Very high** (major rewrite of recording/reviews/quality) |
| Business risk | Large schedule risk; must not invent business rules during redesign |

### Option C — MongoDB for selected workloads; PostgreSQL remains system of record

Examples (hypothetical only): analytics scratchpad, non-authoritative search cache, future AI assistance logs — **not** authoritative checklist/QA decisions.

| Dimension | Assessment |
| --- | --- |
| Integrity | Best preserves current safety properties |
| Transactions / concurrency | Unchanged for core workflows |
| Business fit | May be **unacceptable** if the company requires MongoDB as primary SoR — **OWNER DECISION** (APR-020) |
| Dual-running cost | Extra ops surface if both platforms hosted |

**Note:** Option C must be documented, not assumed. If Management Sponsor requires MongoDB as the only operational database, Option C is rejected by policy even if it is technically safest.

## Comparison (summary)

| Criterion | A Relational-on-Mongo | B Document redesign | C Hybrid (PG SoR) |
| --- | --- | --- | --- |
| Integrity | Medium–Low until proven | Medium (redesigned) | High (current) |
| Transactions | Medium (custom API) | Medium–High if embedded | High |
| Concurrency | Low until redesign | Medium after redesign | High |
| Query / UI selectors | Low–Medium | Medium | High |
| Reporting | Low–Medium | Medium | High |
| Migration effort | High | Very high | Low–Medium |
| Atlas ops | Required | Required | Optional/partial |
| Business Mongo mandate | May satisfy | May satisfy | May fail mandate |
| Near-term safety | Poor without POC | Poor without redesign+POC | Best |

## Atlas production requirements (placeholders only)

If MongoDB proceeds after POC, production must include:

| Requirement | Placeholder / note |
| --- | --- |
| Environment separation | Distinct Atlas projects/clusters for `dev`, `staging`, `prod` |
| Database user | `nelna_fg_app_<env>` (placeholder name) |
| Least privilege | Read/write only required DBs; no atlasAdmin for app |
| SRV URI | `mongodb+srv://<USER>:<PASSWORD>@<CLUSTER>/<DB>?retryWrites=true&w=majority` |
| TLS | Required (Atlas default); verify CA trust on app hosts |
| Network access | IP allow list and/or private endpoint / VPC — **OWNER REQUIRED** |
| Secret storage | Vault/secret manager — **APR-026**; never commit credentials |
| Backups | Atlas continuous backup / snapshots enabled per env |
| Restore testing | Documented restore drill before PRODUCTION READY |
| Monitoring | Atlas alerts + app health checks |
| Indexes | Created from model Meta + explicit review of unique workflow keys |
| Connection pool | Tuned `maxPoolSize` / app workers; avoid connection storms |
| Timeouts | Explicit serverSelection/connect/socket timeouts in URI/settings |

No real credentials belong in this repository.

## Consequences

### Positive

- Company MongoDB request is acknowledged with an evidence path instead of a silent refusal or unsafe swap
- Highest-risk gaps (`select_for_update`, `prefetch_related`, savepoints) are explicit
- PostgreSQL remains safe for ongoing feature work until a cutover decision

### Negative / costs

- POC consumes engineering time before any platform benefit
- Option A or B implies substantial service and test rewrites
- Existing migration graph cannot be “replayed” onto MongoDB unchanged
- Dual narrative risk: stakeholders may equate “assessed” with “migrated” — PROJECT_STATUS must stay truthful

## Go / no-go for DB-02 (migration implementation)

| Gate | Result |
| --- | --- |
| Blind URI swap | **NO-GO** |
| DB-02 full migration start now | **NO-GO** |
| Bounded MongoDB POC (see POC plan) | **GO** (authorized assessment next step) |
| Accept MongoDB as SoR | **BLOCKED** on POC + APR-020 written approval |

## References

- ADR-002 PostgreSQL primary database
- Django MongoDB Backend feature compatibility (v5.2)
- `apps/*/models.py`, `apps/*/services.py`, concurrency tests under `apps/*/tests/`
- [MONGODB_COMPATIBILITY_MATRIX.md](../migration/MONGODB_COMPATIBILITY_MATRIX.md)
- [MONGODB_POC_PLAN.md](../migration/MONGODB_POC_PLAN.md)
