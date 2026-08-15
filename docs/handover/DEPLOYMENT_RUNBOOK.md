# Deployment runbook (non-production)

1. Use the canonical clone, not a stale OneDrive copy.
2. Confirm branch and SHA: `git rev-parse --abbrev-ref HEAD` and `git rev-parse HEAD`.
3. `uv sync --locked --all-groups`
4. `npm ci` and `npm run build`
5. Configure `.env` from `.env.example` without committing secrets.
6. `docker compose up -d --build` when Docker Engine is healthy.
7. Migrate and `manage.py check`.
8. Load synthetic demo only when `ENVIRONMENT_LABEL` is local/test/development/ci.
9. Do not enable the demo loader in UAT/staging/production.

Production deployment requires the go-live checklist. No production deploy is authorized by this document.
