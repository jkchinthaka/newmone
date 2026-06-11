# Newmone QA Test Report

Date: 2026-05-28
Project: Newmone / MaintainPro
Repository: <https://github.com/jkchinthaka/newmone>
Project root: `maintainpro`
Branch reviewed: `qa/fix-live-production-readiness`
Source/report commit reviewed before this update: `b9c1b36`
Live frontend: <https://newmone.chinthakajayaweera1.workers.dev/login>
Live API: <https://newmone.onrender.com/api>
Tester: GitHub Copilot AI QA automation pass
Report type: Final live-readiness QA verification

## Final Status

Final verdict: **FAIL for final release sign-off**.

The previous MongoDB/API health blocker is verified as resolved. Live `/api/health` and `/api/health/readiness` now return HTTP 200, `environment: production`, and operational primary database status with core collections reachable. The current verification cannot mark the project PASS because valid live login and deployment smoke require `MAINTAINPRO_SMOKE_EMAIL` and `MAINTAINPRO_SMOKE_PASSWORD`, and those variables were not present in this terminal environment. The production dependency audit also still reports high/critical unresolved advisories.

## Commands Executed And Results

| Command / check | Result | Evidence summary |
| --- | --- | --- |
| Smoke credential env presence | BLOCKED | Smoke email/password env vars were not set. Values were not printed. |
| `GET /api/health` | PASS | HTTP 200, status `ok`, environment `production`, primary database `operational`. |
| `GET /api/health/readiness` | PASS | HTTP 200, status `operational`, environment `production`, primary database `operational`, 0 degraded checks. |
| Health secret scan | PASS WITH NOTE | No DB URLs, tokens, cookies, or auth failure text detected; generic env var names appear in readiness guidance. |
| Live login page | PASS | `/login` returned HTTP 200 HTML. |
| Live `/auth/me` without token | PASS | Returned HTTP 401. |
| Live empty login | PASS | Returned HTTP 400. |
| Live invalid login | PASS | Returned HTTP 401. |
| Live CORS preflight | PASS | Returned HTTP 204 for Cloudflare origin with credentials enabled. |
| Important route availability | PASS | `/login`, `/dashboard`, `/vehicles`, `/work-orders`, `/inventory`, `/reports`, and `/settings` returned HTTP 200 HTML. |
| Live valid login | NOT CERTIFIED | Required smoke credentials were missing. |
| `npm --prefix maintainpro run smoke:deploy` | FAIL / BLOCKED | Failed fast because smoke credentials were missing. |
| `npm --prefix maintainpro run typecheck` | PASS | API and web TypeScript checks passed. |
| `npm --prefix maintainpro run lint` | PASS | Current lint script delegates to TypeScript checks. |
| `npm --prefix maintainpro run test` | PASS | 20 Jest suites, 105 tests passed. |
| `npm --prefix maintainpro run test:e2e` | PASS | 10 Playwright auth E2E tests passed. |
| `npm --prefix maintainpro run build` | PASS | Shared packages, API, and web production build passed. |
| `npm --prefix maintainpro run cloudflare:build` | PASS | OpenNext Cloudflare build passed; Windows compatibility warning remains. |
| `npm --prefix maintainpro audit --omit=dev` | FAIL | 56 vulnerabilities: 6 low, 39 moderate, 10 high, 1 critical. |

## Test Case Matrix Updates

| ID | Area | Current status | Notes |
| --- | --- | --- | --- |
| BUG-001 | Live valid admin login | NOT CERTIFIED | Change to RESOLVED only after valid env-managed login returns 200 and token/session is issued. |
| BUG-002 | Deployment smoke | OPEN / BLOCKED | `smoke:deploy` did not run credentialed checks because smoke env vars were missing. |
| BUG-003 | Dependency audit | OPEN | Audit still reports high/critical advisories. |
| BUG-004 | `xlsx` risk | PARTIALLY MITIGATED | Upload limits reduce exposure; package replacement/containment remains required. |
| TC-DB-001 | Auth database access live | PARTIAL | Database health is operational, but valid login was not credential-tested. |
| TC-API-003 | Valid login endpoint live | NOT CERTIFIED | Required smoke credentials were missing. |
| TC-DEPLOY-003 | Live API health | PASS | Database status is operational. |
| TC-DEPLOY-004 | Environment consistency | PASS | Health output shows production. |
| TC-ROLE-001 | API without token | PASS | Live `/auth/me` returned 401. |
| TC-ROLE-002 | Permission 403 checks | PARTIAL | Guard tests pass locally; live non-admin/admin role matrix requires credentialed accounts. |
| TC-WORKFLOW-001 | Authenticated dashboard/workflows | NOT CERTIFIED | Credentialed live session unavailable. |
| TC-DB-CRUD-001 | Safe persistence | NOT CERTIFIED | No destructive production CRUD was performed without authenticated QA credentials. |

## Resolved Previous Blockers

- Primary MongoDB health is no longer degraded.
- Live health no longer reports development environment.
- Health output no longer shows database timeout/authentication-failure text.
- Invalid login no longer returns service-unavailable behavior; it returns 401.

## Remaining Risks

- Valid login/token issuance, authenticated dashboard, logout/back-button behavior, protected-route browser redirect after logout, live role/permission matrix, and authenticated CRUD are not certified until smoke credentials are supplied through the environment.
- `smoke:deploy` remains blocked by missing smoke credentials.
- Production dependency audit remains failing with high/critical advisories and no formal risk acceptance recorded.
- Current `xlsx` restrictions are mitigation only; full replacement or backend containment is still required.
- Browser token persistence in `localStorage` remains technical debt.

## Screenshot And Artifact Status

No screenshots were committed. The local Playwright suite passed and did not emit failure screenshots. Authenticated live screenshots were not captured because no credentialed session was available.

## Final Recommendation

Keep the release blocked for final production sign-off. The health/database blocker is resolved, but the release still needs a credentialed smoke pass and a security decision on unresolved high/critical dependency advisories.
