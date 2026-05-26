# Production Readiness Report

## Overall Verdict

MaintainPro is not yet ready for an unrestricted full production go-live across the entire advertised feature surface.

The core multi-tenant web and API platform appears close to production-capable for a staged rollout on Render plus Vercel or Cloudflare with MongoDB Atlas, provided the deployment runbook is tightened and the launch scope explicitly excludes the still-placeholder integration areas called out below.

If the intended go-live includes real push delivery, email alerts, SMS alerts, ERP synchronization, or a true backend `SECURITY_OFFICER` persona, those remain blockers.

## Evidence Reviewed

- Phase completion reports present in repo: `PHASE3_COMPLETION_REPORT.md`, `PHASE4_COMPLETION_REPORT.md`, `PHASE5_COMPLETION_REPORT.md`, `PHASE6_COMPLETION_REPORT.md`
- Deployment and env references: `DEPLOYMENT_GUIDE.md`, `README.md`, `render.yaml`, `vercel.json`, `apps/web/wrangler.jsonc`, `.env.example`, `.env.production.example`, `apps/api/.env.example`, `apps/web/.env.example`
- Runtime and safety checks: `apps/api/src/config/env.validation.ts`, `apps/api/src/health.service.ts`, `scripts/smoke-deployment.mjs`, `scripts/smoke-local.mjs`, `scripts/healthcheck.mjs`
- Security, audit, and tenancy controls: `apps/api/src/app.module.ts`, `apps/api/src/modules/tenancy/tenant-context.guard.ts`, `apps/api/src/common/guards/roles.guard.ts`, `apps/api/src/common/guards/permissions.guard.ts`, `apps/api/src/database/prisma.service.ts`, `apps/api/src/common/context/request-context.middleware.ts`, audit module/controllers/services, Phase 4 and Phase 5 e2e tests, Phase 6 guard tests
- Integration readiness areas: `apps/api/src/modules/notifications/*`, `apps/api/src/modules/inventory/inventory.service.ts`, `apps/mobile/lib/features/notifications/presentation/providers/push_notifications_provider.dart`, `prisma/schema.prisma`, `apps/api/src/database/seed.ts`

Note: no Phase 1 or Phase 2 completion report files were found in the repo. That is a documentation gap, not proof those phases are incomplete.

## Readiness Matrix

| Area | Status | Summary |
| --- | --- | --- |
| Core API hosting | Partial | Render config is present and coherent for Node runtime, health endpoint, build, and start commands. |
| Web hosting / PWA | Partial | Vercel and Cloudflare deployment configs exist. PWA manifest, service worker, offline page, and icons are present. Custom-domain evidence is not present in repo configs. |
| Database | Partial | Prisma datasource is MongoDB and deployment docs target Atlas. Production schema rollout guidance is not yet clean because repo scripts still expose `db:migrate` while local operational guidance already falls back to `prisma db push`. |
| Tenant isolation / PBAC | Ready | Global JWT, tenant, role, and permission guards are registered. Phase 4 and Phase 5 e2e tests cover cross-tenant 403 behavior. Phase 6 tests cover new PBAC keys. |
| Audit trail | Ready | Prisma mutation audit middleware, request context capture, audit endpoints, and explicit audit writes for high-risk workflows are in place. |
| Redis-backed queues | Partial | Queue integration exists and app startup degrades gracefully, but readiness treats Redis as required and queue failures are intentionally suppressed rather than fatal. |
| File storage | Partial | Cloudinary or MinIO/S3-compatible storage is effectively required for uploaded evidence and a green readiness result. |
| SMTP / email alerts | Blocked | Env templates and readiness checks expect SMTP, but no actual email delivery implementation was found in the notification processor. |
| SMS alerts | Blocked | Twilio env support is defined, but no SMS delivery implementation was found in runtime notification processing. |
| ERP inventory integration | Blocked | Purchase-order ERP sync is still `MOCK_ERP` only. |
| Push notifications | Blocked | Backend dispatch uses a `NoopPushProvider`, and the mobile app has no checked-in Firebase platform configuration files. |
| `SECURITY_OFFICER` backend role | Blocked | Mobile UX is aware of the role, but Prisma `RoleName` and backend seed catalog do not include it. |
| Production docs / runbooks | Partial | `DEPLOYMENT_GUIDE.md` is mostly aligned with Atlas/Render/Vercel, but `README.md` still describes a PostgreSQL/Redis/MinIO production architecture. |

## Hosting, Domain, and Database Readiness

### Hosting

- API hosting is prepared for Render via the root `render.yaml` with `rootDir: maintainpro`, `npm install && npm run render:build`, and `npm run render:start`.
- Frontend hosting is prepared for either Vercel (`maintainpro/vercel.json`) or Cloudflare/OpenNext (`apps/web/wrangler.jsonc`).

### Domain readiness

- Current checked-in config points to provider-hosted URLs such as `newmone.onrender.com` and `newmone.chinthakajayaweera1.workers.dev`.
- No repo evidence was found for custom production domains, DNS cutover steps, or domain ownership validation.
- If a branded production domain is required, domain mapping and final `CORS_ORIGIN` / `FRONTEND_URL` alignment are still pending.

### Database readiness

- The current Prisma datasource is MongoDB (`provider = "mongodb"`).
- Deployment docs correctly target MongoDB Atlas.
- The repo still exposes `npm run db:migrate`, but local operational notes already document `prisma db push` as the reliable schema sync path in this workspace.
- Recommendation: do not treat `npm run db:migrate` as the primary production rollout command until the database rollout strategy is formalized and rehearsed.

## Required Environment Variables

### Required for core app boot and hosted connectivity

- API:
  - `NODE_ENV`
  - `DATABASE_URL`
  - `MONGODB_URI`
  - `JWT_SECRET` or `JWT_ACCESS_SECRET` plus `JWT_REFRESH_SECRET`
  - `JWT_ACCESS_EXPIRES`
  - `JWT_REFRESH_EXPIRES`
  - `CORS_ORIGIN`
  - `FRONTEND_URL`
- Web:
  - `NEXT_PUBLIC_API_URL`
  - `NEXT_PUBLIC_API_BASE_URL`
  - `NEXT_PUBLIC_API_ORIGIN`

### Required for green readiness and reliable production behavior

- `REDIS_URL`
- Either Cloudinary credentials:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
  - `CLOUDINARY_ASSET_FOLDER`
- Or S3-compatible storage settings:
  - `MINIO_ENDPOINT`
  - `MINIO_PORT`
  - `MINIO_USE_SSL`
  - `MINIO_ACCESS_KEY`
  - `MINIO_SECRET_KEY`
  - `MINIO_BUCKET`

### Provider-specific or feature-gated variables

- Email placeholders in env templates and readiness:
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
  - `SENDGRID_API_KEY`
- SMS placeholders:
  - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- OAuth / billing / external integrations:
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - `RAPIDAPI_COPILOT_API_KEY`, `RAPIDAPI_COPILOT_HOST`
  - `RAPIDAPI_QR_CODE_API_KEY`, `RAPIDAPI_QR_CODE_HOST`
  - `OPENWEATHER_API_KEY`

### Operational note

- Keep `MONGO_SYNC_ON_STARTUP=false` in production unless the legacy sync path is intentionally required and fully rehearsed.

## Required External Services

### Core production services

- MongoDB Atlas cluster
- API host: Render or equivalent Node host
- Web host: Vercel or Cloudflare/OpenNext
- Redis instance for Bull queues
- Persistent object storage: Cloudinary or S3-compatible storage

### Conditionally required depending on promised launch scope

- SMTP provider for email alerts
- Twilio for SMS alerts
- Real ERP/inventory provider for purchase-order sync
- Firebase/FCM plus platform app registration for mobile push
- DNS and TLS for custom production domains

## Migration and Seed Order

Use the following order for a production rollout or a staging rehearsal.

1. Backup the existing database and confirm whether this is a greenfield environment or an upgrade.
2. Install dependencies from the `maintainpro/` repo root.
3. Generate Prisma client:

   ```bash
   npm run db:generate
   ```

4. Apply schema using the currently reliable path for this workspace:

   ```bash
   npx prisma db push --schema ./prisma/schema.prisma
   ```

5. Seed baseline roles, permissions, admin users, and sample domain configuration:

   ```bash
   npm run db:seed
   ```

6. Run conditional upgrade scripts only for existing environments that predate those features:

   ```bash
   npm run departments:migrate
   npm run phase3:migrate
   ```

7. Verify database health and application health:

   ```bash
   npm run healthcheck
   ```

8. Deploy API.
9. Deploy web frontend.
10. Run hosted smoke tests.

Notes:

- `phase3:migrate` is documented as idempotent in the Phase 3 completion report.
- `departments:migrate` should be rehearsed against a non-production copy before first production use.
- Do not rely on `npm run db:migrate` as the primary production instruction until the MongoDB rollout story is cleaned up.

## Seed and Backfill Requirements

- `apps/api/src/database/seed.ts` is required to establish the PBAC catalog used by production guards.
- Phase 6 permissions `operations.scan_lookup` and `predictive_insights.view` are seeded already.
- Backend seed data does not include `SECURITY_OFFICER` because the role is not present in `RoleName`.
- `phase3:migrate` is required only when upgrading legacy procurement / purchase-order data that needs tenant ownership backfill.
- `departments:migrate` is required only when upgrading legacy tenant data into the canonical department model.

## SMTP, SMS, ERP, and Push Provider Status

### SMTP / email alerts

- Health and env templates imply email readiness.
- Actual notification processing currently logs generic non-push sends and does not implement SMTP or SendGrid delivery.
- Result: email alert configuration alone is not enough for real production email delivery.

### SMS gateway

- Health and env templates imply Twilio readiness.
- No runtime SMS sender was found in the notification processing path.
- Result: SMS is not production-ready.

### ERP inventory API

- Purchase-order ERP sync is implemented as `executeMockErpSync` with provider `MOCK_ERP`.
- Result: ERP sync is not production-ready until a real provider client, credentials, error handling, and reconciliation flow are added.

### Push provider

- Backend push dispatch currently uses `NoopPushProvider` only.
- Mobile bootstrap attempts FCM registration only when Firebase is configured, but no `google-services.json`, `GoogleService-Info.plist`, or `firebase_options.dart` were found in the repo.
- Result: push is in readiness scaffolding only, not live delivery state.

## `SECURITY_OFFICER` Gap

- Mobile UX maps a `SECURITY_OFFICER` role if the backend ever sends it.
- Backend Prisma `RoleName` does not define `SECURITY_OFFICER`.
- Seed permissions therefore cannot assign a backend security-officer role today.
- If go-live requires dedicated security-officer accounts and permissions, this is a blocker.

## Audit, Logging, Tenant Isolation, and Guard Coverage

### Audit coverage

- Prisma middleware automatically writes audit rows for create, update, upsert, and delete operations across most business models.
- Request context captures actor id, email, role, tenant, module, IP address, user agent, and request path.
- Audit endpoints are protected by `audit.view`.
- Phase 4 and inventory / work-order flows also write explicit business-event audit entries for high-risk actions.

### Logging coverage

- The API uses Nest logging and explicit console warnings for degraded Redis / queue behavior.
- No structured log pipeline or central log sink configuration was found in repo code.
- Recommendation: add centralized application logs and alerting before full production launch.

### Tenant isolation and permission coverage

- `JwtAuthGuard`, `TenantContextGuard`, `RolesGuard`, and `PermissionsGuard` are registered globally in `AppModule`.
- `TenantContextGuard` enforces tenant membership for non-super-admins.
- `PermissionsGuard` supports token-provided permissions and DB-fetched permissions.
- Verified tests include:
  - Phase 4 cross-tenant vehicle compliance 403 behavior
  - Driver intelligence cross-tenant 403 behavior
  - Phase 6 role and permission enforcement for scan lookup and predictive insights

Overall, tenant isolation and PBAC coverage look materially stronger than provider-integration readiness.

## Deployment Checklist

1. Choose the single frontend deployment target for go-live: Vercel or Cloudflare/OpenNext.
2. Finalize the public frontend origin and API origin.
3. Provision MongoDB Atlas and verify network allowlists.
4. Provision Redis and object storage.
5. Set all core env variables in the host platforms.
6. Run `npm run deploy:check` from `maintainpro/`.
7. Run schema sync using `prisma db push` and then `npm run db:seed`.
8. Run conditional backfill scripts for upgraded environments.
9. Deploy API and verify `/health` and `/health/readiness`.
10. Deploy web and verify API connectivity from the final origin.
11. Run `npm run smoke:deploy` with final hosted URLs and an admin login.
12. Execute role-based UAT before DNS cutover or customer onboarding.

## Smoke Test Checklist

### Automated

- `npm run deploy:check`
- `npm run smoke:deploy`
- `npm run healthcheck`

### Manual API checks

- `GET /health`
- `GET /health/readiness`
- `POST /api/auth/login`
- Confirm CORS allows the final frontend origin with credentials enabled
- Confirm Swagger docs load at `/api/docs`

### Manual functional checks

- Create and update a work order
- Create a vehicle document and verify / reject it
- Create an accident and confirm work-order linkage
- Execute purchase-order approval path and verify ERP sync behavior is intentionally mocked or de-scoped
- Verify mobile offline queue replay with connectivity restoration
- Verify web PWA installability and offline fallback page

## UAT Checklist by Role

### SUPER_ADMIN / ADMIN

- Login and tenant access
- User, role, and permission administration
- Audit log visibility
- Settings and organization management
- Cross-module dashboard and reporting access

### MANAGER / OPERATIONS_MANAGER / FLEET_MANAGER / COMPLIANCE_MANAGER

- Dashboard analytics
- Compliance, accidents, claims, and fines workflows
- Purchase-order approval workflow
- Driver intelligence and predictive insights
- QR / operational scan lookup

### TECHNICIAN / MECHANIC

- Assigned work-order visibility
- Status updates
- Part request creation and issue flow
- Scan lookup access
- Mobile offline replay behavior

### DRIVER

- Fuel log creation
- Vehicle operation visibility
- Accident and traffic fine reporting
- Driver intelligence visibility
- Mobile offline replay and scan lookup

### SUPERVISOR / CLEANER

- Cleaning visit workflows where that module is in scope
- Issue reporting and sign-off flows

### `SECURITY_OFFICER`

- Cannot be fully UATed as a backend role today because the backend role does not exist.

## Known Risks

- `README.md` still documents a PostgreSQL / Redis / MinIO production architecture while current deployment guidance and Prisma datasource are MongoDB-based.
- `/health/readiness` treats Redis, SMTP, and object storage as required, while other docs describe some of those as optional or low-cost deferred integrations.
- Redis and queue failures are intentionally suppressed so business operations continue, which reduces blast radius but can hide notification delivery degradation.
- Email and SMS configuration may appear ready in env templates even though runtime delivery is not implemented.
- Push registration exists without a live backend provider or checked-in Firebase platform configuration.
- ERP sync can look functionally complete from the UI/API surface while still using a mock provider.
- No central logging / alert routing configuration was found.
- No Phase 1 or Phase 2 completion report files were found.

## Go-Live Blockers

### Blockers for a full feature-complete production launch

1. Real push delivery provider is not implemented.
2. Mobile Firebase platform configuration is absent from the repo.
3. Email alert delivery is not implemented.
4. SMS delivery is not implemented.
5. ERP purchase-order sync is still mock-only.
6. Backend `SECURITY_OFFICER` role and permissions do not exist.
7. Production database rollout instructions are not yet clean enough; schema sync must be standardized and rehearsed.

### Blockers for a green operational readiness gate

1. Redis must be provisioned and reachable.
2. Persistent object storage must be configured.
3. Either SMTP must be configured to satisfy current readiness expectations or the readiness contract must be revised to match actual launch scope.

## Recommended Next Actions

1. Decide the launch scope explicitly: core platform only, or core platform plus alerts, push, ERP, and security-officer workflows.
2. Standardize the database rollout runbook around the actual MongoDB strategy and rehearse it on staging.
3. Update `README.md` so architecture, deployment, and env guidance all match the live stack.
4. Align `/health/readiness` required checks with the actual launch contract, or provision every dependency it currently marks required.
5. Implement or formally de-scope email, SMS, push, and ERP integrations before production sign-off.
6. Add backend `SECURITY_OFFICER` role support if that persona is required at launch.
7. Add centralized logging, alerting, and final domain / TLS configuration before customer-facing go-live.

## Final Recommendation

MaintainPro is close to a staged production rollout for its core authenticated multi-tenant workflows, but it is not yet ready for a full production promise across notifications, ERP, and security-officer scope.

Recommended release posture: proceed only after the blocker list is either resolved or formally removed from launch scope, then rerun smoke tests and role-based UAT against the final hosted environment.
