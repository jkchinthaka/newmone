# Phase 02 Technical Baseline

**Document status:** Under implementation — pending Phase 02 technical approval
**Phase:** 02 — Django/PostgreSQL foundation
**Branch:** `foundation/django-postgresql`
**Last updated:** 2026-08-05

## Branch-name decision

| Item | Value |
| --- | --- |
| Active branch | `foundation/django-postgresql` |
| Obsolete name | `feature/phase-02-django-foundation` |
| Status | Obsolete name **superseded** — do not create or continue work on the obsolete branch name |

See [DESIGN_DECISION_REGISTER.md](../design/DESIGN_DECISION_REGISTER.md) (DES-032).

## Scope (Phase 02)

In scope:

- Django 5.2 project layout (`config/`, `apps/core`, `apps/accounts` scaffold)
- PostgreSQL + Redis via Docker Compose
- Celery worker wiring (foundation only)
- Settings split (local / test / production)
- Pytest skeleton, CI quality gates, pre-commit
- Tailwind + htmx vendor build (no CDN); CSS font stack only for Sinhala

Out of scope / not claimed:

- Business modules beyond foundation scaffolds
- Invented Nelna operational values
- Production deployment or production readiness
- PWA / service worker / installability
- Alpine.js
- Closing DEBT-01C-R-NOTO (remains **open**)

## Exact version pins

### Runtime and platform

| Component | Version |
| --- | --- |
| Python | 3.13.14 |
| Django | 5.2.16 |
| PostgreSQL | 17.10 |
| Redis | 7.4.10 |
| Celery | 5.6.3 |
| uv | 0.11.29 |
| Node | 24.18.0 |
| Tailwind CSS | 4.3.3 |
| htmx | 2.0.10 |
| gunicorn | 26.0.0 |
| structlog | 26.1.0 |
| psycopg | 3.3.4 |
| django-environ | 0.14.0 |
| django-htmx | 1.27.0 |
| redis (Python client) | 8.0.1 |

### Selected tool versions

| Tool | Version |
| --- | --- |
| pytest | 9.0.3 |
| pytest-django | 4.11.1 |
| pytest-cov | 7.0.0 |
| ruff | 0.15.0 |
| mypy | 1.19.1 |
| django-stubs | 5.2.9 |
| djlint | 1.36.4 |
| bandit | 1.9.2 |
| pip-audit | 2.10.0 |
| pre-commit | 4.5.1 |

Image tags used in compose/CI: `postgres:17.10-alpine3.23`, `redis:7.4.10-alpine3.21`, `node:24.18.0-bookworm-slim`, `python:3.13.14-slim-bookworm`, `ghcr.io/astral-sh/uv:0.11.29`.

## Layout (foundation)

| Path | Role |
| --- | --- |
| `config/` | Django project, Celery app, settings package |
| `apps/core/` | Health probes, middleware, foundation views/tasks |
| `apps/accounts/` | Custom user model scaffold (RBAC policies later) |
| `templates/`, `static/` | Template + CSS/htmx assets |
| `compose.yaml` | Local postgres, redis, web, celery-worker; profile `test` → dedicated `test` service |
| `Dockerfile` | Multi-stage: `runtime` (lean, no pytest) and `test` (validation tooling) |
| `.github/workflows/ci.yml` | Quality gates including Docker test profile |

### Docker runtime vs test isolation

| Image / service | Role | Testing tools |
| --- | --- | --- |
| `runtime` / Compose `web` | Production-oriented application runtime | **Excluded** — do not run pytest here |
| `test` / Compose profile `test` | Dedicated validation image | pytest, Ruff, mypy, and related review tools |

Use `docker compose --profile test run --rm test pytest`. The obsolete command `docker compose run --rm web pytest` must not be used.

Compose host publication uses `COMPOSE_POSTGRES_HOST_PORT` / `COMPOSE_REDIS_HOST_PORT` (defaults 5433 / 6380). `POSTGRES_PORT` remains the Django connection port (normally 5432 in-container) and must not control host publish.

## Open design debt affecting Phase 02 UI

| Debt ID | Status | Phase 02 implication |
| --- | --- | --- |
| DEBT-01C-R-NOTO | **Open** | CSS may name `Noto Sans Sinhala` in the font stack; **no font binaries**; **no verification claim** |

Operator UAT, pilot, and production remain **blocked** until the debt is closed with evidence.

## Approval

Phase 02 is **not approved** until [PHASE_02_TECHNICAL_FOUNDATION_APPROVAL.md](../approvals/PHASE_02_TECHNICAL_FOUNDATION_APPROVAL.md) is signed.

## Related docs

- [ADR-004-PYTHON-DEPENDENCY-MANAGEMENT.md](ADR-004-PYTHON-DEPENDENCY-MANAGEMENT.md)
- [ADR-005-DJANGO-SETTINGS-AND-ENVIRONMENTS.md](ADR-005-DJANGO-SETTINGS-AND-ENVIRONMENTS.md)
- [LOCAL_DEVELOPMENT.md](../operations/LOCAL_DEVELOPMENT.md)
- [DOCKER_DEVELOPMENT.md](../operations/DOCKER_DEVELOPMENT.md)
- [FRONTEND_FOUNDATION.md](../frontend/FRONTEND_FOUNDATION.md)
