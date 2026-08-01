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
8. Auth-path diagnostic (required before Playwright):
   `docker compose -p $COMPOSE_PROJECT_NAME --env-file .env.e2e -f docker-compose.yml -f docker-compose.e2e.yml --profile diagnostics run --rm --no-deps e2e-auth-path-diag`
   (or `npm run e2e:auth-path-diag` when `COMPOSE_PROJECT_NAME` / `E2E_RUN_ID` are already exported)
9. `npm run test:e2e:full-stack`
10. `npm run e2e:evidence`
11. Stop: `docker compose -p $COMPOSE_PROJECT_NAME --env-file .env.e2e -f docker-compose.yml -f docker-compose.e2e.yml down --volumes --remove-orphans` (isolated `maintainpro-e2e-*` project only)

## Cleanup

`CONFIRM_E2E_CLEANUP=DELETE_E2E_RUN_$E2E_RUN_ID npm run e2e:cleanup`

## Never

- Point at production URL/IP
- Load production `.env`
- `docker compose down -v` on production project names

## Playwright environment loading

Before `npm run test:e2e:full-stack`, ensure `.env.e2e` exists via `npm run e2e:materialize-env` (newline-safe) and run `npm run e2e:env-preflight`. Playwright loads the approved file via `MAINTAINPRO_E2E_ENV_FILE`; never export `E2E_SEED_PASSWORD` into the shell or GitHub outputs. Confirm `E2E_SEED_EMAIL_DOMAIN` is exactly `e2e.maintainpro.test` with no concatenated assignment text.

## Auth-path diagnostic matrix

| Probe | Target | Meaning |
| --- | --- | --- |
| A | `http://api:3000/api/auth/login` | Direct NestJS from Docker network |
| B | `http://web:3001/api/backend/auth/login` | Direct BFF from Docker network |
| C | `http://nginx/api/backend/auth/login` | Public E2E nginx path |

Safe output only: probe level, status, duration, request id, JSON yes/no, cookie **names**. Never print email, password, tokens, cookies, Authorization, or bodies. CI fails closed when API is unreachable, BFF converts a valid upstream status into 502/504, or Nginx status family differs from BFF (classic large-cookie buffer 502).

