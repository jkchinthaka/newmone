# Local Development

**Document status:** Phase 02 foundation guidance
**Branch:** `foundation/django-postgresql`
**Last updated:** 2026-08-05

## Prerequisites

| Tool | Version (Phase 02 pin) |
| --- | --- |
| Python | 3.13.14 (via uv) |
| uv | 0.11.29 |
| Node.js | 24.18.0 |
| Docker Desktop / Compose | Current stable (for postgres/redis) |
| Git | Any recent |

Recommended clone path on Windows (avoid OneDrive file locking):

```text
C:\Projects\nelna-fg-digital-recording-system
```

Do **not** treat OneDrive Desktop paths as the supported day-to-day workspace for Docker volume performance.

## PowerShell setup (from project root)

```powershell
cd C:\Projects\nelna-fg-digital-recording-system

# Copy env template (never commit .env)
Copy-Item .env.example .env

# Python toolchain
uv python install 3.13.14
uv python pin 3.13.14
uv sync --locked

# Frontend toolchain
npm ci
npm run build

# Start PostgreSQL + Redis (host ports 5433 / 6380 by default)
docker compose up -d postgres redis

# Apply migrations and run
uv run python manage.py migrate
uv run python manage.py runserver 127.0.0.1:8000
```

Optional Celery worker (requires Redis):

```powershell
uv run celery -A config worker --loglevel=INFO
```

## Default local ports

| Service | Host port (default) | Container / process |
| --- | --- | --- |
| PostgreSQL | **5433** (`COMPOSE_POSTGRES_HOST_PORT`) | Container listens on **5432** internally |
| Redis | **6380** (`COMPOSE_REDIS_HOST_PORT`) | Container listens on **6379** internally |
| Django | **8000** (`WEB_PORT`) | `runserver` or compose `web` |

`POSTGRES_PORT` is the Django connection port (normally **5432** inside containers). Host publish uses `COMPOSE_*_HOST_PORT` only — never reuse `POSTGRES_PORT` for Compose publication.

Host defaults avoid common Windows conflicts with native PostgreSQL on 5432 and Redis on 6379. Override via `.env` if needed.

When the Django process runs **on the host** (not in compose `web`), `.env` should keep:

- `POSTGRES_HOST=127.0.0.1`
- `POSTGRES_PORT=5433` (must match `COMPOSE_POSTGRES_HOST_PORT`)
- `REDIS_URL=redis://127.0.0.1:6380/0`

When Django runs **inside** compose `web` / `test`, compose sets `POSTGRES_HOST=postgres`, `POSTGRES_PORT=5432`, and `REDIS_URL=redis://redis:6379/0`.

## Common commands

```powershell
uv run pytest
uv run ruff check .
uv run mypy apps config scripts
uv run python manage.py check
npm run watch:css
```

Pre-commit (once per clone):

```powershell
uv run pre-commit install
```

## Health checks

- Liveness: `GET /health/live/`
- Readiness: `GET /health/ready/` (PostgreSQL + Redis)

## Constraints

- No production secrets in `.env`.
- No invented Nelna business data in fixtures.
- DEBT-01C-R-NOTO remains open — Sinhala font binaries are not shipped.
- Phase 02 is **not** production-ready and **not** approved until the Phase 02 approval form is signed.

## Related

- [DOCKER_DEVELOPMENT.md](DOCKER_DEVELOPMENT.md)
- [CONFIGURATION_REFERENCE.md](CONFIGURATION_REFERENCE.md)
- [PHASE_02_TECHNICAL_BASELINE.md](../architecture/PHASE_02_TECHNICAL_BASELINE.md)
