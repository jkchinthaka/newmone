# Mongo-Specific Test Strategy

**Status:** In progress on `feature/mongodb-same-maintainpro-db`  
**Isolated POC DB only:** `fg_same_db_poc` (NOT `maintainpro_prod`)  
**Production target (later):** `127.0.0.1:27018` / `maintainpro_prod`

PostgreSQL pytest results are **not** Mongo evidence.

---

## Profiles

| Profile | Settings | Database | Purpose |
| --- | --- | --- | --- |
| Default CI | `config.settings.test` | PostgreSQL | Production-safe baseline |
| Mongo same-DB POC | `config.settings.mongo_same_db_poc` | `fg_same_db_poc` | Compatibility engineering |
| Mongo cutover (future) | `config.settings.mongo_same_db` | `maintainpro_prod` | Authorized cutover only |

---

## Failure taxonomy

When a test fails under Mongo POC, classify as:

```text
PASS ON MONGO
FAIL — UNSUPPORTED QUERY
FAIL — LOCKING ASSUMPTION
FAIL — SCHEMA/PK
FAIL — TRANSACTION
FAIL — TEST HARNESS
POSTGRES-ONLY BY DESIGN
```

---

## Required core Mongo acceptance (before cutover consideration)

- login / lockout / RBAC / cross-org denial
- CL/24, CL/39, CL/30, CL/18
- daily duplicate protection
- Save Draft / Submit / duplicate Submit
- Supervisor Approve / Return
- Correction / Resubmit
- QA RELEASE / HOLD / REJECT
- NCR / RCA / CAPA
- history / export / print / audit trail
- concurrency / retry / idempotency

---

## Current spike coverage (this branch)

| Area | Status |
| --- | --- |
| Namespace / POC guard | PASS (PostgreSQL harness + settings import guard) |
| Optimistic transition primitive | PASS on PostgreSQL proving CAS semantics |
| Supervisor concurrency spike | PASS on PostgreSQL (`transaction=True` races) |
| Full suite on Mongo POC | NOT RUN — continuing |
| QA / Recording / RCA spikes | NOT STARTED |

---

## Redis / Celery

Mongo does **not** replace Redis. Cache, broker, result backend, worker, and beat remain Redis-backed under Mongo POC settings.
