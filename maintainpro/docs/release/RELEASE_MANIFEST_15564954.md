# Release Manifest — fg-erp-combined-candidate

| Field | Value |
| --- | --- |
| Repository | https://github.com/jkchinthaka/newmone.git |
| Branch | `release/fg-erp-combined-candidate` |
| **Deployable release SHA** | `e0257d6ba90a38620a00ca603fafec8e61237711` |
| Previous combined application SHA | `15564954a6e6d357017e9068a731342ae2016e59` |
| Docs-only audit SHA | `873a85069f3421518201623c0686910a8f51f158` |
| Build / audit date | 2026-08-16 |
| FG platform source SHA | `1b256e08a3c40bc07627ad95d03262ab1cb912d2` |
| FG standalone tip (reference) | `a8e3ff79a6240b7a7233c0a1bf74dc71064c0295` |
| ERP Excel source SHA | `100f47f7001c9b5251dfb421a2760d74d13a0fce` |
| Rollback baseline SHA | `41f19d7aee9a04a4f2aa09b87d281a18af88a762` |
| Rollback baseline branch | `fix/live-production-remediation` |

## Expected services

nginx, web, api, mongo, redis, minio, minio-init, **fg**, **fg-collectstatic**, **fg-celery-worker**, **fg-celery-beat**

## Expected database

`maintainpro_prod` (fail-closed for FG production settings)  
FG collections: `fg_*`  
ERP: `InventoryImportRun` / `InventoryImportRow`

## Expected routes

`/` → Next.js · `/api/...` → NestJS · `/fg/...` → Django (prefix stripped) · `/fg/static/...` → nginx static volume

## Immutable image tags

`maintainpro-api:<deployable-sha>` · `maintainpro-web:<deployable-sha>` · `maintainpro-fg:<deployable-sha>`

## Redis

- MaintainPro Nest/BullMQ: `REDIS_URL` → DB 0  
- FG Django/Celery: `FG_REDIS_URL` → `redis://redis:6379/1`

## Full audit

See `PRE_PRODUCTION_READINESS_15564954.md` (historical) and update notes in the runtime integration commit message / this file after SHA freeze.
