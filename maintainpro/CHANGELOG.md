# Changelog

All notable changes to MaintainPro are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - Nelna Farm Operations SaaS Upgrade

A major feature release that turns MaintainPro into a multi-tenant farm
operations platform on top of the existing maintenance core.

### Added — Backend (NestJS / Prisma)
- Migrated Prisma datasource provider to **MongoDB** (`provider = "mongodb"`),
  with all model IDs converted to `String @db.ObjectId`, decimals replaced by
  `Float`, and explicit many-to-many links via `roleIds String[] @db.ObjectId`.
- 11 new farm modules under `apps/api/src/modules/farm/`:
  - `fields/` — field registry with GPS bounds.
  - `crops/` — crop cycles, growth stages, expected yield.
  - `livestock/` — animals, health logs, vaccination records.
  - `spray-logs/` — pesticide & fertilizer application tracking.
  - `harvest/` — harvest yields by crop and field.
  - `irrigation/` — irrigation schedules and run logs.
  - `soil-tests/` — pH, NPK, organic matter results.
  - `weather/` — weather logs + alert evaluation + OpenWeather poller.
  - `farm-workers/` — worker registry, attendance, payroll inputs.
  - `farm-finance/` — expense / income capture and summary.
  - `traceability/` — farm-to-market batch traceability.
- Tenant-scoped JWT auth and RBAC across all farm endpoints
  (roles: `FARM_OWNER`, `FARM_MANAGER`, `FIELD_SUPERVISOR`, `AGRONOMIST`,
  `VIEWER` in addition to existing maintenance roles).
- Lightweight in-process TTL cache (`farm-cache.service.ts`) wired into:
  - Weather list (TTL 1h) and weather alerts (TTL 30m).
  - Farm finance summary (TTL 5m).
  Writes invalidate the relevant cache prefix.
- Background OpenWeather poller (`setInterval`-based, 6h cadence) gracefully
  no-ops when `OPENWEATHER_API_KEY` is not configured.

### Added — Web (Next.js App Router)
- 13 farm pages under `apps/web/app/(dashboard)/farm/`:
  - `farm/` (hub with stat cards + 12 quick links).
  - `farm/fields/`, `farm/crops/`, `farm/spray-logs/`, `farm/harvest/`,
    `farm/irrigation/`, `farm/soil-tests/`, `farm/weather/`,
    `farm/livestock/animals/`, `farm/livestock/health/`,
    `farm/workers/`, `farm/workers/attendance/`,
    `farm/finance/`, `farm/traceability/`.
- Shared list-page primitive (`farm-list-page.tsx`) and `farm-api.ts` axios
  helper that auto-injects Bearer token + `X-Tenant-Id`.
- Sidebar navigation extended with a Farm group.
- Map preview for fields uses `react-leaflet` with `dynamic(..., { ssr: false })`
  to avoid SSR `window` errors.

### Added — Mobile (Flutter / Riverpod)
- New top-level **Farm** tab on the mobile dashboard for `superAdmin`,
  `admin`, `manager`, and `supervisor` roles.
- `FarmScreen` exposes 8 sub-tabs: Fields, Crops, Livestock, Health,
  Spray, Harvest, Irrigation, Attendance.
- Reusable `FarmListTab` widget with create-form supporting text, number,
  date, dateTime, and select inputs; uses `dioProvider` (auto Bearer token)
  and consumes the `{ data }` response envelope.

### Performance
- Confirmed 122 `@@index` declarations across the Prisma schema; all farm
  models indexed on `tenantId` plus their primary lookup fields
  (e.g., `fieldId`, `cropId`, `recordedAt`, `date`).

### Tooling / Ops
- Renovate config added at `.github/renovate.json` (weekly schedule).
- Workspace version bumped to `1.2.0` across:
  `package.json`, `apps/api/package.json`, `apps/web/package.json`,
  `packages/shared-types/package.json`, `packages/ui-components/package.json`,
  `apps/mobile/pubspec.yaml` (`1.2.0+2`).

### Notes
- Caching is in-process and tenant-scoped; for multi-replica deployments,
  replace `FarmCacheService` with a Redis-backed implementation.
- `@nestjs/schedule` is intentionally **not** installed; jobs use
  `setInterval` + `onModuleInit` / `onModuleDestroy` with `timer.unref()`.

## [1.0.0] - Initial release

- Maintenance work orders, assets, parts, vendors, predictive AI copilot,
  cleaning module, mobile app, and realtime Mongo sync dashboard.
