# Deployment Guide

MaintainPro deploys as a **split stack**: API on Render, Web on Cloudflare Workers (primary staging) or Vercel (alternative).

## Current staging topology

| Component | URL | Platform |
|-----------|-----|----------|
| Web | https://newmone.chinthakajayaweera1.workers.dev | Cloudflare Workers (OpenNext) |
| API | https://newmone.onrender.com | Render Web Service |
| Database | MongoDB Atlas `maintainpro_staging` | Atlas |
| Planned prod domain | maintenance.nelna.lk | Operator DNS |

## Prerequisites

- MongoDB Atlas cluster + database user (IP allowlist includes Render egress)
- Render account + API key (optional automation)
- Cloudflare account + Wrangler CLI
- Secret manager for passwords (never commit)

## Environment variables

### Render API (critical)

| Variable | Staging example |
|----------|-----------------|
| `DATABASE_URL` | Atlas URI with `/maintainpro_staging` |
| `PRIMARY_DATABASE_URL` | Same as DATABASE_URL |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Strong random values |
| `CORS_ORIGIN` | `https://newmone.chinthakajayaweera1.workers.dev` |
| `FRONTEND_URL` | Same as CORS_ORIGIN |
| `REDIS_REQUIRED_IN_PRODUCTION` | `false` until Redis provisioned |
| `HEALTHCHECK_DEPENDENCY_TIMEOUT_MS` | `15000` |

See `.env.example` and `render.yaml` for full list.

### Cloudflare Web

Set in `wrangler.jsonc` or dashboard:

- `NEXT_PUBLIC_API_URL` = `https://newmone.onrender.com/api`
- `NEXT_PUBLIC_API_ORIGIN` = `https://newmone.onrender.com`

## Deploy API (Render)

**Blueprint:** root `render.yaml` with `rootDir: maintainpro`

```bash
cd maintainpro
npm run render:deploy:dry   # verify API key + service
npm run render:deploy       # trigger deploy
```

Manual: Render dashboard → maintainpro-api → Manual Deploy → wait 60–90s warm-up.

## Deploy Web (Cloudflare)

From repo root (wrangler at root) or `maintainpro/`:

```bash
cd maintainpro
npm run cloudflare:build
cd apps/web && wrangler deploy
```

Or use root `wrangler.jsonc` build command (CI-style).

**Clean rebuild (recommended after chunk errors):**

```bash
cd maintainpro
npm run cloudflare:rebuild
cd apps/web && wrangler deploy
```

After deploy, **purge Cloudflare cache** for the Workers route (dashboard → Caching → Purge Everything) and hard-refresh the browser (or use incognito). Stale HTML referencing old `/_next/static/chunks/*` hashes is the most common cause of `ChunkLoadError` on Workers.

The PWA service worker intentionally does **not** cache `/_next/static/*` build assets; navigation HTML uses network-first so new deploys pick up matching chunk hashes.

## Deploy Web (Vercel)

```bash
cd maintainpro
npm run vercel:build
```

Point Vercel project root per `vercel.json` (repo root or `maintainpro/`).

## Database rollout

Prisma MongoDB uses **`db:push`**, not SQL migrations:

```bash
cd maintainpro
npm run db:generate
npm run db:push
MAINTAINPRO_SEED_PASSWORD=*** npm run db:seed   # shell only
```

Run seed from **Render shell** or Atlas-allowed IP if local TLS fails.

## Post-deploy verification

```bash
cd maintainpro
# Set MAINTAINPRO_WEB_URL, MAINTAINPRO_API_URL, MAINTAINPRO_SMOKE_* in shell
npm run smoke:deploy
npm run test:e2e:staging
```

Expected smoke: Frontend OK · Health OK · CORS OK · Login OK (after credential alignment).

## Health checks

| Endpoint | Access |
|----------|--------|
| `GET https://newmone.onrender.com/health` | Public |
| `GET https://newmone.onrender.com/health/readiness` | Admin JWT or `X-Readiness-Key` |
| Web `/system-health` | Authenticated admin UI |

## Production cutover (summary)

1. Follow [docs/PRODUCTION_CUTOVER_RUNBOOK.md](docs/PRODUCTION_CUTOVER_RUNBOOK.md)
2. Execute DNS/env per [docs/PRODUCTION_DOMAIN_CUTOVER.md](docs/PRODUCTION_DOMAIN_CUTOVER.md)
3. Provision isolated prod Atlas DB
4. Configure prod Render + Cloudflare env
5. Run `npm run uat:005:validate` against production URLs
6. Product owner sign-off

**Do not cut over DNS until explicit operator approval.**

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| Smoke health timeout | Render cold start — smoke script warms up |
| Login 401 on smoke | Smoke password ≠ hosted seed hash |
| CORS error | `CORS_ORIGIN` mismatch with web URL |
| Readiness 403 | Expected without readiness key in prod |
| Local seed TLS fail | Atlas IP/TLS from dev machine — use Render shell |

## Related

- [PRODUCTION_CUTOVER_RUNBOOK.md](docs/PRODUCTION_CUTOVER_RUNBOOK.md)
- [PRODUCTION_DOMAIN_CUTOVER.md](docs/PRODUCTION_DOMAIN_CUTOVER.md)
- [KPI_SOURCE_MATRIX.md](docs/KPI_SOURCE_MATRIX.md)
- [DEPLOYMENT_READINESS_CHECKLIST.md](DEPLOYMENT_READINESS_CHECKLIST.md)
- [FINAL_UAT_AND_CUTOVER_CHECKLIST.md](FINAL_UAT_AND_CUTOVER_CHECKLIST.md)
