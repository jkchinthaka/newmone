# Pre-Production Readiness Audit — Combined FG + ERP Excel

**Audit type:** documentation / config inspection only  
**Audit date (UTC):** 2026-08-16  
**Production actions:** NONE (no deploy, no DB writes, no env changes)

---

## 1. Release SHA freeze

| Field | Value |
| --- | --- |
| Repository | https://github.com/jkchinthaka/newmone.git |
| Branch | `release/fg-erp-combined-candidate` |
| Exact SHA | `15564954a6e6d357017e9068a731342ae2016e59` |
| Local HEAD | matches |
| Remote HEAD | matches |
| FG platform source HEAD | `1b256e08a3c40bc07627ad95d03262ab1cb912d2` |
| ERP Excel source HEAD | `100f47f7001c9b5251dfb421a2760d74d13a0fce` |
| FG standalone synchronized tip (reference) | `a8e3ff79a6240b7a7233c0a1bf74dc71064c0295` (not a linear ancestor of combined HEAD; platform branch carries equivalent subtree merge) |
| Production baseline (rollback identity) | `41f19d7aee9a04a4f2aa09b87d281a18af88a762` (`fix/live-production-remediation`) |
| Build date | 2026-08-16 (audit freeze; images not built in this audit) |

### Expected services (target architecture)

| Service | Role |
| --- | --- |
| nginx | Edge routing |
| web | MaintainPro Next.js |
| api | MaintainPro NestJS |
| mongo | MongoDB replica set |
| redis | Cache / queues / Celery broker |
| minio | Object storage |
| fg | FG Django (gunicorn) — **required by nginx; not yet in MaintainPro compose** |
| celery-worker / celery-beat | FG async/scheduling — **required for FG scheduling features; not in MaintainPro compose** |

### Expected database

| Concern | Value |
| --- | --- |
| MaintainPro primary logical DB | Production-confirmed name (compose template uses `nelna`; FG docs target `maintainpro_prod`) — **operator must confirm single live name** |
| FG collections | `fg_*` only (namespace enabled) |
| MaintainPro masters | Existing collections (Vehicle/Asset/etc.); FG read-allowlist only |
| ERP Excel models | `InventoryImportRun` / `InventoryImportRow` (+ enums) via Prisma |

### Expected routes

| Path | Upstream |
| --- | --- |
| `/` | Next.js (`web:3001`) |
| `/api/...` | NestJS (`api:3000`) |
| `/api/backend/...` | Next BFF (`web`) |
| `/fg/...` | Django (`fg:8000`) |
| `/fg/static/...` | Django static |

### Rollback baseline

- **Images / code:** `41f19d7aee9a04a4f2aa09b87d281a18af88a762`
- **Branch:** `fix/live-production-remediation` (do not modify in this audit)
- **DB:** prefer forward-compatible leave-in-place; do not assume dump restore for rollback

---

## 2. Production delta audit

Compare `41f19d7…` → `15564954…` (~1636 files; majority FG subtree addition).

| Class | Production-impacting? | Notes |
| --- | --- | --- |
| API | YES | ERP Excel import services/controller/module; seed permission keys |
| Web | YES | ERP Import UI + navigation (FG + ERP items) |
| Prisma/schema | YES | Additive `InventoryImport*` models/enums/indexes |
| Mongo indexes | YES (prep) | Prisma unique/index on import runs; FG `fg_*` via Django migrate |
| FG Django | YES | Full subtree + Dockerfile; Mongo production settings |
| nginx | YES | `/fg/` + `/fg/static/` upstream `maintainpro_fg` → `fg:8000` |
| Docker/Compose | **GAP** | Base/production compose still: api, web, mongo, redis, minio, nginx — **no `fg` / celery** |
| permissions/seed | YES | Four `inventory.erp_import.*` keys |
| configuration/env | YES | FG env contract + confirm Mongo DB name alignment |
| Redis/Celery | YES (FG) | FG uses Redis; Celery worker/beat needed for scheduling |
| static assets | YES (FG) | Built into FG image; served under `/fg/static/` |
| database data migration | NO destructive | Additive collections/models only; no drop/reset in release path |

### Requires production execution later (do not run now)

1. Fresh MaintainPro Mongo backup + checksum  
2. Immutable image build/tag for SHA `15564954`  
3. Additive Prisma schema sync for `InventoryImport*` (non-destructive)  
4. Idempotent permission seed/update for ERP import keys  
5. FG production Mongo migrate creating `fg_*` only (explicit ops confirmation)  
6. Wire/start `fg` (+ celery if scheduling needed) before/with nginx that references `fg`  
7. Controlled rollout of api/web/nginx  
8. Health + smoke (no ERP apply / no stock mutation on first smoke)

---

## 3. Schema / data safety

**DESTRUCTIVE_SCHEMA_CHANGE = NO**

Prisma delta vs baseline: **+88 lines only** (additive).

New:

- `InventoryImportRun` with `@@unique([tenantId, source, fileSha256])`
- `InventoryImportRow` + indexes
- `InventoryImportStatus` / `InventoryImportRowStatus` enums

No field removals, no rename of unrelated models, no SparePart/StockMovement destructive migration.

**Safe production schema prep (conceptual):**

```text
# From candidate tree, with production DATABASE_URL (app user, not root)
npx prisma validate
npx prisma db push
# OR repository-approved non-destructive sync equivalent
# FORBIDDEN: prisma db push --accept-data-loss | db reset | dropDatabase
```

Classification: **FORWARD_COMPATIBLE** (additive).

---

## 4. FG Mongo production readiness

| Check | Result |
| --- | --- |
| Official `django-mongodb-backend` | YES (pyproject / Dockerfile) |
| Default production backend Mongo | YES (`FG_DATABASE_BACKEND` default `mongodb`) |
| Target DB | Must equal `MONGODB_PRODUCTION_TARGET_DATABASE` (default `maintainpro_prod`) |
| `fg_*` namespace | Forced on in production / mongo_same_db |
| No separate FG logical DB | Documented / enforced for same-db mode |
| Transactions need replica set | Documented; compose mongo uses `--replSet rs0` |
| No PG production dependency | `POSTGRES_REQUIRED = False` on Mongo path |
| Master write protection | Reference client allowlist + read/tenant-scoped; no master duplication |
| Test DB protections | `mongo_test` / bootstrap forbid system DBs; bootstrap also refuses `maintainpro_prod` |

**Operator note:** Confirm live MaintainPro DB name (`maintainpro_prod` vs compose template `nelna`) before cutover env is set.

---

## 5. FG bootstrap safety

| Item | Status |
| --- | --- |
| `bootstrap_mongo_indexes` | Idempotent migrate wrapper; **refuses** `maintainpro_prod` / system DBs — safe for non-prod |
| Production create path | Use `DJANGO_SETTINGS_MODULE=config.settings.production` + `migrate` (not the refusing bootstrap helper) under ops change control |
| Dry-run | `--dry-run` validates settings only |
| Auto-migrate on container start | Dockerfile/entrypoint do **not** auto-migrate |
| Entrypoint caveat | `WAIT_FOR_POSTGRES` defaults to `1` — **must set `WAIT_FOR_POSTGRES=0` for Mongo production** |

**Eventual production commands (do not run now):**

```text
# After backup + topology confirm (replica set)
WAIT_FOR_POSTGRES=0
DJANGO_SETTINGS_MODULE=config.settings.production
# MONGODB_DATABASE == MONGODB_PRODUCTION_TARGET_DATABASE == <confirmed live name>
python manage.py migrate --noinput
```

Optional dry validation on non-prod only:

```text
python manage.py bootstrap_mongo_indexes --dry-run
```

---

## 6. ERP Excel schema readiness

| Requirement | Status |
| --- | --- |
| Models/enums present | YES |
| Unique `(tenantId, source, fileSha256)` | YES |
| Concurrent apply (`VALIDATED → APPLYING`) | Application-level `updateMany` claim (code) |
| SparePart / StockMovement destructive migrate | NO |
| Absolute SET semantics | Preserved (`applyAbsoluteStockBalances`) |

---

## 7. Permission / seed readiness

Catalog + seed include:

- `inventory.erp_import.view`
- `inventory.erp_import.upload`
- `inventory.erp_import.apply`
- `inventory.erp_import.history`

No duplicate keys in `admin-permission-keys.mjs`. FG nav item coexists with ERP Stock Import.

**Production seed:** run idempotent permission upsert only (preserve users/roles/custom data). Do not full destructive reseed.

---

## 8. Docker / compose audit

**Present:** nginx, web, api, mongo, redis, minio (+ minio-init)  
**API restart:** `restart: unless-stopped` (base compose) — suitable for fatal `process.exit(1)`  
**Missing for combined platform:** `fg`, `celery-worker`, `celery-beat` despite nginx upstream `fg:8000`

**DOCKER/COMPOSE gate: NOT_READY** until FG (+ Celery if needed) are defined in the MaintainPro production compose path or an equivalent documented sidecar with shared network/DNS name `fg`.

---

## 9. Nginx routing audit

Config supports `/`, `/api/`, `/api/backend/`, `/fg/`, `/fg/static/` with request-id + forwarded proto + `X-Script-Name /fg`.  
Collision order OK (`^~ /fg/` before `/`).  
**Blocked for deploy:** upstream host `fg` has no compose service today.

---

## 10. Environment contract (NAMES only)

### MaintainPro API

`NODE_ENV`, `PORT`, `CORS_ORIGIN`, `FRONTEND_URL`, `DATABASE_PROVIDER`, `DATABASE_URL`, `PRIMARY_DATABASE_URL`, `BACKUP_DATABASE_URL`, `PRIMARY_DATABASE_NAME`, `BACKUP_DATABASE_NAME`, `MONGO_DATABASE_NAME`, `MONGODB_URI`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `MINIO_*`, `APP_COMMIT_SHA`, `APP_BUILD_TIMESTAMP`, `APP_ENVIRONMENT`, plus optional ERP/Bileeta/SMTP as deployed

### MaintainPro Web

`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_API_ORIGIN`, `NEXT_PUBLIC_USE_BFF`, `API_INTERNAL_URL`, `COOKIE_SECURE`, `ALLOW_INSECURE_HTTP`, `APP_COMMIT_SHA`, `APP_BUILD_TIMESTAMP`

### Mongo

`MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD`, `MONGO_INITDB_DATABASE`, `MONGO_APP_USERNAME`, `MONGO_APP_PASSWORD`  
(App runtime must use **app** credential, not root.)

### Redis / MinIO

`REDIS_URL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`

### FG Django

`DJANGO_SETTINGS_MODULE`, `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`, `FG_DATABASE_BACKEND`, `MONGODB_URI`, `MONGODB_DATABASE`, `MONGODB_PRODUCTION_TARGET_DATABASE`, `REDIS_URL`, `FORCE_SCRIPT_NAME`, `WAIT_FOR_POSTGRES` (=`0` for Mongo), optional `MAINTAINPRO_TENANT_ID` / reference DB names

### FG Celery

`REDIS_URL` / `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, same Mongo settings as web process

### ERP integration

`ERP_MODE`, `ERP_SYNC_MODE`, `BILEETA_API_*` as required for live Bileeta; Excel path is in-app (no Django)

**Secret scan (release tree delta):** PASS (no tracked real `.env`; no credential URIs in API/Web/prisma/infra/scripts delta)

---

## 11. Immutable image plan

| Image | Tag |
| --- | --- |
| `maintainpro-api` | `15564954` |
| `maintainpro-web` | `15564954` |
| `maintainpro-fg` | `15564954` |
| `maintainpro-fg-celery-worker` | `15564954` (if scheduling enabled) |
| `maintainpro-fg-celery-beat` | `15564954` (if beat enabled) |

Do not use `latest` as rollback identity. Images **not** built in this audit.

---

## 12. Backup plan (do not execute now)

Immediately before future deploy:

1. Backup **MaintainPro Mongo only** (confirmed DB name; never unrelated company DBs)  
2. Verify file exists, non-zero size  
3. Generate checksum (SHA-256)  
4. List/read header / `mongorestore --dryRun` equivalent as available  
5. Record timestamp + operator + SHA `15564954`

---

## 13. Rollback plan

| Layer | Action | DB class |
| --- | --- | --- |
| API/Web images | Redeploy tags for `41f19d7…` | — |
| FG images | Stop/remove FG (+ celery) if newly introduced | — |
| nginx | Restore config without `/fg/` upstream if FG rolled back | — |
| Prisma `InventoryImport*` | Leave collections (forward-compatible) | **FORWARD_COMPATIBLE** |
| FG `fg_*` | Leave unless proven harmful; do not mass-drop | **MANUAL_REVIEW** |
| Permissions | ERP keys may remain (non-destructive) | **FORWARD_COMPATIBLE** |
| Full DB restore | Last resort from pre-deploy backup | **ROLLBACK_REQUIRED** only if corruption |

Do **not** assume schema rollback is safe.

---

## 14. Deployment order (conceptual — do not execute)

1. Verify server/runtime + replica-set topology  
2. Verify release SHA `15564954`  
3. Fresh Mongo backup + checksum  
4. Record current image digests/tags (baseline `41f19d7…`)  
5. Build immutable candidate images  
6. Additive Prisma sync for ERP import models  
7. Idempotent permission seed update  
8. Add/start FG network service `fg` (+ celery if required) with `WAIT_FOR_POSTGRES=0`  
9. FG production migrate (ops-confirmed DB name)  
10. Roll api → web  
11. Reload nginx only when `fg` DNS is healthy  
12. Health checks  
13. Smoke (no ERP apply)  
14. Rollback on any blocking trigger  

---

## 15. Post-deploy smoke plan

**MaintainPro:** homepage/login, `/api` health, auth/me, dashboard, inventory, ERP Stock Import **page load only**, permissions check  
**FG:** `/fg/`, login/session, Mongo readiness, dashboard/list, vehicle search/reference, one read-only workflow  
**Forbidden on first smoke:** ERP Excel upload/apply that mutates stock  

---

## 16. Immediate rollback triggers

- API/Web unhealthy or auth broken  
- Permission corruption / unexpected role widening  
- Mongo errors / topology not replica-set when transactions required  
- FG cannot start / nginx `/fg/` 502 loop  
- Routing collision (`/api` or `/` broken)  
- Schema/index failure or destructive behavior  
- Secret/config exposure  
- Critical 5xx loop  

---

## Gate verdict

**PRE_PRODUCTION_GATE: NOT_READY**

Primary blockers:

1. MaintainPro production compose does not define `fg` (nginx already points at `fg:8000`).  
2. FG Celery worker/beat not integrated for production compose (needed for FG scheduling).  
3. FG entrypoint defaults to waiting on PostgreSQL — Mongo cutover requires explicit `WAIT_FOR_POSTGRES=0`.  
4. Live Mongo logical DB name (`maintainpro_prod` vs template `nelna`) must be operator-confirmed before env freeze.

ERP Excel + MaintainPro API/Web additive paths are otherwise pre-production ready once the FG runtime wiring and DB-name confirmation are closed.
