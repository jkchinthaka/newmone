# Production Rollback Runbook

**Status:** SOURCE_VALIDATED  

Rollback uses known-good:

- Git SHA/tag (`<PREVIOUS_RELEASE_SHA>`)
- API image `maintainpro-api:<PREVIOUS_RELEASE_SHA>`
- Web image `maintainpro-web:<PREVIOUS_RELEASE_SHA>`
- Nginx configuration from that SHA
- Compose files from that SHA
- Configuration backup reference `<BACKUP_REFERENCE>`

## Preserve always

- MongoDB volumes
- Redis volumes
- MinIO volumes

Never run `docker compose down -v`, `docker volume rm`, or database reset during rollback.

## Application rollback

1. Confirm previous images exist locally or in registry.
2. Set `MAINTAINPRO_API_IMAGE` / `MAINTAINPRO_WEB_IMAGE` (or equivalent) to previous SHA tags.
3. Recreate only `api` and/or `web` (and `nginx` if config rolled back).
4. Verify `/api/health`, web build-info, BFF smoke.
5. Verify essential business data still present (counts agreed in ticket).
6. Capture secret-free evidence.

## Configuration rollback

- Restore prior server `.env` from `<BACKUP_REFERENCE>` without printing values.
- Recreate only services that read changed keys.

## Database rollback

- **Not automatic** with application rollback.
- Requires explicit restore plan, approvals, and downtime.
- Follow `PRISMA_SCHEMA_CHANGE_GATE.md` limitations.

## Infrastructure rollback

- IIS/Azure NSG/firewall/DNS changes are operator-owned and out of application rollback scope.
- Do not mix infra rollback with app image rollback unless ticket says so.

## Post-rollback tests

- API health
- Web/BFF smoke
- Essential data presence
- Runtime SHA matches `<PREVIOUS_RELEASE_SHA>`