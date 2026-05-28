# Newmone QA Test Report

Date: 2026-05-28
Project: Newmone / MaintainPro
Repository: <https://github.com/jkchinthaka/newmone>
Project root: `maintainpro`
Branch reviewed: `qa/fix-live-production-readiness`
Latest code QA commit reviewed: `f36fd8d`
Live web URL: <https://newmone.chinthakajayaweera1.workers.dev/login>
Live API URL: <https://newmone.onrender.com/api>
Tester: GitHub Copilot AI QA automation pass
Report type: Code-level, automated, and live-smoke QA report

## Final Status

Final verdict: **FAIL for live production readiness**.

Source-code validation is green: typecheck, lint script, API tests, Playwright E2E, production build, and Cloudflare/OpenNext build all passed. However, the live release is not production-ready because the deployed API cannot complete database-backed authentication. The live frontend loads, but a valid admin login returns `503` and does not issue an access token. A warmed live health probe showed degraded primary MongoDB status caused by database authentication failure, so the remaining production blocker is Render/MongoDB credential or target database configuration outside source control.

Release recommendation: keep the current build on hold for production release until Render/API database health is restored, dependency advisories are remediated or formally risk-accepted, and live smoke tests pass.

## Scope And Evidence Boundaries

This QA report is based on direct workspace inspection, code review, terminal validation, automated test execution, dependency audit output, and live API/browser smoke checks performed during this QA pass.

The provided live sample admin account was used for a live authentication smoke test. The password is intentionally not stored in this report.

Screenshot artifacts were checked after the Playwright run. No screenshot files were available because the automated E2E suite passed and no failure artifacts were emitted under `apps/web/test-results/` or `apps/web/playwright-report/`.

The following items could not be fully certified against live production because live login is currently blocked by API/database service-unavailable behavior:

- Live authenticated dashboard navigation.
- Live admin CRUD workflows.
- Live database persistence through the UI.
- Live role-based browser flows after login.
- Live module-specific CRUD across vehicles, assets, inventory, cleaning, utilities, reports, and work orders.

## Technology Summary

| Layer | Detected stack |
| --- | --- |
| Frontend | Next.js App Router, React 18, TailwindCSS, React Hook Form, React Query, Axios, lucide-react |
| Backend | NestJS 10, Prisma 5.22, MongoDB, JWT auth, role/permission guards, tenant context guard |
| Data | MongoDB primary database, optional backup replication, replication outbox checks |
| Deployment | Cloudflare Workers/OpenNext frontend, Render-hosted NestJS API |
| Testing | Jest for API tests, Playwright for web E2E |
| Package manager | npm workspaces under `maintainpro` |

## QA Coverage Summary

| Requested QA area | Coverage performed | Result |
| --- | --- | --- |
| Functional testing | Login, validation, protected-route behavior, logout implementation, API auth endpoints, and existing module API suites | PASS locally, FAIL live auth |
| UI testing | Login page availability, password visibility toggle, responsive auth E2E on desktop/mobile Chromium | PASS for auth UI, broader authenticated UI blocked |
| Validation testing | Client-side login validation, API empty login validation, schema/type/build validation | PASS |
| Role-based access testing | JWT, roles, permissions, and tenant guards reviewed; guard tests passed | PASS locally, PARTIAL live because login fails |
| Workflow testing | Auth workflow E2E, stale tenant login regression, existing API workflow suites for vehicles/compliance/driver intelligence/replication | PASS locally, PARTIAL live |
| Database testing | Prisma schema/index review, database URL normalization test, live health/readiness probes | PASS locally, FAIL live primary MongoDB auth |
| Error handling testing | Empty login `400`, unauthenticated `401`, invalid login behavior, sanitized health dependency errors | PASS locally, FAIL live DB-backed invalid/valid login due database outage |
| Final verification | Typecheck, lint script, Jest, Playwright, production build, OpenNext build, audit, smoke guard, git hygiene, secret scan | PASS except audit and live smoke |

## Commands Executed And Results

| Command / check | Result | Evidence summary |
| --- | --- | --- |
| `npm --prefix maintainpro run typecheck` | PASS | API and web TypeScript checks passed. |
| `npm --prefix maintainpro run lint` | PASS | Current lint script delegates to TypeScript checks for API and web. |
| `npm --prefix maintainpro run test` | PASS | 20 Jest suites and 105 tests passed. |
| `npm --prefix maintainpro run test:e2e` | PASS | 10 Playwright tests passed across desktop Chromium and mobile Chromium. |
| `npm --prefix maintainpro run build` | PASS | Shared packages, API, and web production build passed. |
| `npm --prefix maintainpro run cloudflare:build` | PASS | OpenNext Cloudflare worker bundle generated and env fallback sanitized. |
| `npm --prefix maintainpro audit --omit=dev` | FAIL | 56 vulnerabilities: 6 low, 39 moderate, 10 high, 1 critical. |
| `npm --prefix maintainpro run smoke:deploy` | FAIL | With public deployment URLs supplied, smoke correctly fails fast until `MAINTAINPRO_SMOKE_EMAIL` and `MAINTAINPRO_SMOKE_PASSWORD` are provided; full live smoke also remains blocked by MongoDB authentication failure. |
| Direct Node live API probe | FAIL | Warmed health endpoints responded with degraded primary database status; CORS preflight returned 204 with Cloudflare origin and credentials. |
| Direct Node live auth smoke | FAIL | `/login` returned 200 HTML, unauthenticated `/auth/me` returned 401, empty login returned 400, valid admin login returned 503, no token issued. |
| `git diff --check` | PASS | No whitespace errors before commit. |
| Staged secret-risk path check | PASS | No `.env`, `.dev.vars`, Playwright auth state, cookie, or secret-risk paths were staged. |
| Screenshot artifact check | PASS | No screenshot artifacts were available because the Playwright run passed without failure artifacts. |

## Test Case Matrix

| ID | Area | Test case | Expected result | Actual result | Status |
| --- | --- | --- | --- | --- | --- |
| TC-AUTH-001 | Login | Login page loads from live Cloudflare URL | Page returns HTML and renders login UI | `/login` returned `200` HTML | PASS |
| TC-AUTH-002 | Login | Empty login submission | Validation error / `400` behavior | Live API returned `400` for empty login | PASS |
| TC-AUTH-003 | Login | Invalid login attempt | Safe generic auth failure, no crash | Local E2E passed; live invalid login returned `503` because database-backed auth is unavailable | FAIL live |
| TC-AUTH-004 | Login | Valid sample admin login on live API | Access token is issued | Live valid login returned `503`; no token issued | FAIL |
| TC-AUTH-005 | Login UI | Password hidden by default | Password input type is `password` | Playwright E2E passed | PASS |
| TC-AUTH-006 | Login UI | Password visibility toggle | User can show/hide entered password | Playwright E2E passed | PASS |
| TC-AUTH-007 | Login UI | Duplicate submit prevention | Submit is disabled/busy during request | Login implementation fixed and validated locally | PASS |
| TC-AUTH-008 | Session | Protected route without auth | Redirects to login or blocks access | Playwright E2E passed | PASS |
| TC-AUTH-009 | Session | `/auth/me` without token | API returns unauthorized | Live API returned `401` | PASS |
| TC-AUTH-010 | Session | Auth request with stale tenant in browser storage | Login request must not send stale `X-Tenant-Id` | New Playwright E2E assertion passed | PASS |
| TC-AUTH-011 | Logout | Logout clears server session when API reachable | `/auth/logout` called before local cleanup | Code updated and reviewed; live logout could not be certified because live login fails | PARTIAL |
| TC-ROLE-001 | Roles | Protected API without auth | Return `401` | Existing API guard tests passed; live `/auth/me` returned `401` | PASS |
| TC-ROLE-002 | Roles | Insufficient role handling | Return `403` where applicable | Existing roles/permissions guard tests passed | PASS |
| TC-ROLE-003 | Roles | Frontend-only hiding is not only protection | Backend guards enforce permissions | Code review found role/permission/tenant guards | PASS |
| TC-ROLE-004 | Roles | URL manipulation / tenant tampering | Unauthorized tenant access blocked | Tenant context guard reviewed; broader live IDOR testing blocked by live login failure | PARTIAL |
| TC-FORM-001 | Forms | Login required username/password validation | User sees validation and request is blocked | Implemented and E2E validated | PASS |
| TC-FORM-002 | Forms | Login password minimum length | User sees field-level validation | Implemented and E2E validated | PASS |
| TC-FORM-003 | Forms | XSS-like frontend scan | No obvious dangerous HTML rendering in targeted frontend scan | No `dangerouslySetInnerHTML` matches found | PASS |
| TC-FORM-004 | Forms | Business module form consistency | Forms should use consistent validation/error patterns | Mixed React Hook Form/Zod and manual validation patterns found | TECH DEBT |
| TC-CRUD-001 | CRUD | API-backed create/update/delete modules | Persist data and enforce validation | Existing API suites passed, but live UI CRUD cannot be certified while live login fails | PARTIAL |
| TC-CRUD-002 | CRUD | Unauthorized edit/delete blocked | API guards block unauthorized actions | Existing guard tests passed; live role CRUD not certified | PARTIAL |
| TC-DB-001 | Database | Auth database access live | Login can read user and issue token | Valid live login returned `503` | FAIL |
| TC-DB-002 | Database | Schema indexes and uniqueness | Key tenant/user/status fields indexed | Prisma schema review found tenant/status/date indexes and `TenantMembership` uniqueness | PASS |
| TC-API-001 | API | Response on unauthenticated auth/me | `401` | Live API returned `401` | PASS |
| TC-API-002 | API | Empty login validation | `400` with validation behavior | Live API returned `400` | PASS |
| TC-API-003 | API | Valid login endpoint live | `200` with token | Live API returned `503` | FAIL |
| TC-API-004 | API | API test suite | Existing API behavior remains stable | 20 suites / 105 tests passed | PASS |
| TC-SEC-001 | Security | No frontend exposed password hash | Frontend does not reference `passwordHash` | Targeted scan found no frontend matches | PASS |
| TC-SEC-002 | Security | No frontend secret-like public env names | No secret/token/password public env names in frontend | Targeted scan found no matches | PASS |
| TC-SEC-003 | Security | No committed env files | Real env files are not staged/committed | Only example env files were found; staged path check passed | PASS |
| TC-SEC-004 | Security | Dependency audit | No high/critical unresolved production advisories | Audit reports 56 vulnerabilities including 1 critical and 10 high | FAIL |
| TC-SEC-005 | Security | Browser token storage | Minimize XSS blast radius | Tokens are mirrored in `localStorage`; documented as technical debt | TECH DEBT |
| TC-UI-001 | UI | Auth responsive coverage | Desktop and mobile login flows work | Playwright desktop/mobile Chromium E2E passed | PASS |
| TC-UI-002 | UI | Broken assets live | Live assets should load | Frontend login page loaded; full authenticated asset review blocked by live login failure | PARTIAL |
| TC-UI-003 | UI | Console errors live | No avoidable console errors | Full authenticated console review blocked by live login failure | NOT CERTIFIED |
| TC-UI-004 | Accessibility | Login password toggle accessible label | Toggle has accessible show/hide labels | Implemented and E2E validated | PASS |
| TC-UI-005 | Accessibility | Broader keyboard/focus states | Visible focus and keyboard navigation across app | Auth UI improved; full app not certified due live login failure | PARTIAL |
| TC-PERF-001 | Performance | Production build size and route generation | Build completes and routes generate | Next build generated 60 routes successfully | PASS |
| TC-PERF-002 | Performance | Live Core Web Vitals | LCP/INP/CLS measured on live app | Not measured in this pass | NOT CERTIFIED |
| TC-DEPLOY-001 | Deployment | Cloudflare worker build | Worker bundle builds | OpenNext build passed | PASS |
| TC-DEPLOY-002 | Deployment | Live frontend availability | Login page available over HTTPS | `/login` returned `200` HTML | PASS |
| TC-DEPLOY-003 | Deployment | Live API health | API health/check endpoints reachable and database operational | Warmed health endpoints respond, but primary MongoDB is degraded due authentication failure | FAIL |
| TC-DEPLOY-004 | Deployment | Environment consistency | Render runs expected production config | Live health output indicated `environment: development`; code now detects Render service vars more broadly, but service must be redeployed and verified | RISK |
| TC-PRODUCT-001 | Products/search | Products page, filtering, sorting, product detail | Feature should work if implemented | Product/contact/order ecommerce flows were not identified as core active MaintainPro features in this app; equivalent module coverage should be added after live auth recovery | NOT APPLICABLE / NOT CERTIFIED |
| TC-CONTACT-001 | Contact | Contact form validation and submission | Validates and submits or shows fallback | Dedicated contact flow not certified in reviewed active routes | NOT CERTIFIED |
| TC-ORDER-001 | Orders | Order form and admin visibility | Creates and persists order | Dedicated order flow not certified in reviewed active routes | NOT CERTIFIED |
| TC-I18N-001 | Language | Language switcher | Switches and persists locale | Language switcher implementation not certified in this pass | NOT CERTIFIED |
| TC-SEO-001 | SEO | Metadata, title, descriptions, Open Graph | Important routes have meaningful metadata | Build passed; full SEO metadata audit not completed | PARTIAL |

## Bugs And Issues Found

| ID | Severity | Issue | Evidence | Status |
| --- | --- | --- | --- | --- |
| BUG-001 | Critical | Live valid admin login fails | Direct live auth smoke: valid login returned `503`, no token issued; health probe points to MongoDB authentication failure | EXTERNAL BLOCKER |
| BUG-002 | Critical | Deployment smoke fails | Backend health/login cannot pass until MongoDB credentials are fixed and smoke credentials are supplied via environment variables | EXTERNAL BLOCKER |
| BUG-003 | High | Production dependency audit fails | `npm audit --omit=dev` reports 56 vulnerabilities, including 1 critical and 10 high | OPEN |
| BUG-004 | High | `xlsx` has high-severity advisories with no upstream npm fix | Browser imports are now restricted by extension, size, and row count, but the vulnerable package remains present | PARTIALLY MITIGATED |
| BUG-005 | Medium | API client request interceptor could mutate missing headers | Code review of Axios interceptor | FIXED |
| BUG-006 | Medium | Auth endpoints could receive stale tenant header from prior browser state | Code review and targeted E2E scenario | FIXED |
| BUG-007 | Medium | Repository lint script is only TypeScript checking | Script output shows lint delegates to typecheck | TECH DEBT |
| BUG-008 | Medium | Mixed form validation patterns across business modules | Frontend form scan found both Zod/RHF and manual submit handlers | TECH DEBT |
| BUG-009 | Medium | Auth tokens mirrored in `localStorage` | Code/security review | TECH DEBT |
| BUG-010 | Medium | Live environment may not match intended production settings | Prior health output reported `environment: development` while deployment config declares production | NEEDS VERIFY |

## Fixes Applied

| Fix | Files changed | Validation |
| --- | --- | --- |
| Added password visibility toggle and validation improvements for login | `apps/web/app/(auth)/login/page.tsx` | Playwright auth E2E passed |
| Removed sample credential display/prefill from login UI | `apps/web/app/(auth)/login/page.tsx` | Source scan and E2E passed |
| Updated logout to call API before clearing local session | `apps/web/components/layout/topbar.tsx` | Code review and build passed |
| Added Playwright auth E2E coverage | `apps/web/e2e/auth.spec.ts` | 10 E2E tests passed |
| Hardened API client headers before interceptor mutation | `apps/web/lib/api-client.ts` | Typecheck, E2E, and build passed |
| Suppressed stale tenant headers on auth endpoints | `apps/web/lib/api-client.ts` | New E2E assertion passed |
| Added stale-tenant login regression test | `apps/web/e2e/auth.spec.ts` | E2E passed |
| Upgraded direct Axios dependency | `apps/web/package.json`, lockfile from prior QA pass | Axios advisory removed from audit findings |
| Removed hardcoded seed/smoke password defaults | `apps/api/src/database/seed.ts`, `apps/api/src/database/seed-cleaning-qr.ts`, `scripts/smoke-local.mjs`, `scripts/smoke-deployment.mjs` | Source scan found no remaining sample-password literal |
| Sanitized public health dependency errors | `apps/api/src/health.service.ts` | Typecheck, tests, build, and Cloudflare build passed; deployed service must be redeployed for the sanitized response behavior to take effect |
| Made optional readiness dependencies explicit | `apps/api/src/health.service.ts`, env examples, `render.yaml` | Redis/object storage/ERP can be disabled without falsely blocking readiness by default |
| Reduced browser spreadsheet import exposure | `apps/web/components/assets/assets-management-page.tsx` | Imports now reject `.xls`, files larger than 2 MB, and files with more than 1,000 rows; full `xlsx` replacement remains required |
| Added QA evidence report | `FINAL_QA_REPORT.md`, `QA_TEST_REPORT.md` | Markdown diagnostics checked |

## Security Findings

Passed checks:

- No staged `.env`, `.dev.vars`, cookie, or Playwright auth-state files.
- Only example environment files were found during `.env*` search.
- No targeted frontend matches for `dangerouslySetInnerHTML`.
- No targeted frontend matches for exposed `NEXT_PUBLIC_*SECRET`, `NEXT_PUBLIC_*TOKEN`, `NEXT_PUBLIC_*PASSWORD`, or similar secret-like env names.
- No frontend `passwordHash` usage found in targeted scan.
- Auth service review indicates `passwordHash` is stripped from public user responses.
- Password hashing uses bcrypt.
- Tenant context guard enforces membership / active tenant checks.

Open security risks:

- Production dependency audit still fails.
- `xlsx` has no safe upstream npm fix available; current upload restrictions reduce exposure but do not remove the vulnerable dependency.
- Browser token persistence in `localStorage` should be reduced or formally risk-accepted.
- Live API service-unavailable behavior prevents full security verification of authenticated live routes.

## Deployment Findings

| Area | Status | Notes |
| --- | --- | --- |
| Cloudflare frontend availability | PASS | Login page loads over HTTPS. |
| Render API auth/database path | FAIL | Valid login returns `503`; no token issued; health probe indicates MongoDB authentication failure. |
| Scripted deployment smoke | FAIL | Requires env-managed smoke credentials and operational MongoDB credentials. |
| OpenNext Cloudflare build | PASS | Worker bundle generated; env fallback sanitized. |
| Windows build warning | RISK | OpenNext warns Windows is not fully compatible; WSL/Linux build should be preferred for production pipeline validation. |
| Environment consistency | RISK | Live health output reported `environment: development`; code now detects Render service-specific variables, but Render env/redeploy must be confirmed. |

## Recommendations

High priority:

1. Restore live API database connectivity on Render.
2. Verify `PRIMARY_DATABASE_URL`, `DATABASE_URL`, and `MONGODB_URI` values.
3. Verify MongoDB username, password, authSource, database path, URI escaping, and Atlas database user permissions.
4. Confirm MongoDB Atlas network access allows Render outbound traffic.
5. Confirm the production database name, replica set, and Prisma MongoDB connection options.
6. Set `MAINTAINPRO_SEED_PASSWORD`, run the idempotent seed only after database connectivity is restored, and verify admin user, tenant, role, permission, and tenant membership records.
7. Set `MAINTAINPRO_SMOKE_EMAIL` and `MAINTAINPRO_SMOKE_PASSWORD` in the smoke-test environment.
8. Re-run live smoke after API health is stable.
9. Plan dependency upgrades for Next/OpenNext, NestJS/platform-express, multer, Nodemailer, protobuf/AWS SDK transitive packages, Wrangler/miniflare/ws, and related packages.
10. Replace `xlsx` or isolate spreadsheet handling behind a safer maintained parser; keep current file type, size, and row-count restrictions until replacement is complete.

Medium priority:

1. Add a real ESLint pass for React, accessibility, hooks, security, and style rules.
2. Broaden Playwright coverage beyond auth to vehicles, assets, inventory, cleaning, utilities, settings, reports, and work orders.
3. Add authenticated live smoke coverage after login is restored.
4. Consolidate business forms around shared schema validation and field-level errors.
5. Reduce browser-token persistence by relying more on httpOnly cookies or another hardened session strategy.
6. Verify Cloudflare routing behavior for deep protected routes after live auth is fixed.
7. Add focused SEO metadata tests for important routes.
8. Add accessibility checks for keyboard navigation, focus states, labels, and modal focus management.

Low priority:

1. Add Lighthouse/Web Vitals measurement to CI or release validation.
2. Add screenshot regression checks for major dashboard pages after authenticated live testing works.
3. Document which requested ecommerce-style flows are not part of MaintainPro, or map them to equivalent modules if the business expects them.

## Final Acceptance Criteria Before Production Release

The project should not be marked production-ready until all items below are true:

- Live valid admin login returns `200` and issues a token/session.
- Live protected route refresh works after login.
- Live logout invalidates access and browser back does not restore sensitive pages.
- Live API health reports operational database status.
- `npm --prefix maintainpro run smoke:deploy` passes.
- Production dependency audit is remediated or formally risk-accepted with compensating controls.
- `xlsx` replacement or containment strategy is complete.
- Authenticated CRUD smoke tests pass for the highest-value modules.
- No secret files or auth-state artifacts are committed.
- Build, typecheck, tests, E2E, and Cloudflare build remain green.

## Final Verdict

**FAIL for live production readiness.**

The source code is in a stable QA state and the latest code QA fixes have been pushed in commit `f36fd8d` on branch `qa/fix-live-production-readiness`, but the live system must remain blocked until Render/API database health is restored and the unresolved dependency/security risks are addressed or formally risk-accepted.
