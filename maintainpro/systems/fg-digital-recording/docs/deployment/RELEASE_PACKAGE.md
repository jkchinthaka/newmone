# Production Release Package

## Purpose

IT does **not** copy the full development repository to the company server.

Engineers build a minimal release package from an approved Git SHA using:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deployment\build_release.ps1
```

Outputs:

```text
dist/release/nelna-fg-<FULL_GIT_SHA>/
dist/release/nelna-fg-<FULL_GIT_SHA>.zip
dist/release/RELEASE_MANIFEST.txt
dist/release/SHA256SUMS.txt
```

## What is included

Runtime-only application code and assets:

- `apps/` (no `tests/`, no POC-only apps)
- `config/`, `templates/`
- Built `static/dist/` and `staticfiles/` (from `npm run build` + `collectstatic`)
- Migrations (including `mongo_migrations/` when present)
- `manage.py`, `pyproject.toml`, `uv.lock`
- `.env.example` (template only)
- Docker/compose/nginx templates used by the approved architecture
- Production ops scripts (backup wrappers, wait_for_postgres, FG Mongo dump/restore tools)

## What is excluded

`.git`, `node_modules`, `.venv`, caches, coverage, `tests/`, full `docs/`, UAT evidence, local logs, Mongo POC dumps, and **all secrets** (`.env`, keys, credentials).

## Verification

The build script runs:

1. `scripts/deployment/verify_release_package.ps1`
2. `scripts/deployment/smoke_release_package.ps1` (isolated temp copy + `uv sync` + Django check)

Do not mark a package ready for server copy unless smoke passed.

## Server use

```text
approved release package
+ external environment / vault secrets
+ PostgreSQL or authorized Mongo + Redis + Celery
```

Never edit application source on the production server for routine releases.

## Safety

`config.settings.release_build` is for **packaging collectstatic only**.  
Production runtime must use `config.settings.production` (or authorized Mongo settings) with real secrets supplied externally.
