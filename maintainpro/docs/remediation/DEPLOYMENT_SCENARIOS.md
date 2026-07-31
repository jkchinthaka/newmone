# Standard Deployment Scenarios

**Status:** SOURCE_VALIDATED  
Placeholders only: `<RELEASE_SHA>`, `<PREVIOUS_RELEASE_SHA>`, `<PUBLIC_HOST>`.

Normal API/Web deployments must **not** recreate MongoDB, Redis, or MinIO.

## A. Web-only change

- **Changed files:** `apps/web/**`, shared UI packages consumed only by web
- **Required images:** `maintainpro-web:<RELEASE_SHA>`
- **Containers recreated:** `web` (optionally `nginx` if static routing unchanged usually not required)
- **Persistent preserved:** `mongo`, `redis`, `minio`
- **Pre-deploy tests:** unit/typecheck/build; BFF route tests; release prepare
- **Post-deploy tests:** Web health/login page; `/api/build-info` via web; BFF unauthenticated 401
- **Expected downtime:** brief web restart (seconds)
- **Rollback:** redeploy `maintainpro-web:<PREVIOUS_RELEASE_SHA>`

## B. API-only change

- **Changed files:** `apps/api/**`, `prisma/schema.prisma` only if schema gate passed separately
- **Required images:** `maintainpro-api:<RELEASE_SHA>`
- **Containers recreated:** `api`
- **Persistent preserved:** `mongo`, `redis`, `minio`, `web`
- **Pre-deploy tests:** API tests, tenant/RBAC audits, secret-safety
- **Post-deploy tests:** `/api/health`, `/api/build-info`, readiness (authorized)
- **Expected downtime:** brief API restart; web may return 502 during window
- **Rollback:** redeploy `maintainpro-api:<PREVIOUS_RELEASE_SHA>`

## C. Nginx-only change

- **Changed files:** `infra/nginx/**`
- **Required images:** none (config bind-mount / nginx image unchanged)
- **Containers recreated:** `nginx` reload or recreate
- **Persistent preserved:** all data services + api/web images unless intentionally updated
- **Pre-deploy tests:** `validate:nginx-routing`
- **Post-deploy tests:** `/api/health`, `/api/backend/...` BFF path, `/login`
- **Expected downtime:** sub-second reload preferred; recreate may drop active connections briefly
- **Rollback:** restore previous nginx config from known-good release SHA

## D. API + Web change

- **Changed files:** both apps and/or shared packages
- **Required images:** `maintainpro-api:<RELEASE_SHA>`, `maintainpro-web:<RELEASE_SHA>`
- **Containers recreated:** `api`, `web` (nginx only if routing changed)
- **Persistent preserved:** `mongo`, `redis`, `minio`
- **Pre-deploy tests:** full prepare-release-build
- **Post-deploy tests:** health, build-info SHA match on both, login smoke
- **Expected downtime:** short coordinated recreate
- **Rollback:** previous API+Web SHA tags together

## E. Configuration-only change

- **Changed files:** server `.env` keys (not in Git), Compose env wiring docs
- **Required images:** none
- **Containers recreated:** only services that consume changed env (typically `api`/`web`)
- **Persistent preserved:** volumes always
- **Pre-deploy tests:** compose config with fixtures in CI; on server: existence check only
- **Post-deploy tests:** health + auth smoke
- **Expected downtime:** service recreate window
- **Rollback:** restore prior `.env` backup reference `<BACKUP_REFERENCE>` (values never printed)

## F. Prisma schema change

- **Changed files:** `prisma/schema.prisma` (+ generated client)
- **Required images:** API image built from schema-approved SHA
- **Containers recreated:** `api` after **separate schema gate** approval
- **Persistent preserved:** `mongo` volume (no reset)
- **Pre-deploy tests:** schema diff, test-DB validation, impact analysis (see schema gate)
- **Post-deploy tests:** health, record-count/integrity checks agreed in ticket
- **Expected downtime:** depends on index builds; plan maintenance window
- **Rollback:** application rollback only; **schema reversal is not automatic** and may be impossible without restore

## G. Rollback

- **Changed files:** none (redeploy known-good artifacts)
- **Required images:** previous API/Web tags
- **Containers recreated:** affected app services only
- **Persistent preserved:** MongoDB, Redis, MinIO volumes
- **Pre-deploy tests:** confirm previous SHA/images still available
- **Post-deploy tests:** health, BFF smoke, essential data presence
- **Expected downtime:** same as scoped recreate
- **Rollback method:** `PRODUCTION_ROLLBACK_RUNBOOK.md`