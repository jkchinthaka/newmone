# MaintainPro Risk Register

## Active Risks

### RISK-SEC-010-TOKEN-SESSION-HARDENING-DRIFT
- **Category:** Security / Authentication
- **Description:** Token/session handling regressions (cookie flags, CSRF validation, refresh rotation) could reintroduce account takeover vectors.
- **Impact:** Session hijack risk, unauthorized account access, compliance gaps.
- **Likelihood:** Low-Medium
- **Current Mitigation:**
  - Refresh tokens are cookie-based and HTTP-only.
  - CSRF double-submit validation is enforced on refresh/logout cookie flows.
  - Refresh token persistence + rotation + revocation paths are covered by automated tests.
- **Residual Risk:** Browser/client edge-case regressions if future auth changes bypass shared API client/cookie flow.
- **Owner:** API/Auth
- **Review Cadence:** Every auth-related release.

### RISK-SEC-011-WEBSOCKET-TENANT-LEAKAGE
- **Category:** Security / Multi-tenancy
- **Description:** Mis-scoped websocket rooms/events could leak live notifications/fleet telemetry across tenants.
- **Impact:** Cross-tenant data exposure, incident response burden, contractual risk.
- **Likelihood:** Low (post SEC-011)
- **Current Mitigation:**
  - JWT + active-user validation on websocket handshake.
  - Tenant room scoping for notifications/fleet channels.
  - Dedicated gateway tests for room routing and unauthorized connection rejection.
- **Residual Risk:** New gateway/event additions must consistently apply room scoping rules.
- **Owner:** Platform Realtime
- **Review Cadence:** Every websocket/gateway change.

### RISK-SEC-006-TENANT-ISOLATION-RESIDUAL
- **Category:** Security / Multi-tenancy
- **Description:** Full tenant isolation sweep (`SEC-006`) remains in progress; residual unscoped query surfaces may still exist outside completed modules.
- **Impact:** Potential cross-tenant read/write leakage.
- **Likelihood:** Medium until SEC-006 closure.
- **Current Mitigation:**
  - High-risk modules patched and covered by targeted tenant isolation tests.
  - Ongoing module-by-module sweep tracked in production TODO.
- **Residual Risk:** Remaining non-audited endpoints/services.
- **Owner:** API Platform
- **Review Cadence:** Weekly until SEC-006 is DONE.

### RISK-SEC-012-REDIS-QUEUE
- **Category:** Security / Reliability
- **Description:** Redis or Bull queue connectivity failures can degrade notification/report dispatch and operational automation.
- **Impact:** Delayed or dropped async tasks, reduced observability, operational blind spots.
- **Likelihood:** Medium
- **Current Mitigation:**
  - Queue/Redis status is surfaced in readiness and system health output.
  - Queue failures update health state with sanitized error metadata.
  - Notification dispatch falls back to direct send when queue is unavailable.
  - Redis-related bootstrap failures are logged through structured queue-health logging.
- **Residual Risk:** If Redis remains unavailable for an extended period, async throughput may degrade despite fallback.
- **Owner:** Platform / API
- **Review Cadence:** Each release and after any Redis infrastructure change.

### RISK-SEC-013-UNSAFE-MOCK-MODES
- **Category:** Security / Compliance / Revenue Integrity
- **Description:** Production integrations running in implicit mock/no-op modes can hide delivery failures and create false operational/billing outcomes.
- **Impact:** Fake ERP/billing success, missed notifications, incorrect compliance posture, and audit/revenue risk.
- **Likelihood:** Medium (without strict mode validation); Low (with SEC-013 controls).
- **Current Mitigation:**
  - Explicit integration mode envs (`ERP_MODE`, `BILLING_MODE`, `EMAIL_MODE`, `SMS_MODE`, `PUSH_MODE`, `STORAGE_MODE`).
  - Production startup validation blocks unsafe mock modes unless `ALLOW_MOCK_IN_PRODUCTION=true`.
  - Readiness/system health exposes `mock`, `misconfigured`, `disabled`, `failed`, `degraded`, and `operational` integration states.
  - Billing and ERP services enforce runtime mode checks to prevent unsafe production mock success paths.
- **Residual Risk:** Temporary production mock overrides (`ALLOW_MOCK_IN_PRODUCTION=true`) require strict operational governance and expiry tracking.
- **Owner:** Platform / API + DevOps
- **Review Cadence:** Every release and every production env change.

### RISK-BUILD-REGISTER-SUSPENSE-BLOCKER
- **Category:** Delivery / Build Stability
- **Description:** Web auth `/register` previously failed static prerender because `useSearchParams` was used without a Suspense boundary.
- **Impact:** Was blocking full monorepo build and delaying release confidence.
- **Likelihood:** Low (resolved by WEB-001 refactor).
- **Current Mitigation:**
  - Route now uses server `page.tsx` + `<Suspense>` wrapper with client child component for `useSearchParams` access.
  - Verified passing `npm run build --workspace @maintainpro/web` and full `npm run build` monorepo build.
- **Residual Risk:** Similar regressions can recur if future App Router pages use client navigation hooks in prerendered routes without Suspense/client separation.
- **Owner:** Web Platform
- **Review Cadence:** Every auth-route structural change and before release cut.

### RISK-UX-003-LOGIN-IDENTIFIER-AMBIGUITY
- **Category:** Security / UX / Authentication
- **Description:** Login UI that accepts ambiguous identifiers (username vs email) or silently rewrites credentials can confuse enterprise users and hide incorrect sign-in attempts.
- **Impact:** Support friction, mistaken lockouts, or accidental reliance on undocumented alias behavior in production.
- **Likelihood:** Low after UX-003 (email-only UI aligned to backend contract).
- **Current Mitigation:**
  - Backend login is email-only (`LoginDto.email`, Prisma lookup by `User.email`).
  - Web login validates work email format before submit and sends trimmed email to API.
  - Silent `@maintainpro.local` alias removed from default production behavior.
  - Optional dev alias requires explicit `NEXT_PUBLIC_LOGIN_DEV_LOCAL_ALIAS=true`.
- **Residual Risk:** Future login changes must preserve email-only contract unless backend adds real username support.
- **Owner:** Web Platform + API/Auth
- **Review Cadence:** Every auth UI/API contract change.

### RISK-UX-002-AUTH-UI-REGRESSION
- **Category:** Security / UX / Authentication
- **Description:** Auth UI refactors can accidentally reintroduce public sign-up links, demo credentials, or break cookie/CSRF login compatibility.
- **Impact:** Unauthorized account creation exposure, credential leakage perception, or login/session failures.
- **Likelihood:** Low-Medium during ongoing Phase 2 auth UX work.
- **Current Mitigation:**
  - Login page rebuilt without public sign-up link and with invitation-only guidance.
  - Existing login API contract preserved (`email` + password; work email validation on web).
  - SEC-010 cookie/CSRF refresh flow untouched in API client/auth storage.
  - Playwright auth e2e selectors updated for new login copy/button text.
- **Residual Risk:** Future login/register UX edits must preserve invitation-only posture and cookie-based refresh behavior.
- **Owner:** Web Platform + API/Auth
- **Review Cadence:** Every auth UI release and before production deploy.

### RISK-UX-004-ROLE-LANDING-MISROUTING
- **Category:** UX / Security / Authorization Clarity
- **Description:** Incorrect post-login landing routes can send users to the wrong module and create confusion about frontend vs backend authorization boundaries.
- **Impact:** Poor first-login UX, support friction, and mistaken assumptions that landing page access implies full module permissions.
- **Likelihood:** Low-Medium while role-specific routes are still being built.
- **Current Mitigation:**
  - Centralized role redirect helper with explicit route availability checks and `/dashboard` fallback.
  - Login/register success no longer hardcodes legacy `/home`.
  - Unit tests for role mapping/fallback and e2e checks for admin/technician landing paths.
  - QA checklist documents per-role landing expectations.
- **Residual Risk:** New roles/routes must update the centralized map; backend RBAC remains mandatory for actual access control.
- **Owner:** Web Platform
- **Review Cadence:** Every auth/navigation release and when new role landing pages are added.

### RISK-UX-005-LEGACY-HOME-CONFUSION
- **Category:** UX / Product Clarity
- **Description:** Users may still discover archived `/home` (legacy FMS) via bookmarks, old links, or legacy module navigation and mistake it for the primary product dashboard.
- **Impact:** Operational confusion, duplicated workflows, and reduced trust in platform navigation.
- **Likelihood:** Low-Medium while legacy module remains accessible.
- **Current Mitigation:**
  - `/home` no longer used for login/register/splash/maintenance default redirects.
  - Legacy page, FMS layout, and maintenance shell clearly label archive/read-only status.
  - Prominent CTA links from legacy surfaces to `/dashboard`.
  - QA checklist covers non-`/home` post-login routing and legacy labelling.
- **Residual Risk:** Legacy module routes (`/machinery`, `/service`, etc.) remain until a later archival/removal decision.
- **Owner:** Web Platform
- **Review Cadence:** When legacy FMS module is retired or further isolated.

### RISK-UX-006-NAV-VS-AUTHORIZATION
- **Category:** UX / Security / Authorization Clarity
- **Description:** Role-aware navigation visibility may be mistaken for backend authorization; users may assume hidden modules are inaccessible server-side or that visible modules grant full permissions.
- **Impact:** Support confusion, attempted unauthorized actions, or false confidence in access controls.
- **Likelihood:** Medium while frontend RBAC UX evolves ahead of complete route coverage.
- **Current Mitigation:**
  - Navigation config documented as frontend UX only; backend RBAC remains authoritative.
  - Unknown/missing roles fall back to minimal Dashboard-only navigation.
  - Legacy `/home` is not exposed as primary Home; archived label used when shown to admins.
  - Unit tests for role-to-nav mapping, active route matching, and no primary `/home` nav.
  - QA checklist covers per-role nav visibility and logout behavior.
- **Residual Risk:** New routes/roles must update centralized nav config; direct URL access must remain server-enforced.
- **Owner:** Web Platform
- **Review Cadence:** Every navigation release and when new modules/roles are added.
