# MongoDB compatibility inventory — FG Digital Recording

**Date:** 2026-08-15  
**Target database:** `maintainpro_prod`  
**Backend:** official `django-mongodb-backend` (not Djongo)

## Verdict

**PARTIAL PASS — cutover scaffolding exists; full-application Mongo cutover is NOT complete.**

Platform integration may proceed for:

- shared DB naming / `fg_` namespace
- MaintainPro reference reads
- vehicle selector + snapshots
- `/fg` routing / branding

Do **not** claim production Mongo cutover READY until blockers below are cleared.

## Inventory highlights

| Area | Observation | Mongo impact |
| --- | --- | --- |
| Models | ~360+ Django models across FG apps | Need ObjectId / UUID strategy per model |
| ForeignKey / O2O / M2M | Hundreds of relations | Prefer references; embed only exclusive children |
| `transaction.atomic` | Widespread | Facade in `apps/core/persistence/transactions.py`; multi-doc uses explicit `mongo_multi_doc_atomic` |
| `Lower()` unique constraints | Dozens | Not portable — replace with normalized fields / unique indexes |
| `select_for_update` | Present in locking helpers | Mapped via persistence facade / CAS patterns |
| Raw SQL | Limited; health previously assumed SQL | Mongo readiness uses connection ping |
| Django auth/admin | Contrib AppConfigs under `config/mongo_contrib.py` + `mongo_migrations/` | POC-proven path; full RBAC regression still required |
| Tests | Large suite assumes PostgreSQL | Mongo markers / isolated POC DB required |
| Official backend | `django-mongodb-backend==5.2.3` in `mongo-poc` group | Must remain the only Mongo ORM path |

## Refactor direction (approved)

1. Keep Django services/forms/views.
2. Activate `FG_COLLECTION_NAMESPACE_ENABLED` + `fg_` prefix in shared DB modes.
3. Use ObjectIdAutoField where required for new Mongo-native models.
4. Preserve MaintainPro PascalCase collections; never write them from FG ORM.
5. Centralize MaintainPro reads in `apps/integrations/maintainpro/`.

## Explicit non-goals for this inventory

- Automatic production data migration
- Dropping PostgreSQL historical data
- Using system DBs or a second application database
