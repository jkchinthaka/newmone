# Production Deployment Runbook

**Status:** SOURCE_VALIDATED  
**Execution in Phase 3:** forbidden — documentation and dry-run helpers only.

Placeholders: `<RELEASE_SHA>`, `<PREVIOUS_RELEASE_SHA>`, `<PUBLIC_HOST>`, `<CHANGE_TICKET>`, `<BACKUP_REFERENCE>`, `<AUTHORIZED_OPERATOR>`.

## Checklist

1. **Change approval** — `<CHANGE_TICKET>` approved.
2. **Operator identity** — `<AUTHORIZED_OPERATOR>` recorded.
3. **Maintenance window** — start/end agreed.
4. **Backup confirmation** — `<BACKUP_REFERENCE>` verified (no secret values in tickets).
5. **Mongo root-rotation gate** — completed or explicitly risk-accepted with incident ID.
6. **Docker engine status** — `docker info` healthy.
7. **Disk-space check** — sufficient free space for images/logs.
8. **Current container health** — api/web/nginx/mongo/redis/minio states recorded.
9. **Current Git SHA** — note running SHA from `/api/build-info` (safe fields only).
10. **Current image IDs/tags** — record previous API/Web tags as `<PREVIOUS_RELEASE_SHA>` images.
11. **Clean working-tree requirement** — `git status --short` empty on deploy host checkout.
12. **Production `.env` existence** — file exists; **do not read or print values**.
13. **Compose structure validation** — use fixtures in CI; on server run `docker compose ... config` without dumping secrets.
14. **Release manifest validation** — `artifacts/release-manifest.json` matches `<RELEASE_SHA>`.
15. **Approved release SHA validation** — checkout/tag equals `<RELEASE_SHA>`.
16. **Image build or pull** — `maintainpro-api:<RELEASE_SHA>`, `maintainpro-web:<RELEASE_SHA>` (never `latest` alone).
17. **Scoped service recreation** — only `api` / `web` / `nginx` as needed; never mongo/redis/minio.
18. **API health check** — `GET http://127.0.0.1:<api>/api/health` (or internal).
19. **Web health check** — login page or web build-info.
20. **BFF unauthenticated check** — `/api/backend/auth/me` returns 401 from BFF path.
21. **Disposable-user login** — cookie session established (no localStorage JWT).
22. **CSRF mutation check** — mutating call requires CSRF.
23. **Role-based login check** — at least one non-admin role path.
24. **Audit-log verification** — sensitive action creates audit row.
25. **Rollback decision point** — if any mandatory check fails, execute rollback runbook.
26. **Evidence recording** — secret-free evidence JSON (DEPLOY-REL-012).
27. **Change-ticket closure** — attach SHA, image tags, evidence, residual risks.

## Guarded helper

```powershell
pwsh -File maintainpro/scripts/deploy-production.ps1 `
  -ReleaseRef <RELEASE_SHA> `
  -ChangeTicket <CHANGE_TICKET> `
  -BaseUrl http://<PUBLIC_HOST> `
  -Services api,web `
  -WhatIf
```

Real execution requires an explicit `-Execute` flag and remains **out of scope** for Phase 3 source alignment.