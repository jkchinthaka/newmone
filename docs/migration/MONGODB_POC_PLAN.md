# MongoDB POC Plan

**Document status:** Proposed proof-of-concept plan — not production migration
**Created:** 2026-08-09
**Updated:** 2026-08-10 (baseline `8acfc68`; include 06H/06I scenarios)
**Baseline:** `8acfc68` (`main`)
**ADR:** [ADR-018](../architecture/ADR-018-DATABASE-PLATFORM-MONGODB-ASSESSMENT.md) (status: **POC REQUIRED**)
**Matrix:** [MONGODB_COMPATIBILITY_MATRIX.md](MONGODB_COMPATIBILITY_MATRIX.md)
**Strategy:** [POSTGRESQL_TO_MONGODB_MIGRATION_STRATEGY.md](POSTGRESQL_TO_MONGODB_MIGRATION_STRATEGY.md)

## Purpose

Validate whether MongoDB (local replica set and/or Atlas **dev** cluster) can preserve Nelna FG **integrity, concurrency, and audit** properties that PostgreSQL currently provides — **before** any DB-02 cutover design.

## Non-goals

- Replace PostgreSQL on `main`
- Remove psycopg
- Store real Atlas secrets in git
- Rewrite all production models on `main`
- Delete or rewrite PostgreSQL migrations on `main`
- Migrate production/pilot data
- Claim MongoDB migration complete

## Success criteria (all required)

1. Critical uniqueness invariants hold under concurrent clients (see scenarios).
2. Immutable submission snapshots cannot be partially written.
3. Supervisor and QA uniqueness (one row/doc per submission) holds under concurrency; duplicate starts are idempotent.
4. Correction resubmit allocates increasing submission numbers without duplicates under concurrency.
5. Transaction API behavior is correct using **Mongo backend** `atomic` (Django native atomic must not be relied upon).
6. QA “latest eligible submission” selection matches PostgreSQL semantics on fixtures.
7. Schema/index creation path is repeatable without PostgreSQL migrations.
8. Admin can open read-only operational views without `prefetch_related`.
9. Performance of queue/detail paths measured and compared to PostgreSQL baseline budgets.
10. Written POC report with go/no-go for each Option A/B/C.

Any failed critical scenario ⇒ **NO-GO** for DB-02.

## Environment

| Item | Requirement |
| --- | --- |
| Branch | Isolated POC branch or worktree — do not break `main` PostgreSQL CI |
| MongoDB | Replica set required for transactions (Atlas free/dev cluster **or** local replica set) |
| App | Disposable settings module (e.g. `config.settings.mongo_poc`) — not production |
| Secrets | Local env / secret manager placeholders only (`MONGODB_URI=mongodb+srv://...` placeholder) |
| PostgreSQL | Remains default for `main` tests |

## Work packages (ordered by risk)

### WP0 — Tooling spike (1–2 days)

- Add optional dependency group for Django MongoDB Backend (POC only; not required on `main` default).
- Prove connection, ping/health, create one trivial model with unique index.
- Document that `django.db.transaction.atomic` is a no-op; switch spike code to backend `atomic`.

**Exit:** Hello-world commit on POC branch; notes checked into `docs/migration/` as POC results appendix (later).

### WP1 — Uniqueness & NULL semantics (critical)

Port minimal models or mirror collections for:

- Employee code uniqueness (case-insensitive strategy)
- Shift scope unique with nullable site/department (`nulls_distinct` behavior)
- Active scoped role assignment uniqueness
- Task unique `(organization, template, batch_reference)`

**Tests:** Concurrent creators (Barrier/ThreadPool) expecting single winner / idempotent return.

### WP2 — Atomic workflow creation without `select_for_update`

Implement POC variants for:

- Start checklist record (one per task)
- Create supervisor review (one per submission)
- Create QA review (one per submission + exact supervisor link)

Strategies to try (evidence which works):

1. Unique index + insert + catch duplicate key → re-fetch (current IntegrityError pattern)
2. Mongo multi-document transaction with backend `atomic`
3. Single-document redesign (embedded state) — Option B slice only if 1–2 fail

**Explicitly forbidden in POC conclusions:** claiming row-lock equivalence.

### WP3 — Immutable submissions

POC two designs:

- **A-style:** submission header doc + child response docs in one backend transaction
- **B-style:** submission doc with embedded responses array

Verify:

- Readers never see header without full responses
- Updates to snapshot denied
- Concurrent submit → exactly one submission number `1` (or exactly one winning number)

### WP4 — Correction numbering

Under concurrency:

- Exactly one open correction per returned source submission
- Duplicate `start_correction` does not reset in-progress correction
- Concurrent resubmit → monotonic unique `(record, submission_number)` with no duplicates

### WP5 — Transactions & savepoints

- Confirm nested `atomic` does **not** provide savepoints.
- Re-implement version-number allocation without nested savepoints.
- Abort mid-flight write; assert rollback of all docs in txn.

### WP6 — Query support

Port minimal selectors:

- QA queue latest-submission logic (`OuterRef`/`Subquery` equivalent)
- Definition tree loading **without** `prefetch_related`
- `select_related`-heavy detail page

Record query counts and latency vs PostgreSQL.

### WP7 — Migrations / admin / ops

- Create indexes via Mongo-supported migration path (not replaying PG migrations).
- Admin change-list for submission/QA read-only.
- Backup/restore drill on Atlas **dev** (or local): snapshot → restore → integrity check.
- Connection pool + timeout settings documented with placeholders.

### WP8 — Performance

Compare PostgreSQL baseline vs Mongo POC for:

- QA queue page
- Submission detail
- Concurrent submit (throughput + error rate)

Fail if correctness fails; performance regressions require owner acceptance before any later adoption.

## Test matrix (minimum)

| ID | Scenario | Pass rule |
| --- | --- | --- |
| POC-T01 | Concurrent task create same batch | One task; idempotent return |
| POC-T02 | Concurrent start record | One record |
| POC-T03 | Concurrent submit | One immutable snapshot set |
| POC-T04 | Concurrent supervisor decisions | One review; conflict rules preserved |
| POC-T05 | Concurrent QA decisions | One QAReview; supervisor link exact |
| POC-T06 | Concurrent correction start | One correction; no reset |
| POC-T07 | Concurrent correction resubmit | Unique increasing numbers |
| POC-T08 | Version allocate concurrent | Unique contiguous-enough numbers; no lost rows |
| POC-T09 | Lockout concurrent failures | Threshold honored |
| POC-T10 | Assignment unique concurrent | One active assignment |
| POC-T11 | Txn abort | No partial submit |
| POC-T12 | Latest submission QA eligibility | Matches fixture expectations |
| POC-T13 | No prefetch_related usage | Code search clean in POC paths |
| POC-T14 | Admin read-only smoke | No write paths |

Reuse existing pytest concurrency patterns where practical; run against Mongo settings module.

## Deliverables

1. POC branch (not merged to `main` until approved)
2. Results doc: `docs/migration/MONGODB_POC_RESULTS.md` (create after execution)
3. Updated ADR-018 status: `BLOCKED` / remain `POC REQUIRED` / propose `ACCEPTED` **only with evidence**
4. Updated APR-020 with owner decision
5. Go/no-go table for Options A/B/C

## Tentative effort (provisional)

| Phase | Provisional duration | Note |
| --- | --- | --- |
| WP0–WP2 | 1–2 weeks | Highest risk gate |
| WP3–WP5 | 1–2 weeks | Depends on WP2 outcome |
| WP6–WP8 | 1 week | Can overlap slightly |
| Results + architecture recommendation | 2–3 days | Includes owner review pack |

Estimates are **provisional** until team capacity confirmed (OWNER TO BE CONFIRMED).

## Governance checkpoints

| Checkpoint | Owner | Rule |
| --- | --- | --- |
| Start POC | Technical Lead + IT Manager | Written acknowledgment of Atlas/dev cost |
| Mid-POC (after WP2) | Technical Lead | Stop if uniqueness/concurrency fails hard |
| End POC | Management Sponsor / IT / QA | APR-020 decision: keep PG, hybrid, or authorize redesign |
| DB-02 start | Change control | **Forbidden** until POC pass + written approval |

Silence is not approval.
