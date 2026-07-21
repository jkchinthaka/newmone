# Submit Reliability Baseline

**Date:** 2026-07-21
**Branch:** `fix/enterprise-production-hardening`
**HEAD (after push):** `8827edcd52d25dfde3feff3669a457af71043ac6` (updated as work continues)

## Command results (Phase 1)

| Check | Result |
|-------|--------|
| `npm run db:generate` | PASS |
| `npm run audit:tenant` | PASS (0 unapproved) |
| `npm run audit:rbac` | PASS (641 routes, 0 violations) |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run test` | PASS — 929/929 (134 suites) |
| `npm run build` | PASS |
| `docker compose -f docker-compose.yml config` (without env) | **FAIL** — required `.env` missing |
| `docker compose --env-file .env.compose-ci -f docker-compose.yml config` | PASS (after fix) |
| Docker image builds | not fully timed in Phase 1; CI workflow updated |

## Critical findings (pre-fix)

1. **Access JWT in localStorage** (`maintainpro_access_token`) — XSS exposure.
2. **Cross-origin CSRF failure:** frontend read `maintainpro_csrf` via `document.cookie` while cookie was set on API origin → refresh frequently failed.
3. **No shared in-flight refresh** — concurrent 401s could stampede refresh.
4. **Tenant ID in localStorage** without mandatory membership revalidation before mutations.
5. **Docker Compose CI** failed without committed `.env`.
6. **Deployed SHAs unknown:** Render `/health` reports `build.commit: "unknown"`; Cloudflare has no build-info yet.
7. **Render environment label** reports `"environment":"production"` on `newmone.onrender.com` while treated as staging in this program.

## Fixes landed in this wave (in progress)

- Same-origin BFF at `/api/backend/*` with HttpOnly session cookies + CSRF on frontend origin.
- Access/refresh tokens removed from Web Storage.
- Shared refresh promise in `api-client`.
- Refresh-token family + reuse revocation (`familyId`).
- Safe `/api/build-info` (API) and `/api/build-info` (web).
- Request ID middleware + error envelope `requestId` / stable codes.
- `.env.compose-ci` + compose `env_file` optional `.env` + CI compose flag.
- Shared `lib/form-payload.ts` helpers (blank optional numbers stay undefined).

## Remaining blockers (keep NO-GO)

- Real mutation E2E matrix not yet green against disposable env.
- OpenAPI-generated frontend contracts not yet wired.
- Staging Cloudflare + Render not yet redeployed from one verified SHA with populated build-info.
- Full tenant bootstrap state machine UI incomplete.
- Structured Pino logging not fully rolled out.