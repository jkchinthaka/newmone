# Final QA Report

Date: 2026-05-28
Repository: jkchinthaka/newmone
Project root: maintainpro
Live web target: <https://newmone.chinthakajayaweera1.workers.dev>
Live API target: <https://newmone.onrender.com/api>

## Verdict

FAIL for live production readiness. Source-code validation is green, but the live release remains blocked until deployed backend health is restored and the remaining high/critical dependency advisories are handled through a planned framework upgrade track.

The application builds successfully, existing API tests pass, and the web authentication E2E suite passes on desktop and mobile. The current live deployment smoke test does not pass. The Cloudflare frontend loads, but the Render API still cannot complete live login because auth requests that require database access return service-unavailable behavior.

## Stack Summary

- Web: Next.js App Router, React 18, TailwindCSS, React Hook Form, React Query, Axios, lucide-react, OpenNext Cloudflare.
- API: NestJS, Prisma MongoDB, JWT authentication, role and permission guards, tenant context, Helmet, Swagger, Bull/Redis integrations.
- Data: MongoDB primary database with optional backup replication and replication outbox checks.
- Deployment: Cloudflare Workers web frontend and Render-hosted NestJS API.

## Execution Metadata

- Tester identity: GitHub Copilot AI QA automation pass.
- Accounts used: mocked Playwright admin account for local E2E; provided live sample admin account was attempted without recording the password in this report.
- Repository branch: `main`.
- QA scope covered: authentication, route protection, role/permission code review, API client behavior, backend auth/tenant/database review, form patterns, security scans, build/deploy configuration, E2E coverage, dependency audit, and live smoke checks.

## Files Changed

- `apps/web/lib/api-client.ts`: hardened Axios request header handling and auth endpoint tenant-header suppression.
- `apps/web/e2e/auth.spec.ts`: added stale-tenant regression coverage for login requests.
- `FINAL_QA_REPORT.md`: updated QA evidence, code-level findings, validation matrix, live deployment status, and release verdict.

## Fixes Completed

- Added a password visibility toggle to the login form with accessible show/hide labels.
- Added client-side login validation for required username/password and password length.
- Prevented duplicate login submissions while a request is in flight.
- Removed login credential prefill and visible sample credential text from the web client.
- Improved login error rendering with field-level and API-level feedback.
- Updated logout to call `/auth/logout` before clearing local session state, so server cookies are cleared when available.
- Added Playwright authentication E2E coverage for desktop and mobile Chromium.
- Hardened the web API client so request headers are initialized before interceptor mutation.
- Prevented stale tenant context from being sent to `/auth` endpoints during login/register/refresh/logout flows.
- Added E2E coverage proving login requests do not carry a stale `X-Tenant-Id` header from a previous session.
- Added Playwright artifact ignores for `apps/web/test-results/` and `apps/web/playwright-report/`.
- Upgraded the direct Axios dependency to remove the Axios high-severity audit finding.

## Automated Validation

| Check | Result | Notes |
| --- | --- | --- |
| `npm --prefix maintainpro run typecheck` | Pass | API and web TypeScript checks passed after the code-level API client fix. |
| `npm --prefix maintainpro run lint` | Pass | Current lint script delegates to workspace TypeScript checks for API and web. |
| `npm --prefix maintainpro run typecheck --workspace @maintainpro/web` | Pass | Re-run after final login changes. |
| `npm --prefix maintainpro run test` | Pass | 20 Jest suites, 104 tests passed. Includes roles, permissions, vehicles, notifications, replication, compliance, driver intelligence, departments, and utility calculations. |
| `npm --prefix maintainpro run test:e2e` | Pass | 10 Playwright tests passed across desktop Chromium and mobile Chromium after adding stale-tenant login header coverage. |
| `npm --prefix maintainpro run build` | Pass | Shared packages, API, and web production build passed. |
| `npm --prefix maintainpro run cloudflare:build` | Pass | OpenNext Cloudflare worker bundle generated; env fallback sanitized. OpenNext still warns that Windows is not its preferred build OS. |
| `npm --prefix maintainpro audit --omit=dev` | Fail | 56 vulnerabilities: 6 low, 39 moderate, 10 high, 1 critical. Several fixes require breaking upgrades; `xlsx` has no upstream fix. |
| `npm --prefix maintainpro run smoke:deploy` | Fail | Frontend loaded; backend health, CORS preflight, and login endpoint timed out during the scripted deployment smoke. A follow-up direct live auth smoke reached the API but valid login still returned 503 with no token. |
| Direct live auth smoke with Node `fetch` | Fail | `/login` returned 200 HTML, unauthenticated `/auth/me` returned 401, empty login returned 400, valid admin login returned 503, and no token was issued. |

## QA Order Results

1. Login and authentication: Passed locally with automated E2E. Live login is blocked by backend database health.
2. User roles and permissions: Passed existing API guard tests and code review of JWT, roles, permissions, and tenant context guards.
3. Core business modules: Existing automated API coverage passed for vehicles, workflow, compliance, predictive AI, driver intelligence, notifications, departments, utilities, and replication. Web production build generated all 60 routes.
4. Forms and validation: Login validation was fixed and tested. Existing module forms were reviewed for schema/native validation patterns.
5. CRUD and database saving: Automated API tests passed. Live CRUD validation cannot be certified while the production database is degraded.
6. API testing: API test suite passed. Live health/readiness reports degraded primary MongoDB.
7. UI and responsive: Auth E2E passed on desktop and mobile Chromium. Login accessibility labels and error states were improved.
8. Security, performance, and deployment: Source builds pass, Cloudflare bundle builds, and deployment smoke isolates the current live blocker to backend database health. Dependency audit still has unresolved advisories.

## Live Deployment Findings

- Web frontend: PASS. The Cloudflare login page loads.
- CORS preflight: FAIL. The scripted deployment smoke timed out against the Render API.
- Backend health: FAIL. The scripted deployment smoke timed out against the Render API. Prior health output showed degraded primary MongoDB health, so database connectivity remains the leading suspected blocker.
- Live auth smoke: FAIL. A direct live auth smoke returned `/login` 200, unauthenticated `/auth/me` 401, empty login 400, but valid admin login returned 503 and no access token.
- Environment risk: live health output reported `environment: development`, while `render.yaml` declares `NODE_ENV=production`. Confirm the active Render service is using the expected environment/configuration.

Recommended live remediation:

- Verify `PRIMARY_DATABASE_URL`, `DATABASE_URL`, and `MONGODB_URI` on Render.
- Confirm MongoDB Atlas network access allows Render outbound traffic.
- Confirm the primary database name and replica set connectivity are correct.
- Run the seed process only after database connectivity is restored.
- Re-run deployment smoke after health reports operational.

## Code-Level QA Addendum

Typecheck result: PASS. `npm --prefix maintainpro run typecheck` passed for API and web after the code-level fix.

Lint result: PASS. `npm --prefix maintainpro run lint` passed. Note: this repository's lint script currently runs TypeScript checks rather than a separate ESLint rule pass.

Test result: PASS. `npm --prefix maintainpro run test` passed with 20 Jest suites and 104 tests.

E2E test result: PASS. `npm --prefix maintainpro run test:e2e` passed with 10 Playwright tests across desktop Chromium and mobile Chromium.

Build result: PASS. `npm --prefix maintainpro run build` passed for shared packages, API, and web. `npm --prefix maintainpro run cloudflare:build` also passed and generated the OpenNext worker bundle.

Npm audit result: FAIL. `npm --prefix maintainpro audit --omit=dev` reports 56 vulnerabilities: 6 low, 39 moderate, 10 high, and 1 critical. The remaining advisories are concentrated in NestJS/platform-express/multer, OpenNext/Next/AWS SDK transitive packages, Nodemailer, protobuf packages, `xlsx`, `ws`/Wrangler/miniflare, and related transitive dependencies. Safe automated fixes are not complete for this dependency set; forced fixes would perform major framework upgrades, and `xlsx` has no upstream npm fix available.

Code quality issues found:

- Web API interceptor robustness: the API client mutated request headers without first ensuring the header object existed. This could produce runtime failures for unusual Axios request configs.
- Auth tenant isolation: login/register/refresh/logout requests could inherit a stale active tenant value from `localStorage` and send `X-Tenant-Id` to public auth endpoints.
- Dependency risk: production audit still fails, including critical transitive XML parser advisories and high-severity framework/deployment/email/spreadsheet advisories.
- Live backend risk: the deployed frontend loads, but the Render API currently times out for health, CORS preflight, and login checks.
- Form consistency: auth/settings/assets/utilities use React Hook Form and/or Zod patterns, while several business-module forms still use manual validation and submit handlers. This is maintainable today but inconsistent for future large-scale form QA.
- Security posture: no frontend `dangerouslySetInnerHTML`, frontend secret-like `NEXT_PUBLIC_*` names, sample credential display, frontend `passwordHash`, or frontend `console.log` calls were found in the targeted scan. Auth tokens are still mirrored in `localStorage`, which increases XSS blast radius even though the API also supports httpOnly cookies.
- Backend/data review: auth service strips `passwordHash`, password hashing uses bcrypt, tenant context guard enforces tenant membership, and Prisma schema has tenant/status/date indexes and key uniqueness constraints such as `TenantMembership` uniqueness. Some legacy module code still performs direct `findUnique` by id followed by tenant checks rather than using a shared tenant-scoped repository helper.

Code quality fixes applied:

- Initialized API request headers before Axios interceptor mutation in `apps/web/lib/api-client.ts`.
- Added auth endpoint detection so `/auth` and `/api/auth` requests do not receive `X-Tenant-Id` from stale browser state.
- Added Playwright E2E coverage that seeds a stale active tenant, performs login, and verifies the login request has no `x-tenant-id` header.

Remaining technical debt:

- Plan and test a dependency upgrade track for Next/OpenNext, NestJS/platform-express, multer, Nodemailer, protobuf/AWS SDK transitive packages, Wrangler/miniflare/ws, and related packages.
- Replace `xlsx` or isolate spreadsheet import/export behind a safer maintained parser because the package has high-severity advisories with no upstream fix.
- Add a true ESLint pass if the team wants style, React hooks, accessibility, and security linting beyond TypeScript compilation.
- Continue consolidating business-module forms around shared schema validation, field-level errors, and submit-state handling.
- Consider reducing browser-token persistence by leaning more heavily on httpOnly cookies or another hardened session strategy.
- Add broader Playwright coverage for high-value modules such as vehicles, work orders, assets, inventory, cleaning, utilities, and settings after backend live health is restored.
- Re-run live smoke after Render/API health is stable and confirm the service is running with production environment settings.

## Security Review

Completed:

- No `.env` files were staged or committed.
- Login no longer embeds or displays sample credentials in the web client.
- Logout now clears server-side auth cookies when the API is reachable.
- Axios direct dependency was upgraded and is no longer present in audit findings.

Remaining dependency risks:

- OpenNext Cloudflare SSRF advisory requires upgrading OpenNext, but the available patched version has a Next.js 15+ peer requirement.
- Next.js advisories require a major Next upgrade path.
- NestJS/platform-express/multer advisories require Nest/platform or multer major upgrades.
- Nodemailer advisories require a major Nodemailer upgrade.
- Protobuf/AWS SDK transitive advisories remain through deployment/cloud integrations.
- `xlsx` has high-severity advisories with no upstream npm fix available; replacing SheetJS usage should be planned.

`npm audit fix` was attempted without `--force`, but npm rejected the update because the patched OpenNext dependency conflicts with the current Next.js 14 line. Forced audit fixes were not applied because they would perform major framework upgrades during a QA stabilization pass.

## Release Decision

Do not mark the live system as production-ready yet.

Final verdict: FAIL for live production readiness. Source code QA is stable enough to merge, but the live release is blocked by external deployment/database configuration and unresolved dependency upgrade work. After restoring MongoDB connectivity and confirming the Render environment is production, rerun:

```bash
npm --prefix maintainpro run typecheck
npm --prefix maintainpro run test
npm --prefix maintainpro run test:e2e
npm --prefix maintainpro run build
npm --prefix maintainpro run cloudflare:build
npm --prefix maintainpro run smoke:deploy
```
