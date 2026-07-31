# Full-Stack E2E Architecture

**Status:** SOURCE_VALIDATED

## 1. Production request path

Browser -> public host:80 -> Nginx -> Next.js `/api/backend/*` (BFF) -> NestJS API -> MongoDB / Redis / MinIO

## 2. E2E request path

```text
Playwright Browser
  -> 127.0.0.1:<E2E_HTTP_PORT>
  -> E2E Nginx
  -> E2E Next.js Web
  -> /api/backend
  -> E2E NestJS API
  -> E2E MongoDB replica set
  -> E2E Redis
  -> E2E MinIO
```

## 3. Service boundaries

| Layer | Responsibility |
| --- | --- |
| Nginx | Path routing only |
| Next.js BFF | Browser cookies + CSRF + upstream proxy |
| NestJS | AuthZ, domain logic, persistence |
| MongoDB | Tenant-scoped documents |
| Redis | Queues/cache with `e2e:` prefix |
| MinIO | `maintainpro-e2e-files` bucket |

## 4–5. Routes

- Browser-facing: `http://127.0.0.1:<port>/login`, `/api/backend/*`, `/api/health`
- Docker-internal: `API_INTERNAL_URL=http://api:3000/api`

## 6–9. Isolation

- DB names begin with `maintainpro_e2e_`
- Compose project begins with `maintainpro-e2e-`
- Dedicated volumes/networks
- Dedicated MinIO bucket and Redis key prefix
- Seed emails scoped by `E2E_RUN_ID`

## 10–11. Evidence and diagnostics

- Playwright HTML + JUnit + traces/screenshots/videos on failure
- `generate-e2e-evidence-manifest.mjs` (no secrets)
- Compose logs redacted in CI

## 12–13. CI / local

- CI: `.github/workflows/full-stack-e2e.yml`
- Local: copy `.env.e2e.example` -> `.env.e2e`, `docker compose -p maintainpro-e2e-$ID ... up`, then `npm run test:e2e:full-stack`

## 14. Cleanup

- `e2e-cleanup.mjs` deletes only run-scoped tenants/docs after explicit confirm

## 15. Production safety barriers

- `validate:e2e-safety` + script guards
- Loopback-only Nginx (and loopback Mongo for seed)
- Never loads production `.env`
- Never uses production DB/bucket/compose project names