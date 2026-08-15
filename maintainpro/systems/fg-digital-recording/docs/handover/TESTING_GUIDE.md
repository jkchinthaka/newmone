# Testing Guide

## Current testing posture

Automated technical testing exists and is part of the engineering baseline. It is not equivalent to UAT or production approval.

Primary reference:

- [../testing/TESTING_GUIDE.md](../testing/TESTING_GUIDE.md)

## Supported test commands

Host-based:

```powershell
uv run pytest
uv run pytest --cov=apps --cov=config --cov-report=term-missing --cov-fail-under=80
uv run python manage.py check
```

Docker-based:

```powershell
docker compose up -d postgres redis
docker compose --profile test build test
docker compose --profile test run --rm test pytest
docker compose --profile test run --rm test pytest --cov=apps --cov=config --cov-report=term-missing --cov-fail-under=80
docker compose --profile test run --rm test python manage.py makemigrations --check
docker compose --profile test run --rm test python manage.py check
docker compose down --volumes
```

Do not use `docker compose run --rm web pytest`.

## Tooling and thresholds

- `pytest`
- `pytest-django`
- `pytest-cov`
- coverage fail-under: `80`

## What tests do and do not prove

Technical tests help verify:

- Django application behavior
- PostgreSQL-backed workflows
- permissions and service-layer logic
- reporting, integration boundaries, and specialized domain modules

Technical tests do not prove:

- business approval
- real operator suitability
- Sinhala UAT completion
- production hosting readiness
- go-live authorization

## Additional validation references

- [../testing/VALIDATION_STRATEGY.md](../testing/VALIDATION_STRATEGY.md)
- [../uat/README.md](../uat/README.md)
- [UAT_EXECUTION_GUIDE.md](UAT_EXECUTION_GUIDE.md)

## Handover rule

When reporting project state during handover, say:

- automated testing exists
- technical validation is partial to broad depending on phase evidence
- UAT remains blocked until business prerequisites and execution evidence are completed
