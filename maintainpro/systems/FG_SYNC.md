# FG Digital Recording — dual-repository sync & shared MongoDB architecture

MaintainPro (`jkchinthaka/newmone`) is the umbrella repository. FG Digital Recording
remains a Django application, mirrored under:

`maintainpro/systems/fg-digital-recording/`

Canonical FG repository:

`https://github.com/jkchinthaka/nelna-fg-digital-recording-system`

## Same MongoDB database (target)

Production application data for MaintainPro **and** FG lives in one logical database:

```text
MONGODB_DATABASE=maintainpro_prod
```

Do **not** use:

- a separate FG PostgreSQL production database as the final SoR
- a second FG-only MongoDB database
- MongoDB system databases: `admin`, `config`, `local`

### Collection ownership

| Owner | Collections | Rule |
| --- | --- | --- |
| MaintainPro | `Vehicle`, `Asset`, `Department`, `User`, `WorkOrder`, … | PascalCase Prisma collections; FG must **not** mutate them directly |
| FG | `fg_*` (e.g. `fg_accounts_user`, `fg_dispatch_dispatchqualityrecord`) | Namespace prefix `fg_` via `apps/core/db_namespace.py` |

FG must **not** create duplicate master collections such as `fg_vehicle`, `fg_asset`,
`fg_department`, or `fg_facility`. MaintainPro remains source of truth for those
entities. FG transaction documents store MaintainPro IDs plus optional display
snapshots (for example `maintainproVehicleId` / `vehicle_registration_snapshot`).

### Environment (placeholders only)

Never commit real credentials. Use process environment / secret managers:

```text
MONGODB_URI=<application least-privilege URI — never root>
MONGODB_DATABASE=maintainpro_prod
MONGODB_PRODUCTION_TARGET_DATABASE=maintainpro_prod
MAINTAINPRO_TENANT_ID=<ObjectId hex for default tenant mapping>
FORCE_SCRIPT_NAME=/fg
REDIS_URL=<redis url>
DJANGO_SECRET_KEY=<django secret>
```

Django settings modules:

- `config.settings.mongo_same_db` — fail-closed production same-DB mode
- `config.settings.mongo_same_db_poc` — isolated POC DB only (refuses `maintainpro_prod`)

### Shared reference layer

Centralized read-only access:

`apps/integrations/maintainpro/`

- Allowlisted collections only (`Vehicle`, `Asset`, `Department`)
- Tenant fail-closed (`tenantId` required on every query)
- Vehicle autocomplete + server revalidation on submit
- No raw Mongo queries in Django views/forms

### Same-domain routing (prepared, not production-deployed by this work)

```text
/          → MaintainPro Next.js
/api/...   → MaintainPro NestJS
/fg/...    → FG Django (FORCE_SCRIPT_NAME=/fg)
/fg/static → FG static
/fg/health/live
/fg/health/ready
```

See `maintainpro/infra/nginx/default.conf`.

## Sync workflow (FG → MaintainPro)

1. Develop/test in standalone FG repository.
2. Commit and push to `nelna-fg-digital-recording-system` (feature branch or `main`).
3. In MaintainPro worktree:

```bash
git fetch fg-origin
git subtree pull --prefix=maintainpro/systems/fg-digital-recording fg-origin <branch> --squash
```

4. Review, commit, push MaintainPro integration branch. Never force-push.

## Sync workflow (MaintainPro → FG)

If FG files are edited under the subtree:

```bash
git subtree push --prefix=maintainpro/systems/fg-digital-recording fg-origin <branch>
```

Do not push the whole MaintainPro repository into the FG repository.

## Secret handling

Never commit:

- Real `.env` files / Mongo URIs / passwords
- Root credentials
- Local DB dumps, venvs, `__pycache__`, `node_modules`

## Testing process

1. FG unit/integration tests (PostgreSQL CI still default on `main` until cutover).
2. Mongo same-DB POC suite against isolated DB (`fg_same_db_poc`), never `maintainpro_prod`.
3. MaintainPro `npm run typecheck` / `npm run test` / `npm run build` for umbrella changes.
4. Verify vehicle autocomplete, tenant isolation, and no writes to MaintainPro master collections from FG.

## Status note

Production FG runtime default is MongoDB (`FG_DATABASE_BACKEND=mongodb` in
`config.settings.production`) targeting `maintainpro_prod` with `fg_` collections.

Isolated release-gate tests use `config.settings.mongo_test` against
`maintainpro_fg_test` (fail-closed against `maintainpro_prod` / system DBs).

Bootstrap:

```bash
DJANGO_SETTINGS_MODULE=config.settings.mongo_test \
MONGODB_URI=... MONGODB_DATABASE=maintainpro_fg_test \
uv run python manage.py bootstrap_mongo_indexes
```

Idempotency keys live in `fg_core_idempotencykey` via `apps.core.models.IdempotencyKey`.
