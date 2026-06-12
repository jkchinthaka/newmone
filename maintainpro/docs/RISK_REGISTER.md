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
- **Description:** Full monorepo build is blocked by a pre-existing web `/register` suspense boundary issue unrelated to completed security tasks.
- **Impact:** Slower release confidence for full-stack build gates despite API security completion.
- **Likelihood:** High (currently reproducible).
- **Current Mitigation:**
  - API workspace build/test gates pass and are used for security-phase verification.
  - Blocker is documented in TODO/implementation logs for Phase 2 handling.
- **Residual Risk:** Full monorepo CI/build remains partially blocked until web issue is resolved.
- **Owner:** Web Platform
- **Review Cadence:** Next UI/Auth web phase.
