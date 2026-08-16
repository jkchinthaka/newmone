# Release Manifest — fg-erp-combined-candidate

| Field | Value |
| --- | --- |
| Repository | https://github.com/jkchinthaka/newmone.git |
| Branch | `release/fg-erp-combined-candidate` |
| Exact SHA | `15564954a6e6d357017e9068a731342ae2016e59` |
| Build / audit date | 2026-08-16 |
| FG platform source SHA | `1b256e08a3c40bc07627ad95d03262ab1cb912d2` |
| ERP Excel source SHA | `100f47f7001c9b5251dfb421a2760d74d13a0fce` |
| FG standalone tip (reference) | `a8e3ff79a6240b7a7233c0a1bf74dc71064c0295` |
| Rollback baseline SHA | `41f19d7aee9a04a4f2aa09b87d281a18af88a762` |
| Rollback baseline branch | `fix/live-production-remediation` |

## Expected services

nginx, web, api, mongo, redis, minio, **fg** (required), celery-worker/beat (FG scheduling)

## Expected database

MaintainPro primary Mongo (operator-confirmed name; FG docs: `maintainpro_prod`)  
FG collections: `fg_*`  
ERP: `InventoryImportRun` / `InventoryImportRow`

## Expected routes

`/` → Next.js · `/api/...` → NestJS · `/fg/...` → Django · `/fg/static/...` → FG static

## Immutable image tags (planned)

`maintainpro-api:15564954` · `maintainpro-web:15564954` · `maintainpro-fg:15564954`

## Full audit

See `PRE_PRODUCTION_READINESS_15564954.md` in this folder.
