# MongoDB Compatibility Matrix

**Document status:** Evidence-based assessment — not a migration authorization
**Created:** 2026-08-09
**Updated:** 2026-08-10 (refresh vs `8acfc68`; 06H/06I rows)
**Baseline:** `8acfc68` (`main`)
**Companion:** [ADR-018](../architecture/ADR-018-DATABASE-PLATFORM-MONGODB-ASSESSMENT.md), [MONGODB_POC_PLAN.md](MONGODB_POC_PLAN.md), [POSTGRESQL_TO_MONGODB_MIGRATION_STRATEGY.md](POSTGRESQL_TO_MONGODB_MIGRATION_STRATEGY.md)

## Classification key

| Class | Meaning |
| --- | --- |
| **A** | Supported directly and comparatively safe |
| **B** | Supported with implementation change |
| **C** | Possible but needs architecture redesign |
| **D** | Unsupported / high risk as currently designed |
| **E** | Requires POC before class can be finalized |

**Decision** column values: `KEEP-PG`, `POC`, `REDESIGN`, `BLOCK`, `HYBRID-CANDIDATE`.

Sources for Mongo capability claims: Django MongoDB Backend v5.2 feature compatibility documentation (official). Do not assume PostgreSQL semantics.

---

## Platform & identity

| Feature | Current PostgreSQL Technique | MongoDB Compatibility | Required Refactor | Data Risk | Concurrency Risk | Test Requirement | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Default DB engine | `django.db.backends.postgresql` + psycopg | Different backend package/engine | Settings, Compose, CI, deps | High if swapped blindly | N/A | Full suite on Mongo | `POC` |
| Primary keys | UUID fields widely | ObjectId-oriented; AutoField unsupported | PK strategy POC | High on cutover | Medium | Model CRUD + FKs | `E` / `POC` |
| Employee code uniqueness | `UniqueConstraint(Lower(employee_code))` partial | Functional/CI unique needs proof | May need normalized stored code + unique index | Medium | Medium | Concurrent user create | `E` |
| Login lockout | `select_for_update` + atomic counter | **select_for_update unsupported** | Redesign locking (findAndModify / version field / Redis lock) | Medium | **High** | Concurrent failed login | `D`→`C` via redesign |
| Password hashing / sessions | Django auth | Auth contrib supported (docs) | Config/session store review | Low–Medium | Low | Auth regression | `B` |

---

## RBAC / organizations / master data

| Feature | Current PostgreSQL Technique | MongoDB Compatibility | Required Refactor | Data Risk | Concurrency Risk | Test Requirement | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Org/Site/Department FKs | PROTECT graph | FK partial; `$lookup` cost | Possibly embed site under org **or** keep refs + indexes | Medium | Low | Hierarchy CRUD | `B`/`C` |
| Shift scope uniqueness | Unique + `nulls_distinct=False` + CHECKs | nulls_distinct claimed supported; CHECKs weaker | App validation; unique index POC | Medium | Medium | Concurrent shift create | `E` |
| Role M2M permissions | Django M2M | Supported with limits | Verify M2M collection behavior | Medium | Low | Permission grant tests | `E` |
| Active scoped assignment uniqueness | Partial unique + `nulls_distinct=False` | Partial indexes supported; semantics POC | Confirm NULL key collapsing | **High** (authz duplication) | **High** | Concurrent assignment Barrier tests | `E` |
| Object-aware Product manage | Service checks + org FK | Authz logic portable; query joins change | Selector rewrite if prefetch used | Medium | Low | Authz matrix tests | `B` |
| FGProduct org+code unique | `Lower(code), organization` | Needs functional/normalized unique POC | Possibly store `code_normalized` | Medium | Medium | Concurrent create | `E` |

---

## Checklist definitions

| Feature | Current PostgreSQL Technique | MongoDB Compatibility | Required Refactor | Data Risk | Concurrency Risk | Test Requirement | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Template/version tree | FK PROTECT + CASCADE children | CASCADE less performant; embed sections/items candidate | Option B embed draft/published snapshot | High if CASCADE races | Medium | Publish immutability tests | `C` |
| Version number allocation | `select_for_update` + `Max` + **nested atomic retry** | No row lock; **no savepoints** | Single outer txn + unique retry without nested savepoint | Medium | **High** | Concurrent version allocation | `D`/`C` |
| Position uniqueness | Unique (version, position) etc. | Unique indexes likely | Keep constraints; verify migration | Medium | Medium | Reorder/create tests | `B`/`E` |
| Immutable published versions | Service guards + DB rows | Portable if services preserved | Ensure no silent mutable embeds | **High** | Low | Publish/edit denial tests | `B` |
| Definition selectors with Count annotate | `annotate(Count(...))` | Aggregations partially supported | Possibly raw_aggregate or denorm counts | Low | Low | Selector unit tests | `E` |
| `prefetch_related` definition trees | Nested Prefetch | **Unsupported** | Multiple queries or embed | Medium | Low | UI/query tests | `D`→`C` |

---

## Scheduling

| Feature | Current PostgreSQL Technique | MongoDB Compatibility | Required Refactor | Data Risk | Concurrency Risk | Test Requirement | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| One task per org/template/batch | UniqueConstraint + IntegrityError idempotent return | Unique index + app catch | Confirm IntegrityError mapping | Medium | **High** | Concurrent create dedupe | `B`/`E` |
| Explicit published version FK | PROTECT FK | FK partial | Keep ref + validate publish status in service | Medium | Low | Create/cancel tests | `B` |
| Task list `select_related` | Joins | `$lookup` cost | Projection/denorm display fields | Low | Low | Query budget tests | `B` |

---

## Recording / submission / correction

| Feature | Current PostgreSQL Technique | MongoDB Compatibility | Required Refactor | Data Risk | Concurrency Risk | Test Requirement | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| One record per task | OneToOne PROTECT + lock + IntegrityError | No `select_for_update` | Unique task_id + idempotent create | **High** | **High** | Concurrent start | `C` |
| Response uniqueness + XOR CHECK | Unique + CheckConstraint | CHECK not equivalent | App XOR validation + unique (record,item) | **High** | Medium | Response save tests | `C` |
| Draft save under lock | `select_for_update` record/responses | Unsupported lock | Conditional update / revision field | Medium | **High** | Concurrent draft save | `C` |
| Submission numbering | Unique (record, number) + lock | Unique OK; allocation race without lock | Atomic counter pattern / retry | **High** | **High** | Concurrent submit | `C` |
| Immutable snapshot + bulk_create | Multi-row atomic insert | Multi-doc txn or embed responses | Option B embed strongly preferred | **High** | **High** | Submit immutability + concurrency | `C` |
| Response `(record\|submission, item, sample_index)` uniqueness (06H) | UniqueConstraint | Unique compound index | Preserve sample_index; avoid unbounded embedded arrays | **High** | **High** | Multi-sample concurrent save | `B`/`E` |
| Calculated `calculation_context` JSON (06I) | JSONField on draft/snapshot | JSON support nuances; Decimal strings | Store Decimal as string in context; never recompute history | **High** | Low | Snapshot historical operator tests | `B`/`E` |
| Calculation operand graph (06I) | FK links + cycle checks | FK partial; embed operand ids on CALCULATED item candidate | Keep same-version refs; validate cycles in service | Medium | Low | Publish/cycle tests | `B`/`C` |
| Post-submit edit blocked | Status + service rules | Portable | Keep services | Medium | Low | Mutation denial tests | `A`/`B` |
| Correction O2O per returned submission | O2O + locks | Unique source_submission_id | Idempotent start without reset | **High** | **High** | Concurrent correction start | `C` |
| Resubmit number increment | `Max(submission_number)+1` under locks | Race without lock | Retry on unique conflict | **High** | **High** | Concurrent resubmit | `C` |

---

## Supervisor / QA / audit

| Feature | Current PostgreSQL Technique | MongoDB Compatibility | Required Refactor | Data Risk | Concurrency Risk | Test Requirement | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Exactly one SupervisorReview / submission | O2O + `select_for_update` | Unique submission_id; no row lock | Idempotent create + conflict on different decision | **High** | **High** | Concurrent review | `C` |
| Exactly one QAReview / submission | Dual O2O (submission + supervisor_review) | Dual unique keys | Preserve exact Supervisor linkage in service | **High** | **High** | Concurrent QA | `C` |
| Latest eligible submission rule | `OuterRef`/`Subquery` + filters | Subquery/`$lookup` POC | May denorm `is_latest` flag | **High** if wrong | Medium | Queue correctness tests | `E`/`C` |
| QA queue `prefetch_related` | Nested Prefetch | **Unsupported** | Query redesign | Medium | Low | Query tests | `D`→`C` |
| Append-only audit events | Insert-only services; SET_NULL actors; JSON metadata | Insert OK; JSONField partial | Avoid update/delete paths; JSON null semantics POC | Medium | Low | Audit immutability tests | `B`/`E` |
| Admin read-only operational rows | Admin flags | Admin supported | Re-verify inlines without prefetch | Low | Low | Admin smoke | `B` |

---

## Cross-cutting ORM / migrations / ops

| Feature | Current PostgreSQL Technique | MongoDB Compatibility | Required Refactor | Data Risk | Concurrency Risk | Test Requirement | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `django.db.transaction.atomic` | Ubiquitous | **No-op** on Mongo backend | Replace with `django_mongodb_backend.transaction.atomic` | **High** if missed | **High** | Every workflow integration test | `D` until B |
| Nested atomic / savepoints | Version allocate retry | **Unsupported** | Flatten retry algorithm | Medium | High | Version concurrency | `D`/`C` |
| `select_related` deep chains | Widespread | Emulated via `$lookup` | Reduce depth; denorm | Medium | Low | Performance budgets | `B` |
| `prefetch_related` | Selectors | **Unsupported** | Eliminate | Medium | Low | Selector rewrite tests | `D` |
| Health `SELECT 1` | `cursor.execute` | Different ping | Backend-appropriate ping | Low | Low | Health endpoint | `B` |
| Existing Django migrations | PostgreSQL operations graph | Not portable as-is | New Mongo migration strategy / rebuild | **Very high** | N/A | Migration POC | `BLOCK` cutover |
| `dumpdata` / `loaddata` | Available on PG | **Unsupported** (docs) | Alternate export tooling | High for cutover | N/A | Export/restore drill | `C` |
| DDL transactions | PG migration atomicity | Unsupported | Careful migration ops | High | N/A | Migration failure drills | `C` |
| Compose postgres service | Required today | Would become Mongo/Atlas | Dual-run during POC only | Medium | N/A | CI matrix | `POC` |
| Redis/Celery | Independent | Keep | None for DB swap | Low | Low | Smoke | `KEEP-PG` sibling |

---

## Highest-risk unsupported patterns (summary)

1. **`select_for_update` anywhere critical** — class **D** until redesigned (**C**).
2. **`prefetch_related` in selectors** — class **D** until redesigned.
3. **Assuming `django.db.transaction.atomic` works** — class **D** until API swap proven.
4. **Nested savepoint retry** (checklist version allocation) — class **D**/**C**.
5. **Blind reuse of PostgreSQL migrations** — cutover **BLOCK**.
6. **Multi-row immutable submit without embed or multi-doc txn redesign** — class **C**.

---

## Recommended target model (assessment only)

| Preference order (technical safety) | Notes |
| --- | --- |
| 1. Keep PostgreSQL SoR (Option C hybrid only if Mongo still mandated for non-authoritative data) | Safest for food-safety workflows |
| 2. If Mongo must be SoR: Option B for immutable submission snapshots + redesigned concurrency | Large rewrite; POC mandatory |
| 3. Option A pure relational-on-Mongo | Only after POC proves uniqueness/txn/query substitutes for row locks |

**Final business choice of SoR remains APR-020 / Management Sponsor — silence is not approval.**
