# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This git repo's root contains deployment glue (root `Dockerfile`, `vercel.json`, `wrangler.jsonc`, `render.yaml`, `.github/workflows/docker-image.yml`) that all point into the actual application, which lives entirely under `maintainpro/`. **Almost all work happens inside `maintainpro/`.** Run all commands below from `maintainpro/` unless otherwise noted.

```text
maintainpro/
├── apps/
│   ├── api/      # NestJS backend (TypeScript)
│   ├── web/      # Next.js App Router dashboard
│   └── mobile/   # Flutter app
├── packages/
│   ├── shared-types/   # types shared between api and web
│   └── ui-components/  # shared React components
├── prisma/schema.prisma  # single Prisma schema (MongoDB) for the whole platform
├── docker-compose.yml / docker-compose.dev.yml
└── .github/workflows/    # ci.yml, docker-build-check.yml, develop-staging-deploy.yml
```

## Commands (run from `maintainpro/`)

Setup:

```bash
cp .env.example .env
npm install
npm run db:generate     # generate Prisma client (required before building/running api)
```

Dev servers:

```bash
npm run dev          # api (port 3000) + web (port 3001), concurrently
npm run dev:api
npm run dev:web
```

Validation (run before opening a PR):

```bash
npm run typecheck     # tsc --noEmit for api and web
npm run lint          # alias of typecheck for both workspaces
npm run test          # jest for @maintainpro/api only
npm run build         # shared-types -> ui-components -> api -> web
```

Single backend test (jest config restricts test files to `apps/api/test/*.spec.ts`):

```bash
cd apps/api
npx jest --config ./jest.config.cjs test/work-orders.spec.ts
npx jest --config ./jest.config.cjs -t "some test name"
```

Web e2e (Playwright, in `apps/web/e2e`):

```bash
npm run test:e2e --workspace @maintainpro/web
```

Database:

```bash
npm run db:push                       # push prisma/schema.prisma to MongoDB
npm run db:seed                       # requires MAINTAINPRO_SEED_PASSWORD
npm run db:backup:resync -- --dry-run # dry run primary -> backup resync
npm run db:backup:resync              # apply resync
npm run db:backup:verify              # verify backup counts/checksums/outbox lag
```

`db:migrate` is a compatibility alias for `db:push` — Prisma MongoDB has no SQL migration files; folders under `prisma/migrations/` are legacy and not the rollout path.

Docker:

```bash
npm run docker:up:dev    # dev stack
npm run docker:up        # production-like stack: nginx, api, web, mongo, redis, minio
```

## Architecture

### Backend (`apps/api`, NestJS)

- **Modular monolith**: every domain (assets, vehicles, fleet, drivers, maintenance, work-orders, inventory, suppliers, fuel, trips, utilities, notifications, reports, predictive-ai, billing, farm/*, cleaning, compliance, accidents, insurance-claims, traffic-fines, etc.) is its own module under `src/modules/`, registered in `src/app.module.ts`. New domain features should follow the existing `*.module.ts` / `*.controller.ts` / `*.service.ts` pattern within a module directory.
- **Single Prisma schema** at `prisma/schema.prisma` (MongoDB provider) shared by the whole API — `Tenant` is the root model and most domain models hang off `tenantId`.
- **Multi-tenancy**: `TenantContextMiddleware` reads `X-Tenant-Id` and populates `req.tenantContext`; `TenantContextGuard` (in `modules/tenancy`) enforces it. Order of global guards in `app.module.ts` matters: `JwtAuthGuard` → `TenantContextGuard` → `RolesGuard` → `PermissionsGuard`.
- **Auth/RBAC**: JWT-based (`@nestjs/passport` + `passport-jwt`). Controllers are decorated with `@UseGuards(JwtAuthGuard)`, `@Roles(...)` (checked by `RolesGuard`), and optionally `@Permissions(...)` (checked by `PermissionsGuard`, which falls back to a DB lookup of the user's role permissions when the JWT doesn't carry them — see `COMPATIBLE_PERMISSION_ALIASES` in `permissions.guard.ts` for legacy permission name mapping). Roles: `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `TECHNICIAN`, `SECURITY_OFFICER`, `DRIVER`, `VIEWER` (plus some legacy role names like `ASSET_MANAGER`/`MECHANIC` still referenced in places).
- **Response envelope**: controllers return `{ data, message }` (or with `meta` for pagination); `ResponseInterceptor` wraps this into `{ success, data, message, meta }`. `HttpExceptionFilter` standardizes error responses. Both are registered globally in `main.ts`.
- **Dual-database replication**: primary MongoDB Atlas (`nelna`, via `PRIMARY_DATABASE_URL`/`DATABASE_URL`) plus a local backup MongoDB (`bileeta_db`, via `BACKUP_DATABASE_URL`). Writes go through a `ReplicationOutbox`; `ReplicationSyncService` (in `src/database/`) drains it to the backup according to `DATABASE_REPLICATION_MODE` (`async_outbox` default, or `strict_dual_write`/`disabled`). See `DATABASE_MIGRATION_TO_MONGODB.md` and `DUAL_DATABASE_REPLICATION.md` for the full runbook.
- **Background jobs**: Bull queues backed by Redis (`REDIS_URL`); if Redis is unreachable, `main.ts` deliberately swallows `ECONNREFUSED`/ioredis errors so the API still boots — queue-dependent code must degrade gracefully.
- **External integrations are env-gated and optional** — see `env.validation.ts` and the README's "Optional backend integrations" section: SMTP/SMS notifications, ERP sync (mock provider blocked in prod unless explicitly allowed), push providers, RapidAPI-based QR/Street View/copilot, Cloudinary, MinIO. Code touching these must handle the disabled/no-op case.
- Health endpoints (`/health`, `/health/readiness`, `/`) are mounted directly on the underlying Express instance in `main.ts`, bypassing the `/api` global prefix.

### Frontend (`apps/web`, Next.js App Router)

- Routes live under `app/`, grouped by `(auth)` (login/register/forgot-password) and `(dashboard)` (one directory per domain module, mirroring the API modules — assets, vehicles, fleet, work-orders, inventory, maintenance, reports, etc., plus an `(fms)` sub-group).
- API access goes through `lib/api-client.ts` (axios instance, base URL from `lib/api-url.ts`, auth token from `lib/auth-storage.ts`, active tenant from `lib/tenant-context.ts`, sent as `X-Tenant-Id`). `getApiErrorMessage()` in the same file normalizes axios errors (network, timeout, `DATABASE_UNAVAILABLE`) into user-facing messages — reuse it rather than re-deriving error strings.
- Domain-specific API helper modules also exist (`audit-api.ts`, `driver-intelligence-api.ts`, `farm-api.ts`, `phase4-api.ts`) following the same axios-client pattern.
- Shared UI primitives come from `@maintainpro/ui-components` and local `components/` (organized by domain: `work-orders/`, `inventory/`, `maintenance/`, `farm/`, etc., plus generic `ui/`, `forms/`, `tables/`, `layout/`, `charts/`).
- Two deployment targets for the same Next.js app: Vercel (`npm run vercel:build`) and Cloudflare Workers via OpenNext (`npm run cloudflare:build` / `cloudflare:deploy`, config in `wrangler.jsonc`).

### Mobile (`apps/mobile`, Flutter + Riverpod)

- Feature-organized under `lib/features/<domain>` (assets, fleet, work_orders, inventory, maintenance, farm, cleaning, etc.), with shared networking/storage/offline-queue code under `lib/core/` (`network`, `storage`, `offline`).
- Uses Dio for HTTP and Hive for an offline write queue — offline-first patterns matter here; check `lib/core/offline` before adding new mutating API calls.

### Shared packages

- `packages/shared-types`: TypeScript types shared between `api` and `web`. Build it first (`npm run build` does this automatically) when its types change, since `web` and `api` consume the built output.
- `packages/ui-components`: shared React components for `apps/web`.

## Environment configuration

Validated centrally in `apps/api/src/config/env.validation.ts` (Joi schema) — any new env var consumed by the API must be added there or `ConfigModule` validation will fail at boot. `normalizeDatabaseEnvironment()` in `src/config/database-url-options.ts` runs before `ConfigModule` to reconcile equivalent deployment variable names (e.g. Render vs local).

Critical vars for local dev: `PRIMARY_DATABASE_URL`/`DATABASE_URL`, `BACKUP_DATABASE_URL`, `JWT_SECRET` (or `JWT_ACCESS_SECRET`+`JWT_REFRESH_SECRET`), `CORS_ORIGIN`, `FRONTEND_URL`. See `.env.example` for the full reference and the README's environment section for what each optional integration unlocks.
## Working agreement

- Act as a senior full-stack engineer: prioritize business value, UX, maintainability, and deployment readiness over tutorial-style code. This is a real platform for company use.
- Inspect relevant files before changing them. For large/multi-file changes, sketch a short plan first.
- Don't delete existing business logic without explaining why. Don't make unrelated UI changes unless they clearly improve usability. Keep changes focused and production-safe.
- Keep API logic, UI logic, validation, and database logic cleanly separated; follow existing structure and naming conventions; prefer reusable components over new one-offs.
- No hardcoded credentials, no localhost-only values in production config, no exposed secrets — use env vars (and add new ones to `env.validation.ts`, see above).
- UI must be responsive (mobile/tablet/desktop) with proper loading, empty, error, and success states, and consistent spacing/typography/colors/component behavior. Think in terms of the real user's workflow.
- Before calling a task complete: run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` as relevant to the change; check for TS/JS and console errors; check responsive layout for UI changes; check security-sensitive code; and call out any remaining risks or manual checks.
- When summarizing work, state which files changed and why. Keep explanations concise and practical.
