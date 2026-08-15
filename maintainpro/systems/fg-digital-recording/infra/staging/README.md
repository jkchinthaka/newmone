# Staging architecture package

Recommended topology:

```text
Internet
   |
Reverse Proxy / Nginx
   |
fg-staging.nelna.lk
   |
Django Web
   |
   +--> PostgreSQL (nelna_fg_staging)
   |
   +--> Redis
   |
   +--> Celery Worker
   |
   +--> Celery Beat
```

## Files

| File | Purpose |
| --- | --- |
| `compose.staging.yaml` | Staging-oriented Compose override/template |
| `infra/staging/nginx.staging.conf.example` | TLS-terminating reverse proxy example |
| `infra/staging/env.staging.example` | Variable list (no secrets) |

## Rules

- Do not hard-code secrets.
- `DEBUG=False` for staging that mirrors production.
- Separate DB name from local/dev (`nelna_fg_staging`).
- Do not deploy to a real server from this package unless access is authorized.

## Health

Configure probes against live/ready endpoints after deploy.
Restart policy: `unless-stopped` for long-running services.
