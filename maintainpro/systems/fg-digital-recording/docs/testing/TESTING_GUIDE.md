# Testing Guide

**Document status:** Living host/Docker testing guidance
**Last updated:** 2026-08-10

## Tooling (pinned)

| Tool | Version |
| --- | --- |
| pytest | 9.0.3 |
| pytest-django | 4.11.1 |
| pytest-cov | 7.0.0 |

Settings module for tests: `config.settings.test` (`DJANGO_SETTINGS_MODULE` / `tool.pytest.ini_options`).

Phase 03 adds identity, authentication, lockout, organization hierarchy, scoped RBAC, and security-audit tests. See [PHASE_03_TEST_PLAN.md](PHASE_03_TEST_PLAN.md).

Phase **06H** repeating/sample foundation tests: [PHASE_06H_TEST_PLAN.md](PHASE_06H_TEST_PLAN.md).
Phase **06I** calculated fields: [PHASE_06I_TEST_PLAN.md](PHASE_06I_TEST_PLAN.md). No `eval`; no invented business formulas.

## Running tests on the host

From project root (with Postgres/Redis available as required by markers):

```powershell
uv run pytest
uv run pytest --cov=apps --cov=config --cov-report=term-missing --cov-fail-under=80
```

```bash
uv run pytest
uv run pytest --cov=apps --cov=config --cov-report=term-missing --cov-fail-under=80
```

Coverage fail-under **80** is enforced in `pyproject.toml` and CI.

## Running tests in Docker (required validation path)

`web` is the production-like runtime service and does **not** include pytest. Use the dedicated Compose profile/`test` service:

```powershell
docker compose up -d postgres redis
docker compose --profile test build test
docker compose --profile test run --rm test pytest
docker compose --profile test run --rm test pytest --cov=apps --cov=config --cov-report=term-missing --cov-fail-under=80
docker compose --profile test run --rm test python manage.py makemigrations --check
docker compose --profile test run --rm test python manage.py check
docker compose down --volumes
```

```bash
docker compose up -d postgres redis
docker compose --profile test build test
docker compose --profile test run --rm test pytest
docker compose --profile test run --rm test pytest --cov=apps --cov=config --cov-report=term-missing --cov-fail-under=80
docker compose --profile test run --rm test python manage.py makemigrations --check
docker compose --profile test run --rm test python manage.py check
docker compose down --volumes
```

### Obsolete command

Do **not** use `docker compose run --rm web pytest`. Testing tools are intentionally absent from the runtime image.

### PostgreSQL isolation

- Tests use PostgreSQL only (never SQLite).
- The Compose `test` service shares local `postgres` with placeholder credentials.
- pytest-django creates/destroys `test_<POSTGRES_DB>` and does not overwrite the primary local database.

## Layout and markers

| Location | Role |
| --- | --- |
| `tests/` | Project-level tests |
| `apps/*/tests/` | App tests |

Markers (see `pyproject.toml`):

| Marker | Meaning |
| --- | --- |
| `integration` | Requires PostgreSQL and/or Redis |
| `architecture` | Architecture boundary checks |

## What Phase 02 tests cover

- Foundation smoke / health / settings fail-closed behaviour as implemented
- Architecture and config guards where present
- Redis integration and Celery eager diagnostic coverage where present
- No claim of UAT, browser E2E (Playwright), or business-workflow validation completeness

Playwright remains planned per [VALIDATION_STRATEGY.md](VALIDATION_STRATEGY.md); not a Phase 02 exit requirement unless later expanded.

## Local DB for host-based tests

CI host jobs use Actions service containers on 5432/6379 (`POSTGRES_PORT=5432`). Locally, point host test env at Compose-published **5433** / **6380** (`COMPOSE_POSTGRES_HOST_PORT` / `COMPOSE_REDIS_HOST_PORT`), or run the Docker `test` service on the compose network (internal `postgres:5432` / `redis:6379`). Use synthetic credentials only.

## Related

- [DOCKER_DEVELOPMENT.md](../operations/DOCKER_DEVELOPMENT.md)
- [CI_QUALITY_GATES.md](CI_QUALITY_GATES.md)
- [VALIDATION_STRATEGY.md](VALIDATION_STRATEGY.md)
- [PHASE_02_TECHNICAL_BASELINE.md](../architecture/PHASE_02_TECHNICAL_BASELINE.md)
