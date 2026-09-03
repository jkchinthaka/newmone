# MaintainPro Mobile V2 — Architecture

**Authoritative base:** `origin/main` @ `2fd697e004da8524b6348c1ad2d33411a873a2a8`  
**Branch:** `feature/mobile-v2`  
**App path:** `maintainpro/apps/mobile` (V2 under `lib/`; archived V1 in `lib_legacy_v1/`)

## Platform position

```
MaintainPro Platform
        |
+-------+--------+
|                |
Next.js Web   Flutter Mobile V2
|                |
+------ APIs ----+
        |
     NestJS API
        |
+---+---+---+
MongoDB Redis MinIO
        |
   FG Digital Records (Django + Next strangler + FG SSO)
```

No WebView shell. No separate production DB. Additive `/api/mobile/*` only when aggregation is required.

## Stack

| Concern | Choice |
|---|---|
| Flutter / Dart | Stable / SDK ≥3.4 |
| State | Riverpod |
| Navigation | go_router |
| HTTP | Dio |
| Secrets | flutter_secure_storage |
| Offline DB | Drift + SQLite |
| Connectivity | connectivity_plus |
| Realtime (foreground) | socket_io_client (`/notifications`, `/fleet`) |
| Push | FCM + flutter_local_notifications |
| Scan | mobile_scanner |
| Biometrics | local_auth (optional) |

## Package layout

```
lib/
  main.dart / app.dart
  design_system/     # tokens + components
  core/
    config/          # flavors: dev | uat | prod
    network/         # Dio, interceptors, ApiException
    auth/            # session, refresh single-flight, secure store
    tenant/          # X-Tenant-Id context
    rbac/            # nav policy, role home config
    database/        # Drift (outbox, drafts, cache)
    offline/         # outbox + sync controller
    router/          # adaptive shell routes
    i18n/            # English foundation (SI/TA ready)
  features/
    splash, auth, shell, home, tasks, scan, alerts, more,
    search, profile, settings, diagnostics, drafts, sync,
    work_orders/...
```

## Auth / session

Aligned to Nest `AuthController`:

- `POST /api/auth/login` → `{ accessToken, refreshToken, user }`
- `POST /api/auth/refresh` body `{ refreshToken }` (JSON; not cookie-first)
- `POST /api/auth/logout`
- Bearer JWT + `X-Tenant-Id`
- Refresh single-flight lock; 401 → refresh → retry once
- Shared-device: vault keyed by `tenantId` + `userId`; logout never silently wipes pending outbox

## Tenancy & RBAC

- Guard order (API): Jwt → TenantContext → Roles → Permissions
- Mobile mirrors web `navigation.ts` for **UI visibility only**
- Backend remains authoritative; revoked permissions force re-fetch `/auth/me` on resume

## Offline / outbox

States: `LOCAL_DRAFT` → `QUEUED` → `SYNCING` → `SYNCED` | `CONFLICT` | `FAILED_RETRYABLE` | `FAILED_PERMANENT`

Every local row: `tenantId`, `userId`, `operationId`, `idempotencyKey`, `payloadHash`, attempts, lastError.

Policy summary: drafts/photos offline-ok; critical WO status, gate, inventory stock, supervisor/QA, admin destructive = online-required initially.

## Server time

Device clock not authoritative. Business timezone Asia/Colombo unless backend config proves otherwise. FG `submittedAt` / `reviewedAt` / `verifiedAt` / `businessDate` are server-owned.

## Mobile BFF (proposed, additive)

Not implemented yet:

- `GET /api/mobile/bootstrap`
- `GET /api/mobile/action-center`
- `GET /api/mobile/dashboard`

Must call existing domain services only.

## FG path

Nest has FG **SSO only** (`/api/auth/fg-sso/exchange|verify`). Forms CL18/CL24/CL30 live in Django `systems/fg-digital-recording` + Next `/fg/*`. Mobile must not invent Nest FG CRUD.

## Flavors

| Flavor | Dart define | Network |
|---|---|---|
| dev | `APP_FLAVOR=dev` | configurable HTTP/HTTPS |
| uat | `APP_FLAVOR=uat` | HTTPS preferred |
| prod | `APP_FLAVOR=prod` | HTTPS required |

## Non-goals (this phase)

- Production deploy / DB mutation
- Full parity of every admin/report surface
- Permanent background Socket.IO
