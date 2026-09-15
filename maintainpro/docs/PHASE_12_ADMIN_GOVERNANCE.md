# Phase 12 — Admin Governance

**Branch:** `maintainpro/integration-v1`
**Baseline SHA:** `3694173d074f7255587910c1be29d3990279da6c`
**Historical reference:** `df16071` (REFERENCE ONLY — `_p12_extract/` removed after integration)

---

## Objective

Replace any remaining software-delivery-centric admin UX with operational Maintenance Administration governance. Introduce structured data quality, user deactivation safety, high-impact config protection, and an admin overview dashboard.

---

## Architecture

### `AdminGovernanceModule` (`src/modules/admin-governance/`)

New Nest module with:
- **`admin-catalog.ts`** — Data quality rule definitions (`DATA_QUALITY_RULES`) with `CRITICAL/HIGH/WARNING/INFO` severity levels, covering 14 rule codes across assets, fleet, ERP, workforce, compliance, approvals domains.
- **`admin-safety.ts`** — Pure helper functions: `evaluateUserDeactivation`, `evaluateHighImpactConfigChange`, `nextBulkImportStage`, `canWriteBulkRows`, `sanitizeSystemResponse`. No Prisma, fully testable in isolation.
- **`admin-governance.service.ts`** — Business logic: `previewDeactivate`, `guardConfigChange`, `dataQualityIssues`, `overview`, `systemInfo`.
- **`admin-governance.controller.ts`** — REST endpoints under `/admin-governance/*`.
- **`admin-governance.module.ts`** — Registered in `AppModule`.

### Endpoints

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/admin-governance/overview` | `admin.overview.view` | Actionable signal counts |
| GET | `/admin-governance/users/:id/deactivate-preview` | `admin.users.manage` | Pre-flight deactivation check |
| POST | `/admin-governance/config-change/guard` | `admin.system.view` | High-impact config guard |
| GET | `/admin-governance/data-quality` | `admin.dataquality.view` | Platform DQ issues |
| GET | `/admin-governance/system` | `admin.system.view` | Sanitized system info |

### User Deactivation Safety (`UsersService.applyProtectedUserStatusUpdate`)

Existing guards retained:
- Self-deactivate blocked (existing)
- Last SUPER_ADMIN globally protected (existing)

New guards via `evaluateUserDeactivation`:
- **Last tenant ADMIN protection**: counts active ADMIN+SUPER_ADMIN users in the tenant; blocks if ≤1
- **Technician open WO block**: queries `WorkOrder.technicianId` for OPEN/IN_PROGRESS/ON_HOLD/OVERDUE/REWORK_REQUIRED; blocks with list of WO ids

### Data Quality Service

Aggregates issues from:
1. `BusinessException` records with status OPEN/INVESTIGATING (grouped by ruleCode)
2. `Vehicle` records with `assetId = null` → `FLEET_NO_ASSET_LINK` (WARNING)
3. `SparePart` records with `isActive = true, erpCode = null` → `ERP_UNMAPPED_PARTS` (WARNING)

Returns structured `DataQualityIssue[]` with `{ code, severity, domain, entityType, message, suggestedAction?, count? }`.

### Admin Overview

`GET /admin-governance/overview` returns:
```json
{
  "users": { "active": N, "inactive": N, "total": N },
  "dataQuality": { "issuesBySeverity": { "CRITICAL": 0, "HIGH": 0, "WARNING": 3, "INFO": 0 }, "totalIssues": 3 },
  "pendingImports": 1,
  "rules": 14
}
```

---

## Permissions (Phase 12)

Six new permission keys in `permission-catalog.ts`:

| Key | Aliases |
|-----|---------|
| `admin.overview.view` | `settings.view`, `settings.manage`, `settings.organization.manage` |
| `admin.dataquality.view` | `settings.view`, `settings.manage`, `assets.manage` |
| `admin.audit.view` | `audit.view`, `settings.view` |
| `admin.system.view` | `settings.system.manage`, `settings.manage` |
| `admin.users.manage` | `users.manage`, `users.status.manage` |
| `admin.organization.manage` | `organization.manage`, `settings.organization.manage` |

---

## Frontend Changes

### `apps/web/lib/admin-console.ts` (surgical update)
- `data-quality` section: href changed from `/operations/exceptions` → `/admin/data-quality`
- `audit-log` section: href changed from `/settings` → `/admin/audit`; description updated

### `apps/web/lib/navigation.ts`
- Added `/admin/data-quality` and `/admin/audit` to `EXISTING_NAV_ROUTES`

### New pages
- `apps/web/app/(dashboard)/admin/data-quality/page.tsx` — DQ issues grouped by severity with cards
- `apps/web/app/(dashboard)/admin/audit/page.tsx` — Filterable audit log table

### Updated components
- `apps/web/components/admin/admin-console-page.tsx` — Fetches `GET /admin-governance/overview`, shows `OverviewCard` signal grid (active users, DQ issues, critical findings, pending imports)

### New API helper
- `apps/web/lib/admin-governance-api.ts` — `fetchAdminOverview`, `fetchDataQualityIssues`, `fetchDeactivatePreview`, `guardConfigChange`

---

## Secrets Safety

`sanitizeSystemResponse` strips `SENSITIVE_CONFIG_FIELDS` before any system endpoint returns a response. Fields redacted: `password`, `passwordHash`, `connectionString`, `databaseUrl`, `apiKey`, `apiSecret`, `secretKey`, `token`, `refreshToken`, `resetToken`, `smtpPassword`, `smsApiKey`, `jwtSecret`.

---

## Tests

**`apps/api/test/admin-governance-phase12.spec.ts`** — 37 test cases:
- `evaluateUserDeactivation`: 9 cases (self-lockout, last ADMIN, last SA, tech open WO, MECHANIC, MANAGER, reactivate, allow when other admins remain)
- `evaluateHighImpactConfigChange`: 5 cases (confirmation, preview, reason, allow, null reason)
- Bulk stage gating: 11 cases (all stage transitions + canWriteBulkRows)
- `DATA_QUALITY_RULES`: 7 assertions (count, severities, required codes)
- `sanitizeSystemResponse`: 2 cases (strips secrets, keeps safe fields)
- RBAC catalog: 6 per-key presence assertions
- Admin console section hrefs: 8 assertions
- `AdminGovernanceService` (mocked Prisma): 13 cases

**`apps/api/test/admin-console.spec.ts`** — Updated: asserts `/admin/data-quality` and `/admin/audit` hrefs.

---

## What Was NOT Changed

- `BulkImportRun` schema — no changes
- Prisma schema — no changes required
- Historical delivery/go-live/QA/billing cards — not added
- Existing admin nav items — kept unchanged (organization, asset-masters, approvals, people, users, roles, invitations, bulk-imports)
- `SystemHealthSummary` — moved off admin overview page (now only linked via Technical Admin card)

---

## Cleanup

`maintainpro/_p12_extract/` deleted after integration.
