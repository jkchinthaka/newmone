# MaintainPro

Enterprise operations platform for maintenance, fleet, inventory, compliance, and reporting.

**Repository layout:** application code lives in [`maintainpro/`](maintainpro/). Root-level files (`Dockerfile`, `wrangler.jsonc`, `render.yaml`, `vercel.json`) are deployment glue pointing into that directory.

## Quick links

| Resource | Path |
|----------|------|
| Setup & commands | [maintainpro/README.md](maintainpro/README.md) |
| Architecture | [maintainpro/docs/ARCHITECTURE.md](maintainpro/docs/ARCHITECTURE.md) |
| Production readiness | [maintainpro/PRODUCTION_READINESS_REPORT.md](maintainpro/PRODUCTION_READINESS_REPORT.md) |
| UAT checklist | [maintainpro/docs/UAT_CHECKLIST.md](maintainpro/docs/UAT_CHECKLIST.md) |
| Security checklist | [maintainpro/docs/SECURITY_CHECKLIST.md](maintainpro/docs/SECURITY_CHECKLIST.md) |
| Enterprise roadmap | [maintainpro/docs/ENTERPRISE_ROADMAP.md](maintainpro/docs/ENTERPRISE_ROADMAP.md) |

## Current deployment status (staging)

| Service | URL | Status |
|---------|-----|--------|
| Web (Cloudflare Workers) | https://newmone.chinthakajayaweera1.workers.dev | Active staging |
| API (Render) | https://newmone.onrender.com/api | Active staging |
| Public health | https://newmone.onrender.com/health | Liveness |
| Readiness (protected) | `/health/readiness` | Admin JWT or `READINESS_API_KEY` |

Production domain target: **`maintenance.nelna.lk`** (operator-owned DNS/TLS — not yet cut over).

## Validation (from `maintainpro/`)

```bash
npm install
npm run db:generate
npm run typecheck
npm run lint
npm run test
npm run build
```

See [maintainpro/README.md](maintainpro/README.md) for full setup, seed, deployment, and portfolio context.
