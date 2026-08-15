# Admin guide

Administration is for named individual accounts. Shared users are prohibited.

## Local / non-production

- Copy `.env.example` to `.env`. Never commit secrets.
- `uv sync --locked --all-groups`
- `npm ci` then `npm run build`
- Docker Compose is the supported local stack (Postgres, Redis, web, Celery worker/beat).
- Synthetic demo loader is blocked in production/UAT/staging environment labels.

## Users and RBAC

- Create users in Django admin or approved provisioning.
- Assign roles per organization. Deny by default.
- Do not invent Nelna role names as company facts.
- SoD policy remains EVIDENCE REQUIRED.

## Controlled forms

- DEMO/TEST seed publishes the four SOURCE RECEIVED forms into the demo organization only.
- Business approval is still required before treating those templates as SOP.
- Do not import handwritten production readings.

## Backup

See `BACKUP_RESTORE_DR.md`. Restore drills are non-production only.
