# Docker CI

## Problem

`docker compose -f docker-compose.yml config` previously required a local `.env` file that is not present in GitHub Actions.

## Fix

1. Committed `maintainpro/.env.compose-ci` with **non-secret placeholders only**.
2. `docker-compose.yml` service `env_file`:
   - `.env.compose-ci` (required)
   - `.env` (optional local overrides)
3. CI command:

```bash
docker compose --env-file .env.compose-ci -f docker-compose.yml config
```

## Local usage

```bash
cp .env.compose-ci .env   # then edit secrets locally (gitignored)
docker compose --env-file .env -f docker-compose.yml up --build
```