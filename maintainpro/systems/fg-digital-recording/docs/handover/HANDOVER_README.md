# Handover README

## Purpose

This is the engineer onboarding entry point for the Nelna FG Digital Recording System.

- Authoritative working path on Windows: `C:\Projects\nelna-fg-digital-recording-system`
- Do not use OneDrive-backed working paths for day-to-day Docker development
- Canonical project status: [../PROJECT_STATUS.md](../PROJECT_STATUS.md)
- Governing roadmap: [../ROADMAP.md](../ROADMAP.md)

## Current status

- PostgreSQL is the implemented system of record
- MongoDB is under assessment only and must not be used for cutover
- UAT has not passed
- Production readiness is not claimed
- Phase 21 go-live is blocked

See:

- [../PROJECT_STATUS.md](../PROJECT_STATUS.md)
- [../release/PHASE_21_FINAL_REPORT.md](../release/PHASE_21_FINAL_REPORT.md)
- [MONGODB_MIGRATION_STATUS.md](MONGODB_MIGRATION_STATUS.md)
- [OPEN_BLOCKERS.md](OPEN_BLOCKERS.md)

## Toolchain

- Python: `3.13.x` (`requires-python = ">=3.13,<3.14"`)
- Recommended local pin from ops docs: `3.13.14`
- Node.js: `24.x` (`24.18.0` in `package.json`)
- Python package manager: `uv`
- Frontend package manager: `npm`
- Local infrastructure: Docker Compose for PostgreSQL and Redis

## Local quick start

From `C:\Projects\nelna-fg-digital-recording-system`:

```powershell
Copy-Item .env.example .env
uv python install 3.13.14
uv python pin 3.13.14
uv sync --locked
npm ci
npm run build
docker compose up -d postgres redis
uv run python manage.py migrate
uv run python manage.py runserver 127.0.0.1:8000
```

Related:

- [LOCAL_SETUP.md](LOCAL_SETUP.md)
- [../operations/LOCAL_DEVELOPMENT.md](../operations/LOCAL_DEVELOPMENT.md)
- [../operations/CONFIGURATION_REFERENCE.md](../operations/CONFIGURATION_REFERENCE.md)

## Local admin and synthetic test users

Create a local Django admin interactively:

```powershell
uv run python manage.py createsuperuser
```

Use only synthetic local values, for example:

- username: `local_admin`
- employee code: `ADMIN-LOCAL-001`

Create a non-superuser synthetic test account if needed:

```powershell
uv run python manage.py shell
```

```python
from django.contrib.auth import get_user_model
User = get_user_model()
User.objects.create_user(
    username="local_test_user",
    employee_code="TEST-LOCAL-001",
    password="ChangeMe123!",
)
```

Do not create shared accounts. Do not use real employee codes or real business users in local setup.

## Synthetic demo data

Load a clearly labelled local demonstration dataset only:

```powershell
uv run python manage.py load_synthetic_demo_data
```

Hard rules:

- Banner: `DEMO / TEST DATA — NOT COMPANY MASTER DATA`
- Blocked when `ENVIRONMENT_LABEL` is `production`, `prod`, `uat`, or `staging`
- Uses synthetic codes only (`DEMOORG1`, `DEMOPROD1`, `DEMOCHK1`, `DEMO-BATCH-0001`)
- Creates local-only users `DEMO-ADMIN-001`, `DEMO-REC-001`, `DEMO-SUP-001`, `DEMO-QA-001`
- Does **not** load FG-QA-001, official products, official shifts, or company roles

Other existing commands remain evidence-gated imports, not demo seeds:

- `uv run python manage.py import_organization_hierarchy`
- `uv run python manage.py import_fg_products`
- `uv run python manage.py load_fg_qa_001_draft`
- `uv run python manage.py preview_checklist_applicability`

These do not authorize loading real Nelna data without owner evidence.

## Tests and validation

Host-based:

```powershell
uv run pytest
uv run pytest --cov=apps --cov=config --cov-report=term-missing --cov-fail-under=80
```

Docker-based:

```powershell
docker compose up -d postgres redis
docker compose --profile test build test
docker compose --profile test run --rm test pytest --cov=apps --cov=config --cov-report=term-missing --cov-fail-under=80
docker compose --profile test run --rm test python manage.py check
docker compose down --volumes
```

Do not use `docker compose run --rm web pytest`.

See [TESTING_GUIDE.md](TESTING_GUIDE.md) and [../testing/TESTING_GUIDE.md](../testing/TESTING_GUIDE.md).

## Frontend build

```powershell
npm ci
npm run build
```

For CSS watch mode:

```powershell
npm run watch:css
```

## Docker usage

Supported local infrastructure:

```powershell
docker compose up -d postgres redis
```

Optional compose runtime services also exist for local development:

- `web`
- `celery-worker`
- `celery-beat`
- `test` profile

This is not production deployment approval.

## Troubleshooting

- If Docker volumes or file watching behave poorly on Windows, confirm the repo is under `C:\Projects\...`, not OneDrive
- Host PostgreSQL defaults to `127.0.0.1:5433`; container PostgreSQL is `5432`
- Host Redis defaults to `127.0.0.1:6380`; container Redis is `6379`
- If host Django cannot connect, confirm `.env` uses `POSTGRES_HOST=127.0.0.1`, `POSTGRES_PORT=5433`, and `REDIS_URL=redis://127.0.0.1:6380/0`
- If tests fail in Docker, use the `test` service profile rather than `web`
- If integration behavior is expected, remember Bileeta live HTTP is intentionally blocked until evidence gates are satisfied
- If MongoDB variables are present in `.env`, they are for the isolated POC only and not for the default app path

## Database position

- PostgreSQL remains the operational system of record
- Redis supports cache and Celery only
- MongoDB is not the application default database
- MongoDB cutover is blocked

See [DATABASE.md](DATABASE.md) and [MONGODB_MIGRATION_STATUS.md](MONGODB_MIGRATION_STATUS.md).

## Business blockers

The repository is technically broad, but operational use is blocked by missing business evidence and approvals, including:

- FG-QA-001 final approval
- Official org/site/department and shift values
- Official product catalogue and specification limits
- Recorder, Supervisor, and QA role mapping
- Segregation-of-duties policy evidence
- Production batch source and Bileeta API evidence
- Hosted UAT / production environment decisions

See [OPEN_BLOCKERS.md](OPEN_BLOCKERS.md) and [BUSINESS_EVIDENCE_REQUIRED.md](BUSINESS_EVIDENCE_REQUIRED.md).

## Production restrictions

- Do not claim `PRODUCTION READY`
- Do not claim `UAT PASSED`
- Do not treat local Docker success as deployment approval
- Do not load real Nelna business data without written owner evidence
- Do not enable live Bileeta or ERP side effects without approved evidence
- Do not migrate from PostgreSQL to MongoDB

## Suggested reading order

1. [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md)
2. [LOCAL_SETUP.md](LOCAL_SETUP.md)
3. [ARCHITECTURE.md](ARCHITECTURE.md)
4. [DATABASE.md](DATABASE.md)
5. [MODULE_GUIDE.md](MODULE_GUIDE.md)
6. [WORKFLOW_GUIDE.md](WORKFLOW_GUIDE.md)
7. [TESTING_GUIDE.md](TESTING_GUIDE.md)
8. [OPEN_BLOCKERS.md](OPEN_BLOCKERS.md)
9. [FINAL_HANDOVER_REPORT.md](FINAL_HANDOVER_REPORT.md)
