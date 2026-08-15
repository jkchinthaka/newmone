# PostgreSQL → MongoDB Migration Strategy

**Document status:** Strategy draft — **not** migration authorization  
**Created:** 2026-08-10  
**Baseline SoR on `main`:** PostgreSQL (ADR-002) at commit `8acfc68`  
**Assessment:** [ADR-018](../architecture/ADR-018-DATABASE-PLATFORM-MONGODB-ASSESSMENT.md) (**POC REQUIRED**)  
**Matrix:** [MONGODB_COMPATIBILITY_MATRIX.md](MONGODB_COMPATIBILITY_MATRIX.md)  
**POC plan:** [MONGODB_POC_PLAN.md](MONGODB_POC_PLAN.md)

## Rule

Do **not** migrate `main` until:

1. DB-02 POC report records **PASS** (or **PASS_WITH_REFACTOR** with implemented redesign proof) for all critical invariants
2. Written **APR-020** approval
3. Explicit owner confirmation that no unknown/real company data will be destroyed

Blind URI swap is **forbidden**.

## Target backend

Official **Django MongoDB Backend** only (Django 5.2 docs).

Do **not** use Djongo, Mongoose, abandoned third-party backends, or invent `__v` versioning schemes.

## Recommended sequence

| Step | Gate |
| --- | --- |
| DB-01 Assessment (this package) | Docs + inventory complete; PG remains SoR |
| DB-02 Isolated POC | Critical concurrency/uniqueness/immutability proven |
| DB-03 Controlled migration | Only if DB-02 = **MONGODB POC PASSED — DB-03 MAY PROCEED** |
| Dual-run / cutover | OWNER REQUIRED; backup/restore drills REQUIRED |

## Option preference (technical, pending APR-020)

| Option | Summary | Near-term recommendation |
| --- | --- | --- |
| **A** Relational-on-Mongo | Keep Django model shapes; change engine; redesign locks | Possible after POC redesign of `select_for_update` / nested atomic |
| **B** Document redesign | Embed immutable submission responses; fewer multi-doc writes | Strong candidate for recording/submit path after redesign |
| **C** Hybrid (PG SoR) | Mongo for non-authoritative workloads only | Safest technically; may fail company “Mongo SoR” mandate |

**Default engineering stance until APR-020:** keep PostgreSQL as SoR; use POC results to choose A vs B (or reject Mongo for core workflows).

## Critical invariants that must survive cutover

1. Employee-code uniqueness (case-insensitive strategy proven)
2. Organization isolation / RBAC scope
3. Checklist version number uniqueness under concurrency
4. Task uniqueness `(org, template, batch_reference)`
5. One `ChecklistRecord` per task
6. Immutable submission snapshots (incl. `sample_index`, `calculation_context`)
7. Submission numbering without duplicates
8. One SupervisorReview per submission
9. One correction per source submission
10. One QAReview per submission
11. Audit append integrity
12. Idempotent duplicate starts/submits

## Data classification gate (before DB-03)

| Classification | Action |
| --- | --- |
| Development/test only | May rebuild empty Mongo schemas after backup of PG dump |
| Real company data | STOP — written migration plan + owner approval required |
| Unknown | STOP — treat as real until proven otherwise |

## What DB-03 must not do

- Commit Atlas credentials
- Drop PostgreSQL without dual-run evidence
- Mechanically map every table 1:1 without document design
- Embed unbounded arrays (repeating samples must remain bounded / referenced)
- Claim BUSINESS APPROVED / PRODUCTION READY

## Rollback posture

Until cutover acceptance:

- PostgreSQL remains restore target of record
- Mongo POC environments are disposable
- Application default settings on `main` stay PostgreSQL

## Next technical step

Execute [MONGODB_POC_PLAN.md](MONGODB_POC_PLAN.md) on an **isolated** settings module / branch/worktree. Publish `MONGODB_POC_RESULTS.md` with PASS/FAIL per guarantee.
