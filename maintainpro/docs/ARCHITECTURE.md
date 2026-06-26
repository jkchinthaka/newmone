# MaintainPro Architecture

## Product positioning

MaintainPro is a **multi-tenant enterprise operations platform** for maintenance, fleet, inventory, compliance, facilities, and reporting — not a generic CRUD demo.

## High-level topology

```text
┌─────────────┐     ┌─────────────┐
│  Next.js    │     │  Flutter    │
│  Web App    │     │  Mobile     │
└──────┬──────┘     └──────┬──────┘
       │    HTTPS / WSS    │
       └────────┬──────────┘
                ▼
       ┌─────────────────┐
       │   NestJS API    │
       │  (modular       │
       │   monolith)     │
       └───┬───┬───┬─────┘
           │   │   │
     MongoDB  Redis  External
     (Atlas)  Bull   (SMTP, SMS,
     + backup       ERP, storage)
```

## Backend structure (`apps/api`)

- **Entry:** `src/main.ts` — Helmet, CORS, global prefix `/api`, health mounts, Swagger guard
- **Module pattern:** `src/modules/<domain>/*.module.ts` — controller, service, DTOs
- **Database:** Single Prisma schema at `prisma/schema.prisma` (MongoDB)
- **Tenancy:** `TenantContextMiddleware` + `TenantContextGuard`; most models carry `tenantId`
- **Auth:** JWT (Bearer + cookie), refresh rotation, CSRF on cookie refresh
- **Guards (order):** JwtAuthGuard → TenantContextGuard → RolesGuard → PermissionsGuard
- **Response envelope:** `{ success, data, message, meta }` via global interceptor
- **Audit:** Prisma middleware + explicit `recordAudit` on sensitive domain actions
- **Jobs:** Bull queues (notifications, replication drain); degrades if Redis unavailable
- **Realtime:** Socket.IO gateways (fleet, notifications)

## Domain modules (representative)

| Module | Responsibility |
|--------|----------------|
| auth, users, roles, invitations | Identity and access |
| tenants | Tenant context and switching |
| assets, vehicles, fleet, drivers, trips | Asset/fleet register |
| work-orders, maintenance | Job execution lifecycle |
| inventory, suppliers, procurement | Parts and purchasing |
| utilities, fuel, billing | Operational cost surfaces |
| compliance, accidents, traffic-fines, insurance-claims | Compliance workflows |
| cleaning, facilities, farm | Facility and vertical modules |
| notifications | Email/SMS/push dispatch (queued) |
| inventory (ERP) | Bileeta read-only stock sync adapter |
| audit, reports, predictive-ai | Visibility and analytics |
| health, queues | Observability |

## Frontend structure (`apps/web`)

- **App Router** under `app/(auth)` and `app/(dashboard)`
- **API client:** `lib/api-client.ts` — axios, tenant header, refresh interceptor
- **Auth storage:** `lib/auth-storage.ts` — access token + user profile in localStorage; refresh in HttpOnly cookie
- **Navigation:** `lib/navigation.ts` — role-filtered sidebar and command palette
- **Dashboards:** `components/dashboard/role-dashboard.tsx` — role-specific KPI sections from live APIs
- **Admin:** `/admin/*` — read-only admin console (users, tenants, roles, invitations)
- **System health:** `/system-health` — readiness dependency matrix

## Mobile structure (`apps/mobile`)

- Feature folders under `lib/features/<domain>`
- Core networking: Dio, Hive offline queue
- Role-aware briefing and field workflows

## Multi-tenancy model

- `Tenant` is root entity; users belong to tenants via memberships
- API requests carry `X-Tenant-Id`; guard validates membership
- Queries scoped by `tenantId` in services

## Dual-database replication

- Primary: MongoDB Atlas (`PRIMARY_DATABASE_URL`)
- Backup: local/secondary MongoDB (`BACKUP_DATABASE_URL`)
- Mode: `async_outbox` (default) via `ReplicationOutbox`
- See `DUAL_DATABASE_REPLICATION.md`

## Integration architecture

| Integration | Interface | Default |
|-------------|-----------|---------|
| Email | `EmailDispatchService` + Nodemailer | disabled |
| SMS | `SmsDispatchService` + HTTP | disabled |
| Push | `PushDispatchService` + provider adapter | disabled / noop |
| ERP | `InventoryErpAdapter` + Bileeta HTTP | mock |
| Storage | Cloudinary / MinIO | env-gated |

Production boot validates modes and blocks mock providers unless explicitly overridden.

## Security architecture

- Passwords: bcrypt
- JWT: separate access/refresh secrets, configurable TTL
- CSRF: double-submit cookie for refresh/logout
- Rate limiting: Throttler on auth endpoints
- Swagger: disabled in production unless basic-auth enabled
- Web CSP/HSTS: `apps/web/next.config.mjs`

## Testing strategy

- API: Jest unit/integration under `apps/api/test/*.spec.ts`
- Web: Playwright under `apps/web/e2e/`
- Deploy: `scripts/smoke-deployment.mjs`, `scripts/smoke-local.mjs`

## Deployment targets

| Tier | Platform | Config |
|------|----------|--------|
| API | Render | `render.yaml` |
| Web | Cloudflare Workers (OpenNext) | `wrangler.jsonc` |
| Alt web | Vercel | `vercel.json` |
| Local | Docker Compose | `docker-compose.yml` |

See [DEPLOYMENT.md](DEPLOYMENT.md).
