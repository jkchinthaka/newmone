# Phase 21 — Database change and production smoke

## Database change

| Step | Status |
| --- | --- |
| Backup before risky migration | **NOT EXECUTED** (no production DB) |
| Schema / index validation | **NOT EXECUTED** on production |
| Rollback / forward-fix plan documented for candidate release | Template only — attach per-release notes when gates open |

SoR is **PostgreSQL**. Do not run production cutover to Mongo without separate approved ADR/evidence (currently cutover blocked).

## Production smoke test (controlled test data only)

| Check | Result |
| --- | --- |
| Login | **NOT RUN** (no production) |
| RBAC | **NOT RUN** |
| Task / record / submit | **NOT RUN** |
| Supervisor | **NOT RUN** |
| QA | **NOT RUN** |
| Search / audit | **NOT RUN** |
| Integration health | **NOT RUN** / deferred without vendor evidence |

**Do not** accidentally RELEASE real inventory during any future smoke — use explicitly marked controlled test lots only when owners define them.
