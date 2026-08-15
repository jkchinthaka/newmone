# CI Quality Gates

**Document status:** Phase 03 foundation guidance
**Branch:** `feature/accounts-rbac`
**Last updated:** 2026-08-06

## Workflow

File: `.github/workflows/ci.yml`
Triggers: pull requests and pushes to `main`.

Services: `postgres:17.10-alpine3.23`, `redis:7.4.10-alpine3.21` (CI host-job ports 5432 / 6379).

Toolchain setup: uv **0.11.29**, Python **3.13.14**, Node **24.18.0**.

## Gates (ordered)

| Gate | Command / check |
| --- | --- |
| Lockfile | `uv lock --check` |
| Sync | `uv sync --locked --all-groups` |
| Ruff lint | `uv run ruff check .` |
| Ruff format | `uv run ruff format --check .` |
| mypy | `uv run mypy apps config scripts` |
| Template lint | `uv run djlint templates --check` |
| JSON/YAML validate | Scripted parse of JSON + key YAML files |
| Frontend | `npm ci` + `npm run build` + design token `--check` |
| Pytest + coverage (host) | fail-under **80** |
| Migrations (host) | `makemigrations --check` |
| Django check (host) | `manage.py check` |
| Production fail-closed | Import production settings without secret must fail |
| Deploy check | `manage.py check --deploy` with CI placeholders |
| Bandit | `uv run bandit -r apps config scripts` |
| pip-audit | `uv run pip-audit` |
| Compose | `docker compose config` |
| Compose test profile | `docker compose --profile test config` |
| Runtime image | `docker compose build web` |
| Test image | `docker compose --profile test build test` |
| Runtime isolation | Confirm `pytest` absent from `web` image |
| Compose deps | `docker compose up -d postgres redis` + health wait |
| Docker pytest + coverage | `docker compose --profile test run --rm test pytest ... --cov-fail-under=80` |
| Docker migrations | `docker compose --profile test run --rm test python manage.py makemigrations --check` |
| Docker Django check | `docker compose --profile test run --rm test python manage.py check` |
| Cleanup | `docker compose down --volumes` |

Host-based quality checks remain; the Docker `test` profile validates the dedicated test image path. The runtime `web` image must not include pytest.

Compose host publication uses `COMPOSE_POSTGRES_HOST_PORT` / `COMPOSE_REDIS_HOST_PORT` (CI: `55432` / `56379`) so job-level `POSTGRES_PORT=5432` for Actions services does not collide with Compose publish.

## Pre-commit (local)

`.pre-commit-config.yaml` mirrors subset: whitespace/EOF, YAML/JSON, large files, private key detect, ruff, djlint, detect-secrets.

Pinned locally via project: pre-commit **4.5.1**; ruff hook **v0.15.0**; djlint **v1.36.4**.

## Non-claims

- Green CI does **not** mean Phase 02 is approved or production-ready.
- CI does not close DEBT-01C-R-NOTO.
- Security scans are baseline hygiene, not a completed security assessment.

## Related

- [TESTING_GUIDE.md](TESTING_GUIDE.md)
- [DOCKER_DEVELOPMENT.md](../operations/DOCKER_DEVELOPMENT.md)
- [SECURE_CONFIGURATION.md](../security/SECURE_CONFIGURATION.md)
- [PHASE_02_TECHNICAL_BASELINE.md](../architecture/PHASE_02_TECHNICAL_BASELINE.md)
