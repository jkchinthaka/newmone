# Mobile V2 — Assets / PM / Machinery / Job Codes / Service

## Source contracts

| Surface | Nest | Notes |
|---------|------|--------|
| Assets | `GET/PATCH /api/assets` | Role-gated (`ADMIN`, `MANAGER`, `ASSET_MANAGER`, `SUPERVISOR`, `MECHANIC`, `VIEWER`, …). **Not** `TECHNICIAN`. |
| PM schedules | `GET /api/maintenance/schedules` | Roles: `ADMIN`, `ASSET_MANAGER`, `MECHANIC` (+ SUPER_ADMIN). No pagination. |
| Job codes | `GET /api/job-codes` | Includes `TECHNICIAN`. Read-only on mobile V2. |
| Machinery | **No `/api/machinery`** | Use `Asset.category = MACHINE`. Legacy web FMS `/machinery` is mock-only. |
| Service FMS | **No Nest service-job API** | Use `Asset.nextServiceDate` + PM schedules. Legacy `/service` is mock-only. |

## Offline policy

- **Cache OK (future):** asset list/detail, PM summary, job codes (read).
- **Online required:** status changes, PM completion, assignment, deletes, WO creation from PM.
- Phone clock is **not** authoritative for due state; Nest fields drive overdue/due-soon chips.

## Concurrency / idempotency gaps

- Asset status PATCH / PM schedule mutations: **no Idempotency-Key** documented on Nest; mobile does not mutate PM/service completion in V2 yet.
- Document before claiming production-grade mutation flows.

## Flutter routes

- `/assets` hub
- `/assets/list`, `?category=MACHINE`, `?serviceFocus=1`
- `/assets/pm`
- `/assets/job-codes`
- `/assets/:id`
- Scan manual lookup falls through to `GET /assets/validate-tag`

## Parity (initial)

| Row | Status |
|-----|--------|
| Asset list/search/filter | DONE |
| Asset detail + history | DONE (history best-effort) |
| Machinery = MACHINE filter | DONE |
| Service due focus | DONE (client filter on page) |
| PM schedules read | DONE |
| Job codes browse | DONE |
| WO integration | PARTIAL (deep-link to WO list; no assetId query yet) |
| Scan → asset | DONE (validate-tag) |
| RBAC UX aligned to Nest roles | DONE |
| Tenant isolation | Nest JWT + X-Tenant-Id (existing) |
| Offline mutations | Documented blocked |
