# Full-Stack E2E Runbook

**Status:** SOURCE_VALIDATED

## Local

1. `npm run e2e:materialize-env` (or copy `.env.e2e.example` then materialize with runtime `E2E_RUN_ID` / `COMPOSE_PROJECT_NAME`) — never use bare `echo KEY=... >> .env.e2e` without a forced line boundary

2. Set `E2E_RUN_ID` and `COMPOSE_PROJECT_NAME=maintainpro-e2e-$E2E_RUN_ID`
3. `npm run validate:e2e-safety`
4. `npm run validate:container-healthchecks`
5. `docker compose -p $COMPOSE_PROJECT_NAME --env-file .env.e2e -f docker-compose.yml -f docker-compose.e2e.yml up -d --build`
6. Wait until compose reports API/Web/Nginx healthy, then `http://127.0.0.1:18080/api/health`
7. `npm run e2e:seed`
8. `npm run test:e2e:full-stack`
9. `npm run e2e:evidence`
10. Stop: `docker compose -p $COMPOSE_PROJECT_NAME --env-file .env.e2e -f docker-compose.yml -f docker-compose.e2e.yml down --volumes --remove-orphans` (isolated `maintainpro-e2e-*` project only)

## Cleanup

`CONFIRM_E2E_CLEANUP=DELETE_E2E_RUN_$E2E_RUN_ID npm run e2e:cleanup`

## Never

- Point at production URL/IP
- Load production `.env`
- `docker compose down -v` on production project names

## Playwright environment loading

Before `npm run test:e2e:full-stack`, ensure `.env.e2e` exists via `npm run e2e:materialize-env` (newline-safe) and run `npm run e2e:env-preflight`. Playwright loads the approved file via `MAINTAINPRO_E2E_ENV_FILE`; never export `E2E_SEED_PASSWORD` into the shell or GitHub outputs. Confirm `E2E_SEED_EMAIL_DOMAIN` is exactly `e2e.maintainpro.test` with no concatenated assignment text.

