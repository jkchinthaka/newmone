# Configuration Reference

**Document status:** Phase 02 foundation catalogue
**Branch:** `foundation/django-postgresql`
**Last updated:** 2026-08-05

Source of examples: `.env.example`. Never commit real secrets. Production must supply variables from the process environment / secret manager (production settings do not load `.env`).

## Django

| Variable | Example / default | Notes |
| --- | --- | --- |
| `DJANGO_SETTINGS_MODULE` | `config.settings.local` | `local` / `test` / `production` |
| `DJANGO_SECRET_KEY` | local placeholder in `.env.example` | Required in production; placeholders rejected |
| `DJANGO_DEBUG` | `True` (local example) | Forced `False` in production |
| `DJANGO_ALLOWED_HOSTS` | `127.0.0.1,localhost,web` | Explicit, non-wildcard in production |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | `http://127.0.0.1:8000,...` | Required in production (HTTPS origins) |
| `DJANGO_TIME_ZONE` | `Asia/Colombo` | Local default |
| `DJANGO_LANGUAGE_CODE` | `en` | Foundation default |
| `ENVIRONMENT_LABEL` | `local` | Label for logs/context |
| `APP_VERSION` | `0.2.0` | Reported on health |
| `LOG_LEVEL` | `INFO` | Root log level |

## PostgreSQL

| Variable | Example / default | Notes |
| --- | --- | --- |
| `POSTGRES_DB` | `nelna_fg` | |
| `POSTGRES_USER` | `nelna_fg` | |
| `POSTGRES_PASSWORD` | local-only example | Not a production secret |
| `POSTGRES_HOST` | `127.0.0.1` (host app) / `postgres` (compose web/test) | |
| `POSTGRES_PORT` | **5432** in-container; host apps use **5433** when targeting Compose publish | Django connection port — **not** Compose host publish |
| `DB_CONN_MAX_AGE` | `60` | |
| `DB_CONNECT_TIMEOUT` | `10` | |
| `DB_CONN_HEALTH_CHECKS` | `True` | |

## Redis / Celery

| Variable | Example / default | Notes |
| --- | --- | --- |
| `REDIS_URL` | `redis://127.0.0.1:6380/0` | Host app; compose web/test use `redis://redis:6379/0` |
| `REDIS_CACHE_TIMEOUT` | `300` | Seconds |
| `CELERY_TASK_TIME_LIMIT` | `300` | |
| `CELERY_TASK_SOFT_TIME_LIMIT` | `240` | |

## Compose host publish ports

These control **localhost publish only**. Docker-network clients use service names and container ports (`postgres:5432`, `redis:6379`), not these values.

| Variable | Default | Maps to |
| --- | --- | --- |
| `COMPOSE_POSTGRES_HOST_PORT` | `5433` | Host `127.0.0.1` → container 5432 |
| `COMPOSE_REDIS_HOST_PORT` | `6380` | Host `127.0.0.1` → container 6379 |
| `WEB_PORT` | `8000` | Host → container 8000 |

Do **not** use `POSTGRES_PORT` for Compose host publication. In CI, Compose publish uses non-conflicting values (e.g. `55432` / `56379`) while host pytest keeps `POSTGRES_PORT=5432` against Actions service containers.

## Production-only / security toggles

| Variable | Default in `production.py` | Notes |
| --- | --- | --- |
| `SECURE_SSL_REDIRECT` | `True` | May be `False` only for controlled CI deploy-check |
| `SECURE_HSTS_SECONDS` | `31536000` | |
| `SECURE_HSTS_INCLUDE_SUBDOMAINS` | `True` | Disable only with documented exception |
| `SECURE_HSTS_PRELOAD` | `False` | Enable only after deliberate readiness |

Required for production import: `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`, `POSTGRES_*`, `REDIS_URL`.

## Related

- [ADR-005-DJANGO-SETTINGS-AND-ENVIRONMENTS.md](../architecture/ADR-005-DJANGO-SETTINGS-AND-ENVIRONMENTS.md)
- [SECURE_CONFIGURATION.md](../security/SECURE_CONFIGURATION.md)
- [ENVIRONMENT_STRATEGY.md](ENVIRONMENT_STRATEGY.md)
- [DOCKER_DEVELOPMENT.md](DOCKER_DEVELOPMENT.md)
