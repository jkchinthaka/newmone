# MaintainPro V1 — Gate 1 Re-Validation (2026-09-16)

**Supersedes (for the items below only):** `V1_FINAL_VALIDATION_GATE_STATUS.md` (2026-09-15, Gate 1 FAIL)
**Branch:** `maintainpro/phase-15-sqlserver-migration`
**What changed since 2026-09-15:** this session had a reachable native SQL Server instance
(`localhost:1433`, `MaintainProDev`) and Redis (`redis://127.0.0.1:6380`) for the first time —
prior Phase 15 sessions could only validate schema/typecheck, not live behavior (see
`PHASE_15_SQLSERVER_MIGRATION.md` "Local apply status").

This document only re-states the specific Gate 1 blockers from 2026-09-15 that were
reproduced and fixed this session. It does **not** re-run or supersede the parts of Gate 1
that were never executed (full canonical-role UAT, browser/PWA UAT, staging reconciliation,
Bileeta/ERP live, production cutover). Gate 1 is **still not a full PASS** — see "Still not
executed" below.

## Blockers from 2026-09-15, re-verified

| # | 2026-09-15 finding | Root cause found this session | Fix | Verified |
|---|---|---|---|---|
| 1 | G1-API-04: `TENANT_ACCESS_DENIED` on all domain routes even with `X-Tenant-Id` sent | `RequestContextMiddleware` populated the AsyncLocalStorage request context (actorId/role/tenantId) as Express **middleware**, which NestJS always runs *before* guards — so `request.user` (set by `JwtAuthGuard`) and the guard-resolved tenant (set by `TenantContextGuard`) did not exist yet when the context was captured. Any service reading `requestContext.getTenantId()` (vehicles, fleet, notifications, trips, cleaning) saw `tenantId: null` and failed closed with "Tenant context is required," even for a fully authenticated single-tenant session. | Replaced the middleware with `RequestContextInterceptor` (`apps/api/src/common/context/request-context.interceptor.ts`), registered as a global `APP_INTERCEPTOR` — interceptors run after guards, so `request.user`/`request.tenantId` are fully resolved by the time the context is captured. | Live: login → `GET /api/vehicles`, `/api/assets`, `/api/work-orders`, `/api/notifications` **without** `X-Tenant-Id` all return 200 for the seeded ADMIN user. Regression: `apps/api/test/request-context-interceptor.spec.ts` (new) + full existing tenant-isolation suite (`vehicles-`, `fleet-`, `notifications-`, `trips-tenant-isolation.spec.ts`, `cross-tenant-isolation.spec.ts`) — 22/22 pass. |
| 2 | Known issue: `Vehicle.assetId`/`Vehicle.vin` nullable `@unique` — SQL Server allows only one NULL per plain UNIQUE constraint | Confirmed: the checked-in init migration created these as plain `UNIQUE NONCLUSTERED` constraints. A prior manual SSMS-style fix had already patched the *live* `MaintainProDev` database to filtered indexes, but that fix was never captured in a migration file, so a fresh database install would still hit it. | New migration `prisma/migrations/20260916120000_sqlserver_filtered_unique_indexes_and_bounds/migration.sql` drops the plain constraints and recreates them as `CREATE UNIQUE NONCLUSTERED INDEX ... WHERE [col] IS NOT NULL`. Written defensively (`IF EXISTS` branching on `sys.key_constraints` vs `sys.indexes`) so it succeeds against both a genuinely fresh database *and* this already-hand-patched one. | Live, on a **brand-new** disposable database (`MaintainProValidation`, created and dropped this session): `prisma migrate deploy` (both migrations) → `npm run db:seed` twice → 5 seeded vehicles, all with `assetId = NULL`, no constraint violation. Confirmed via `sys.indexes` query that `filter_definition` is `([assetId] IS NOT NULL)` / `([vin] IS NOT NULL)` post-migration. |
| 3 | Known issue: `Vehicle.vin`/`registrationNo` unbounded `NVARCHAR(1000)` risking the SQL Server 1700-byte nonclustered index key limit (warning already seen on `Vehicle_vin_key`) | Confirmed via `sys.columns`: both were 2000 bytes (`NVARCHAR(1000)`), i.e. exactly at 2x the documented limit. | Same migration narrows `registrationNo`/`assetTag` to `NVARCHAR(64)` and `vin` to `NVARCHAR(32)` (VINs are 17 chars under ISO 3779). | Live: existing seeded data's max lengths (18/17 chars) fit comfortably; `ALTER COLUMN` succeeded with no data loss. |
| 4 | "Login on SQL works; tenant-scoped APIs denied" | Same root cause as #1 — login itself was never broken. | (see #1) | (see #1) |
| — | *Not in the 2026-09-15 doc, found this session while reproducing the above* — `GET /api/assets` with no `sortBy` query param returned 503 `DATABASE_UNAVAILABLE` | `AssetsService.buildOrderBy()` always appended `{ updatedAt: "desc" }` as a tiebreaker; when the caller's `sortBy` also defaulted to `updatedAt`, Prisma emitted `ORDER BY [updatedAt] DESC, [updatedAt] DESC`, which SQL Server rejects (error 169, "column specified more than once in the order by list"). Mongo silently tolerated the duplicate. | `buildOrderBy` now only appends the `updatedAt` tiebreaker when it isn't already the primary sort key. | Live: `GET /api/assets` with no query params returns 200. |
| — | *Not in the 2026-09-15 doc* — `POST /api/assets` returned 503 once the ORDER BY bug above was fixed | `Asset.qrCodeUrl` (and the same field on `CleaningLocation`/`LivestockAnimal`/`FarmWorker`/`TraceabilityRecord`) was `NVARCHAR(1000)` but stores a base64 PNG data-URI (`QrCodeService.toDataUrl()`), routinely 3–5 KB — "The provided value for the column is too long for the column's type." | Same migration widens all five `qrCodeUrl` columns to `NVARCHAR(MAX)` (none are indexed, so no key-size concern). | Live: created an asset, confirmed `qrCodeUrl` stored at 5134 characters. |
| — | *Not in the 2026-09-15 doc* — same JSON-as-text class of bug found in `Asset.documents`/`images`, `Vehicle.customFields`/`images`, `SparePart.images`, and 4 bulk-import adapters (`documents: []` / `images: []` / raw-object `customFields` passed straight into a `String` Prisma field) | Same root pattern already partially fixed for `asset-taxonomy` before this session (per `PROJECT PROMPT`): Mongo-era code assigning a native array/object to a field that is now SQL Server `String @db.NVarChar(Max)` JSON text. | All sites now use `JSON.stringify` / the existing `toStringArray`/`parseJsonText`/`stringArrayToText` helpers (`apps/api/src/common/utils/json-text.ts`) at the Prisma read/write boundary. | Live: asset create/read with documents, vehicle create with `vin=null` twice in a row, sparePart create, all bulk-import adapter creates — all succeed; typecheck + full Jest suite green. |

## BFF login 500 (separate item from the above)

`POST http://localhost:3001/api/backend/auth/login` → `500 UPSTREAM_CONFIG`

Root cause: the Next.js BFF proxy (`apps/web/lib/bff-upstream-url.ts`) requires a **server-only**
`API_INTERNAL_URL` env var to know where to forward requests. `apps/web/.env.local` set the
`NEXT_PUBLIC_API_*` client vars but never set `API_INTERNAL_URL`, so every `/api/backend/*`
call (BFF mode is the local default — `NEXT_PUBLIC_USE_BFF` unset) failed closed with a clean,
non-crashing 500 before ever reaching the NestJS API.

Fix: added `API_INTERNAL_URL=http://localhost:3000/api` to `apps/web/.env.local`, and documented
the requirement in `apps/web/.env.example` and `.env.local.example` (which were also updated —
the latter was still MongoDB-era and conflicted with the now-canonical SQL Server `.env.example`).

Verified live: `POST /api/backend/auth/login` → 200 with `maintainpro_access` /
`maintainpro_refresh` / `maintainpro_csrf` cookies set → `GET /api/backend/auth/me` → 200 →
`GET /api/backend/vehicles` → 200 → `POST /api/backend/auth/logout` (with CSRF header) → 200.

**Note for whoever reviews `apps/web/lib/api-url.ts`:** `upstreamApiBaseUrl` defaults to
`https://newmone.onrender.com/api` when `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_API_BASE_URL` are
unset. This is only reachable when `NEXT_PUBLIC_USE_BFF=false` (the BFF path never uses it),
and this repo's local `.env.local` already sets both vars to `localhost:3000`, so no production
traffic was sent during this session. Flagging it because a clean clone without a `.env.local`
would silently point at production — see "Known remaining issues" in the engineering report.

## Still not executed (honest carry-over from 2026-09-15)

- Full canonical 11-role UAT matrix (fixture only has ADMIN/TECHNICIAN/DRIVER-class seeded users)
- Browser/PWA UAT per `docs/UAT_RUNBOOK.md` (this session validated the BFF over HTTP with curl,
  not a real browser session)
- Full staging Mongo→SQL reconciliation beyond the CMMS-core fixture
- Bileeta ERP live validation (still mock)
- Redis queue health under load
- Production cutover — not attempted, not authorized in this session

**Gate 1 verdict:** the specific blockers recorded 2026-09-15 are fixed and re-verified against
both the existing dev database and a fresh disposable database. Gate 1 as a whole (full UAT
sign-off) is still **NOT READY** — see above.
