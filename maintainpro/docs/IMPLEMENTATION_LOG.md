# MaintainPro Implementation Log

This log records every completed change made as part of the production-readiness program
tracked in `MAINTAINPRO_PRODUCTION_TODO.md`. One entry per completed task (or meaningful
sub-step of a large task).

Format per entry:

```
## YYYY-MM-DD — TASK-ID: short title
- What changed:
- Files changed:
- Tests run:
- Remaining risks:
```

---

## 2026-06-12 — SEC-001: Verify no public demo credentials on login page

- What changed: no code change. Audited
  `apps/web/app/(auth)/login/page.tsx` plus the rest of `(auth)/`, `components/`, and
  `lib/` for hardcoded demo credentials, prefilled login values, or "demo account"
  banners (`grep -rni "demo"`). None found — the login form starts with empty
  `username`/`password` defaults and only links to `/register` and
  `/forgot-password`. Marked VERIFIED.
- Files changed: none.
- Tests run: none (verification only).
- Remaining risks: none for this item.

## 2026-06-12 — SEC-008: Gate Swagger and detailed readiness in production

- What changed: `/api/docs` was previously mounted unconditionally with no auth.
  `/health/readiness` (mounted directly on the Express adapter, bypassing all Nest
  guards) returned full dependency + integration-configuration details
  (`getReadiness()`) to anyone, unauthenticated.
  - Extracted two pure, testable helper modules under `src/bootstrap/`:
    - `swagger-guard.ts`: `shouldSetupSwagger()`, `shouldProtectSwaggerWithBasicAuth()`,
      `verifySwaggerBasicAuth()`.
    - `readiness-guard.ts`: `isAuthorizedForReadiness()`.
  - Swagger (`/api/docs`, `/api/docs-json`) is now always set up outside production.
    In production it is **disabled by default**; set `SWAGGER_ENABLED=true` plus both
    `SWAGGER_USER`/`SWAGGER_PASSWORD` to enable it behind HTTP Basic Auth (verified via
    a small Express middleware using `verifySwaggerBasicAuth`, no new dependency).
  - `/` and `/health` are unchanged — they already returned the minimal
    `getPublicHealth()` payload (status/service/environment/db summary only), which
    satisfies "minimal public health".
  - `/health/readiness` now calls `isAuthorizedForReadiness()` before returning
    `getReadiness()`. Outside production it remains open (dev convenience). In
    production it requires either:
    - `Authorization: Bearer <JWT>` where the token's `role` is `ADMIN` or
      `SUPER_ADMIN` (verified with `jsonwebtoken.verify` + `getAccessJwtSecret()`), or
    - `X-Readiness-Key: <value>` matching the new `READINESS_API_KEY` env var (for
      uptime/infra monitoring tools that can't hold a user JWT).
  - Added `SWAGGER_ENABLED`, `SWAGGER_USER`, `SWAGGER_PASSWORD`, `READINESS_API_KEY` to
    `env.validation.ts` (all optional) and documented them in `.env.example` and
    `README.md`.
- Files changed:
  - `apps/api/src/main.ts`
  - `apps/api/src/bootstrap/readiness-guard.ts` (new)
  - `apps/api/src/bootstrap/swagger-guard.ts` (new)
  - `apps/api/src/config/env.validation.ts`
  - `apps/api/test/readiness-guard.spec.ts` (new)
  - `apps/api/test/swagger-guard.spec.ts` (new)
  - `maintainpro/.env.example`
  - `maintainpro/README.md`
- Tests run:
  - `npx jest --config ./jest.config.cjs test/readiness-guard.spec.ts test/swagger-guard.spec.ts` — 20/20 pass
  - `npx tsc --noEmit -p apps/api/tsconfig.json` — clean
- Remaining risks: `render.yaml` health check still points at `/health` (unaffected,
  stays public/minimal). Operators deploying to production must set
  `READINESS_API_KEY` (or use an admin JWT) if they rely on `/health/readiness` for
  monitoring — otherwise it now returns 403. PERF-002 (readiness/Swagger timeout)
  is still open and tracked separately.

## 2026-06-12 — SEC-009: Reject inactive/deleted users in JWT validation

- What changed: `JwtStrategy.validate()` previously returned the JWT payload as-is with
  no DB check, so a deactivated user's existing access token remained valid until
  expiry. `validate()` is now async, loads the user by `payload.sub`, and throws
  `UnauthorizedException` if the user no longer exists or `isActive === false`. Added
  `PrismaService` injection to `JwtStrategy` (PrismaModule is `@Global()`, no module
  wiring change needed).
- Files changed:
  - `apps/api/src/modules/auth/jwt.strategy.ts`
  - `apps/api/test/jwt-strategy.spec.ts` (new)
- Tests run:
  - `npx jest --config ./jest.config.cjs test/jwt-strategy.spec.ts` — 3/3 pass
  - `npx tsc --noEmit -p apps/api/tsconfig.json` — clean
- Remaining risks: adds one DB lookup per authenticated request (select isActive only,
  indexed by `id`/`_id` — negligible). Login/refresh flows should also re-check
  isActive (covered separately by SEC-002/SEC-004 work).

## 2026-06-12 — SEC-007: Fix UtilitiesService cross-tenant data leak

- What changed: `UtilitiesService` previously queried `utilityMeter`, `meterReading`,
  and `utilityBill` with no tenant scoping at all (`meters()`, `meter()`,
  `allReadings()`, `bills()`, `bill()`, `overdue()`, `analytics()`, etc. returned data
  across ALL tenants). Reworked every method to accept the caller's `tenantId` (from
  `req.user.tenantId`, set by `TenantContextGuard`) and scope/verify ownership:
  - List methods (`meters`, `bills`, `overdue`, `analytics`) now filter
    `where: { tenantId }` (no filter for SUPER_ADMIN with `tenantId === null`).
  - Single-record methods (`meter`, `bill`) use `findFirst({ where: { id, tenantId } })`
    so a cross-tenant id lookup returns 404 instead of another tenant's record.
  - Mutating methods (`updateMeter`, `addReading`, `readings`, `consumptionChart`,
    `payBill`, `createBill`) call the ownership-checked getter first.
  - `allReadings()` (MeterReading has no tenantId of its own) now first loads the
    tenant's meters, then queries readings `where: { meterId: { in: [...] } }`.
  - `createMeter`/`createBill` now stamp `tenantId` on the created record.
  - Controller (`utilities.controller.ts`) now injects `@Req() req` and passes
    `req.user?.tenantId ?? null` to every service call.
- Files changed:
  - `apps/api/src/modules/utilities/utilities.service.ts`
  - `apps/api/src/modules/utilities/utilities.controller.ts`
  - `apps/api/test/utilities-tenant-isolation.spec.ts` (new)
- Tests run:
  - `npx jest --config ./jest.config.cjs test/utilities-tenant-isolation.spec.ts` — 8/8 pass
  - `npx tsc --noEmit -p apps/api/tsconfig.json` — clean
- Remaining risks: none for this module. SEC-006 (broad tenant-isolation audit across
  all other modules, e.g. `fleet.service.ts liveMap()`) is still open and tracked
  separately.

## 2026-06-12 — PHASE-0: Repository audit & TODO system setup

- What changed: Performed full repository audit (backend modules, Prisma schema,
  frontend routes/components, mobile app, deployment config). Created the three
  tracking documents (`MAINTAINPRO_PRODUCTION_TODO.md`, `IMPLEMENTATION_LOG.md`,
  `QA_CHECKLIST.md`) under `maintainpro/docs/`. No application code changed.
- Files changed:
  - `maintainpro/docs/MAINTAINPRO_PRODUCTION_TODO.md` (new)
  - `maintainpro/docs/IMPLEMENTATION_LOG.md` (new)
  - `maintainpro/docs/QA_CHECKLIST.md` (new)
- Tests run: none (audit only)
- Remaining risks: Several premises in the original task brief do not match the current
  codebase (Farm module already has full UI; CleaningChecklistTemplate already has
  service-layer support; "Building/Property/Floor/Room" hierarchy does not exist and
  Phase 5 as specified is net-new). These are flagged in the TODO table and should be
  resolved with the user before deep work begins on Phases 5, 10, 11, 12, 13, 18.
