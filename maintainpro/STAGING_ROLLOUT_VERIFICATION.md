# Staging Rollout Verification

## Scope

This pass was limited to final MongoDB rollout execution and verification in the intended dev/staging target environment. A follow-up Redis readiness closure was completed on 2026-05-26. No new business features were started or added.

All database credentials were supplied through local environment variables or process-only environment values. No MongoDB credentials, SMTP keys, SMS keys, ERP keys, push keys, or committed environment files were added to source control.

## Target Environment

Verified active target configuration before rollout:

- `MONGODB_URI`: set locally, using `mongodb+srv`, credentials masked during verification.
- MongoDB host: `nelna.o6tqdh4.mongodb.net`.
- MongoDB database: `nelna`.
- `DATABASE_URL`: set locally for compatibility and points to the same MongoDB target.
- `DATABASE_PROVIDER`: not committed; supplied as process-only `mongodb` during rollout commands.
- `MONGO_DATABASE_NAME`: not committed; supplied as process-only `nelna` during rollout commands.
- `NODE_ENV`: `development`.
- SMTP, SMS, ERP, and push provider flags were not hardcoded. Rollout smoke used process-only disabled or safe fallback values.

## Rollout Execution

Executed against the confirmed dev/staging MongoDB target:

- Confirmed active environment values with secrets masked.
- Ran a read-only Prisma connectivity probe before making schema or seed changes.
- Ran `npm run db:push` and found a real MongoDB index rollout blocker.
- Resolved the blocker by replacing nullable unique MongoDB relation indexes on `WorkOrder.accidentId` and `WorkOrder.trafficFineId` with normal indexes, then adapting the inverse Prisma relations to collection relations while preserving the existing API response shape.
- Ran `npm run db:generate` successfully.
- Ran `npx prisma validate --schema ./prisma/schema.prisma` successfully.
- Re-ran `npm run db:push` successfully.
- Ran `npm run db:seed` successfully. Seed output completed and built-in baseline verification passed.

### Resolved Rollout Blocker

Initial `db:push` failed while creating the MongoDB unique index for `WorkOrder.accidentId` because existing documents had multiple `null` values. MongoDB unique indexes treat repeated `null` values as duplicates unless the index strategy explicitly avoids that case.

Resolution:

- Removed nullable `@unique` constraints from `WorkOrder.accidentId` and `WorkOrder.trafficFineId`.
- Added normal indexes for both fields.
- Updated inverse relations from singular `workOrder` fields to `workOrders` arrays for accident reports and traffic fines.
- Kept accident and traffic-fine API responses compatible by mapping the first related work order back to the existing singular `workOrder` response field.

## Runtime Database Verification

Read-only post-seed verification passed:

- Tenants: 4.
- Users: 52.
- Settings rows: 11.
- Required roles exist.
- `SUPER_ADMIN` users: 5.
- `SUPER_ADMIN` role rows: 7.
- `SECURITY_OFFICER` role rows: 1.
- `SECURITY_OFFICER` permissions present: `dashboard.view`, `vehicles.view`, `gate.out.create`, `gate.in.create`, `operations.scan_lookup`, `predictive_insights.view`.
- `SECURITY_OFFICER` restricted permissions absent: `purchase_orders.approve_finance`, `settings.system.manage`, `roles.manage`.
- Required PBAC permissions are present.
- System configuration rows: 2.
- Vehicle gate policy rows: 2.
- Notification preference setting exists.
- Queryable collections verified: `Vehicle`, `WorkOrder`, `Notification`, `PurchaseOrder`, and `AppSetting`.

Collection counts observed during verification:

- Vehicles: 275.
- Work orders: 23.
- Notifications: 4.
- Purchase orders: 0.
- App settings: 11.

## Smoke Test Results

API smoke tests were run against the local API server connected to the verified MongoDB target. All workflow checks passed:

- API health: passed, database operational.
- API readiness endpoint: passed with readiness status `operational` after Redis was started and the queue configuration was corrected.
- Admin login: passed.
- Vehicle list: passed.
- Vehicle profile: passed.
- Gate out: passed.
- Gate in: passed.
- Maintenance work-order endpoint: passed.
- Inventory purchase-order endpoint: passed.
- Compliance summary endpoint: passed.
- Driver intelligence dashboard endpoint: passed.
- Security Officer login: passed.
- Security Officer scan lookup: passed.
- Security Officer finance approval denial: passed with expected `403`.

## Provider Readiness

Provider readiness observed through `/health/readiness`:

- SMTP: `unconfigured`, optional, disabled by current process settings.
- SMS: `unconfigured`, optional, disabled by current process settings.
- ERP: `unconfigured`, optional, using mock ERP mode in non-production.
- Push: `unconfigured`, optional, using noop fallback.
- Redis: `operational`, required. `/health/readiness` and `/api/health/readiness` both report Redis as accepting queue commands.

Redis URL coverage verified during closure:

- Local/native API: `redis://127.0.0.1:6379`.
- Docker/Compose API container: `redis://redis:6379`.
- Docker Compose dev host access: Redis service port `6380` maps to container port `6379` for host-side tools.

ERP production guard remains active: mock ERP mode is blocked in production unless explicitly allowed by environment configuration.

## Validation Evidence

Post-rollout validation passed:

- `npm run typecheck --workspace @maintainpro/api`.
- `npm run typecheck --workspace @maintainpro/web`.
- `npm run test --workspace @maintainpro/api`: 18 suites passed, 93 tests passed.
- `npm run build`.
- `docker compose -f docker-compose.dev.yml config --quiet` with placeholder-only MongoDB env values.
- `docker compose -f docker-compose.yml config --quiet` with placeholder-only MongoDB env values.

Redis readiness closure validation passed:

- Started Redis in the local/staging environment and confirmed `ioredis` ping returned `PONG`.
- Restarted the API and confirmed queue-dependent modules started without Redis/Bull bootstrap errors.
- `GET /health/readiness`: `operational`; Redis dependency `operational`, required, latency 5 ms.
- `GET /api/health/readiness`: `operational`; Redis dependency `operational`, required, latency 6 ms.
- `npm run typecheck --workspace @maintainpro/api`.
- `npm run test --workspace @maintainpro/api`: 18 suites passed, 93 tests passed.
- `npm run build --workspace @maintainpro/api`.

The first web typecheck invocation was interrupted by the shell and was rerun cleanly; the clean rerun passed.

## Redis Readiness Gate

The MongoDB rollout itself is verified and passed. The Redis readiness gate is now closed for the local/dev-staging runtime.

The required readiness dependencies now report operational: MongoDB / Prisma, Redis queues, and object storage.

## Final Assessment

MongoDB schema sync, seed, runtime database verification, core smoke workflows, provider readiness reporting, and post-rollout validation all passed for the intended dev/staging MongoDB target.

Final staging deployment status: ready for the verified local/dev-staging runtime. The MongoDB rollout is complete, Redis is provisioned and reachable, and `/health/readiness` returns without Redis degradation.
