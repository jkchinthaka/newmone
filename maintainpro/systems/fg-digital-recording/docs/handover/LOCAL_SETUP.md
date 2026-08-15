# Local Setup

## Supported workstation path

Use this repository path on Windows:

```text
C:\Projects\nelna-fg-digital-recording-system
```

Do not use OneDrive-backed paths for the normal Docker development workflow.

## Required tools

| Tool | Version guidance |
| --- | --- |
| Python | `3.13.x` |
| Recommended local pin | `3.13.14` |
| `uv` | current compatible version |
| Node.js | `24.x` |
| Recommended local pin | `24.18.0` |
| Docker Desktop / Compose | current stable |
| Git | any recent version |

## Environment file

Create `.env` from the template:

```powershell
Copy-Item .env.example .env
```

Important default local values in `.env.example`:

- `POSTGRES_HOST=127.0.0.1`
- `POSTGRES_PORT=5433`
- `COMPOSE_POSTGRES_HOST_PORT=5433`
- `COMPOSE_REDIS_HOST_PORT=6380`
- `REDIS_URL=redis://127.0.0.1:6380/0`
- `WEB_PORT=8000`
- `BILEETA_LIVE_ENABLED=False`
- `AI_ASSISTANCE_ENABLED=False`

Do not commit `.env`. Do not place real secrets in source control.

## Initial setup

```powershell
uv python install 3.13.14
uv python pin 3.13.14
uv sync --locked
npm ci
npm run build
docker compose up -d postgres redis
uv run python manage.py migrate
uv run python manage.py runserver 127.0.0.1:8000
```

Optional worker:

```powershell
uv run celery -A config worker --loglevel=INFO
```

## Local admin and test accounts

Create a local superuser:

```powershell
uv run python manage.py createsuperuser
```

Use synthetic local-only values such as:

- username: `local_admin`
- employee code: `ADMIN-LOCAL-001`

Create a synthetic non-admin user if needed:

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

## Local data notes

- No generic demo-data bootstrap script was found
- Controlled import commands exist, but they do not authorize real Nelna master-data loading
- Use only synthetic local content for development or demonstration

## Common commands

```powershell
uv run pytest
uv run ruff check .
uv run mypy apps config scripts
uv run python manage.py check
npm run watch:css
```

## Docker-specific test path

```powershell
docker compose up -d postgres redis
docker compose --profile test build test
docker compose --profile test run --rm test pytest --cov=apps --cov=config --cov-report=term-missing --cov-fail-under=80
docker compose --profile test run --rm test python manage.py check
docker compose down --volumes
```

Do not use `docker compose run --rm web pytest`.

## Ports

| Service | Host port |
| --- | --- |
| PostgreSQL | `5433` |
| Redis | `6380` |
| Django | `8000` |

## Troubleshooting

- If Django cannot connect to PostgreSQL from the host, verify `.env` still points to `127.0.0.1:5433`
- If Redis errors occur on the host, verify `REDIS_URL=redis://127.0.0.1:6380/0`
- If build output is missing, run `npm run build`
- If migrations fail, confirm `docker compose up -d postgres redis` completed successfully
- If Bileeta behavior is expected locally, stop and confirm the feature is mocked only; live HTTP is blocked
- If MongoDB variables appear in `.env`, remember they are for the isolated POC only

## Related authoritative docs

- [../operations/LOCAL_DEVELOPMENT.md](../operations/LOCAL_DEVELOPMENT.md)
- [../operations/DOCKER_DEVELOPMENT.md](../operations/DOCKER_DEVELOPMENT.md)
- [../operations/CONFIGURATION_REFERENCE.md](../operations/CONFIGURATION_REFERENCE.md)
- [../testing/TESTING_GUIDE.md](../testing/TESTING_GUIDE.md)
