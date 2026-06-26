# MaintainPro Implementation Log

Record each completed task with:
- Date | Task ID | What changed | Files changed | Tests run | Remaining risks

---

## 2026-06-12 | PHASE-0 | Repository audit and TODO system bootstrap
- What changed: completed a read-only architecture audit across API, web, mobile, schema, auth, tenancy, notifications, deployment, and CI; created and initialized the three required tracking docs for production-readiness execution.
- Files changed:
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
  - `maintainpro/docs/QA_CHECKLIST.md`
- Tests run: none (Phase 0 is audit/planning only; no runtime code changes).
- Remaining risks: multiple Phase-brief assumptions differ from current code state (notably CI already exists, farm web UI exists, utilities meter leak appears already patched, swagger/readiness gating already implemented). These are tracked in Phase 0 audit output and should be confirmed before Phase 1 execution.

## 2026-06-12 | SEC-002 | Persistent hashed refresh tokens + rotation + revoke flows
- What changed:
  - Added new Prisma model `RefreshToken` and relations:
    - `RefreshToken { tokenHash @unique, userId, tenantId?, deviceInfo?, ipAddress?, userAgent?, expiresAt, revokedAt?, lastUsedAt?, createdAt }`
    - `User.refreshTokens` and `Tenant.refreshTokens`.
  - Reworked auth token lifecycle in `AuthService`:
    - Removed in-memory `refreshTokenStore`.
    - Added SHA-256 hashing for refresh token storage (`tokenHash` only, raw token never persisted).
    - Persist refresh token on login/register/refresh issuance.
    - Implemented refresh-token rotation: on `/auth/refresh`, revoke current token (`revokedAt`, `lastUsedAt`) and issue/store a new refresh token.
    - Added session metadata capture from request context (`ipAddress`, `userAgent`, `deviceInfo`).
    - Added `logoutAll(userId)` to revoke all active refresh sessions for a user.
    - `login` now rejects inactive users as part of auth hardening.
  - Extended `AuthController` with `POST /auth/logout-all` (JWT-protected) and cookie clearing.
  - Added/updated tests:
    - New `auth-refresh-token.spec.ts` for rotation + revoke-all behavior.
    - Updated `auth-register.spec.ts` mocks to include refresh-token persistence behavior.
- Files changed:
  - `maintainpro/prisma/schema.prisma`
  - `maintainpro/apps/api/src/modules/auth/auth.service.ts`
  - `maintainpro/apps/api/src/modules/auth/auth.controller.ts`
  - `maintainpro/apps/api/test/auth-refresh-token.spec.ts`
  - `maintainpro/apps/api/test/auth-register.spec.ts`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
- Tests run:
  - `npm run db:generate` (pass)
  - `npm run test` (api workspace) (pass; 26 suites, 147 tests)
  - `npm run typecheck` (api + web) (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/api` (pass)
  - `npm run build` (monorepo) (fails due pre-existing web `/register` `useSearchParams` suspense boundary issue; unrelated to SEC-002 code)
- Remaining risks:
  - `SEC-003` still open: password reset still uses in-memory token store and returns raw token.
  - Full monorepo build remains blocked by existing web auth page issue outside this task.

## 2026-06-12 | SEC-003 | Secure password reset with hashed one-time tokens
- What changed:
  - Added Prisma `PasswordResetToken` model:
    - `tokenHash @unique`, `userId`, `expiresAt`, `usedAt?`, `ipAddress?`, `createdAt`
    - Relation: `User.passwordResetTokens`.
  - Updated `AuthService.forgotPassword()`:
    - Always returns generic response: `"If this email exists, a reset link has been sent"`.
    - Generates raw reset token with `randomBytes(32)` and stores only SHA-256 hash.
    - Expires token in 15 minutes.
    - Invalidates previous active reset tokens for the same user.
    - Sends reset link via `EmailDispatchService` using `/reset-password?token=RAW`.
    - No reset token is returned in API response.
  - Updated `AuthService.resetPassword()`:
    - Validates token by hash and rejects used/expired tokens.
    - Updates password hash.
    - Marks reset token as used (one-time use).
    - Revokes all active refresh-token sessions for that user.
    - Writes `AuditLog` entry for password reset completion.
  - Updated `AuthModule` to import `NotificationsModule` so auth can use `EmailDispatchService`.
  - Added `auth-password-reset.spec.ts` coverage for:
    - generic unknown-email response
    - hashed token creation + email dispatch
    - invalid token rejection
    - successful reset transaction flow
  - Updated existing auth tests to match new `AuthService` constructor dependency.
- Files changed:
  - `maintainpro/prisma/schema.prisma`
  - `maintainpro/apps/api/src/modules/auth/auth.module.ts`
  - `maintainpro/apps/api/src/modules/auth/auth.service.ts`
  - `maintainpro/apps/api/test/auth-password-reset.spec.ts`
  - `maintainpro/apps/api/test/auth-register.spec.ts`
  - `maintainpro/apps/api/test/auth-refresh-token.spec.ts`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
- Tests run:
  - `npm run db:generate` (pass)
  - `npm run test --workspace @maintainpro/api` (pass; 27 suites, 151 tests)
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - The reset email now points to `/reset-password`, but this web page does not yet exist in `apps/web`; user experience follow-up needed.
  - SMTP-disabled environments will still behave securely (generic response), but no email will be delivered (expected behavior).

## 2026-06-12 | SEC-004 | Endpoint throttling + login lockout
- What changed:
  - Added login lockout fields on `User`:
    - `failedLoginAttempts Int @default(0)`
    - `lockedUntil DateTime?`
  - Hardened `AuthService.login()`:
    - Denies authentication for accounts still within lockout window.
    - Increments `failedLoginAttempts` on bad credentials.
    - Sets `lockedUntil` to now + 15 minutes after 5 consecutive failed attempts.
    - Resets `failedLoginAttempts` and clears `lockedUntil` after successful login.
  - Added per-endpoint throttling decorators (`@Throttle`) on:
    - `POST /auth/register`
    - `POST /auth/login`
    - `POST /auth/refresh`
    - `POST /auth/forgot-password`
    - `POST /auth/reset-password`
    - `POST /tenants/:id/invitations`
  - Added `auth-login-lockout.spec.ts` to validate increment/lockout behavior and lock-window denial.
- Files changed:
  - `maintainpro/prisma/schema.prisma`
  - `maintainpro/apps/api/src/modules/auth/auth.service.ts`
  - `maintainpro/apps/api/src/modules/auth/auth.controller.ts`
  - `maintainpro/apps/api/src/modules/invitations/invitations.controller.ts`
  - `maintainpro/apps/api/test/auth-login-lockout.spec.ts`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
- Tests run:
  - `npm run db:generate` (pass)
  - `npm run test --workspace @maintainpro/api` (pass; 28 suites, 154 tests)
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - Lockout policy thresholds are currently hardcoded (5 attempts, 15 minutes); should be moved to env config in a later hardening pass.
  - Full monorepo build remains blocked by the pre-existing web auth `/register` suspense issue outside this task.

## 2026-06-12 | SEC-005 | Gate public self-registration
- What changed:
  - Added production-safe registration toggle in env validation:
    - `ALLOW_PUBLIC_REGISTRATION_IN_PRODUCTION` (default `false`).
  - Hardened `AuthService.register()` public-signup decision:
    - Invitation-token registration remains allowed when token is valid.
    - Public registration in non-production requires `ALLOW_PUBLIC_REGISTRATION=true`.
    - Public registration in production now requires both:
      - `ALLOW_PUBLIC_REGISTRATION=true`
      - `ALLOW_PUBLIC_REGISTRATION_IN_PRODUCTION=true`
  - Expanded `auth-register.spec.ts` for:
    - production rejection without explicit production override
    - production allow path with explicit override
- Files changed:
  - `maintainpro/apps/api/src/config/env.validation.ts`
  - `maintainpro/apps/api/src/modules/auth/auth.service.ts`
  - `maintainpro/apps/api/test/auth-register.spec.ts`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
- Tests run:
  - `npm run test --workspace @maintainpro/api` (pass)
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - Runtime admin UI/API toggle for global signup policy is still not implemented.

## 2026-06-12 | SEC-006 | Tenant isolation hardening sweep (in progress)
- What changed:
  - Added tenant-aware query scoping in high-risk modules using request-context tenant identity:
    - `TripsService.allTrips()` now filters by `vehicle.tenantId` for tenant-bound actors.
    - `UsersService` now scopes list/read/update/status/delete by tenant membership for non-super-admin actors.
    - `UsersService.create()`/`invite()` now stamp `tenantId` and create tenant membership in tenant-scoped contexts.
    - `VehiclesService` now applies tenant checks/stamping on key list/detail/create/update/operation paths and tenant-checks related driver lookups.
    - `DriversService` list/detail/create now use tenant-aware filters/stamping.
    - `FleetService.liveMap()` now filters GPS feed by `vehicle.tenantId` for tenant-scoped actors.
    - `FleetService.updateGps()` validates vehicle accessibility before writing telemetry.
    - `ComplianceService.getVehicleCompliance()` now enforces tenant ownership for vehicle-level compliance reads.
  - Added targeted tenant-isolation tests:
    - `trips-tenant-isolation.spec.ts`
    - `users-tenant-isolation.spec.ts`
    - `vehicles-tenant-isolation.spec.ts`
- Files changed:
  - `maintainpro/apps/api/src/modules/trips/trips.service.ts`
  - `maintainpro/apps/api/src/modules/users/users.service.ts`
  - `maintainpro/apps/api/src/modules/vehicles/vehicles.service.ts`
  - `maintainpro/apps/api/src/modules/drivers/drivers.service.ts`
  - `maintainpro/apps/api/src/modules/fleet/fleet.service.ts`
  - `maintainpro/apps/api/src/modules/compliance/compliance.service.ts`
  - `maintainpro/apps/api/src/modules/compliance/compliance.controller.ts`
  - `maintainpro/apps/api/test/trips-tenant-isolation.spec.ts`
  - `maintainpro/apps/api/test/users-tenant-isolation.spec.ts`
  - `maintainpro/apps/api/test/vehicles-tenant-isolation.spec.ts`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
- Tests run:
  - `npm run test --workspace @maintainpro/api` (pass; 31 suites, 162 tests)
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - SEC-006 remains open until the same tenant-isolation standard is verified module-by-module across the remaining API surfaces.

## 2026-06-12 | SEC-007 | Utilities meter leak fix
- What changed:
  - Hardened `UtilitiesService.bills()` meter hydration query:
    - Added tenant filter when loading related meters by `meterIds`.
    - Prevents cross-tenant meter metadata from being attached to tenant-scoped bill responses.
- Files changed:
  - `maintainpro/apps/api/src/modules/utilities/utilities.service.ts`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
- Tests run:
  - `npm run test --workspace @maintainpro/api -- test/utilities-tenant-isolation.spec.ts` (pass)
  - `npm run test --workspace @maintainpro/api` (pass)
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - None identified within this specific utility meter-join scope; broader SEC-006 sweep remains in progress.

## 2026-06-12 | SEC-006 | Tenant isolation hardening sweep (continued)
- What changed:
  - Hardened `cleaning` module for tenant-safe ID-based operations:
    - Added tenant ownership checks (via request context) in:
      - location fetch/update/deactivate/QR operations
      - visit fetch/sign-off
      - issue update
    - Added tenant validation when creating facility issues against `locationId`.
  - Removed null-tenant bypass risk in Phase4 modules by enforcing strict tenant equality checks:
    - `insurance-claims.service.ts`
    - `accidents.service.ts`
    - `traffic-fines.service.ts`
    - `vehicle-documents.service.ts`
    - `driver-intelligence.service.ts`
  - Prevents access to rows with `tenantId: null` from tenant-scoped actors.
- Files changed:
  - `maintainpro/apps/api/src/modules/cleaning/cleaning.service.ts`
  - `maintainpro/apps/api/src/modules/insurance-claims/insurance-claims.service.ts`
  - `maintainpro/apps/api/src/modules/accidents/accidents.service.ts`
  - `maintainpro/apps/api/src/modules/traffic-fines/traffic-fines.service.ts`
  - `maintainpro/apps/api/src/modules/vehicle-documents/vehicle-documents.service.ts`
  - `maintainpro/apps/api/src/modules/driver-intelligence/driver-intelligence.service.ts`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
- Tests run:
  - `npm run test --workspace @maintainpro/api` (pass; 31 suites, 162 tests)
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - SEC-006 remains open for a final full module-by-module verification pass to confirm no residual unscoped query surfaces.

## 2026-06-12 | SEC-008 | Protect Swagger + readiness endpoints
- What changed:
  - Verified existing production controls in `main.ts` + bootstrap guards:
    - `/health/readiness` in production requires either:
      - `ADMIN` / `SUPER_ADMIN` bearer token, or
      - matching `x-readiness-key` / `READINESS_API_KEY`.
    - Swagger setup in production is opt-in only (`SWAGGER_ENABLED=true`) and requires both:
      - `SWAGGER_USER`
      - `SWAGGER_PASSWORD`
    - Production Swagger routes (`/api/docs`, `/api/docs-json`) are protected with HTTP Basic Auth.
  - No code delta required for this task beyond verification.
- Files verified:
  - `maintainpro/apps/api/src/main.ts`
  - `maintainpro/apps/api/src/bootstrap/readiness-guard.ts`
  - `maintainpro/apps/api/src/bootstrap/swagger-guard.ts`
  - `maintainpro/apps/api/test/readiness-guard.spec.ts`
  - `maintainpro/apps/api/test/swagger-guard.spec.ts`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
- Tests run:
  - `npm run test --workspace @maintainpro/api` (pass; includes readiness/swagger guard suites)
- Remaining risks:
  - None identified for SEC-008 scope.

## 2026-06-12 | SEC-009 | Reject inactive users in login/jwt/refresh
- What changed:
  - Verified end-to-end enforcement is already present:
    - `AuthService.login()` rejects inactive users.
    - `AuthService.refresh()` revokes/rejects refresh flows for inactive users.
    - `JwtStrategy.validate()` rejects inactive users on access-token auth paths.
  - No additional code delta required for this task beyond verification.
- Files verified:
  - `maintainpro/apps/api/src/modules/auth/auth.service.ts`
  - `maintainpro/apps/api/src/modules/auth/jwt.strategy.ts`
  - `maintainpro/apps/api/test/jwt-strategy.spec.ts`
  - `maintainpro/apps/api/test/auth-refresh-token.spec.ts`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
- Tests run:
  - `npm run test --workspace @maintainpro/api` (pass)
- Remaining risks:
  - None identified for SEC-009 scope.

## 2026-06-12 | SEC-005 | Gate public self-registration
- What changed:
  - Added explicit production safety setting in env schema:
    - `ALLOW_PUBLIC_REGISTRATION_IN_PRODUCTION` (default `false`)
  - Hardened public registration decision logic in `AuthService`:
    - Public registration remains disabled by default.
    - Invitation-based registration still works regardless of public-registration flags.
    - In non-production, `ALLOW_PUBLIC_REGISTRATION=true` enables public registration.
    - In production, public registration now requires both:
      - `ALLOW_PUBLIC_REGISTRATION=true`
      - `ALLOW_PUBLIC_REGISTRATION_IN_PRODUCTION=true`
  - Expanded auth registration tests to cover:
    - production rejection when only `ALLOW_PUBLIC_REGISTRATION=true`
    - production allow path only when explicit production override is enabled
    - updated config test mocks for JWT secret keys in production-mode tests
- Files changed:
  - `maintainpro/apps/api/src/config/env.validation.ts`
  - `maintainpro/apps/api/src/modules/auth/auth.service.ts`
  - `maintainpro/apps/api/test/auth-register.spec.ts`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
- Tests run:
  - `npm run test --workspace @maintainpro/api` (pass; 28 suites, 156 tests)
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - There is no admin UI/API yet to toggle global signup policy safely at runtime; current control remains env-driven.
  - Full monorepo build remains blocked by the pre-existing web auth `/register` suspense issue outside this task.

## 2026-06-12 | SEC-010 | Cookie refresh + CSRF hardening
- What changed:
  - Hardened API auth cookie flow in `AuthController`:
    - Added CSRF double-submit protection for cookie-based `POST /auth/refresh` and `POST /auth/logout`.
    - Added non-HttpOnly CSRF cookie (`maintainpro_csrf`) issued whenever refresh cookie is issued/rotated.
    - Enforced `x-csrf-token` header match against CSRF cookie before allowing cookie-token refresh/logout.
    - Cleared CSRF cookie alongside access/refresh cookies on logout/logout-all.
  - Hardened web token handling:
    - Removed refresh-token persistence from web `localStorage` (legacy key cleanup retained).
    - Updated login/register session persistence to store only access token + user profile.
    - Updated Axios client to:
      - attach CSRF header from cookie for state-changing requests,
      - perform one-time silent refresh on 401 using cookie + CSRF,
      - retry original request when refresh succeeds, otherwise clear session and redirect to login.
- Files changed:
  - `maintainpro/apps/api/src/modules/auth/auth.controller.ts`
  - `maintainpro/apps/web/lib/auth-storage.ts`
  - `maintainpro/apps/web/lib/api-client.ts`
  - `maintainpro/apps/web/app/(auth)/login/page.tsx`
  - `maintainpro/apps/web/app/(auth)/register/page.tsx`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
- Tests run:
  - `npm run test --workspace @maintainpro/api` (pass; 31 suites, 162 tests)
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - Mobile/API clients that rely on body `refreshToken` are still supported for compatibility and should be migrated to equivalent hardened patterns in a later mobile-focused security pass.
  - Full monorepo build remains blocked by the pre-existing web auth `/register` suspense issue outside this task.

## 2026-06-12 | SEC-011 | WebSocket auth + tenant room isolation
- What changed:
  - Hardened `NotificationsGateway` socket connection handling:
    - Validates JWT on handshake and rejects invalid/missing tokens.
    - Confirms account is active via Prisma before accepting socket.
    - Enforces tenant identity for non-super-admin users.
    - Joins deterministic user and tenant rooms (`user:<id>`, `tenant:<id>`) and emits notification events only to user-scoped rooms.
  - Hardened `FleetGateway` socket connection handling:
    - Added JWT handshake auth + active-user validation.
    - Enforces tenant room join for tenant users, and dedicated global room for `SUPER_ADMIN`.
    - Replaced namespace-wide broadcasts with room-scoped broadcasts:
      - `tenant:<id>` for tenant-bound events
      - `fleet:global` for super-admin/global events.
  - Updated `FleetService` broadcast flow to carry tenant scope:
    - Added `tenantId` to fleet vehicle runtime metadata.
    - `updateGps` now emits location events to tenant-scoped rooms.
    - Alert broadcasts are resolved against runtime tenant context before socket emission.
  - Added dedicated websocket tests:
    - `fleet.gateway.spec.ts`
    - `notifications.gateway.spec.ts`
- Files changed:
  - `maintainpro/apps/api/src/modules/notifications/notifications.gateway.ts`
  - `maintainpro/apps/api/src/modules/fleet/fleet.gateway.ts`
  - `maintainpro/apps/api/src/modules/fleet/fleet.service.ts`
  - `maintainpro/apps/api/test/fleet.gateway.spec.ts`
  - `maintainpro/apps/api/test/notifications.gateway.spec.ts`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
- Tests run:
  - `npm run test --workspace @maintainpro/api -- test/fleet.gateway.spec.ts test/notifications.gateway.spec.ts` (pass)
  - `npm run test --workspace @maintainpro/api` (pass; 33 suites, 168 tests)
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - Mobile notification socket listener currently subscribes to legacy event names (`notification:new`, `notification:read`) while backend emits `notifications.new`/`notifications.updated`; this is a pre-existing integration mismatch and should be addressed in mobile hardening.
  - Full monorepo build remains blocked by the pre-existing web auth `/register` suspense issue outside this task.

## 2026-06-12 | SEC-012 | Surface queue/Redis failures in health and system status
- What changed:
  - Added queue/Redis runtime observability via new `QueueHealthService` and global `QueuesModule`.
    - Tracks Redis status transitions (`active`/`degraded`/`disabled`/`failed`).
    - Tracks per-queue status, job counts (`waiting`, `active`, `delayed`, `failed`), and sanitized last error metadata.
    - Captures Redis-related bootstrap failures through structured queue-health logging (without leaking secrets).
  - Registered notifications queue monitoring with `NotificationsQueueMonitor`.
  - Hardened queue processor visibility:
    - Added `@OnQueueFailed()` hook in `NotificationsProcessor`.
    - Queue failures now update queue health and emit structured error logs.
  - Hardened notification dispatch fallback:
    - `NotificationsService.enqueueSend()` now checks queue health.
    - On queue unavailability/failure, it falls back to direct email/SMS/push dispatch (with explicit warning logs) instead of silently swallowing.
  - Enhanced readiness output in `HealthService`:
    - Added queue/Redis dependency checks to readiness dependencies.
    - Added detailed `queues` payload with:
      - `redis.status`
      - `redis.lastErrorAt`
      - `redis.lastErrorMessageSafe`
      - per-queue status and counts
      - aggregate queue totals.
    - Public `/health` remains minimal and unchanged.
  - Updated environment validation (`env.validation.ts`):
    - Added `REDIS_REQUIRED_IN_PRODUCTION` guard.
    - Enforces `REDIS_URL` in production when production Redis requirement is enabled.
  - Secured detailed API readiness route in controller:
    - `GET /api/health/readiness` now requires `SUPER_ADMIN`/`ADMIN`.
    - Existing root readiness route protections remain in `main.ts`.
  - Updated system-health UI typing for new readiness states (`failed`, `disabled`) and summary counts.
  - Documentation updates:
    - Added clear TODO Known Issues/Blockers section for the pre-existing web `/register` build blocker.
    - Added `docs/RISK_REGISTER.md` with Redis/queue availability risk.
    - Added `docs/DEPLOYMENT_ENVIRONMENT_CHECKLIST.md` with Redis/Bull and degraded-mode guidance.
    - Added Redis/queue degraded-state checks to `docs/QA_CHECKLIST.md`.
- Files changed:
  - `maintainpro/apps/api/src/modules/queues/queue-health.service.ts`
  - `maintainpro/apps/api/src/modules/queues/queues.module.ts`
  - `maintainpro/apps/api/src/modules/notifications/notifications-queue.monitor.ts`
  - `maintainpro/apps/api/src/modules/notifications/notifications.module.ts`
  - `maintainpro/apps/api/src/modules/notifications/notifications.processor.ts`
  - `maintainpro/apps/api/src/modules/notifications/notifications.service.ts`
  - `maintainpro/apps/api/src/health.service.ts`
  - `maintainpro/apps/api/src/health.controller.ts`
  - `maintainpro/apps/api/src/main.ts`
  - `maintainpro/apps/api/src/config/env.validation.ts`
  - `maintainpro/apps/api/src/app.module.ts`
  - `maintainpro/apps/web/app/(dashboard)/system-health/page.tsx`
  - `maintainpro/apps/api/test/queue-health-readiness.spec.ts`
  - `maintainpro/apps/api/test/notifications.push.spec.ts`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
  - `maintainpro/docs/RISK_REGISTER.md`
  - `maintainpro/docs/DEPLOYMENT_ENVIRONMENT_CHECKLIST.md`
  - `maintainpro/docs/QA_CHECKLIST.md`
- Tests run:
  - `npm run test --workspace @maintainpro/api` (pass; 34 suites, 172 tests)
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - Full monorepo build remains blocked by the pre-existing web auth `/register` suspense issue outside SEC-012 scope.

## 2026-06-12 | SEC-013 | Stop unsafe production mock/no-op integration behavior
- What changed:
  - Added explicit integration mode env controls and production safety validation:
    - `ALLOW_MOCK_IN_PRODUCTION`
    - `ERP_MODE` (`disabled|mock|live`)
    - `BILLING_MODE` (`disabled|mock|live`)
    - `EMAIL_MODE` (`disabled|live`)
    - `SMS_MODE` (`disabled|mock|live`)
    - `PUSH_MODE` (`disabled|mock|live`)
    - `STORAGE_MODE` (`local|r2|s3|minio|cloudinary`)
  - Extended env validation to:
    - reject unsafe production mock modes unless explicitly allowed,
    - enforce live-mode credential presence for ERP/Billing/Email/SMS/Push,
    - validate storage-mode-specific credential requirements (Cloudinary/MinIO).
  - Hardened integration services:
    - `BillingService` now enforces mode semantics (`disabled`/`mock`/`live`) and blocks production mock billing unless explicitly allowed.
    - `ErpSyncProviderService` now uses explicit `ERP_MODE` with `disabled/mock/live` semantics (plus legacy fallback), and blocks production mock mode by policy.
    - `EmailDispatchService`, `SmsDispatchService`, and `PushDispatchService` now use explicit mode semantics and surface `disabled/mock/misconfigured` states instead of ambiguous noop behavior.
  - Expanded readiness/system health visibility:
    - Added new check states (`mock`, `misconfigured`) in backend health model and web system-health UI.
    - Health configuration checks now report mode-aware integration status for Billing/ERP/Email/SMS/Push/Storage.
  - Added/updated tests for SEC-013 policy behavior:
    - production mock mode rejection in env validation,
    - dev mock allowance,
    - billing mock block in production,
    - integration status visibility in readiness checks.
- Files changed:
  - `maintainpro/apps/api/src/config/env.validation.ts`
  - `maintainpro/apps/api/src/modules/billing/billing.service.ts`
  - `maintainpro/apps/api/src/modules/inventory/erp-sync-provider.service.ts`
  - `maintainpro/apps/api/src/modules/notifications/email-dispatch.service.ts`
  - `maintainpro/apps/api/src/modules/notifications/sms-dispatch.service.ts`
  - `maintainpro/apps/api/src/modules/notifications/push-dispatch.service.ts`
  - `maintainpro/apps/api/src/health.service.ts`
  - `maintainpro/apps/web/app/(dashboard)/system-health/page.tsx`
  - `maintainpro/apps/api/test/billing-modes.spec.ts`
  - `maintainpro/apps/api/test/env-validation-integration-modes.spec.ts`
  - `maintainpro/apps/api/test/health-integration-modes.spec.ts`
  - `maintainpro/apps/api/test/erp-sync-provider.service.spec.ts`
  - `maintainpro/apps/api/test/email-dispatch.service.spec.ts`
  - `maintainpro/apps/api/test/sms-dispatch.service.spec.ts`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
  - `maintainpro/docs/RISK_REGISTER.md`
  - `maintainpro/docs/DEPLOYMENT_ENVIRONMENT_CHECKLIST.md`
  - `maintainpro/docs/QA_CHECKLIST.md`
- Tests run:
  - `npm run test --workspace @maintainpro/api` (pass; 37 suites, 177 tests)
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - Full monorepo build remains blocked by the pre-existing web auth `/register` suspense issue outside SEC-013 scope.

## 2026-06-12 | WEB-001 | Fix `/register` Suspense build blocker
- What changed:
  - Reproduced the Next.js build failure on `/register`:
    - `useSearchParams() should be wrapped in a suspense boundary at page "/register"`.
  - Refactored `/register` route rendering pattern to satisfy App Router prerender rules:
    - Converted route `page.tsx` into a server component shell.
    - Wrapped the client registration UI in `<Suspense>` with a lightweight loading fallback.
    - Moved `useSearchParams` usage and existing register-submit logic into a dedicated client child component (`RegisterFormCard`).
  - Preserved behavior:
    - Invitation-token registration path (`invitationToken` query param) is still passed through to `/auth/register`.
    - Existing registration security messaging and API gating behavior are unchanged (no public-registration policy relaxation, no demo credentials introduced).
- Files changed:
  - `maintainpro/apps/web/app/(auth)/register/page.tsx`
  - `maintainpro/apps/web/app/(auth)/register/register-form-card.tsx`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
  - `maintainpro/docs/RISK_REGISTER.md`
  - `maintainpro/docs/QA_CHECKLIST.md`
- Tests run:
  - `npm run build --workspace @maintainpro/web` (pass)
  - `npm run build` (monorepo; pass)
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run test --workspace @maintainpro/api` (pass; 37 suites, 177 tests)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - `SEC-006` tenant-isolation final sweep remains in progress and should be completed before final security sign-off.

## 2026-06-12 | UX-001 / UX-002 | Auth branding standardization + enterprise login rebuild
- What changed:
  - **UX-001 branding standardization:**
    - Added centralized branding constants in `lib/branding.ts` (`MaintainPro`, enterprise tagline/description).
    - Added reusable `MaintainProLogo` and `AuthMarketingPanel` components for consistent auth identity.
    - Updated app metadata (`layout.tsx`) and PWA manifest (`manifest.ts`) to use standardized product naming/tagline.
    - Aligned `/register` and `/forgot-password` visible branding with MaintainPro identity.
    - Removed legacy login marketing labels (`Maintenance Job`, `Fleet & Facility Maintenance Management System`) from the auth experience.
  - **UX-002 enterprise login rebuild:**
    - Rebuilt `/login` with professional enterprise layout (marketing panel + focused sign-in card).
    - Added required copy: “Welcome back”, “Sign in to your workspace”, and enterprise tagline.
    - Kept backend-compatible login payload (`email` normalization for username/email input).
    - Added accessible form labels, password show/hide toggle, loading state, and safe generic errors.
    - Removed public “Sign Up” link; replaced with invitation-only guidance text.
    - Did not add remember-device or staging badge (no safe existing support/env flag).
    - Updated Playwright auth e2e selectors for new login copy/button text.
  - Also closed **SEC-001** as part of login UX hardening (no displayed credentials, no public sign-up link).
- Files changed:
  - `maintainpro/apps/web/lib/branding.ts`
  - `maintainpro/apps/web/components/brand/maintainpro-logo.tsx`
  - `maintainpro/apps/web/components/auth/auth-marketing-panel.tsx`
  - `maintainpro/apps/web/app/(auth)/login/page.tsx`
  - `maintainpro/apps/web/app/(auth)/forgot-password/page.tsx`
  - `maintainpro/apps/web/app/(auth)/register/page.tsx`
  - `maintainpro/apps/web/app/(auth)/register/register-form-card.tsx`
  - `maintainpro/apps/web/app/layout.tsx`
  - `maintainpro/apps/web/app/manifest.ts`
  - `maintainpro/apps/web/e2e/auth.spec.ts`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
  - `maintainpro/docs/QA_CHECKLIST.md`
  - `maintainpro/docs/RISK_REGISTER.md`
- Tests run:
  - `npm run build --workspace @maintainpro/web` (pass)
  - `npm run build` (monorepo; pass)
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run test --workspace @maintainpro/api` (pass; 37 suites, 177 tests)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - Legacy FMS branding still exists in archived/legacy dashboard areas (intentionally preserved outside auth scope).
  - `SEC-006` tenant-isolation final sweep remains in progress.
  - Auth UI regressions (removed sign-up link, changed labels) require manual QA on desktop/mobile.

## 2026-06-12 | UX-003 | Work Email login identifier alignment
- What changed:
  - Inspected backend auth contract:
    - `LoginDto` requires `@IsEmail()` on `email` only.
    - `AuthService.login()` looks up users exclusively by `User.email` (no username path).
  - Chose **Option A (email-only enterprise login)** based on backend contract.
  - Added `lib/login-identifier.ts` with:
    - client-side work email validation before submit,
    - production-safe `resolveLoginEmail()` (trim only, no silent alias),
    - optional dev-only alias helper gated by `NEXT_PUBLIC_LOGIN_DEV_LOCAL_ALIAS=true` for local seed convenience.
  - Updated `/login` form:
    - label **Work Email**, placeholder `you@company.com`, `type="email"`, `autoComplete="email"`,
    - removed silent `@maintainpro.local` normalization from default production UI behavior,
    - renamed form field from `username` to `email` to match API payload intent.
  - Updated Playwright auth e2e tests for new field/copy and added cases for invalid email pre-submit rejection and absence of public sign-up link.
  - Documented optional dev alias flag in `apps/web/.env.example`.
- Files changed:
  - `maintainpro/apps/web/lib/login-identifier.ts`
  - `maintainpro/apps/web/app/(auth)/login/page.tsx`
  - `maintainpro/apps/web/e2e/auth.spec.ts`
  - `maintainpro/apps/web/.env.example`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
  - `maintainpro/docs/QA_CHECKLIST.md`
  - `maintainpro/docs/RISK_REGISTER.md`
- Tests run:
  - `npm run build --workspace @maintainpro/web` (pass)
  - `npm run build` (monorepo; pass)
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run test --workspace @maintainpro/api` (pass; 37 suites, 177 tests)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - Local developers accustomed to bare username login must enter full seeded email or opt into explicit dev alias flag.
  - `SEC-006` tenant-isolation final sweep remains in progress.

## 2026-06-12 | UX-004 | Role-based post-login redirect routing
- What changed:
  - Inspected post-login role availability:
    - Role is available immediately in login/register API response (`payload.user.role.name`).
    - Stored user payload in localStorage also includes nested role for later reads (`getStoredRole()`).
    - No extra `/auth/me` call required for initial landing redirect.
  - Added centralized redirect helper `lib/role-redirect.ts`:
    - `extractRoleName()`, `resolvePostLoginPath()`, `getPostLoginRedirect()`.
    - Role preference map with first-existing-route resolution against audited App Router paths.
    - Safe default fallback to `/dashboard` for unknown/missing roles.
  - Updated auth success flows:
    - `/login` and invitation `/register` now call `getPostLoginRedirect(payload.user)` instead of legacy `/home`.
    - Left legacy `/home` route intact for archival/FMS use (UX-005 follow-up).
  - Added unit coverage via `apps/api/test/role-redirect.spec.ts` (9 tests).
  - Updated Playwright auth e2e for admin -> `/dashboard` and technician -> `/work-orders`, with no `/home` post-login redirect.
- Files changed:
  - `maintainpro/apps/web/lib/role-redirect.ts`
  - `maintainpro/apps/web/app/(auth)/login/page.tsx`
  - `maintainpro/apps/web/app/(auth)/register/register-form-card.tsx`
  - `maintainpro/apps/api/test/role-redirect.spec.ts`
  - `maintainpro/apps/api/tsconfig.json` (exclude cross-workspace test from API typecheck rootDir constraint)
  - `maintainpro/apps/web/e2e/auth.spec.ts`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
  - `maintainpro/docs/QA_CHECKLIST.md`
  - `maintainpro/docs/RISK_REGISTER.md`
- Tests run:
  - `npm run test --workspace @maintainpro/api -- test/role-redirect.spec.ts` (pass; 9 tests)
  - `npm run build --workspace @maintainpro/web` (pass)
  - `npm run build` (monorepo; pass)
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run test --workspace @maintainpro/api` (pass; 38 suites, 186 tests)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - Frontend landing redirect is UX-only; route-level authorization must remain enforced server-side.
  - Several role-specific target routes are not built yet and currently fall back to `/dashboard` or nearest existing module route.
  - `SEC-006` tenant-isolation final sweep remains in progress.

## 2026-06-12 | UX-005 | Legacy `/home` routing cleanup
- What changed:
  - Audited web references to `/home` and legacy FMS branding.
  - Removed `/home` as a default/automatic destination:
    - Splash authenticated redirect now uses `getPostLoginRedirect()` from `/auth/me` (role-aware, never `/home`).
    - `/maintenance` server redirect now targets `/dashboard` instead of `/home`.
    - Login/register already used role redirect helper from UX-004 (verified unchanged).
  - Retained `/home` as an archived legacy FMS workspace with clearer labelling:
    - Added archive banner + “Go to MaintainPro Dashboard” CTA on `(fms)/home` page.
    - Updated FMS layout banner with dashboard link.
    - Updated maintenance-job shell hero copy to “Legacy FMS Workspace / Archived Maintenance Job Module”.
    - Renamed bottom nav label from “Home” to “Legacy” (href remains `/home` for archived navigation only).
  - Updated splash branding from legacy “Maintenance Job” copy to MaintainPro identity.
  - Added `LEGACY_FMS_HOME_PATH` constant in `role-redirect.ts` documenting non-default status.
  - Updated e2e auth tests: protected-route check uses `/dashboard`; added legacy `/home` archive label test.
- Files changed:
  - `maintainpro/apps/web/app/splash/page.tsx`
  - `maintainpro/apps/web/app/(dashboard)/maintenance/page.tsx`
  - `maintainpro/apps/web/app/(dashboard)/(fms)/home/page.tsx`
  - `maintainpro/apps/web/app/(dashboard)/(fms)/layout.tsx`
  - `maintainpro/apps/web/components/maintenance-job/shell.tsx`
  - `maintainpro/apps/web/lib/role-redirect.ts`
  - `maintainpro/apps/web/e2e/auth.spec.ts`
  - `maintainpro/apps/api/test/role-redirect.spec.ts`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
  - `maintainpro/docs/QA_CHECKLIST.md`
  - `maintainpro/docs/RISK_REGISTER.md`
- Tests run:
  - `npm run build --workspace @maintainpro/web` (pass)
  - `npm run build` (monorepo; pass)
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run test --workspace @maintainpro/api` (pass; 38 suites, 186 tests)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - `/home` remains reachable for archived/demo workflows and must stay clearly labelled to avoid user confusion.
  - Role-aware dashboard replacement remains deferred (see TODO known issues).
  - `SEC-006` tenant-isolation final sweep remains in progress.

## 2026-06-12 | UX-006 | Responsive role-aware navigation foundation
- What changed:
  - Added centralized navigation config in `lib/navigation.ts` with role-based visibility, category grouping, active-route matching, and legacy archive handling.
  - Rebuilt dashboard shell navigation:
    - Desktop sidebar uses MaintainPro branding + role-filtered `NavLinks`.
    - Mobile drawer navigation with accessible open/close controls and Escape support.
    - Topbar adds mobile menu trigger, compact branding, and minimal user email/role display.
  - Logout, tenant switch, notifications, and session gate behavior unchanged.
  - Legacy `/home` is not shown as primary Home; admin-only “Legacy FMS Archive” under Archived section.
  - Added unit tests (`navigation.spec.ts`) and Playwright nav coverage for admin desktop/mobile menus.
- Files changed:
  - `maintainpro/apps/web/lib/navigation.ts` (new)
  - `maintainpro/apps/web/components/layout/nav-links.tsx` (new)
  - `maintainpro/apps/web/components/layout/mobile-nav.tsx` (new)
  - `maintainpro/apps/web/components/layout/sidebar.tsx`
  - `maintainpro/apps/web/components/layout/topbar.tsx`
  - `maintainpro/apps/web/app/(dashboard)/layout.tsx`
  - `maintainpro/apps/api/test/navigation.spec.ts` (new)
  - `maintainpro/apps/api/tsconfig.json`
  - `maintainpro/apps/web/e2e/auth.spec.ts`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
  - `maintainpro/docs/QA_CHECKLIST.md`
  - `maintainpro/docs/RISK_REGISTER.md`
- Tests run:
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/web` (pass)
  - `npm run build` (monorepo; pass)
  - `npm run test --workspace @maintainpro/api` (pass; 39 suites, 195 tests)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - Frontend nav visibility is UX-only; backend RBAC must continue to enforce route access.
  - Topbar billing link remains visible on larger screens for all roles (sidebar is role-filtered).
  - `SEC-006` tenant-isolation final sweep remains in progress.

## 2026-06-12 | UX-011 | Standard page UI states
- What changed:
  - Added reusable page state components: `LoadingState`, `ErrorState`, `EmptyState`, `SuccessState`, `PermissionState`, plus `LoadingCardSkeleton` and `InlineLoadingState`.
  - Added `lib/safe-display-message.ts` to sanitize user-facing error text (no stack traces, tokens, or connection strings).
  - Updated legacy `StatePanel` in reports UI to delegate to shared components.
  - Applied shared states to high-impact screens:
    - Dashboard (safe error messaging via existing StatePanel)
    - Reports dashboard (safe error messaging)
    - Work Orders (loading + error)
    - Inventory (loading + error)
    - Procurement (loading + error + empty)
    - System Health (loading + error)
    - Assets list empty state
- Files changed:
  - `maintainpro/apps/web/components/ui/page-state.tsx` (new)
  - `maintainpro/apps/web/lib/safe-display-message.ts` (new)
  - `maintainpro/apps/web/components/reports/report-ui.tsx`
  - `maintainpro/apps/web/components/reports/reports-dashboard-page.tsx`
  - `maintainpro/apps/web/app/(dashboard)/dashboard/page.tsx`
  - `maintainpro/apps/web/app/(dashboard)/system-health/page.tsx`
  - `maintainpro/apps/web/components/work-orders/work-orders-page.tsx`
  - `maintainpro/apps/web/components/inventory/inventory-page.tsx`
  - `maintainpro/apps/web/components/procurement/procurement-page.tsx`
  - `maintainpro/apps/web/components/assets/assets-management-page.tsx`
  - `maintainpro/apps/api/test/page-state.spec.ts` (new)
  - `maintainpro/apps/api/tsconfig.json`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
  - `maintainpro/docs/QA_CHECKLIST.md`
  - `maintainpro/docs/RISK_REGISTER.md`
- Tests run:
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/web` (pass)
  - `npm run build` (monorepo; pass)
  - `npm run test --workspace @maintainpro/api` (pass; 40 suites, 199 tests)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - Not all routes migrated yet; legacy inline loading/error patterns remain on lower-traffic pages.
  - Over-sanitized errors may reduce user-facing detail for rare edge cases (see RISK-UX-011).
  - `SEC-006` tenant-isolation final sweep remains in progress.

## 2026-06-12 | UX-009 | Reusable data-table baseline
- What changed:
  - Added shared table foundation:
    - `components/ui/data-table.tsx` — sortable headers, pagination bar, desktop table + mobile card fallback, EmptyState integration.
    - `components/ui/table-toolbar.tsx` — accessible search input.
    - `lib/client-table.ts` — client-side search/sort/pagination helpers.
  - Rolled out to 3 high-impact list pages (Assets deferred — column picker, motion rows, inline status prompts too risky for this pass):
    - Work Orders table — preserved sort, selection, status/assign controls, row actions; mobile card layout added.
    - Inventory table — preserved pagination, selection, stock visuals, row actions; mobile card layout added.
    - Procurement list — converted to DataTable with client-side PO/supplier search; row click selection preserved.
  - Reused UX-011 `EmptyState` inside DataTable for consistent empty messaging.
- Files changed:
  - `maintainpro/apps/web/components/ui/data-table.tsx` (new)
  - `maintainpro/apps/web/components/ui/table-toolbar.tsx` (new)
  - `maintainpro/apps/web/lib/client-table.ts` (new)
  - `maintainpro/apps/web/components/work-orders/work-order-table.tsx`
  - `maintainpro/apps/web/components/inventory/inventory-table.tsx`
  - `maintainpro/apps/web/components/procurement/procurement-page.tsx`
  - `maintainpro/apps/api/test/data-table.spec.ts` (new)
  - `maintainpro/apps/api/tsconfig.json`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
  - `maintainpro/docs/QA_CHECKLIST.md`
  - `maintainpro/docs/RISK_REGISTER.md`
- Tests run:
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/web` (pass)
  - `npm run build` (monorepo; pass)
  - `npm run test --workspace @maintainpro/api` (pass; 41 suites, 205 tests)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - Assets list not migrated (complex inline editing/column picker); follow-up rollout needed.
  - Client-side search on Procurement filters already-loaded rows only (no API change).
  - `SEC-006` tenant-isolation final sweep remains in progress.

## 2026-06-12 | UX-010 | Replace browser dialogs with professional confirmations
- What changed:
  - Added reusable dialog foundation:
    - `components/ui/confirm-dialog.tsx` — accessible alertdialog with destructive variant and loading state.
    - `components/ui/prompt-dialog.tsx` — inline input dialog with validation via `validatePromptInput`.
    - `components/ui/use-confirm-dialog.tsx` / `use-prompt-dialog.tsx` — promise-based hooks for async flows.
    - `components/ui/action-feedback.ts` — Sonner toast helpers using safe display messages.
  - Replaced all 10 browser-native dialog usages across 7 high-impact files:
    - Work Orders — delete single + bulk delete confirmations.
    - Vehicles list + detail — delete vehicle confirmations.
    - Vehicle documents — reject reason prompt + delete document confirmation.
    - Notifications — assign user prompt + schedule task prompt (ISO validation on submit).
    - Departments — deactivate confirmation.
    - Job codes — deactivate confirmation.
  - No `window.alert`, `window.confirm`, or `window.prompt` remain in audited web app paths.
- Files changed:
  - `maintainpro/apps/web/components/ui/confirm-dialog.tsx` (new)
  - `maintainpro/apps/web/components/ui/prompt-dialog.tsx` (new)
  - `maintainpro/apps/web/components/ui/use-confirm-dialog.tsx` (new)
  - `maintainpro/apps/web/components/ui/use-prompt-dialog.tsx` (new)
  - `maintainpro/apps/web/components/ui/action-feedback.ts` (new)
  - `maintainpro/apps/web/lib/prompt-validation.ts` (new)
  - `maintainpro/apps/web/components/work-orders/work-orders-page.tsx`
  - `maintainpro/apps/web/app/(dashboard)/vehicles/page.tsx`
  - `maintainpro/apps/web/app/(dashboard)/vehicles/[id]/page.tsx`
  - `maintainpro/apps/web/app/(dashboard)/vehicles/[id]/documents/page.tsx`
  - `maintainpro/apps/web/app/(dashboard)/notifications/page.tsx`
  - `maintainpro/apps/web/app/(dashboard)/master-data/departments/page.tsx`
  - `maintainpro/apps/web/app/(dashboard)/maintenance/job-codes/page.tsx`
  - `maintainpro/apps/api/test/dialog-validation.spec.ts` (new)
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
  - `maintainpro/docs/QA_CHECKLIST.md`
  - `maintainpro/docs/RISK_REGISTER.md`
- Tests run:
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/web` (pass)
  - `npm run build` (monorepo; pass)
  - `npm run test --workspace @maintainpro/api` (pass; 42 suites, 210 tests)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - SCHEDULE_TASK dialog cancel still schedules without due date (legacy `window.prompt` semantics preserved).
  - Assets table not migrated (UX-009 deferral; no native dialogs found there).

## 2026-06-12 | SEC-006 | Tenant isolation final sweep closure
- Audit scope:
  - Prisma service queries across high-risk modules: vehicles, work-orders, fleet, notifications, trips, users, drivers, inventory, reports, Phase4 (accidents, fines, claims, vehicle-documents), cleaning, utilities.
  - Tenant context derivation: `TenantContextGuard` validates membership (or active tenant for SUPER_ADMIN via `X-Tenant-Id`); services use `requestContext.getTenantId()` / actor `tenantId`.
  - SUPER_ADMIN: explicit unscoped reads when `tenantId` is null; tenant switch only via validated active tenant header — not accidental for normal users.
- Findings fixed (5 high-risk gaps):
  1. `VehiclesService.remove()` — deleted by id without tenant check → now calls `findOne()` first.
  2. `WorkOrdersService.assign()` — updated work order without tenant ownership check → now calls `findOne(id, actor)` first.
  3. `FleetService.listAlerts()` — returned process-global alerts for all tenants → filtered by vehicle runtime tenant.
  4. `FleetService` geofence CRUD — in-memory geofences shared across tenants → stamped/filtered/scoped by `tenantId`; geofence evaluation respects vehicle tenant.
  5. `NotificationsService` action handlers — work orders created/mutated without tenant scope → `tenantId` stamped on create; `assertReferenceTenantAccess()` guards reference mutations.
- Modules verified (no new gaps found):
  - trips, users, drivers, utilities, reports, inventory, cleaning (post-fetch assert), Phase4 modules (assertAccess pattern), notifications gateway tenant rooms (SEC-011 unchanged).
- Files changed:
  - `maintainpro/apps/api/src/modules/vehicles/vehicles.service.ts`
  - `maintainpro/apps/api/src/modules/work-orders/work-orders.service.ts`
  - `maintainpro/apps/api/src/modules/fleet/fleet.service.ts`
  - `maintainpro/apps/api/src/modules/notifications/notifications.service.ts`
  - `maintainpro/apps/api/test/vehicles-tenant-isolation.spec.ts`
  - `maintainpro/apps/api/test/work-orders-tenant-isolation.spec.ts` (new)
  - `maintainpro/apps/api/test/fleet-tenant-isolation.spec.ts` (new)
  - `maintainpro/apps/api/test/notifications-tenant-isolation.spec.ts` (new)
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
  - `maintainpro/docs/QA_CHECKLIST.md`
  - `maintainpro/docs/RISK_REGISTER.md`
- Tests run:
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/web` (pass)
  - `npm run build` (monorepo; pass)
  - `npm run test --workspace @maintainpro/api` (pass; 45 suites, 218 tests)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks (intentionally deferred):
  - Fleet geofences remain in-memory (now tenant-scoped at API layer); DB persistence recommended for multi-instance deployments.
  - Notification reads are user-scoped (not tenant-column); reference mutations now tenant-guarded.
  - New modules must adopt the same tenant patterns — monitor via code review.

## 2026-06-12 | UX-007 | Breadcrumbs on deep pages
- What changed:
  - Added reusable breadcrumb foundation:
    - `lib/breadcrumbs.ts` — route-to-crumb helper with static labels, dynamic vehicle/report patterns, label truncation, legacy `/home` handling.
    - `components/ui/breadcrumbs.tsx` — accessible `nav` with current-page state, optional links, mobile-safe truncation.
    - `components/layout/page-breadcrumbs.tsx` — pathname-aware wrapper with optional item overrides.
  - Rolled out to high-impact pages:
    - Work Orders, Assets, Inventory, Procurement, Fleet, Vehicles list, Vehicle detail, Vehicle documents, Reports dashboard, Report modules, System Health.
  - Vehicle detail/documents use registration number from already-loaded page data (no new API calls).
  - `/home` maps to “Legacy FMS Archive” only; not used as main dashboard breadcrumb.
- Files changed:
  - `maintainpro/apps/web/lib/breadcrumbs.ts` (new)
  - `maintainpro/apps/web/components/ui/breadcrumbs.tsx` (new)
  - `maintainpro/apps/web/components/layout/page-breadcrumbs.tsx` (new)
  - `maintainpro/apps/web/components/work-orders/work-orders-page.tsx`
  - `maintainpro/apps/web/components/assets/assets-management-page.tsx`
  - `maintainpro/apps/web/components/inventory/inventory-page.tsx`
  - `maintainpro/apps/web/components/procurement/procurement-page.tsx`
  - `maintainpro/apps/web/app/(dashboard)/fleet/page.tsx`
  - `maintainpro/apps/web/app/(dashboard)/vehicles/page.tsx`
  - `maintainpro/apps/web/app/(dashboard)/vehicles/[id]/page.tsx`
  - `maintainpro/apps/web/app/(dashboard)/vehicles/[id]/documents/page.tsx`
  - `maintainpro/apps/web/components/reports/reports-dashboard-page.tsx`
  - `maintainpro/apps/web/components/reports/report-module-page.tsx`
  - `maintainpro/apps/web/app/(dashboard)/system-health/page.tsx`
  - `maintainpro/apps/api/test/breadcrumbs.spec.ts` (new)
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
  - `maintainpro/docs/QA_CHECKLIST.md`
  - `maintainpro/docs/RISK_REGISTER.md`
- Routes intentionally skipped:
  - Work order / asset / procurement detail (modal or inline panel — no dedicated routes).
  - Legacy FMS workspace pages (out of scope for this pass).
  - Cleaning, farm, utilities nested routes (deferred follow-up rollout).
- Tests run:
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/web` (pass)
  - `npm run build` (monorepo; pass)
  - `npm run test --workspace @maintainpro/api` (pass; 46 suites, 225 tests)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - Static breadcrumb labels may drift from page titles on unmigrated routes.
  - New routes must register patterns in `lib/breadcrumbs.ts` or pass explicit `items`.

## 2026-06-12 | UX-009B | Migrate Assets table to shared DataTable baseline
- Audit findings:
  - Assets list lived inline in `assets-management-page.tsx` (~370 lines of table markup) with column picker, server-side filters/sort/pagination, row selection + bulk bar, ellipsis row menu (view/edit/status/WO/maintenance/QR/delete), inline status confirm with disposal reason, framer-motion row enter/exit, QR column, and optimistic delete row hiding via `hiddenRowIds`.
  - Shared DataTable supports selection slots, row actions, mobile cards, empty state, row click, and row className — but not numbered pagination, loading skeleton in tbody, or motion rows.
  - No browser-native dialogs in Assets table flows (delete uses existing modal).
- Migration approach:
  - **Partial wrap:** new `AssetsTable` component delegates rendering to shared `DataTable`; page retains column picker, filter bar, bulk actions, and custom numbered pagination footer.
  - Column visibility: filter `columns` array by `visibleColumns` before passing to DataTable; column picker unchanged in page header.
  - List fetch states: initial load uses UX-011 `LoadingState`; query errors use `ErrorState` with refetch (new vs prior inline skeleton-only loading).
  - Motion: removed `motion.tr` enter/exit animations to avoid hydration/complexity risk; kept row highlight + selection styling via `rowClassName`.
- Preserved behaviors:
  - All data columns, QR column, actions column, column picker, server-side search/filters/sort, page size + numbered pagination, row/header selection, bulk bar, row menu actions, inline status change with disposal reason validation, row click → details drawer, QR view, delete guard when open WOs exist, `hiddenRowIds` optimistic delete filter, breadcrumbs.
- Skipped/deferred:
  - DataTable built-in prev/next pagination not used (Assets keeps numbered pages).
  - Column header sort not enabled (server sort remains in filter bar only).
  - Row motion animations simplified/removed.
- Files changed:
  - `maintainpro/apps/web/components/assets/assets-table.tsx` (new)
  - `maintainpro/apps/web/components/assets/assets-table-columns.ts` (new)
  - `maintainpro/apps/web/components/assets/assets-management-page.tsx`
  - `maintainpro/apps/api/test/assets-table.spec.ts` (new)
  - `maintainpro/apps/api/tsconfig.json`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
  - `maintainpro/docs/QA_CHECKLIST.md`
  - `maintainpro/docs/RISK_REGISTER.md`
- Tests run:
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/web` (pass)
  - `npm run build` (monorepo; pass)
  - `npm run test --workspace @maintainpro/api` (pass; 47 suites, 228 tests)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - Row action dropdown positioning on small mobile cards may need polish.
  - Other unmigrated legacy tables still use inline patterns.

## 2026-06-12 | UX-012 | Mobile responsiveness and PWA polish
- Audit findings:
  - Mobile nav/topbar already had 44px menu targets; Assets row action flyout clipped inside DataTable `overflow-hidden` on mobile cards.
  - DataTable mobile cards lacked `break-words`/`min-w-0` on values; selection checkboxes had small hit areas.
  - Breadcrumbs wrapped but used fixed `text-sm` on very narrow screens.
  - Auth pages generally responsive; submit/toggle controls needed explicit min-height on small screens.
  - PWA manifest/meta already used MaintainPro name; description was longer than canonical tagline; viewport lacked explicit `device-width`.
  - Service worker left unchanged (low-risk static shell only).
- Fixes applied:
  - DataTable: mobile overflow-visible cards, word wrapping, touch-friendly leading cells, shared `getVisibleMobileColumns` helper.
  - Assets row actions: mobile bottom-sheet menu with backdrop; desktop keeps anchored dropdown; 44px action trigger/menu items.
  - Breadcrumbs: responsive text size + max-width guard.
  - Mobile nav close button, confirm/prompt dialogs, login/register/forgot-password touch targets, dashboard toasts centered for mobile.
  - Root layout viewport + metadata aligned to `pwa-metadata` / branding constants; manifest description uses canonical tagline.
  - Global `overflow-x: clip` on html/body to reduce accidental horizontal page scroll.
  - Assets registry table wrapper uses horizontal scroll on desktop only.
- Skipped/deferred:
  - No service-worker caching strategy changes.
  - Legacy non-DataTable pages (cleaning, farm, utilities tables) not migrated in this pass.
  - Vehicles and other dashboard pages beyond shared shell/DataTable/auth not individually redesigned.
- Files changed:
  - `maintainpro/apps/web/lib/pwa-metadata.ts` (new)
  - `maintainpro/apps/web/lib/data-table-mobile.ts` (new)
  - `maintainpro/apps/web/app/layout.tsx`
  - `maintainpro/apps/web/app/manifest.ts`
  - `maintainpro/apps/web/app/globals.css`
  - `maintainpro/apps/web/app/(dashboard)/layout.tsx`
  - `maintainpro/apps/web/app/(auth)/login/page.tsx`
  - `maintainpro/apps/web/app/(auth)/register/register-form-card.tsx`
  - `maintainpro/apps/web/app/(auth)/forgot-password/page.tsx`
  - `maintainpro/apps/web/components/ui/data-table.tsx`
  - `maintainpro/apps/web/components/ui/breadcrumbs.tsx`
  - `maintainpro/apps/web/components/ui/confirm-dialog.tsx`
  - `maintainpro/apps/web/components/ui/prompt-dialog.tsx`
  - `maintainpro/apps/web/components/layout/mobile-nav.tsx`
  - `maintainpro/apps/web/components/assets/assets-table.tsx`
  - `maintainpro/apps/web/components/assets/assets-management-page.tsx`
  - `maintainpro/apps/api/test/mobile-pwa.spec.ts` (new)
  - `maintainpro/apps/api/tsconfig.json`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
  - `maintainpro/docs/QA_CHECKLIST.md`
  - `maintainpro/docs/RISK_REGISTER.md`
- Tests run:
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/web` (pass)
  - `npm run build` (monorepo; pass)
  - `npm run test --workspace @maintainpro/api` (pass; 48 suites, 233 tests)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - Fixed-position Assets menus may overlap iOS home indicator on smallest devices; manual device QA still recommended.
  - Unmigrated legacy tables may still horizontally scroll on mobile.

## 2026-06-12 | UX-013 | WCAG 2.1 AA accessibility polish
- Audit findings:
  - Auth pages mostly labeled; register/forgot-password lacked explicit `htmlFor`/`id` pairs; login busy state not announced to screen readers.
  - Topbar mobile menu button missing `aria-expanded` / `aria-controls`; drawer lacked stable `id`.
  - Breadcrumbs had `aria-current` but truncated visible text could lose full meaning for assistive tech.
  - DataTable sort headers lacked shared `aria-sort` helper usage consistency; desktop clickable rows had no keyboard support; column headers missing `scope="col"`.
  - PromptDialog validation errors not associated with input via `aria-describedby` / `aria-invalid`.
  - Empty/success page states used generic `region` role instead of `status` where appropriate.
- Fixes applied:
  - Added `lib/accessibility.ts` helpers (`toAriaExpanded`, `toNavAriaCurrent`, `toBreadcrumbAriaCurrent`, `toSortAriaSort`, `getAccessibleLabel`, `joinAriaDescribedBy`).
  - Navigation: mobile menu `aria-expanded`/`aria-controls`, drawer `id`, nav links use shared `aria-current` helper.
  - Breadcrumbs: full-label `aria-label` when truncated; shared current-page helper.
  - DataTable: `scope="col"`, keyboard-activatable rows when `onRowClick`, optional `getRowLabel`, sort/pagination focus rings, pagination `nav` landmark.
  - Dialogs: confirm `aria-busy`; prompt input linked to description + error ids.
  - Page states: Empty/Success use `role="status"`; Error retains `role="alert"`.
  - Auth: explicit label associations, focus-visible rings, busy status announcements, password toggle `aria-hidden` icons.
  - Assets table: row menu `aria-controls`, disposal reason label, QR button accessible name.
- Skipped/deferred:
  - Full focus trap in mobile drawer/dialogs (existing Escape/backdrop retained; trap deemed higher regression risk).
  - Legacy unmigrated pages and modal-only detail flows not individually audited.
  - Automated axe/Lighthouse CI not added in this pass.
- Files changed:
  - `maintainpro/apps/web/lib/accessibility.ts` (new)
  - `maintainpro/apps/web/components/layout/topbar.tsx`
  - `maintainpro/apps/web/components/layout/mobile-nav.tsx`
  - `maintainpro/apps/web/components/layout/nav-links.tsx`
  - `maintainpro/apps/web/app/(dashboard)/layout.tsx`
  - `maintainpro/apps/web/components/ui/breadcrumbs.tsx`
  - `maintainpro/apps/web/components/ui/data-table.tsx`
  - `maintainpro/apps/web/components/ui/confirm-dialog.tsx`
  - `maintainpro/apps/web/components/ui/prompt-dialog.tsx`
  - `maintainpro/apps/web/components/ui/page-state.tsx`
  - `maintainpro/apps/web/components/assets/assets-table.tsx`
  - `maintainpro/apps/web/app/(auth)/login/page.tsx`
  - `maintainpro/apps/web/app/(auth)/register/register-form-card.tsx`
  - `maintainpro/apps/web/app/(auth)/forgot-password/page.tsx`
  - `maintainpro/apps/api/test/accessibility.spec.ts` (new)
  - `maintainpro/apps/api/tsconfig.json`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
  - `maintainpro/docs/QA_CHECKLIST.md`
  - `maintainpro/docs/RISK_REGISTER.md`
- Tests run:
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/web` (pass)
  - `npm run build` (monorepo; pass)
  - `npm run test --workspace @maintainpro/api` (pass; 49 suites, 239 tests)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - Focus management on route changes and complex nested widgets still needs manual screen-reader QA.
  - Color contrast on legacy pages not fully audited.

## 2026-06-12 | UX-008 | Global command palette
- Audit findings:
  - UX-006 `getVisibleNavigationItems()` already centralizes role-aware routes with `EXISTING_NAV_ROUTES` guard and dashboard fallback for unknown roles.
  - Current user role is available client-side via `useCurrentUser()` / `extractRoleName()` (same source as sidebar).
  - `/home` is only exposed as labeled “Legacy FMS Archive” (`legacy: true`), not as main Dashboard.
  - Topbar had decorative search text only; no global quick navigation existed.
- Command source/filtering approach:
  - Pure helpers in `lib/command-palette.ts` map visible navigation items to command entries (label, description, href, category, keywords).
  - Filtering reuses `getVisibleNavigationItems(role)` — no separate command list, no backend calls, no routes outside nav config.
  - Client-side search matches label, description, category, and keyword aliases only.
- Fixes applied:
  - Added reusable `CommandPalette` dialog UI with accessible search, keyboard navigation (Up/Down/Enter/Escape), no-results status, mobile-friendly layout.
  - Added `GlobalCommandPalette` wired into dashboard layout with Ctrl/Cmd+K shortcut (ignored while typing in inputs/textareas/select/contenteditable).
  - Topbar search buttons (mobile icon + desktop trigger with Ctrl K hint) open the palette.
  - Selecting a command navigates via Next router and closes palette.
- Skipped/deferred:
  - No destructive/mutating commands (create/update/delete/approve).
  - No server-side search or new API endpoints.
  - No focus trap (Escape/backdrop close retained; documented residual risk).
  - Entity/detail search (assets by tag, work orders by number) deferred — navigation-only scope.
- Files changed:
  - `maintainpro/apps/web/lib/command-palette.ts` (new)
  - `maintainpro/apps/web/components/ui/command-palette.tsx` (new)
  - `maintainpro/apps/web/components/layout/global-command-palette.tsx` (new)
  - `maintainpro/apps/web/app/(dashboard)/layout.tsx`
  - `maintainpro/apps/web/components/layout/topbar.tsx`
  - `maintainpro/apps/api/test/command-palette.spec.ts` (new)
  - `maintainpro/apps/api/tsconfig.json`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
  - `maintainpro/docs/QA_CHECKLIST.md`
  - `maintainpro/docs/RISK_REGISTER.md`
- Tests run:
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/web` (pass)
  - `npm run build` (monorepo; pass)
  - `npm run test --workspace @maintainpro/api` (pass; 50 suites, 248 tests)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - Frontend command visibility mirrors nav config only; backend RBAC still required on route access.
  - Command keywords may drift from nav labels until both share one source (currently same item list).

## 2026-06-12 | UX-014 | Sri Lanka localization readiness
- Audit findings:
  - Scattered `en-US` / `USD` / `$` formatting in inventory helpers, work-order helpers, dashboard fleet cost summary, reports `formatReportValue`, and procurement totals.
  - Assets tables used browser-default `Intl.DateTimeFormat(undefined, …)` without `Asia/Colombo` timezone.
  - Partial prior alignment in `lib/farm-api.ts` and maintenance-job screens (`en-LK` / `LKR`); farm/vehicles/predictive-ai pages still use raw `toLocaleDateString()` (deferred mass migration).
- Helper functions added:
  - `apps/web/lib/localization.ts`: `DEFAULT_LOCALE` (`en-LK`), `DEFAULT_TIME_ZONE` (`Asia/Colombo`), `DEFAULT_CURRENCY` (`LKR`), `formatDate`, `formatTime`, `formatDateTime`, `formatCurrency`, `formatNumber`, `formatPercent`, `formatRelativeDateLabel`, safe parsing/coercion, `EMPTY_DISPLAY` (`—`) fallback.
  - `apps/web/lib/ui-copy.ts`: minimal English-default language readiness constants (`SUPPORTED_UI_LANGUAGES`, labels) — no full translation catalogs.
  - Root layout `lang="en-LK"` for document locale metadata (English UI unchanged).
- Limited rollout locations:
  - `components/inventory/helpers.ts` — date/datetime/currency formatters delegate to localization (fallback `-` preserved in module wrappers).
  - `components/work-orders/helpers.ts` — date/currency formatters delegate to localization.
  - `components/assets/assets-table.tsx` — last service date uses shared formatter (`Never` empty label preserved).
  - `components/assets/assets-management-page.tsx` — local date/datetime formatters delegate to localization.
  - `app/(dashboard)/dashboard/page.tsx` — fleet cost breakdown uses `formatCurrency`.
  - `components/reports/api.ts` — `formatReportValue` uses currency/date/datetime/percent helpers.
  - `components/procurement/procurement-page.tsx` — PO totals use LKR `formatCurrency` instead of `$` prefix.
- Skipped/deferred:
  - Full Sinhala/Tamil UI translation and heavy i18n library.
  - Mass replace of every `toLocaleDateString` / `Intl` usage across farm, vehicles, predictive-ai, fuel, and legacy FMS pages.
  - Backend/API/database/schema changes; stored timestamp formats and API payloads unchanged.
  - PWA manifest translation (MaintainPro branding retained from UX-012).
- Files changed:
  - `maintainpro/apps/web/lib/localization.ts` (new)
  - `maintainpro/apps/web/lib/ui-copy.ts` (new)
  - `maintainpro/apps/web/app/layout.tsx`
  - `maintainpro/apps/web/components/inventory/helpers.ts`
  - `maintainpro/apps/web/components/work-orders/helpers.ts`
  - `maintainpro/apps/web/components/assets/assets-table.tsx`
  - `maintainpro/apps/web/components/assets/assets-management-page.tsx`
  - `maintainpro/apps/web/app/(dashboard)/dashboard/page.tsx`
  - `maintainpro/apps/web/components/reports/api.ts`
  - `maintainpro/apps/web/components/procurement/procurement-page.tsx`
  - `maintainpro/apps/api/test/localization.spec.ts` (new)
  - `maintainpro/apps/api/tsconfig.json`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
  - `maintainpro/docs/QA_CHECKLIST.md`
  - `maintainpro/docs/RISK_REGISTER.md`
- Tests run:
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/web` (pass)
  - `npm run build` (monorepo; pass)
  - `npm run test --workspace @maintainpro/api` (pass)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - Unmigrated pages may still show USD/browser-default formatting until individually rolled out.
  - Relative date labels use English-only strings (`Today`, `Yesterday`) until future i18n catalogs exist.

## 2026-06-12 | DASH-001 | Role-aware dashboard content
- Audit findings:
  - `/dashboard` previously rendered the full driver-intelligence management dashboard for every role, including technicians, cleaners, inventory keepers, and viewers.
  - Role detection already exists via `extractRoleName()` / `useCurrentUser()` and UX-006 navigation visibility.
  - Existing data APIs usable without backend changes: work orders (`fetchWorkOrders`), inventory (`getInventoryParts`, `getLowStockParts`, `getPurchaseOrders`), reports (`getReportsDashboard`), system health (`/health/readiness`), driver intelligence (`getDriverManagementDashboard`).
  - No dedicated cleaning or driver aggregate dashboard API exists; documented safe empty states instead of fake metrics.
- Role grouping approach:
  - Added `lib/dashboard-roles.ts` with `resolveDashboardVariant()` and section visibility helpers.
  - Variants: `admin`, `management`, `technician`, `cleaner`, `inventory`, `driver`, `viewer`, `minimal`.
  - Reuses same role naming conventions as navigation/redirect; frontend visibility only.
- Dashboard sections added:
  - Shared building blocks: `dashboard-card`, `dashboard-section`, `dashboard-quick-links`.
  - `SystemHealthSummary` (admin only).
  - `WorkOrdersSummary` (admin/management/technician; technician filters by assigned user id).
  - `InventorySummary` (admin/inventory keeper).
  - `ReportsSummary` (admin/management/viewer; read-only flag for viewer).
  - `DriverIntelligenceDashboard` extracted from old page (admin only).
  - Quick links from visible navigation; safe empty states for cleaner/driver/minimal variants.
- Data sources used:
  - Work orders list API with client-side stats/priority selection.
  - Inventory parts/low-stock/purchase orders with existing `calculateInventorySummary`.
  - Reports dashboard summary cards API.
  - Health readiness endpoint summary counts.
  - Driver intelligence dashboard API (admin only).
- Skipped/deferred:
  - No new backend endpoints, models, or role permission changes.
  - No dedicated `/admin` console (ADMIN-001).
  - No cleaning/driver aggregate metrics (no existing API).
  - Farm-specific dashboard metrics deferred; farm roles get management variant with work orders/reports/quick links only.
- Files changed:
  - `maintainpro/apps/web/lib/dashboard-roles.ts` (new)
  - `maintainpro/apps/web/components/dashboard/*` (new)
  - `maintainpro/apps/web/app/(dashboard)/dashboard/page.tsx`
  - `maintainpro/apps/api/test/dashboard-roles.spec.ts` (new)
  - `maintainpro/apps/api/tsconfig.json`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
  - `maintainpro/docs/QA_CHECKLIST.md`
  - `maintainpro/docs/RISK_REGISTER.md`
- Tests run:
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/web` (pass)
  - `npm run build` (monorepo; pass)
  - `npm run test --workspace @maintainpro/api` (pass)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - Frontend dashboard visibility mirrors role config; backend RBAC still required on module access.
  - Technician assigned-work filtering depends on `technicianId` matching stored user id.
  - Multiple dashboard panels may call several existing APIs on admin load (acceptable for this pass; no new endpoints).

## 2026-06-12 | ADMIN-001 | Dedicated /admin console foundation
- Audit findings:
  - `/admin` did not exist; `role-redirect` already preferred `/admin` for SUPER_ADMIN but route was missing.
  - `/system-health`, `/settings` (users/roles/audit/system tabs), and `/health/readiness` provide safe read-only admin signals today.
  - Navigation/command palette already derive visibility from `getVisibleNavigationItems()`; no separate admin command list needed.
  - Settings page contains mutation flows (invite/delete users, role changes) — intentionally not duplicated in admin console this pass.
- Admin route added:
  - `app/(dashboard)/admin/page.tsx` inside authenticated dashboard shell.
  - Non-admin users see `PermissionState`; no redirect loop.
- Admin sections added (read-only cards):
  - Users & Access, Tenants, Roles & Permissions, System Health, Audit & Security, Integrations, Notifications/Email/SMS, Environment Readiness.
  - Links only to existing routes (`/settings`, `/system-health`) where available; Tenants marked `Requires API`; no fake counts.
- Navigation/command palette visibility:
  - New nav item `Admin Console` (`/admin`) for ADMIN/SUPER_ADMIN only via `ADMIN_ROLES`.
  - Command palette inherits nav visibility automatically; keywords added for admin search.
  - `/admin` added to `EXISTING_NAV_ROUTES` and `EXISTING_POST_LOGIN_ROUTES`.
- Data sources used:
  - Current session from `useCurrentUser()` (email, role, tenant id).
  - Existing `/tenants/me` for active tenant name (read-only).
  - Reused dashboard `SystemHealthSummary` (`/health/readiness`).
- Intentionally deferred mutation flows:
  - No user create/update/delete/invite actions in admin console.
  - No tenant mutation or cross-tenant admin actions.
  - No role/permission mutation actions.
  - Dedicated tenant admin counts/API deferred.
- Files changed:
  - `maintainpro/apps/web/lib/admin-console.ts` (new)
  - `maintainpro/apps/web/components/admin/admin-console-page.tsx` (new)
  - `maintainpro/apps/web/components/admin/admin-section-card.tsx` (new)
  - `maintainpro/apps/web/app/(dashboard)/admin/page.tsx` (new)
  - `maintainpro/apps/web/lib/navigation.ts`
  - `maintainpro/apps/web/lib/role-redirect.ts`
  - `maintainpro/apps/web/lib/breadcrumbs.ts`
  - `maintainpro/apps/web/lib/command-palette.ts`
  - `maintainpro/apps/api/test/admin-console.spec.ts` (new)
  - `maintainpro/apps/api/test/navigation.spec.ts`
  - `maintainpro/apps/api/test/breadcrumbs.spec.ts`
  - `maintainpro/apps/api/tsconfig.json`
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md`
  - `maintainpro/docs/IMPLEMENTATION_LOG.md`
  - `maintainpro/docs/QA_CHECKLIST.md`
  - `maintainpro/docs/RISK_REGISTER.md`
- Tests run:
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/web` (pass)
  - `npm run build` (monorepo; pass)
  - `npm run test --workspace @maintainpro/api` (pass)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - Frontend admin visibility is UX-only; backend RBAC must protect settings/users/roles APIs.
  - Settings still hosts mutating admin flows outside this foundation scope.
  - Dedicated tenant admin API and audit workspace still missing.

## 2026-06-12 | ADMIN-002A | Read-only Users & Access view
- Audit findings:
  - Existing `GET /users` requires `users.view` permission and returns broad user objects (still strips passwordHash but includes internal fields like failedLoginAttempts).
  - Settings page already supports user mutations — intentionally not duplicated under `/admin`.
  - UsersService already implements tenant membership scoping for non-super-admin actors.
- Route/API approach:
  - Added read-only `GET /admin/users` protected by `@Roles(SUPER_ADMIN, ADMIN)`.
  - `UsersService.findAllForAdminAccessView()` returns sanitized `AdminUserAccessRow` DTO with explicit tenant scoping.
  - Frontend route `/admin/users` with DataTable, page states, and localization formatting.
- Fields exposed:
  - displayName, email, roleName, tenantId, tenantName (SUPER_ADMIN tenant column), isActive, lastLogin, createdAt, updatedAt.
- Fields intentionally excluded:
  - passwordHash, passwords, refresh/reset/session tokens, failedLoginAttempts, lockedUntil, and other internal auth/session fields.
- Tenant/RBAC behavior:
  - ADMIN: tenant membership filter on list query; UI notes tenant-scoped review.
  - SUPER_ADMIN: no tenant filter; UI shows cross-tenant scope banner and tenant column.
  - Non-admin: frontend PermissionState; backend RolesGuard on API.
- Deferred mutation flows:
  - No invite/create/update/delete/status changes in admin users view.
  - Settings mutation flows unchanged.
- Files changed:
  - `maintainpro/apps/api/src/modules/admin/*` (new)
  - `maintainpro/apps/api/src/modules/users/users.service.ts`
  - `maintainpro/apps/api/src/app.module.ts`
  - `maintainpro/apps/api/test/admin-users-access.spec.ts` (new)
  - `maintainpro/apps/api/test/admin-users.spec.ts` (new)
  - `maintainpro/apps/web/app/(dashboard)/admin/users/page.tsx` (new)
  - `maintainpro/apps/web/components/admin/admin-users-page.tsx` (new)
  - `maintainpro/apps/web/components/admin/user-access-table.tsx` (new)
  - `maintainpro/apps/web/lib/admin-users.ts` (new)
  - `maintainpro/apps/web/lib/admin-console.ts`
  - `maintainpro/apps/web/lib/breadcrumbs.ts`
  - `maintainpro/apps/api/test/admin-console.spec.ts`
  - `maintainpro/apps/api/test/breadcrumbs.spec.ts`
  - `maintainpro/apps/api/tsconfig.json`
  - docs updates
- Tests run:
  - `npm run typecheck` (pass)
  - `npm run lint` (pass)
  - `npm run build --workspace @maintainpro/web` (pass)
  - `npm run build` (monorepo; pass)
  - `npm run test --workspace @maintainpro/api` (pass)
  - `npm run build --workspace @maintainpro/api` (pass)
- Remaining risks:
  - Legacy `GET /users` response shape remains broader for settings callers.
  - No dedicated user detail route; list-only review in this pass.

## 2026-06-12 | ADMIN-002B | Safe deactivate/reactivate user flow
- Audit findings:
  - User model already has `isActive`; no schema change required.
  - ADMIN-002A `GET /admin/users` returns sanitized `AdminUserAccessRow` via allowlist mapping in `UsersService.toAdminUserAccessRow()`.
  - Existing `PATCH /users/:id/status` in settings lacks admin-specific protections (self-deactivation, SUPER_ADMIN rules, last super-admin guard); not duplicated under admin.
  - Request context supplies `actorId`, `actorRole`, and `tenantId` for tenant-scoped enforcement.
- Endpoint/route added:
  - `PATCH /admin/users/:id/status` with `{ isActive: boolean }` on `AdminAccessController`, delegating to `UsersService.updateAdminUserStatus()`.
- Protection rules:
  - `@Roles(SUPER_ADMIN, ADMIN)` on endpoint; non-admin blocked by RolesGuard.
  - ADMIN: tenant membership filter on mutation target lookup.
  - SUPER_ADMIN: cross-tenant mutation allowed when target found.
  - Reject self-deactivation (`actorId === userId && !isActive`).
  - Reject ADMIN mutating SUPER_ADMIN targets.
  - Reject deactivating last active SUPER_ADMIN (count guard).
  - Return sanitized `AdminUserAccessRow` only.
- Frontend changes:
  - `/admin/users` row Deactivate/Reactivate button with UX-010 ConfirmDialog copy.
  - `canShowAdminUserStatusAction()` hides self, SUPER_ADMIN (for ADMIN), and missing-context actions.
  - Mutation via `updateAdminUserStatus()`; optimistic list row refresh + toast feedback.
  - DataTable actions column preserved with mobile card accessibility labels.
- Tests/checks run:
  - `admin-users-status.spec.ts` (service protections + RolesGuard on endpoint).
  - Extended `admin-users.spec.ts` (action visibility helper + labels).
  - Existing `admin-users-access.spec.ts` unchanged and passing.
  - Verification: typecheck, lint, web build, API build, full build, API tests.
- Deferred mutation flows:
  - No invite/create/delete/role-edit/password-reset/tenant admin workspace in admin console.
  - Settings user mutation flows unchanged.

## 2026-06-12 | ADMIN-002C | Harden legacy user management paths
- Audit findings:
  - Legacy `GET /users` used `toPublicUser()` which only stripped `passwordHash` but still returned `failedLoginAttempts`, `lockedUntil`, `tenantId`, timestamps, and full `role` objects (including permission relations when loaded).
  - Legacy `PATCH /users/:id/status` (`UsersService.setActive`) had tenant membership check only; lacked self-deactivation, SUPER_ADMIN, and last-super-admin protections present in ADMIN-002B.
  - Settings, work-order technician picker, and department EntityPicker consume `GET /users`; Settings also uses legacy status endpoint with `users.status.manage` permission (broader than admin-only roles).
- Legacy endpoints reviewed:
  - `GET /users`, `GET /users/:id`, `PATCH /users/:id/status`, plus create/invite/update responses sharing the same public mapper.
  - `GET /admin/users` and `PATCH /admin/users/:id/status` left unchanged.
- Hardening approach:
  - Extracted shared `applyProtectedUserStatusUpdate()` used by both `updateAdminUserStatus()` and `setActive()` to eliminate behavior drift.
  - Replaced raw Prisma spread mapping with explicit `PublicUserResponse` allowlist via `toPublicUserResponse()`.
  - Prisma queries now select `role: { id, name }` only.
- DTO changes:
  - Allowed on legacy user responses: `id`, `firstName`, `lastName`, `email`, `phone`, `isActive`, `role.id`, `role.name`.
  - Excluded: `passwordHash`, tokens, `failedLoginAttempts`, `lockedUntil`, `tenantId`, `roleId`, `departmentId`, `avatar`, timestamps, role permissions/permissionIds, and other internal auth fields.
  - `AdminUserAccessRow` unchanged for `/admin/users`.
- Compatibility decisions:
  - Settings retains `PATCH /users/:id/status` for permissioned operators (`users.status.manage`); backend protections now match ADMIN-002B.
  - Settings user list unchanged structurally; admins see a link to `/admin/users` for ConfirmDialog-based status changes.
  - No Settings feature removal beyond response sanitization.
- Tests/checks run:
  - `users-legacy-hardening.spec.ts` for allowlist GET /users and legacy setActive protections.
  - Existing admin-users*.spec.ts retained.
  - Verification: typecheck, lint, web build, API build, full build, API tests.
- Remaining risks:
  - Settings still exposes invite/delete/role flows outside admin console scope.
  - Permission-based status mutation remains broader than admin-only `/admin/users` endpoint by design.

## 2026-06-12 | ADMIN-003A | Read-only tenant admin workspace
- Audit findings:
  - Existing `GET /tenants/me` returns active tenant + memberships for session/switch flows; not suitable as admin review list (includes membership roles, mutates user tenantId).
  - No prior `GET /admin/tenants` or tenant list endpoint for admin review.
  - Tenant model fields are limited to id, name, slug, isActive, createdAt, updatedAt — safe for read-only overview.
  - Subscriptions, Stripe, invitations, and env/config are not loaded or returned.
- Endpoint/route approach:
  - Added `GET /admin/tenants` with `@Roles(SUPER_ADMIN, ADMIN)` on `AdminAccessController`.
  - `AdminTenantsService.findAllForAdminTenantReview()` returns sanitized `AdminTenantOverviewRow` DTO.
  - Frontend route `/admin/tenants` with DataTable (SUPER_ADMIN) and tenant profile card (ADMIN).
  - Admin console Tenants card links to `/admin/tenants` as read-only review.
- Tenant fields exposed:
  - id, name, slug, isActive, memberCount (membership aggregate), createdAt, updatedAt.
- Fields intentionally excluded:
  - Database URLs, API keys, SMTP/SMS credentials, billing/Stripe secrets, invitation tokens, subscriptions, raw env/config, and any relation payloads beyond membership count.
- Tenant/RBAC behavior:
  - SUPER_ADMIN: lists up to 100 tenants, tenant ID column visible in table.
  - ADMIN: scoped to active `tenantId` from request context (single tenant profile).
  - Non-admin: frontend PermissionState; backend RolesGuard on API.
- Deferred mutation flows:
  - No tenant create/update/delete, invitations, switching UI, or billing changes in admin workspace.
- Tests/checks run:
  - `admin-tenants-access.spec.ts`, `admin-tenants.spec.ts`, updated `admin-console.spec.ts` and `breadcrumbs.spec.ts`.
  - Verification: typecheck, lint, web build, API build, full build, API tests.
- Remaining risks:
  - `/tenants/me` and `POST /tenants/:id/switch` remain separate session flows outside this read-only workspace.
  - Member count is membership-based, not active-user filtered.

## 2026-06-12 | ADMIN-004A | Read-only roles & permissions matrix
- Audit findings:
  - Legacy `GET /roles` and `GET /roles/permissions` require `roles.view` / `permissions.view` permissions and return raw Prisma objects (including permission relation arrays on roles).
  - Permissions are global catalog records (`Permission.key` unique); roles are tenant-scoped (`Role.tenantId`) with seeded built-in `RoleName` values per tenant.
  - Settings still hosts role/permission mutation flows — not duplicated under `/admin`.
- Endpoint/route approach:
  - Added read-only `GET /admin/roles-permissions` with `@Roles(SUPER_ADMIN, ADMIN)`.
  - `AdminRolesService.findRolesPermissionsMatrixForReview()` returns sanitized matrix DTO with permission groups and coverage map.
  - Frontend route `/admin/roles` with module-grouped matrix cards and client-side search.
  - Admin console Roles & Permissions card links to `/admin/roles`.
- Fields exposed:
  - Permission: id, key, module (derived from key prefix), description.
  - Role: id, name, tenantId, tenantName (SUPER_ADMIN), permissionKeys, permissionCount, isBuiltIn.
  - Matrix: scope, permissionGroups, coverage map (permissionKey → role ids).
- Fields intentionally excluded:
  - Users assigned to roles, raw roleIds/permissionIds relation arrays, auth tokens/sessions, secrets, tenant integration config.
- Tenant/RBAC behavior:
  - Permissions: global catalog visible to all admin viewers.
  - Roles: ADMIN tenant-scoped; SUPER_ADMIN cross-tenant with tenant labels.
  - Non-admin blocked in UI and via RolesGuard.
- Deferred mutation flows:
  - No role create/update/delete, permission create/update/delete, or user role assignment in admin matrix.
  - Settings mutation flows unchanged.
- Tests/checks run:
  - `admin-roles-access.spec.ts`, `admin-roles.spec.ts`, updated `admin-console.spec.ts` and `breadcrumbs.spec.ts`.
  - Verification: typecheck, lint, web build, API build, full build, API tests.
- Remaining risks:
  - Legacy `/roles` endpoints still return broader objects for permissioned Settings callers.
  - Matrix can grow large; current UI uses grouped scrollable tables without pagination.

## 2026-06-13 | ADMIN-004B | Harden legacy role/permission read responses
- Audit findings:
  - Legacy `GET /roles` returned raw Prisma role objects with full `permissions` relations, `permissionIds`, `tenantId`, timestamps, and nested permission `roleIds`.
  - Legacy `GET /roles/permissions` returned raw permission records including `roleIds` and timestamps.
  - Settings consumes `id`, `name`, and nested permission `id`/`key`/`description` only for role editing checkboxes and invite role picker.
  - No `GET /roles/:id` endpoint exists.
- Legacy endpoints reviewed:
  - `GET /roles`, `GET /roles/permissions`.
  - Mutation endpoints unchanged in behavior; create/update/createPermission now reuse the same allowlist mappers on responses for consistency.
  - `GET /admin/roles-permissions` (ADMIN-004A) unchanged.
- DTO fields allowed/excluded:
  - Role read DTO: id, name, permissionCount, permissions[] summaries.
  - Permission read DTO: id, key, module, description.
  - Excluded: tenantId, permissionIds, roleIds, users, timestamps, raw relation payloads, secrets/tokens/sessions.
- Compatibility decisions:
  - Settings `RoleRow` / `PermissionRow` remain compatible; added `module` and `permissionCount` are additive only.
  - Prisma `select` limits loaded fields; mappers enforce explicit allowlists.
- Tests/checks run:
  - `roles-legacy-hardening.spec.ts` for GET /roles and GET /roles/permissions allowlists.
  - Existing admin-roles*.spec.ts retained.
  - Verification: typecheck, lint, web build, API build, full build, API tests.
- Remaining risks:
  - Settings role/permission mutation APIs (`POST/PATCH/DELETE /roles*`) remain active outside admin console.
  - Legacy read endpoints still use permission-based guards (`roles.view`, `permissions.view`) rather than admin-only roles.

## 2026-06-13 | ADMIN-003B | Read-only tenant invitation review
- Audit findings:
  - `TenantInvitation` model exists with token, status, expiry, invitedBy, and tenant membership role fields.
  - Legacy `GET /tenants/:id/invitations` returns raw records including `token` and `invitationLink` on create — not reused for admin review.
  - Billing page has separate invitation UX; admin console gets dedicated read-only review only.
- Invitation model/API availability:
  - Model: `TenantInvitation` with statuses PENDING, ACCEPTED, EXPIRED, REVOKED.
  - Existing mutation/list module at `/tenants/:id/invitations` (tenant-scoped, membership permission checks).
  - New admin read endpoint added because no safe cross-tenant admin list existed.
- Route/API approach:
  - Added `GET /admin/invitations` with `@Roles(SUPER_ADMIN, ADMIN)`.
  - `AdminInvitationsService.findAllForAdminInvitationReview()` returns sanitized `AdminInvitationReviewRow` DTO.
  - Frontend route `/admin/invitations` with DataTable, search, and status filter.
  - Admin console card: Invitations & Onboarding → `/admin/invitations`.
- Fields exposed:
  - id, tenantId, tenantName, email, inviteeDisplayName, membershipRole, status, invitedByDisplayName, invitedByEmail, createdAt, expiresAt, acceptedAt.
- Fields intentionally excluded:
  - token, invitationLink, invitedById, SMTP/SMS secrets, provider tokens, raw relation payloads.
- Tenant/RBAC behavior:
  - ADMIN: tenant-scoped invitation list.
  - SUPER_ADMIN: cross-tenant list with tenant column.
  - Non-admin blocked via UI PermissionState and RolesGuard.
- Deferred mutation flows:
  - No create/resend/revoke/accept/delete, token display, or email/SMS dispatch in admin workspace.
  - Legacy `/tenants/:id/invitations` mutation paths unchanged.
- Tests/checks run:
  - `admin-invitations-access.spec.ts`, `admin-invitations.spec.ts`, updated `admin-console.spec.ts` and `breadcrumbs.spec.ts`.
  - Verification: typecheck, lint, web build, API build, full build, API tests.
- Remaining risks:
  - Legacy tenant invitation API still returns tokens to authorized callers on list/create.
  - No revokedAt timestamp in schema; REVOKED status only.

## 2026-06-13 | ADMIN-003C | Harden legacy tenant invitation list responses
- Audit findings:
  - `TenantInvitation` model stores `token` plus status/expiry/inviter metadata.
  - Legacy `GET /tenants/:id/invitations` returned raw Prisma rows including `token`, `invitedById`, and nested `invitedBy.id`.
  - No resend/revoke/accept endpoints exist outside registration acceptance in auth.
  - Billing page uses `POST /tenants/:id/invitations` only; no frontend GET list consumer found.
- Legacy endpoints reviewed:
  - `GET /tenants/:id/invitations` — hardened with allowlist DTO.
  - `POST /tenants/:id/invitations` — unchanged; still returns `invitationLink` and raw token for onboarding handoff.
- DTO fields allowed (list):
  - id, tenantId, email, inviteeDisplayName, membershipRole, status, invitedByDisplayName, invitedByEmail, createdAt, expiresAt, acceptedAt.
- DTO fields excluded (list):
  - token, invitationLink, invitedById, updatedAt, raw invitedBy relation payloads, secrets.
- Mutation response compatibility:
  - `POST` create response intentionally retains `invitationLink` and token for copy/share flows; deferred hardening to ADMIN-003 follow-up.
- Tests/checks run:
  - `invitations-legacy-hardening.spec.ts` for list allowlist, membership guard, and create link preservation.
  - Existing `admin-invitations-access.spec.ts` retained for `/admin/invitations`.
  - Verification: typecheck, lint, web build, API build, full build, API tests.
- Remaining risks:
  - `POST /tenants/:id/invitations` still returns token in mutation response body.
  - No revokedAt timestamp in schema.

## 2026-06-13 | ADMIN-003D | Controlled invitation create + POST response hardening
- Audit findings:
  - Legacy `POST /tenants/:id/invitations` returned spread Prisma row including raw `token` plus `invitationLink`.
  - Billing page creates invitations but only shows toast success; no raw token dependency found.
  - Admin console had read-only review only; create flow deferred until ADMIN-003D.
- Response hardening:
  - Added `CreateTenantInvitationResponse` allowlist via `toCreateTenantInvitationResponse()`.
  - Both `POST /tenants/:id/invitations` and `POST /admin/invitations` return token-free DTO with one-time `invitationLink`.
  - Rejects unsafe membership roles (`OWNER`) via `CREATABLE_TENANT_MEMBERSHIP_ROLES`.
- Route/API approach:
  - Added `POST /admin/invitations` with `@Roles(ADMIN, SUPER_ADMIN)`, entitlement guard, throttle.
  - `AdminInvitationsService.createInvitationForAdminConsole()` enforces tenant scope and delegates to `InvitationsService`.
  - Hardened shared `InvitationsService.createInvitation()` response mapper used by legacy and admin paths.
- Frontend create flow:
  - `/admin/invitations` adds Create invitation dialog (email, optional name, membership role, SUPER_ADMIN tenant selector).
  - One-time copy panel for `invitationLink` with security warning; not stored in localStorage/sessionStorage or table rows.
- Fields returned (create):
  - id, tenantId, tenantName, email, inviteeDisplayName, membershipRole, status, createdAt, expiresAt, invitationLink.
- Fields excluded (create):
  - token, invitationToken, tokenHash, invitedById, updatedAt, secrets, raw relations.
- Deferred mutation flows:
  - No resend, revoke, delete, accept, bulk invite, or email/SMS dispatch.
- Tests/checks run:
  - `admin-invitations-create.spec.ts`, updated `invitations-legacy-hardening.spec.ts`, `admin-invitations.spec.ts`, `admin-invitations-access.spec.ts`.
  - Verification: typecheck, lint, web build, API build, full build, API tests.
- Remaining risks:
  - Invitation link still appears once in create response/panel; email dispatch not integrated.
  - No revokedAt timestamp in schema.

## 2026-06-13 | BUILD-001 | Building / Facility maintenance module planning
- Audit findings:
  - `FacilityIssue`, `CleaningLocation`, cleaning issue API/UI, and `FACILITY_ISSUE_REPORTED` notifications already exist.
  - Work Orders, Assets (`INFRASTRUCTURE`), Inventory/Procurement, and Reports modules are mature and reusable.
  - No Property/Building/Floor/Room hierarchy; no dedicated `facility` API module; `/facility` web routes missing.
  - Frontend references `FACILITY_MANAGER` and `BUILDING_SUPERVISOR` but Prisma `RoleName` lacks these values.
  - `FacilityIssue` has no `workOrderId`, category, or room FK — blocks repair workflow (FAC-008).
- Chosen architecture direction:
  - New spatial hierarchy (Property → Building → Floor → Room) plus new `facility` module.
  - Extend `FacilityIssue`, `WorkOrder`, `Asset`, `CleaningLocation` — do not duplicate WO/asset engines.
  - Issue → Work Order bridge via shared WO service; cleaning module retains visit/checklist focus.
- Reuse decisions:
  - Issues: extend `FacilityIssue`; execution: `WorkOrder`; equipment: `Asset`; parts: PartRequest/PartIssue; notifications/reports: extend existing patterns.
- Proposed phases:
  - BUILD-002 schema + roles; BUILD-003 hierarchy API; BUILD-004 issue migration; BUILD-005 WO bridge; BUILD-006 web routes; BUILD-007 dashboard/reports; BUILD-008 public portal.
- Skipped implementation:
  - No schema migration, no API modules, no web routes, no seed changes in BUILD-001.
- Tests/checks run:
  - Documentation-only change; verification: typecheck, lint, web build, API build, full build, API tests.

## 2026-06-13 | BUILD-002 | Facility schema foundation + roles seed
- Audit findings:
  - BUILD-001 plan approved Property→Building→Floor→Room hierarchy with direct `tenantId` on each model.
  - Frontend already referenced `FACILITY_MANAGER` / `BUILDING_SUPERVISOR`; Prisma enum lacked both values.
  - Seed uses idempotent `permissionCatalog` + `rolePermissions` loop over all `RoleName` values.
  - `FacilityIssue` / `CleaningLocation` extensions deferred to BUILD-004 to avoid premature workflow coupling.
- Schema models added:
  - `Property`, `Building`, `Floor`, `Room`, enum `FacilityRoomType`; Tenant relations for all four models.
- Role/permission seed changes:
  - Added 7 facility permission keys to catalog; `FACILITY_MANAGER` and `BUILDING_SUPERVISOR` role mappings in `facility-seed.constants.ts`.
  - Extended MANAGER, SUPERVISOR, CLEANER, VIEWER with conservative facility permissions.
  - `verifySeedBaseline` now requires FACILITY_MANAGER and BUILDING_SUPERVISOR roles.
- Deferred API/UI work:
  - No facility module, endpoints, `/facilities` routes, issue/WO bridge, or fake business seed data.
- Tests/checks run:
  - `building-schema-seed.spec.ts` for RoleName enum, permission keys, and role permission assignments.
  - `npx prisma validate`, typecheck, lint, web build, API build, full build, API tests.

## 2026-06-13 | SMART-OPS-001 | Product excellence / smart operations sprint
- Audit findings:
  - Role-aware dashboard (DASH-001) already consumes work orders, inventory, reports, and system health APIs without fake metrics.
  - No `window.confirm` / `window.prompt` / `window.alert` usages remain in web app.
  - `FACILITY_MANAGER` / `BUILDING_SUPERVISOR` post-login preferences referenced missing `/facility` routes (404 risk).
  - Cleaning issue API (`/cleaning/issues`) and admin invitation review API available for operational attention signals.
  - No dedicated Action Center route; technicians/inventory roles lacked consolidated priority view.
- Smart features implemented:
  - **Action Center** (`/action-center`): role-aware sections from existing APIs; admin system health + invitations; work order/inventory/facility/driver/report links.
  - **Morning Briefing** dashboard card for admin/management/inventory variants with link to Action Center.
  - **QR readiness** helper (`lib/qr-readiness.ts`) with encode/parse validation and secret-field rejection.
  - **Evidence timeline** reusable read-only component + `mapWorkOrderDatesToEvidenceTimeline()` helper.
  - Navigation/command palette/breadcrumb integration for Action Center; `BellRing` nav icon.
- Gap closure / security sweep:
  - Fixed facility role post-login preferences to use `/cleaning/issues` and `/action-center` instead of missing `/facility` paths.
  - Action Center admin sections gated to ADMIN/SUPER_ADMIN only; no invitation tokens exposed.
- Skipped/deferred:
  - No new backend endpoints, schema changes, public QR routes, photo upload, AI/IoT, ERP posting, or fake KPIs.
  - Facility hierarchy UI/API remains BUILD-003+; Action Center shows “Facility module planned” state for facility roles.
- Files changed:
  - `apps/web/lib/action-center.ts`, `action-center-api.ts`, `qr-readiness.ts`
  - `apps/web/components/action-center/*`, `components/dashboard/morning-briefing.tsx`, `components/ui/evidence-timeline.tsx`
  - `apps/web/app/(dashboard)/action-center/page.tsx`
  - `apps/web/lib/navigation.ts`, `command-palette.ts`, `breadcrumbs.ts`, `role-redirect.ts`
  - `apps/web/components/dashboard/role-dashboard.tsx`, `components/layout/nav-links.tsx`
  - `apps/api/test/action-center.spec.ts`, `qr-readiness.spec.ts`
  - `docs/SMART_OPERATIONS_PRODUCT_EXCELLENCE_ROADMAP.md`, `MAINTAINPRO_PRODUCTION_TODO.md`, `QA_CHECKLIST.md`, `RISK_REGISTER.md`
- Tests/checks run:
  - `npm run typecheck`, `npm run lint`, `npm run build --workspace @maintainpro/web`, `npm run build --workspace @maintainpro/api`, `npm run build`, `npm run test --workspace @maintainpro/api`
- Recommended next task:
  - **BUILD-003** — Facility hierarchy API module (see `BUILDING_FACILITY_MODULE_PLAN.md`).

## 2026-06-13 | BUILD-003 | Facility hierarchy API module
- Audit findings:
  - BUILD-002 schema provides Property/Building/Floor/Room with direct `tenantId` and parent FKs.
  - Seed grants `facilities.view` to MANAGER/SUPERVISOR/VIEWER/BUILDING_SUPERVISOR; `facilities.manage` to FACILITY_MANAGER/ADMIN/SUPER_ADMIN only.
  - Existing modules use JwtAuthGuard + Roles + Permissions guards; tenant from `req.user.tenantId` after TenantContextGuard.
  - Departments pattern uses PATCH `isActive` deactivation instead of DELETE — adopted for hierarchy.
- Endpoints added (`/api/facilities/*`):
  - Property, Building, Floor, Room list/get/create/patch (16 routes total).
  - Parent filters: `propertyId`, `buildingId`, `floorId` query params on child lists.
  - No DELETE routes; deactivate via `isActive` on PATCH.
- Tenant isolation approach:
  - `requireTenantId()` rejects null tenant (SUPER_ADMIN must provide `X-Tenant-Id`).
  - All queries filter by scoped tenantId; parent FK validated with same-tenant `findFirst`.
  - Cross-tenant parent IDs return 404; `tenantId` never accepted from body (ValidationPipe whitelist).
- Permission approach:
  - Read: `@Permissions("facilities.view")` + read roles.
  - Manage: `@Permissions("facilities.manage")` + SUPER_ADMIN/ADMIN/FACILITY_MANAGER roles.
  - BUILDING_SUPERVISOR view-only per seed (no manage).
- Deferred:
  - No web UI, FacilityIssue migration, WO bridge, QR routes, seed data, or DELETE endpoints.
- Files changed:
  - `apps/api/src/modules/facilities/*`, `app.module.ts`
  - `apps/api/test/facilities-hierarchy.spec.ts`
  - `docs/BUILDING_FACILITY_MODULE_PLAN.md`, `MAINTAINPRO_PRODUCTION_TODO.md`, `SMART_OPERATIONS_PRODUCT_EXCELLENCE_ROADMAP.md`, `QA_CHECKLIST.md`, `RISK_REGISTER.md`, `IMPLEMENTATION_LOG.md`
- Tests/checks run:
  - `facilities-hierarchy.spec.ts` (14 cases), full API suite (70 suites / 354 tests).
  - typecheck, lint, prisma validate, API/web/full build.
- Recommended next task:
  - **BUILD-004** — Facility hierarchy UI + `FacilityIssue.roomId` migration.

---

## BUILD-004 — Facility hierarchy web UI (2026-06-13)

**Status:** DONE — web UI shipped; FacilityIssue migration deferred to BUILD-005.

### Audit findings

- `FacilityIssue` links to `CleaningLocation` via `locationId` only; cleaning issue API/UI unchanged.
- Adding nullable `roomId` now would touch cleaning workflows, issue creation, and backfill without UI benefit in this pass.
- **Decision:** defer schema/API migration to **BUILD-005** with documented backfill plan in `BUILDING_FACILITY_MODULE_PLAN.md`.

### UI routes/components added

- Route: `apps/web/app/(dashboard)/facilities/page.tsx`
- Components: `components/facilities/facilities-page.tsx`, `facility-hierarchy-panel.tsx`, `facility-entity-table.tsx`, `facility-entity-dialog.tsx`
- Lib: `lib/facilities.ts`, `lib/facilities-api.ts`, `lib/facility-ui.ts`

### Navigation / Action Center updates

- Nav item “Facilities” (`/facilities`) for facility/admin/manager roles
- Command palette keywords: buildings, rooms, property, hierarchy
- Breadcrumbs: `/facilities`
- Role redirect: FACILITY_MANAGER / BUILDING_SUPERVISOR → `/facilities`
- Action Center: “Open facility hierarchy” → `/facilities` (replaces planned-module placeholder)

### Permission / RBAC behavior

- View: `facilities.view` or role fallback (ADMIN, FACILITY_MANAGER, BUILDING_SUPERVISOR, MANAGER, VIEWER, etc.)
- Manage: `facilities.manage` or ADMIN/SUPER_ADMIN/FACILITY_MANAGER only
- BUILDING_SUPERVISOR remains view-only per BUILD-002 seed

### Tests/checks run

- `facilities-web-config.spec.ts`, extended `navigation.spec.ts`, `command-palette.spec.ts`, `role-redirect.spec.ts`, `action-center.spec.ts`
- typecheck, lint, prisma validate, web/api/full build, full API test suite

### Recommended next task

- **BUILD-006** — Issue reporting UI (room selector + category in cleaning issues).

---

## BUILD-005 — FacilityIssue room linkage foundation (2026-06-13)

**Status:** DONE — schema/API compatibility only; no issue UI.

### Audit findings

- `IssueSeverity` already existed (LOW/MEDIUM/HIGH/CRITICAL, default MEDIUM) — no new severity enum.
- No `category` field existed — added optional `FacilityIssueCategory` enum.
- `FacilityIssue` linked to `CleaningLocation` via `locationId` only — preserved unchanged.
- Cleaning issue UI at `/cleaning/issues` uses `locationId`, severity, status — additive API fields safe.

### Schema changes

- `FacilityIssue.roomId` nullable FK → `Room`
- `FacilityIssue.category` optional `FacilityIssueCategory`
- Indexes: `[tenantId, roomId]`, `[tenantId, category]`, `[tenantId, status]`
- `Room.issues` reverse relation

### API changes

- `CreateFacilityIssueDto`: optional `roomId`, `category`
- `UpdateFacilityIssueDto`: optional `roomId` (nullable clear), `category`, `severity`
- `cleaning.service.ts`: same-tenant Room validation; allowlisted responses via `facility-issue.mapper.ts`
- Flat response fields: `roomName`, `floorId`, `buildingId`, `propertyId`

### Backward compatibility

- Existing create without `roomId`/`category` unchanged
- `locationId` / CleaningLocation validation unchanged
- No backfill required; old records keep null `roomId`/`category`
- Issue list/create responses remain compatible with existing UI (location.name, severity, status)

### Tests/checks run

- `facility-issues-room-link.spec.ts` (mapper + service cases)
- prisma validate, typecheck, lint, api/web/full build, full API test suite

### Deferred

- Issue UI room selector (BUILD-006)
- CleaningLocation → Room backfill
- Work Order bridge, QR public routes, photo upload, dashboards

---

## BUILD-006 — Facility issue room selector UI (2026-06-13)

**Status:** DONE — `/cleaning/issues` UI only; no backend changes.

### Audit findings

- Page was monolithic with location-only create; no category or room fields.
- BUILD-005 API already exposes `roomId`, `category`, flat room summary — UI was the gap.
- Facilities list APIs from BUILD-003/004 available via `facilities-api.ts`.
- PATCH supports nullable `roomId` clear from BUILD-005.

### UI changes

- `components/cleaning/facility-issues-page.tsx` — create form, list badges, category filter, edit panel
- `components/cleaning/facility-issue-room-selector.tsx` — cascading hierarchy selects
- `lib/facility-issue-ui.ts` — payload builders, display helpers, filter utilities
- Route wrapper: `app/(dashboard)/cleaning/issues/page.tsx`

### Legacy compatibility

- Cleaning location selector unchanged on create.
- Issues without roomId/category display safely.
- Facilities API errors isolated to room selector warning; issue load/create unaffected.
- No tenantId in create/update payloads.

### Tests/checks run

- `facility-issue-ui.spec.ts` (12 cases)
- typecheck, lint, prisma validate, web/api/full build, full API test suite

### Recommended next task

- **BUILD-007** — Issue → Work Order bridge.

---

## BUILD-007 — Facility Issue → Work Order bridge (2026-06-12)

### Audit findings

- `WorkOrder` requires `woNumber`, `title`, `description`, `priority`, `type`, `createdById`; lifecycle owned by `WorkOrdersService`.
- `FacilityIssue` had no `workOrderId` before BUILD-007; cleaning module already exposes `/cleaning/issues` with allowlisted mapper responses.
- Safest bridge: one-way nullable `FacilityIssue.workOrderId` → `WorkOrder` (unique on issue side); no duplicate repair entity.

### Schema / API

- Added nullable `FacilityIssue.workOrderId` with `@unique`, relation to `WorkOrder`, index `[tenantId, workOrderId]`.
- Endpoint: `POST /cleaning/issues/:id/create-work-order` with `@Roles` + `@Permissions("facility_issues.manage")`.
- Rejects: cross-tenant issue, existing `workOrderId`, RESOLVED/CLOSED status.
- Creates WO via `WorkOrdersService.create`; updates issue link; optional `assign` when issue has `assignedToId`.

### Issue → work order mapping

| Issue field | Work order field |
|-------------|------------------|
| `title` | `title` |
| `description` + room/location/category context | `description` |
| `severity` | `priority` (LOW/MEDIUM/HIGH/CRITICAL) |
| — | `type`: `CORRECTIVE` |
| `slaTargetAt` | `dueDate` (optional) |
| actor `sub` | `createdById` |
| — | `assetId` not set (no safe link yet) |

### UI

- `/cleaning/issues`: ConfirmDialog + “Create work order” for authorized roles; linked WO summary links to `/work-orders`.
- Helpers in `facility-issue-ui.ts`: `canCreateWorkOrderFromIssue`, `formatLinkedWorkOrderLabel`.

### Tests / checks

- `facility-issue-work-order-bridge.spec.ts`, updated `facility-issues-room-link.spec.ts`, `facility-issue-ui.spec.ts`
- typecheck, lint, prisma validate, web/api/full build, full API test suite

### Deferred

- QR public scan route (BUILD-008), photo upload/storage, facility reports/dashboard, ERP posting, email/SMS.

### Recommended next task

- **BUILD-008** — QR issue reporting (authenticated scan first; public route after security review).

---

## BUILD-008 — Authenticated QR issue reporting (2026-06-13)

### Audit findings

- `qr-readiness.ts` already validates payload shape and rejects secret-like fields; `react-qr-code` is installed (used on cleaning locations).
- No public unauthenticated intake route exists; dashboard layout enforces session via `/auth/me`.
- Facility hierarchy GET endpoints enforce tenant isolation; QR payloads must not include or trust `tenantId`.

### QR payload / route approach

- Minimal payload via `createQrIssueReportPayload`: `v`, `type` (property/building/floor/room), `entityId`, optional `label`, `createdAt` — **no tenantId, tokens, or user IDs**.
- Authenticated route: `/qr/report-issue?qr=<url-encoded JSON>` under `(dashboard)` shell.
- Parser: `parseQrIssueReportQueryParam`; resolver chains `/facilities/*/:id` APIs to build room selection.
- Room QR prefills full hierarchy; building/floor/property links require room selection before submit.

### UI changes

- `/facilities`: QR link button + dialog (copy URL + QR image) for manage roles on all hierarchy levels.
- `/qr/report-issue`: issue report form reusing `FacilityIssueRoomSelector` + `buildCreateFacilityIssuePayload`; submits to existing `POST /cleaning/issues`.

### Security decisions

- Public anonymous QR route explicitly **not** added.
- `tenantId` in legacy payloads ignored for authorization; issue payloads never include `tenantId`.
- Invalid/unsupported/inaccessible entities show safe error states; backend tenant guards remain authoritative.

### Tests / checks

- `qr-issue-reporting.spec.ts`, extended `qr-readiness.spec.ts`, updated `facility-issue-ui.spec.ts`
- typecheck, lint, prisma validate, web/api/full build, full API test suite

### Deferred

- Public QR scan route (security review + rate limiting)
- Photo upload/storage on QR report form
- Facility dashboard/reporting (BUILD-009)

### Recommended next task

- **BUILD-009** — Facility dashboard + reporting KPIs.

---

## BUILD-009 — Facility dashboard + reporting (2026-06-13)

### Audit findings

- Hierarchy counts available via Property/Building/Floor/Room models (tenant-scoped).
- FacilityIssue has `status`, `severity`, `category`, `slaTargetAt`, `roomId`, `workOrderId`.
- Overdue computable from `slaTargetAt < now` for OPEN/IN_PROGRESS issues (same rule as cleaning issues UI).
- Frontend aggregation would be inefficient; read-only backend summary endpoint chosen.

### Metrics implemented

- Hierarchy: property/building/floor/room counts + inactive rooms.
- Issues: totals by status, overdue, critical open, room-linked vs unlinked.
- Work order bridge: linked count, unlinked open count.
- Breakdowns: category, severity, status (`groupBy`).
- Attention previews: top rooms, overdue/critical/unlinked open issues (limit 5, allowlisted fields only).

### Endpoint / UI

- `GET /facilities/dashboard` → `PublicFacilityDashboardSummary` DTO.
- `/facilities/reports` dashboard page with KPI cards, breakdown tables, attention lists.
- Navigation, command palette, Action Center, and `/facilities` header link updated.

### Permissions

- `@Permissions("facilities.view")` + existing facility read roles; DRIVER blocked on web helper.

### Tests / checks

- `facility-dashboard.spec.ts`, `facility-dashboard-ui.spec.ts`, updated `action-center.spec.ts`, `facilities-web-config.spec.ts`
- typecheck, lint, prisma validate, web/api/full build, full API test suite

### Recommended next task

- **OPS-003** — Duplicate issue detection for facility issues.

---

## 2026-06-13 | OPS-003 | Duplicate facility issue detection (advisory)

- Audit findings:
  - `FacilityIssue` supports `roomId`, `locationId`, `category`, `severity`, `title`, `description`, `status`, `createdAt`, and optional `workOrderId`.
  - Create flows exist in `CleaningService.createIssue`, `/cleaning/issues`, and authenticated QR reporting.
  - No prior duplicate issue helper (only unrelated cleaning visit scan dedupe).
- Matching rules: tenant-scoped; `OPEN`/`IN_PROGRESS`; window from `DUPLICATE_ISSUE_WINDOW_DAYS` (default 7); match by `roomId` else `locationId`; category filter when provided; deterministic token overlap; confidence HIGH/MEDIUM/LOW; max 5 candidates.
- Endpoint/UI: `POST /cleaning/issues/duplicate-check`; advisory warnings on `/cleaning/issues` and `/qr/report-issue` with continue-anyway path.
- Tests run: `duplicate-facility-issues.spec.ts`, `facility-issue-duplicates.spec.ts`, typecheck, lint, prisma validate, api/web/full build, full API test suite.
- Deferred: auto-merge, auto-close, auto-link, hard-block on duplicates.
- Recommended next task: **WO-011** work order activity timeline + evidence integration.

## 2026-06-13 | WO-011 | Work order activity timeline + evidence integration

- Audit findings:
  - `WorkOrder` has `createdAt`, `dueDate`, `startDate`, `completedDate`, `slaDeadline`, `technicianId`, `createdById`; no dedicated assignment timestamp or activity table.
  - `FacilityIssue.workOrderId` one-to-one link exists from BUILD-007 bridge; reverse relation `WorkOrder.facilityIssue` available.
  - Audit logs exist for part-request workflows but not for all WO lifecycle transitions; derived timeline chosen (Option A).
  - Work order detail UI is the edit modal (`work-order-editor-modal.tsx`); no separate detail page.
  - `EvidenceTimeline` component + `mapWorkOrderDatesToEvidenceTimeline()` foundation already present from SMART-OPS-001.
- Timeline data source:
  - Derived from work order date fields, linked same-tenant facility issue timestamps, and part request `createdAt` (max 10).
  - No new DB model; no fake events when timestamps missing; cross-tenant linked issue excluded in mapper.
- Endpoint/UI:
  - `GET /work-orders/:id/activity` → allowlisted `entries[]`, `linkedFacilityIssue`, `checkedAt`.
  - Work order edit modal adds **Activity & evidence** panel using `EvidenceTimeline` + linked issue summary card with link to `/cleaning/issues?issueId=…`.
- Tenant isolation:
  - Work order lookup scoped by JWT tenant; linked facility issue included only when `workOrderId` matches and tenant matches.
- Tests run: `work-order-activity-timeline.spec.ts`, `work-order-activity.spec.ts`, typecheck, lint, prisma validate, api/web/full build, full API test suite.
- Deferred: photo upload/storage, public uploads, external storage, assignment timestamp without dedicated field, full audit-log ingestion.
- Recommended next task: **NOTIFY-002** staged production email/SMS UAT sends.

## 2026-06-13 | NOTIFY-002 | Staged notification Email/SMS UAT sends

- Audit findings:
  - NOTIFY-001 already provides readiness, template samples, SMTP (nodemailer), and generic HTTP SMS provider with honest disabled/mock/live modes.
  - No broad automatic production notification broadcaster; queue dispatch remains event-driven per existing flows.
- Provider status:
  - Email UAT uses `sendUatEmail()` when `EMAIL_MODE=live` and SMTP credentials are complete.
  - SMS UAT uses live HTTP provider when configured; disabled returns `not_configured`; mock returns `mock` without external calls.
- UAT endpoints/UI:
  - `POST /notifications/uat/email-test`, `POST /notifications/uat/sms-test` (ADMIN/SUPER_ADMIN).
  - Readiness summary includes `uat` controls; admin Notification UAT card on `/system-health`.
- Send safety rules:
  - `NOTIFICATION_UAT_ENABLED` + `NOTIFICATION_REAL_SENDS_ENABLED` + allowlisted recipient required; masked responses; no secrets returned.
- Tests run: `notifications-uat-send.spec.ts`, `notification-provider-safety.spec.ts`, `notification-uat-ui.spec.ts`, updated readiness tests, full build/test suite.
- Live UAT attempt: not performed in repo/CI (credentials not present).
- Deferred: automatic production event notifications, bulk sends, Twilio-specific adapter.
- Recommended next task: **ERP-002** live Bileeta read-only stock sync.

## 2026-06-12 | ERP-002 | Bileeta read-only stock sync

- Audit findings:
  - ERP-001 provides disabled/no-op `InventoryErpAdapter` foundation and honest health readiness; PO posting remains in `ErpSyncProviderService` (unchanged).
  - Inventory matching field is `SparePart.partNumber` ↔ Bileeta item code/SKU (normalized uppercase); stock field is `SparePart.quantityInStock`.
  - No Bileeta live credentials or approved stock endpoint in repo/CI; integration stays disabled/not_configured until env explicitly set.
- Adapter implementation:
  - Added `BileetaInventoryErpAdapter` with `checkReadiness()` and read-only `fetchStockBalances()` (GET only; no ERP write methods).
  - Added `ErpStockSyncService` with `dryRunStockSync()` (default) and guarded `applyStockSnapshot()` (local-only; requires `ERP_STOCK_SYNC_APPLY_ENABLED=true`).
  - Mapping/compare logic in `erp-stock-sync.mapper.ts` with capped sample rows in API responses; apply uses full changed set internally.
- Endpoints/UI:
  - `GET /inventory/erp/readiness`
  - `POST /inventory/erp/stock-sync/dry-run`
  - `POST /inventory/erp/stock-sync/apply` (guarded; ADMIN/SUPER_ADMIN/INVENTORY_KEEPER/ASSET_MANAGER)
  - Inventory ERP Sync card on `/system-health` (inventory roles; no secrets shown; no apply button in UI).
- Safety rules:
  - `ERP_MODE=disabled|mock|sandbox|live`; real reads require `ERP_READ_ONLY_SYNC_ENABLED=true` plus `ERP_BASE_URL`, `ERP_API_KEY`, `ERP_STOCK_ENDPOINT`.
  - `ERP_STOCK_SYNC_APPLY_ENABLED=false` by default; apply blocked without flag; no scheduled sync; no ERP POST/PUT/PATCH.
  - Responses/logs mask secrets; dry-run does not return raw ERP payload.
- Tests run: `erp-stock-sync.spec.ts`, `erp-stock-mapping.spec.ts`, extended `erp-inventory-adapter.spec.ts`, typecheck, lint, prisma validate, api/web/full build, full API test suite.
- Live ERP attempt: not performed (Bileeta API contract/credentials not available in environment).
- Still needed for live Bileeta UAT: approved `ERP_STOCK_ENDPOINT` path, field mapping confirmation, sandbox credentials, warehouse/tenant codes, sandbox/live mode sign-off.
- Deferred: ERP catalog sync, PO status pull, WO part request posting, automatic scheduled sync, ERP write/post flows.
- Recommended next task: **DEPLOY-002** production cutover UAT or next roadmap ERP posting phase after Bileeta contract approval.

## 2026-06-12 | WO-012 | Evidence/photo upload storage foundation

- Audit findings:
  - WO-011 Activity & Evidence panel is read-only timeline derived from existing WO/issue/part-request dates; no photo upload yet.
  - WorkOrder has legacy `attachments: String[]` URL list; no structured evidence metadata model existed.
  - SEC-013 `STORAGE_MODE` already surfaces in health/deployment readiness (`local`, `minio`, `cloudinary`, etc.) but evidence uploads had no dedicated guard flags.
  - Accident module uses URL-based evidence pattern; WO foundation uses metadata + provider readiness instead of MongoDB bytes.
- Schema/API changes:
  - Added `EvidenceAttachment` Prisma model with tenant/workOrder/facilityIssue links, status enum, storage metadata fields (no file bytes).
  - Added `EvidenceModule` with `EvidenceStorageProviderService`, `EvidenceService`, `GET /evidence/readiness`.
  - Work order routes: `GET/POST /work-orders/:id/evidence`, `upload-request`, `confirm`.
- Provider readiness:
  - `STORAGE_UPLOADS_ENABLED=false` by default; `STORAGE_MODE` extended with `disabled`/`mock`/`azure_blob`.
  - Mock mode supports metadata-only upload UAT without external storage calls; live presigned upload deferred.
- UI changes:
  - Work order editor Activity panel now lists evidence metadata and shows disabled upload state with allowed MIME/size guidance.
  - Upload button enabled only when readiness is `configured` and role allows WO evidence upload.
- Safety rules:
  - Tenant-scoped WO lookup; MIME/size/filename validation; no public routes; storageKey excluded from public DTOs.
  - No file bytes stored in MongoDB; no storage credentials in repo/responses.
- Tests run: `evidence-storage-readiness.spec.ts`, `work-order-evidence-storage.spec.ts`, extended `work-order-activity.spec.ts`, updated phase3 tests, typecheck, lint, prisma validate, api/web/full build, full API test suite.
- Live storage upload attempt: not performed (provider credentials/UAT not available).
- Still needed for live upload UAT: set `STORAGE_MODE=minio|cloudinary|s3|azure_blob`, provider credentials in secret manager, `STORAGE_UPLOADS_ENABLED=true`, presigned upload implementation sign-off.
- Deferred: public QR photo upload, downloadable signed URLs, image preview/editing, evidence retention automation, facility-issue direct upload UI.
- Recommended next task: **WO-013** live storage provider presigned upload UAT or re-run Atlas smoke after env wiring.

## 2026-06-13 | DEPLOY-002 | Staging MongoDB Atlas connection smoke test

- Audit findings:
  - Prisma datasource uses `env("DATABASE_URL")`; Joi requires `DATABASE_URL`; `normalizeDatabaseEnvironment()` mirrors `PRIMARY_DATABASE_URL` / `MONGODB_URI`.
  - `.env` is gitignored and not tracked; no credentials committed in repo/docs.
  - Local/host env during this run still referenced `localhost:27017` with database segment `bileeta_db` (not Atlas, not `maintainpro_staging`).
- Smoke tooling:
  - Added `npm run db:smoke` (`scripts/staging-db-smoke.mjs`) — connects via Prisma, prints counts only, redacts connection strings from errors.
  - Existing `node scripts/healthcheck.mjs` and `/health` used for runtime DB status when API is running.
- Connection result (this session):
  - `npm run db:smoke`: failed with server selection timeout (no reachable MongoDB at configured host).
  - API boot: succeeded; `/health` returned `database.status=degraded` with timeout message.
  - Atlas URI was **not** applied in the committed repo; operator must set `DATABASE_URL` in local/hosting secret manager only.
- Seed status:
  - `npm run db:seed` **not run** (requires `MAINTAINPRO_SEED_PASSWORD`; upsert-based but skipped to avoid altering staging data without approval).
- Safety:
  - No `db:reset`, drop, or destructive push executed against any database.
- Verification run: prisma validate, api/web/full build, 93 API test suites / 508 tests — all pass.
- Atlas follow-up (operator):
  - Set `DATABASE_URL` to MongoDB Atlas URI with explicit DB name (`maintainpro_staging` recommended).
  - Confirm Atlas IP allowlist / VPC access, least-privilege DB user, backups policy before production.
  - **Rotate temporary Atlas password after UAT** and revoke old credential.
- Recommended next task: re-run `npm run db:smoke` + `/health` after Atlas env is wired, then **DEPLOY-003** hosted staging deploy smoke (`smoke:deploy`).

## 2026-06-13 | DEPLOY-002B | Atlas staging connection smoke (operator env)

- Operator wired `DATABASE_URL` through shell/local `.env` only (not committed).
- `npm run db:smoke`: `connected: true` against `maintainpro_staging`; initial counts `tenantCount=0`, `userCount=0`, `workOrderCount=0`.
- API restarted with Atlas env; `/health` `database.status=operational`; `/health/readiness` primary MongoDB operational (overall readiness still degraded for expected local/staging gaps: backup replication, disabled email/SMS).
- No seed, reset, drop, or destructive push executed in this step.
- Recommended next task: **DEPLOY-002C** safe staging seed + login smoke.

## 2026-06-13 | DEPLOY-002C | Safe staging seed and login smoke

- Audit: branch `main`, clean working tree, `.env` gitignored; seed script (`apps/api/src/database/seed.ts`) is upsert-only (no drop/reset); `MAINTAINPRO_SEED_PASSWORD` required via shell env only.
- Seed: `npm run db:seed` completed against Atlas `maintainpro_staging` using env-only credentials (password not committed or logged).
- Post-seed `npm run db:smoke`: `connected: true`, `tenantCount=1`, `userCount=8`, `workOrderCount=5`.
- Seed baseline includes default tenant (`slug=default`), RBAC permissions/roles, and seeded admin users (`superadmin@maintainpro.local`, `admin@maintainpro.local`, plus sample roles).
- API health after seed: `node scripts/healthcheck.mjs` OK; `/health` database operational; `/health/readiness` primary MongoDB operational (overall still degraded for optional deps).
- Login smoke: API `POST /auth/login` for seed super-admin succeeded (access token returned); dashboard browser smoke pending unless web dev server is running (`smoke:local` web check not run).
- Safety: no destructive reset/drop; no secrets in git diff; smoke script continues to redact Mongo URIs in errors.
- Operator follow-up: rotate temporary Atlas password after UAT; store `MAINTAINPRO_SEED_PASSWORD` in secret manager (not repo); re-run seed password is session-only unless operator records it securely.
- Recommended next task: **DEPLOY-003** hosted staging deploy smoke (`npm run smoke:deploy`).

## 2026-06-14 | DEPLOY-003 | Hosted staging deploy smoke

- Audit: branch `main`, clean working tree, `.env` gitignored; smoke script `scripts/smoke-deployment.mjs` (`npm run smoke:deploy`) uses `MAINTAINPRO_API_URL`, `MAINTAINPRO_WEB_URL`, `MAINTAINPRO_SMOKE_EMAIL`, `MAINTAINPRO_SMOKE_PASSWORD` (aliases `STAGING_*` / `SMOKE_LOGIN_*` mapped in shell).
- Hosted targets exercised (public staging URLs from repo deploy config):
  - API: `https://newmone.onrender.com`
  - Web: `https://newmone.chinthakajayaweera1.workers.dev`
- Results (**PARTIAL**):
  - `GET /health`: HTTP 200, `database.status=operational` (after Render cold-start warm-up; first attempt timed out at 25s).
  - `GET /health/readiness`: HTTP 200, overall `operational`, primary MongoDB `operational`; readiness reported primary DB name **`nelna`** (hosted env not aligned with Atlas `maintainpro_staging` used in DEPLOY-002C local seed).
  - `npm run smoke:deploy`: frontend load **OK**; backend health **OK** (warm); CORS preflight **OK** (`access-control-allow-credentials=true`); login **FAIL** (`Invalid email or password` — likely hosted DB/password mismatch vs local seed credentials).
  - Web `/login` page loads over HTTPS (manual dashboard/navigation smoke still pending).
- No destructive DB operations; no re-seed; no secrets logged or committed.
- Operator follow-up before sign-off:
  1. Point Render/hosting `DATABASE_URL` to Atlas `maintainpro_staging` (or seed the hosted DB with approved `MAINTAINPRO_SEED_PASSWORD` matching `MAINTAINPRO_SMOKE_PASSWORD`).
  2. Re-run `npm run smoke:deploy` after warm-up; complete manual browser checklist on staging web.
  3. Rotate temporary Atlas password after UAT.
- Recommended next task: **DEPLOY-003B** align hosted DB env + re-run hosted smoke/login, or **DEPLOY-004** production cutover checklist after staging sign-off.

## 2026-06-14 | DEPLOY-003B | Align Render staging DB env + hosted smoke retry

- Local prep (completed):
  - Re-ran idempotent `npm run db:seed` against Atlas `maintainpro_staging` with shell `MAINTAINPRO_SEED_PASSWORD` aligned to smoke credentials (not logged/committed).
  - Post-seed `npm run db:smoke`: `connected: true`, `tenantCount=1`, `userCount=8`, `workOrderCount=5`.
- Render blueprint fix (repo):
  - Updated root `render.yaml`: `PRIMARY_DATABASE_NAME` and `MONGO_DATABASE_NAME` changed from legacy `nelna` to `maintainpro_staging` (non-secret; applies on next Render blueprint sync/deploy).
  - `DATABASE_URL` / `PRIMARY_DATABASE_URL` / `MONGODB_URI` remain `sync: false` — **must be set in Render dashboard** to Atlas URI with `/maintainpro_staging` path (operator-owned; not in repo).
- Hosted smoke retry (**FAIL / blocked on Render dashboard env**):
  - `GET /health`: operational.
  - `GET /health/readiness`: operational; primary DB name still reported as **`nelna`** (Render service env not yet updated/redeployed).
  - `npm run smoke:deploy`: frontend **OK**, health **OK**, CORS **OK**, login **FAIL** (`Invalid email or password`).
  - Web `/login` loads over HTTPS; browser dashboard smoke still pending.
- No destructive DB ops; no secrets committed or printed.
- Operator unblock steps:
  1. Render dashboard → `maintainpro-api` → set `DATABASE_URL`, `PRIMARY_DATABASE_URL`, `MONGODB_URI` to Atlas `maintainpro_staging` (secret manager).
  2. Confirm `MONGO_DATABASE_NAME=maintainpro_staging` after blueprint deploy; manual deploy / wait 60–90s warm-up.
  3. Re-run `npm run smoke:deploy`; complete manual browser checklist.
  4. Rotate temporary Atlas password after UAT.
- Recommended next task: re-run **DEPLOY-003B** smoke after Render dashboard env update, then **DEPLOY-004** production cutover checklist.

## 2026-06-15 | DEPLOY-003C | Stabilize hosted smoke health/CORS timeouts

- Root cause: Render dashboard DB env from DEPLOY-003B is now fixed (hosted login succeeds, ~18.8s), but `npm run smoke:deploy` still reported "Backend health: FAIL timeout" and "CORS preflight: FAIL timeout". Both checks ran against a cold Render free-tier instance with 25s/15s `AbortSignal.timeout()` budgets — shorter than the cold-start + first-Atlas-query latency (~30-60s+), so the requests never completed before the script aborted them. By the time the login check ran (after ~40s of prior attempts), the instance had warmed up enough to respond in 18.8s.
- What changed:
  - `scripts/smoke-deployment.mjs`: added a `/health` warm-up loop (`SMOKE_WARMUP_ATTEMPTS`, default 2) run before the timed checks; raised all hosted request timeouts to `SMOKE_REQUEST_TIMEOUT_MS` (default 60000ms, was 25000/15000ms); added per-check retry with backoff (`SMOKE_RETRY_ATTEMPTS`/`SMOKE_RETRY_DELAY_MS`, default 2/5000ms); replaced `AbortSignal.timeout()` with a manually-managed `AbortController` + `clearTimeout` to avoid Node 24 "AbortError" issues from timers firing after a fetch already settled. Health endpoint (`{apiOrigin}/health`) and CORS preflight target (`{apiBaseUrl}/auth/login` OPTIONS) were already correct and unchanged.
  - `apps/api/src/health.service.ts` + `apps/api/src/config/env.validation.ts`: `checkDatabase()`'s Prisma `withTimeout` budget (previously hardcoded 2500ms) is now `HEALTHCHECK_DEPENDENCY_TIMEOUT_MS` (default 5000ms), so `/health`'s DB check has headroom on a cold Atlas connection without making the liveness endpoint slow by default.
  - `render.yaml`: added `HEALTHCHECK_DEPENDENCY_TIMEOUT_MS=15000` (non-secret) for the staging API service to give the cold-start DB check more room; `/health/readiness` deep checks, Redis-optional behavior (`REDIS_REQUIRED_IN_PRODUCTION=false`, `REDIS_REQUIRED_FOR_READINESS=false`), and CORS config were already correct and unchanged.
- Files changed: `scripts/smoke-deployment.mjs`, `apps/api/src/health.service.ts`, `apps/api/src/config/env.validation.ts`, `render.yaml`, `docs/DEPLOYMENT_READINESS_CHECKLIST.md`, `docs/QA_CHECKLIST.md`, `docs/MAINTAINPRO_PRODUCTION_TODO.md`, `docs/RISK_REGISTER.md`.
- Tests run: `npm run typecheck`, `npm run lint`, `npx prisma validate --schema prisma/schema.prisma`, `npm run build --workspace @maintainpro/api`, `npm run build --workspace @maintainpro/web`, `npm run test --workspace @maintainpro/api` (93 suites / 508 tests, all pass, including `health-integration-modes.spec.ts` and `queue-health-readiness.spec.ts`).
- No secrets printed or committed; no DB writes/resets; CORS still requires an exact origin match with credentials (no wildcard).
- Remaining risks: Render free-tier cold starts add inherent latency to the *first* request after idle — the warm-up/retry loop tolerates this but a sufficiently slow cold start (>2x60s) could still fail; rotate the temporary Atlas password used during DEPLOY-002/003 UAT.
- Recommended next task: re-run `npm run smoke:deploy` against hosted staging with `MAINTAINPRO_SMOKE_PASSWORD` from the secret manager to confirm all four checks pass end-to-end, then proceed to **DEPLOY-004** production cutover checklist.

## 2026-06-15 | DEPLOY-004 / PROD-001 / UAT-001 | Final UAT and production cutover readiness

- Added `docs/FINAL_UAT_AND_CUTOVER_CHECKLIST.md` — operator Render/Atlas checklist, manual browser UAT (23 areas), production cutover go/no-go table, feature gap audit (must-have / should-have / Phase 2), residual risks.
- Extended `scripts/smoke-deployment.mjs` (DEPLOY-003C+): staging env aliases (`STAGING_*`, `SMOKE_LOGIN_*`), optional readiness check (skips with note when production returns 403 without `READINESS_API_KEY`), `SMOKE_WARMUP_DELAY_MS`, classified timeout vs DB-degraded vs login errors, wildcard CORS rejection, safe AbortController cleanup.
- Updated deployment docs (`DEPLOYMENT_READINESS_CHECKLIST`, `QA_CHECKLIST`, `RISK_REGISTER`, `MAINTAINPRO_PRODUCTION_TODO`) with final UAT/cutover references.
- **OPERATOR ACTION REQUIRED:** confirm Render dashboard secrets, rotate Atlas password post-UAT, complete manual browser UAT sign-off.
- Recommended next task: hosted `npm run smoke:deploy` sign-off + manual UAT on staging web, then production domain/TLS cutover using `FINAL_UAT_AND_CUTOVER_CHECKLIST.md`.

## 2026-06-15 | UAT-001 | Browser UAT blockers — login 401 UX + `/admin` React #310

- Audit findings:
  - Hosted `npm run smoke:deploy` PASS (health, CORS, login).
  - Manual browser UAT **PARTIAL**: login POST returned 401 and user landed on `/login?reason=session_expired` because the axios 401 interceptor treated **all** 401s (including `/auth/login`) as session expiry.
  - `/admin` crashed with React minified error **#310** (`Rendered more hooks than during the previous render`) when admin-only UI (including `SystemHealthSummary` with `useQuery`) mounted after role hydration.
- What changed:
  - `apps/web/lib/api-client.ts`: session-expired redirect skips credential auth routes (`/auth/login`, register, forgot/reset password); `/auth/me` 401 still redirects with reason.
  - `apps/web/app/(auth)/login/page.tsx`: trim password on submit; show session-expired banner from query param; invalid-credentials fallback message.
  - `apps/web/app/(dashboard)/layout.tsx`: `QueryClientProvider` wraps session gate; unauthenticated redirect uses `?reason=session_expired`.
  - `apps/web/lib/use-current-user.ts`: lazy-init from localStorage to stabilize role on first render.
  - `apps/web/components/admin/admin-console-page.tsx`: split authorized UI; always mount `SystemHealthSummary` with `enabled={isAdmin}`.
  - `apps/web/components/dashboard/system-health-summary.tsx`: optional `enabled` prop keeps hook order stable.
  - `apps/web/components/layout/global-command-palette.tsx`: fix `extractRoleName(user)` usage.
  - `apps/web/e2e/auth.spec.ts`: regression tests for `/admin` and `/action-center` shell load.
  - Docs: `FINAL_UAT_AND_CUTOVER_CHECKLIST.md`, `QA_CHECKLIST.md`, `MAINTAINPRO_PRODUCTION_TODO.md`, `RISK_REGISTER.md`.
- Root cause summary:
  - Login 401: **code issue** (interceptor), not API auth weakening — wrong password still returns 401; UI now shows message instead of session-expired redirect.
  - React #310: **code issue** — conditional mount of query-hook child after async role hydration changed hook tree; fixed via stable `enabled` query + provider/layout stabilization.
- Tests run: typecheck, lint, prisma validate, api/web build, api tests, smoke:deploy (post-fix).
- Remaining: operator manual browser UAT re-sign-off in incognito; rotate Atlas password post-UAT.

## 2026-06-15 | UAT-001 | Staging browser re-test after `039e361`

- Hosted smoke (2026-06-15): Frontend OK · Health OK · Readiness skip OK · CORS OK · **Login FAIL** (`Invalid email or password`).
- Staging Playwright (`npm run test:e2e:staging`): **1/5 PASS** — wrong-password UX verified on live Workers URL; authenticated routes blocked by credential mismatch.
- Local Playwright (`auth.spec.ts` admin/action-center/invalid-credentials): **3/3 PASS** — confirms `039e361` hook-order and login interceptor fixes.
- Local `npm run db:seed` against Atlas: **FAIL** (TLS/server selection from dev workstation) — operator should seed from Render shell or Atlas-allowed IP, then align `MAINTAINPRO_SMOKE_PASSWORD`.
- Added `apps/web/e2e/staging-uat.spec.ts` + `playwright.staging.config.ts` and `npm run test:e2e:staging` for repeatable staging browser checks (env-only credentials).
- UAT-001 sign-off remains **PARTIAL** until hosted login succeeds and `/admin` + `/action-center` verified with valid session.

## 2026-06-15 | Enterprise readiness polish | Portfolio + production documentation

- Rewrote `README.md` (root + maintainpro) with honest deployment status, MVP flow, readiness table, and portfolio value.
- Replaced stale `PRODUCTION_READINESS_REPORT.md` (SECURITY_OFFICER, email/SMS/ERP claims corrected).
- Added docs: `ARCHITECTURE.md`, `ROLE_MATRIX.md`, `UAT_CHECKLIST.md`, `SECURITY_CHECKLIST.md`, `ENTERPRISE_ROADMAP.md`, `DEPLOYMENT.md`, `PORTFOLIO_CASE_STUDY.md`.
- Web: production security headers (CSP, HSTS, frame denial) in `next.config.mjs`; route/global error boundaries.
- API: CORS `X-CSRF-Token` allowed header for cookie refresh cross-origin.
- Documented auth storage security posture in `auth-storage.ts`.
- Corrected stale `PHASE6_COMPLETION_REPORT.md` SECURITY_OFFICER note.

## 2026-06-12 | OPS-002 / BUILD-010 / NOTIFY-001 / ERP-001 / DEPLOY-001 | Operational readiness foundations sprint

- What changed:
  - **OPS-002:** Added tenant-scoped SLA/aging report (`GET /facilities/reports/aging`) with issue age buckets, overdue SLA preview, critical/high aging preview, and optional linked work order aging when `dueDate` exists. Web route `/facilities/reports/aging` with heatmap tables; Action Center + facility reports links updated.
  - **BUILD-010:** Added CleaningLocation → Room dry-run matcher/report, guarded optional apply for exact matches only (`ALLOW_FACILITY_BACKFILL_APPLY=true` + `--apply`), CLI script, and runbook.
  - **NOTIFY-001:** Added notification provider readiness service, render-only templates, `/notifications/readiness` + template samples endpoints, health readiness integration.
  - **ERP-001:** Added `InventoryErpAdapter` disabled/no-op foundation with honest readiness reporting.
  - **DEPLOY-001:** Added deployment readiness service, admin endpoint, CLI helper, and production checklist doc.
- Files changed (high level):
  - API: `facility-aging.mapper.ts`, `facilities.service.ts`, `facilities.controller.ts`, `facility-location-backfill.*`, `notification-readiness.service.ts`, `notification-templates.service.ts`, `inventory-erp-adapter.service.ts`, `deployment-readiness.service.ts`, `health.service.ts`, `env.validation.ts`
  - Web: `/facilities/reports/aging`, aging components/libs, Action Center + reports links
  - Docs: `FACILITY_LOCATION_BACKFILL_RUNBOOK.md`, `NOTIFICATION_PROVIDER_SETUP.md`, `ERP_INVENTORY_INTEGRATION_PLAN.md`, `DEPLOYMENT_READINESS_CHECKLIST.md` + tracking doc updates
  - Tests: `facility-aging.spec.ts`, `facility-location-backfill.spec.ts`, `notification-readiness.spec.ts`, `erp-inventory-adapter.spec.ts`, `deployment-readiness.spec.ts`
- Tests run: typecheck, lint, prisma validate, api/web/full build, full API test suite
- Remaining risks:
  - Live email/SMS/ERP still require production credentials and staged UAT sends
  - Backfill apply remains off by default; manual review required for ambiguous matches
  - WO aging limited to linked work orders with due dates (no platform-wide WO SLA engine yet)
- Recommended next task: **OPS-003** duplicate issue detection
