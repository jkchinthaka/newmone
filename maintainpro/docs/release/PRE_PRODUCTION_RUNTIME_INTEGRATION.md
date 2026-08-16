# Pre-Production Gate Update — FG Runtime Integration

**Date:** 2026-08-16  
**Prior application SHA:** `15564954a6e6d357017e9068a731342ae2016e59`  
**Prior docs audit SHA:** `873a85069f3421518201623c0686910a8f51f158`

## Blockers closed

1. Root Compose now includes `fg`, `fg-collectstatic`, `fg-celery-worker`, `fg-celery-beat`.
2. `WAIT_FOR_POSTGRES=0` for all FG Mongo runtime services.
3. Production DB name fail-closed to `maintainpro_prod` (FG `production.py` + Compose overlay).
4. Nginx strips `/fg/` via trailing-slash `proxy_pass` and serves `/fg/static/` from volume alias.
5. Explicit `ALLOW_INSECURE_HTTP` opt-in for temporary HTTP :80 (secure-by-default preserved).
6. FG runtime image installs `--group mongo` (`django-mongodb-backend`).

## Redis

- Nest/BullMQ: `REDIS_URL` → DB 0  
- FG: `FG_REDIS_URL` → `redis://redis:6379/1`

## Persistent FG paths

- `EVIDENCE_STORAGE_ROOT` → volume `maintainpro-fg-evidence` (`/app/media/evidence_private`)
- Static collect volume `maintainpro-fg-static` (not user data)

## Validation performed

- `docker compose ... config` PASS (all required services)
- FG image build PASS
- Isolated FG smoke: health live/ready, `/accounts/login/`, nginx `/fg/` strip, `/fg/static/css/app.css` 200
- Celery worker Redis connect + single beat instance
- FG production-settings tests PASS
- API/Web typecheck + build PASS
- Prisma validate PASS

**PRE_PRODUCTION_GATE:** READY after deployable SHA commit on this branch.

**Deployable release SHA:** `63a729209cab09ff5ad3f08a8a371499115a4cc5`


Runtime integration commit: `e0257d6ba90a38620a00ca603fafec8e61237711`

