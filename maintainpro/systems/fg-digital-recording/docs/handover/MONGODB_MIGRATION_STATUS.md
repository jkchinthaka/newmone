# MongoDB Migration Status

## Executive status

```text
STARTING_BRANCH=feature/mongodb-same-maintainpro-db
STARTING_SHA=c140d72
MAIN_SHA=d5a4460
ORIGIN_MAIN_SHA=d5a4460
```

PostgreSQL remains the authoritative system of record on `main`.

```text
CONTINUATION REQUIRED — MONGODB FUNCTIONAL PARITY MIGRATION CHECKPOINT CREATED
```

---

## Production target (unchanged)

```text
Host route: via MONGODB_URI (do not hard-code 127.0.0.1:27018 in Python)
Logical database: mgintginpro_prod
FG namespace: fg_
Isolated POC only: fg_same_db_poc
Company Mongo writes: NONE
MaintainPro impact: NONE
main merged: NO
```

---

## Checkpoint progress

| Item | Status |
| --- | --- |
| Persistence facade | Extended — `locked_get`, `prefetch_related_compat`, `cas_status_transition`, Mongo QuerySet safety net |
| Checklist versioning | Done — unique(template, version_number)+retry, CAS publish/retire, draft immutability guard |
| Scheduling | Done — `lock_queryset`/`atomic_fn`, unique occurrence_key upsert, CAS cancel |
| CAPA | Done — `locked_get` + status CAS close/verify/effectiveness + open guard |
| NCR / Hold | Done — `locked_get` + status CAS close + open guard |
| Access-control governance | Done — last raw `select_for_update` sites → `lock_queryset` + `atomic_fn` |
| Production `.select_for_update(` | **0** outside persistence facade helper |
| Operational `.prefetch_related(` | **0** outside facade/compat; recording uses batched `load_version_items_for_recording` |
| Health | Backend-aware: Mongo mode pings Mongo+Redis, not PostgreSQL |
| FG-only backup plan | `docs/handover/MONGO_BACKUP_RESTORE_SHARED_DB.md` |
| Concurrency spikes (PG harness) | Checklist / scheduling / CAPA / NCR / core persistence — green |
| Full Mongo pytest suite | Not run |
| Live company read-only audit | Script ready — not executed |

### Inventory counts (this checkpoint)

```text
SELECT_FOR_UPDATE INITIAL=137
SELECT_FOR_UPDATE CURRENT_RAW_PRODUCTION=0  (facade helper only)
SELECT_FOR_UPDATE MIGRATED≈137

PREFETCH INITIAL=34
PREFETCH CURRENT_RAW_PRODUCTION=0  (compat helper / Mongo no-op only)
PREFETCH REMAINING_COMPAT_SITES≈operational via prefetch_related_compat

TRANSACTION.ATOMIC ≈328 remaining (many behind atomic_fn / PG-only paths)
LOWER / FUNCTION ≈87 (still to rewrite for Mongo)
```

---

## Next exact action

1. Isolated Mongo POC (`fg_same_db_poc`): migrate + run full pytest under `mongo_same_db_poc`
2. Rewrite high-priority `Lower()` / function expressions (employee_code uniqueness, search)
3. Contrib Mongo AppConfig activation (POC only) — auth/session/admin proof
4. Full recording → Supervisor → QA → RCA workflow on **actual** isolated Mongo
5. Isolated FG-only dump/restore drill
6. PostgreSQL regression + quality gates

---

## Safety

- Do not write to `mgintginpro_prod`
- Do not merge `main`
- Do not touch MaintainPro data
