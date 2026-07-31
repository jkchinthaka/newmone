# Full-Stack E2E Runbook

**Status:** SOURCE_VALIDATED

## Local

1. `cp .env.e2e.example .env.e2e`
2. Set `E2E_RUN_ID` and `COMPOSE_PROJECT_NAME=maintainpro-e2e-$E2E_RUN_ID`
3. `npm run validate:e2e-safety`
4. `docker compose -p $COMPOSE_PROJECT_NAME --env-file .env.e2e -f docker-compose.yml -f docker-compose.e2e.yml up -d --build`
5. Wait for `http://127.0.0.1:18080/api/health`
6. `npm run e2e:seed`
7. `npm run test:e2e:full-stack`
8. `npm run e2e:evidence`
9. Stop: `docker compose -p $COMPOSE_PROJECT_NAME --env-file .env.e2e -f docker-compose.yml -f docker-compose.e2e.yml down`

## Cleanup

`CONFIRM_E2E_CLEANUP=DELETE_E2E_RUN_$E2E_RUN_ID npm run e2e:cleanup`

## Never

- Point at production URL/IP
- Load production `.env`
- `docker compose down -v` on production project names