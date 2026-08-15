# Support Runbook — Common Incidents

Safe first-response steps. Do not invent credentials or bypass RBAC.

## Cannot login

1. Confirm environment URL (local vs staging vs production).
2. Confirm user `is_active` and org membership.
3. Check lockout / rate limit settings.
4. Reset password via approved process; force change if required.
5. Verify demo accounts are not expected in production.

## Cannot save / Cannot submit

1. Check network and CSRF/session — ask user to re-login if session expired.
2. Check for conflict/stale form banner — reload and re-enter.
3. Check app logs for validation errors (not 500).
4. Confirm permissions for the form and org.

## Supervisor / QA queue empty

1. Confirm role and organization scope.
2. Confirm records were submitted (not still draft).
3. Check filters (date/status).
4. Confirm no cross-org expectation.

## Print incorrect

1. Use print view (not screen chrome).
2. Verify saved values on detail page match print.
3. Capture browser Print Preview evidence.
4. Physical printer issues → device/driver UAT (`PRINT_UAT_CHECKLIST.md`).

## Database unavailable

1. `pg_isready` / health ready.
2. Check credentials and host/port (Compose host port vs container port).
3. Do not point restore at wrong database name.

## Redis unavailable

1. Ping Redis URL.
2. Expect cache/queue degradation; recording SoR is PostgreSQL.
3. Restart Redis; then Celery worker/beat.

## Celery unavailable

1. Check worker and beat processes.
2. `celery -A config inspect ping` where available.
3. Clear stuck duplicate beat if misconfigured.

## Disk full

1. Identify large logs/backups/temp.
2. Delete only disposable caches/build artifacts.
3. **Never** delete source, Git, DB volumes, UAT evidence without explicit approval.

## Backup failed

1. Inspect job exit code and artifact path.
2. Confirm destination writable.
3. Escalate — RPO is a business decision once policy exists.

## Health endpoint failed

1. Distinguish live vs ready.
2. Ready failing → DB/Redis first.
3. Check reverse proxy upstream.

## Unexpected 403

1. Role/org scope.
2. CSRF failure on POST.
3. Direct URL to unauthorized module (expected deny).

## Unexpected 500

1. Capture request time + user + URL (no passwords).
2. Read traceback from logs.
3. If reproducible after deploy, note SHA and open defect.

## Safe commands (examples)

```bash
uv run python manage.py check
uv run python manage.py showmigrations
docker compose ps
docker compose logs --tail=200 web
```

Never run destructive DB drops against shared environments.
