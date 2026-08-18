# Docker Development

**Document status:** Phase 02 foundation guidance
**Branch:** `foundation/django-postgresql`
**Last updated:** 2026-08-05

## Compose file

Primary file: `compose.yaml` at repository root.

| Service | Image / build | Role |
| --- | --- | --- |
| `postgres` | `postgres:17.10-alpine3.23` | Operational database |
| `redis` | `redis:7.4.10-alpine3.21` | Cache and Celery broker |
| `web` | Build `Dockerfile` target `runtime` | Production-like Django runtime (`runserver` in local compose) |
| `celery-worker` | Same runtime image | Celery worker |
| `test` | Build `Dockerfile` target `test` (profile `test`) | Dedicated validation runner (pytest, manage.py checks, quality tools) |

Volumes: `postgres_data` for local persistence.

**Important:** `web` is **not** the test runner. Testing dependencies are intentionally excluded from the production-oriented runtime image. Do **not** run `docker compose run --rm web pytest` — that command is obsolete and fails with `pytest: not found`.

## Host vs container ports

| Service | Host bind (default) | Internal |
| --- | --- | --- |
| PostgreSQL | `127.0.0.1:${COMPOSE_POSTGRES_HOST_PORT:-5433}` → 5432 | 5432 |
| Redis | `127.0.0.1:${COMPOSE_REDIS_HOST_PORT:-6380}` → 6379 | 6379 |
| Web | `127.0.0.1:${WEB_PORT:-8000}` → 8000 | 8000 |
| `test` | **None** (no host ports) | N/A |

`POSTGRES_PORT` is the Django/application connection port (normally **5432** inside containers). It must **not** control Compose host publication. Defaults **5433** / **6380** for `COMPOSE_*_HOST_PORT` reduce Windows conflicts with local 5432 / 6379 listeners.

Inside the compose network, `web`, `celery-worker`, and `test` always use container DNS names and internal ports (`postgres:5432`, `redis:6379`) — never the host-published ports.

## Common workflows

Infra only (app on host via uv):

```powershell
docker compose up -d postgres redis
```

```bash
docker compose up -d postgres redis
```

Full stack (runtime services):

```powershell
docker compose up --build
```

```bash
docker compose up --build
```

Config validation:

```powershell
docker compose config
docker compose --profile test config
```

```bash
docker compose config
docker compose --profile test config
```

Stop / reset data (destructive for local volume):

```powershell
docker compose down --volumes
docker compose ps
```

```bash
docker compose down --volumes
docker compose ps
```

## Dedicated Docker tests (required path)

Build the test image:

```powershell
docker compose --profile test build test
```

```bash
docker compose --profile test build test
```

Ensure PostgreSQL and Redis are healthy, then run tests:

```powershell
docker compose up -d postgres redis
docker compose --profile test run --rm test pytest
docker compose --profile test run --rm test pytest --cov=apps --cov=config --cov-report=term-missing --cov-fail-under=80
docker compose --profile test run --rm test python manage.py makemigrations --check
docker compose --profile test run --rm test python manage.py check
```

```bash
docker compose up -d postgres redis
docker compose --profile test run --rm test pytest
docker compose --profile test run --rm test pytest --cov=apps --cov=config --cov-report=term-missing --cov-fail-under=80
docker compose --profile test run --rm test python manage.py makemigrations --check
docker compose --profile test run --rm test python manage.py check
```

Arbitrary commands in the test image (Ruff, mypy, manage.py, etc.):

```powershell
docker compose --profile test run --rm test ruff check .
docker compose --profile test run --rm test python manage.py showmigrations
```

### Test database isolation

- The `test` service uses **PostgreSQL only** (never SQLite).
- It shares the local Compose `postgres` service with placeholder credentials (`nelna_fg` / `nelna_fg_local_only`).
- Isolation: pytest-django creates and destroys a temporary database named `test_<POSTGRES_DB>` (e.g. `test_nelna_fg`). It does **not** reset or overwrite the primary application database.
- Credentials are local placeholders only — never production secrets.
- Redis is used for integration tests via `REDIS_URL=redis://redis:6379/0`.

### Obsolete command (do not use)

```text
docker compose run --rm web pytest   # OBSOLETE — pytest is not in the runtime image
```

## Dockerfile stages

| Stage | Purpose |
| --- | --- |
| `frontend-build` | Node 24.18.0 — vendor copy + Tailwind build |
| `python-deps` | uv 0.11.29 sync of locked **runtime** deps only |
| `python-deps-test` | uv 0.11.29 sync with `--all-groups` (dev / testing / security) |
| `runtime` | Production-oriented image — non-root `nelna`, gunicorn default CMD; **no pytest** |
| `test` | Dedicated validation image — pytest, Ruff, mypy, and related tools on PATH |

Notes:

- Entrypoint (`infra/docker/entrypoint.sh`) optionally waits for PostgreSQL, then `exec`s the container command. It does **not** auto-migrate, create users, load fixtures, or assume Gunicorn.
- Runtime default settings module is `config.settings.production`; compose `web` overrides to `config.settings.local`.
- Test default settings module is `config.settings.test`.
- Runtime and test images share the frontend-build stage for static assets; test dependencies never contaminate the runtime image.
- Image builds in CI are **not** a production release approval.

## Related

- [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)
- [TESTING_GUIDE.md](../testing/TESTING_GUIDE.md)
- [SECURE_CONFIGURATION.md](../security/SECURE_CONFIGURATION.md)
- [PHASE_02_TECHNICAL_BASELINE.md](../architecture/PHASE_02_TECHNICAL_BASELINE.md)
