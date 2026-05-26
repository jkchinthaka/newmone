# Production Hardening Report

## Scope

This phase was limited to production hardening. No new business modules or feature workflows were added. Work focused on resolving or explicitly de-scoping the go-live blockers identified in `PRODUCTION_READINESS_REPORT.md`.

## Blocker Disposition

### 1. Documentation And Architecture Alignment

Status: resolved.

- `README.md` now describes Prisma MongoDB as the active backend data layer.
- PostgreSQL production architecture references were removed from active setup guidance.
- `DEPLOYMENT_GUIDE.md` now aligns Render, Vercel or Cloudflare, MongoDB Atlas, provider flags, and custom domain readiness.
- Legacy SQL migration folders are documented as historical metadata, not the active rollout path.

### 2. Database Rollout Runbook

Status: resolved.

- Added `DATABASE_MIGRATION_TO_MONGODB.md`.
- Active rollout command is `npm run db:push` after `npm run db:generate`.
- `npm run db:migrate` is retained only as a compatibility alias for MongoDB schema push.
- Runbook covers local MongoDB, Docker MongoDB, Atlas, schema push, seed verification, rollback, credential rotation, and go-live gate checks.

### 3. Email Notification Implementation

Status: resolved, provider-gated.

- Added SMTP dispatch via `EmailDispatchService`.
- Notification queue now processes `EMAIL` jobs through the SMTP provider.
- SMTP is disabled by default and becomes active only when `SMTP_ENABLED=true` and required SMTP variables are configured.
- Readiness reports SMTP as disabled, configured, or incomplete.

### 4. SMS Notification Implementation

Status: resolved, provider-gated.

- Added generic HTTP SMS dispatch via `SmsDispatchService`.
- Notification queue now processes `SMS` jobs through the SMS provider.
- SMS is disabled by default and becomes active only when `SMS_ENABLED=true` and required SMS variables are configured.
- Readiness reports SMS as disabled, configured, or incomplete.

### 5. ERP Sync Readiness

Status: resolved with production guardrail.

- Added `ErpSyncProviderService` with `mock` and `http` modes.
- Existing purchase-order ERP sync now uses the selected provider path.
- Mock ERP mode is blocked in production unless explicitly allowed with `ERP_SYNC_ALLOW_MOCK_IN_PRODUCTION=true`.
- Production ERP sync requires `ERP_SYNC_PROVIDER=http`, `ERP_API_URL`, and `ERP_API_KEY`.
- Readiness reports mock blocked, mock allowed, HTTP configured, or HTTP incomplete.

### 6. Push Notification Readiness

Status: resolved with explicit de-scope path.

- Existing no-op push provider remains the default fallback.
- Added generic HTTP push provider guarded by `PUSH_PROVIDER_ENABLED=true` and required provider variables.
- Readiness reports push as no-op, configured, or incomplete.
- Disabled no-op push is now visible without failing overall readiness.

### 7. SECURITY_OFFICER Backend Role Hardening

Status: resolved.

- Added `SECURITY_OFFICER` to the Prisma `RoleName` enum.
- Seed data now creates the role, permissions, and a sample security officer user.
- Added fine-grained `gate.out.create` and `gate.in.create` permissions.
- Gate endpoints now require fine-grained gate permissions, with `vehicles.operate` kept as a compatibility alias.
- Operations scan lookup now allows `SECURITY_OFFICER`.
- Tests verify gate access, scan role access, compatibility aliases, and blocked purchase approval.

### 8. Hosting And Domain Readiness Checklist

Status: resolved.

- `DEPLOYMENT_GUIDE.md` now includes a go-live hosting checklist for Vercel or Cloudflare frontend hosting, Render API custom domain, DNS, HTTPS, CORS, API URL variables, and `/health/ready` checks.
- `render.yaml` now includes MongoDB/provider readiness environment keys with placeholders or disabled defaults.

## Database And Seed Notes

- Prisma schema validation passed after adding `SECURITY_OFFICER`.
- Prisma Client generation passed.
- Seed now includes post-seed verification for required roles, permissions, full `SUPER_ADMIN` permission coverage, tenant gate policy, and queryable core collections.
- `db:push` and `db:seed` were not executed against the currently configured database during this hardening pass to avoid mutating an unknown local or live MongoDB target. The commands and verification sequence are now documented in the MongoDB rollout runbook.

## Validation Evidence

Passed:

- `npm run db:generate`
- `npx prisma validate --schema ./prisma/schema.prisma`
- `npm run typecheck --workspace @maintainpro/api`
- `npm run typecheck --workspace @maintainpro/web`
- Focused provider and authorization Jest tests: 7 suites, 45 tests passed.
- Full API Jest suite: 18 suites, 93 tests passed.
- `npm run build`
- Docker Compose validation for `docker-compose.dev.yml` and `docker-compose.yml` with placeholder MongoDB credentials.
- `flutter analyze` in `apps/mobile`: no issues found.
- Diagnostics for touched docs and new provider code: no issues found.

Known unrelated diagnostics:

- Workspace diagnostics still show pre-existing markdown lint in older phase reports such as `PHASE3_COMPLETION_REPORT.md`, `PHASE4_COMPLETION_REPORT.md`, and `PHASE5_COMPLETION_REPORT.md`. These were not part of this production-hardening scope.

## Remaining Go-Live Actions

These are operational actions, not code blockers:

- Provision final MongoDB Atlas or authenticated MongoDB target.
- Set real secret-manager values for MongoDB, JWT, Redis, Cloudinary or S3, SMTP, SMS, ERP, push, and external APIs.
- Run the documented `db:generate`, `db:push`, and `db:seed` sequence against staging, then production.
- Verify `/health` and `/health/ready` on the final API domain.
- Run hosted smoke tests against the final web and API domains.
- Keep ERP and push intentionally disabled if vendors are not selected for launch.

## Final Assessment

Production hardening blockers from the readiness report are now either resolved in code/docs or explicitly de-scoped behind provider flags and readiness reporting. The application is ready for a staged production rehearsal using the MongoDB rollout runbook and final environment/provider credentials.
