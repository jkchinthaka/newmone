# Same-Database MongoDB Cutover Audit — FG + MaintainPro

**Branch:** `feature/mongodb-same-maintainpro-db`  
**Classification:** **MONGODB SAME-DATABASE CUTOVER BLOCKED — INVARIANTS OR BACKEND LIMITATIONS NOT SAFELY RESOLVED**

Do not merge to `main`. PostgreSQL remains the application default on `main`.

---

## Confirmed company MongoDB target

| Field | Value |
| --- | --- |
| Host (documented) | `127.0.0.1` |
| Port (documented) | `27018` |
| **Logical database** | **`mgintginpro_prod`** |
| FG collection namespace | **`fg_` prefix required** |
| Credentials | **Never in Git** — `MONGODB_URI` from server env only |

FG must store collections in **`mgintginpro_prod`**. Do **not** create a separate FG logical database at cutover.

---

## Pre-cutover checklist

| Field | Value |
| --- | --- |
| EXISTING_DATABASE_NAME | **`mgintginpro_prod`** (confirmed) |
| EXISTING_COLLECTION_COUNT | **114** MaintainPro Prisma models (static; live inventory still required) |
| PLANNED_FG_COLLECTION_COUNT | **231** with `fg_` namespace (includes M2M through tables) |
| COLLECTION_COLLISIONS (static) | **0 exact** — see [COLLECTION_COLLISION_AUDIT.md](COLLECTION_COLLISION_AUDIT.md) |
| Live listCollections vs static audit | **PENDING** — read-only on authorized host |
| MONGODB_VERSION | Not verified on `127.0.0.1:27018` |
| TOPOLOGY / TRANSACTIONS | **UNKNOWN** — must not modify company topology |
| BACKUP_VERIFIED | **No** |
| MAINTAINPRO_HEALTH_BEFORE | **Not measured** |

---

## Development / POC rules (mandatory)

1. **Do not write** to `mgintginpro_prod` during development or POC.  
2. Use **`config.settings.mongo_same_db_poc`** with isolated database e.g. `fg_same_db_poc`.  
3. Static collision audit: `uv run python scripts/migration/collection_collision_audit.py`  
4. Production cutover settings: **`config.settings.mongo_same_db`** (fail-closed; requires exact DB name).

---

## Namespace implementation

| Component | Purpose |
| --- | --- |
| `apps/core/db_namespace.py` | Applies `fg_` prefix when `FG_COLLECTION_NAMESPACE_ENABLED=True` |
| `apps/core/apps.py` | Calls namespace on `AppConfig.ready()` |
| `scripts/migration/collection_collision_audit.py` | Static audit vs MaintainPro Prisma schema |
| `scripts/migration/fg_collection_inventory.py` | Lists planned FG collections |

**Gap:** Runtime namespace is applied; **Django migration files still reference PostgreSQL table names** until Mongo-specific migrations are generated on this branch.

---

## PostgreSQL assumptions still blocking cutover

| Blocker | Scale |
| --- | --- |
| `select_for_update()` | **~138 call sites** — unsupported |
| `prefetch_related` | **~30+ usages** |
| `OuterRef` / `Subquery` | QA/supervisor queues |
| Nested savepoints | Checklist versioning |
| Full pytest on Mongo | **Not run** (893 tests = PostgreSQL evidence only) |

See [MONGODB_COMPATIBILITY_MATRIX.md](MONGODB_COMPATIBILITY_MATRIX.md).

---

## Environment variables

```text
MONGODB_URI=<from vault — never commit>
MONGODB_DATABASE=mgintginpro_prod
MONGODB_PRODUCTION_TARGET_DATABASE=mgintginpro_prod
```

Isolated POC (example — no production writes):

```text
DJANGO_SETTINGS_MODULE=config.settings.mongo_same_db_poc
MONGODB_URI=mongodb://127.0.0.1:27027/?replicaSet=nelnaPocRs&directConnection=true&retryWrites=true&w=majority
MONGODB_DATABASE=fg_same_db_poc
MONGODB_PRODUCTION_TARGET_DATABASE=mgintginpro_prod
```

---

## Final classification

```text
MONGODB SAME-DATABASE CUTOVER BLOCKED — INVARIANTS OR BACKEND LIMITATIONS NOT SAFELY RESOLVED
```

Static collection audit with `fg_` prefix: **SAFE — NO COLLISION** (0 exact matches vs 114 MaintainPro Prisma collections).

**Main merged?** No.
