# Bulk Import Architecture

Reusable master-data Bulk Upload / Bulk Import framework for MaintainPro.
V1 covers **Vehicles, Assets, Departments, Suppliers, and Job Codes**, gated
to **SUPER_ADMIN only**. See [`BULK_IMPORT_MATRIX.md`](./BULK_IMPORT_MATRIX.md)
for the full entity classification and [`BULK_IMPORT_RUNBOOK.md`](./BULK_IMPORT_RUNBOOK.md)
for the operator/SUPER_ADMIN how-to.

## Why a new framework

Before this change, MaintainPro had **three separate, non-reusable import
subsystems**, none of which covered master data:

1. **ERP Excel stock import** (`modules/inventory/erp-excel-import.service.ts`) — upload → validate → apply, backed by `InventoryImportRun`/`InventoryImportRow`. The most mature pattern; this framework generalizes its shape.
2. **Inventory Excel "yellow-highlight" import** (`modules/inventory/inventory-excel-import.service.ts`) — a second, differently-shaped staging model (`ErpImportBatch`/`ErpImportRow`).
3. **Generic ERP CSV import** (`modules/erp-integration`) — staging-only; explicitly does not mutate production master data; uses a hand-rolled, non-quote-safe CSV splitter.

None of these is exposed for Vehicles, Assets, Departments, Suppliers, or Job
Codes, and none is reused by the others. This framework consolidates the
proven parts of (1) into a generic, adapter-based engine and leaves (2) and
(3) untouched, since they are specialized, already-shipped workflows (see
"What this framework does **not** replace" below).

## Design decisions worth flagging

- **DB-backed sessions, not Redis.** The task brief suggested a Redis-backed
  import session. In this deployment, Redis is optional and not currently
  provisioned in production (`REDIS_URL` unset on Render,
  `REDIS_REQUIRED_IN_PRODUCTION=false`); the only real Redis consumer is the
  Bull notifications queue, and `QueueHealthService` is explicitly designed
  to degrade when Redis is absent. Both pre-existing "real" import
  subsystems above already persist 100% of staging state in MongoDB. This
  framework does the same: two new Prisma models, `BulkImportRun` and
  `BulkImportRow`, are the source of truth for preview/commit sessions, so
  the feature works correctly across multiple API replicas without a hard
  Redis dependency. **This is the one schema addition in this change** — see
  "Schema change" below.
- **DB-authoritative SUPER_ADMIN check.** `BulkImportAuthService.assertSuperAdmin(userId)`
  re-fetches the user's role fresh from the database on **every** preview
  and commit call — a JWT claiming SUPER_ADMIN is not sufficient. This
  mirrors `PermissionsGuard.loadDbUser()` (`common/guards/permissions.guard.ts`),
  the one existing place in the codebase that already does this, rather than
  the cheaper `requestContext.actorRole` shortcut used elsewhere. A `@Roles("SUPER_ADMIN")`
  decorator is also present on every route for defense-in-depth and to
  satisfy the repository's static RBAC audit (`npm run audit:rbac`) — it is
  a fast JWT-based pre-filter, not the authorization boundary.
- **`csv-parse` is actually used.** It was a declared dependency, unused
  everywhere in the API (the old `erp-integration` module hand-rolls a naive,
  non-quote-safe CSV split). `BulkImportParserService` uses `csv-parse/sync`
  for `.csv` and `exceljs` (already used elsewhere) for `.xlsx`.
- **Per-row processing, not one giant transaction.** Each row's create/update
  is a single atomic MongoDB document write. Commit processes rows in
  bounded batches (`BULK_IMPORT_COMMIT_BATCH_SIZE = 200`) and re-checks
  authoritative DB state per batch — this framework does **not** claim
  whole-file atomicity, which would be dishonest given MongoDB's
  document-level (not naive multi-row) write model. Multi-document
  `$transaction` is already proven safe elsewhere in this codebase
  (`inventory-transaction.engine.ts`) and remains available if a future
  adapter needs cross-collection consistency.

## What this framework does **not** replace

- **Inventory ERP Excel import** and the **yellow-highlight inventory
  import** remain their own specialized workflows — they mutate live stock
  quantities under a dedicated integrity engine (`InventoryTransactionEngine`)
  and must not be conflated with a generic master-data importer (per the
  task's explicit instruction: "Part master != stock adjustment").
- **Users/People bulk import is not implemented.** Bulk-creating accounts
  with passwords is explicitly unsafe per the task brief; see the matrix for
  the recommended follow-up (route through the existing Invitation
  lifecycle instead of direct `User` creation).

## Components

```
apps/api/src/modules/bulk-import/
├── bulk-import.module.ts
├── bulk-import.controller.ts        # HTTP routes, @Roles("SUPER_ADMIN") + DB-authoritative re-check
├── bulk-import.service.ts           # preview() / commit() orchestration
├── bulk-import-auth.service.ts      # DB-authoritative SUPER_ADMIN check
├── bulk-import-parser.service.ts    # .csv (csv-parse) / .xlsx (exceljs), bounded limits
├── bulk-import-adapter.ts           # BulkImportAdapter interface
├── bulk-import-adapter-registry.service.ts  # entity slug -> adapter, 404s on unknown entities
├── bulk-import.constants.ts         # entity allow-list, file/row/column limits
├── util/bulk-import-normalize.util.ts  # deterministic date/number/enum parsing helpers
└── adapters/
    ├── vehicle.adapter.ts       # natural key: registrationNo (globally unique)
    ├── asset.adapter.ts         # natural key: assetTag (globally unique)
    ├── department.adapter.ts    # natural key: (tenantId, code)
    ├── supplier.adapter.ts      # natural key: (tenantId, vendorCode)
    └── job-code.adapter.ts      # natural key: (tenantId, code)
```

Frontend:

```
apps/web/lib/bulk-import-api.ts                       # typed API client
apps/web/components/bulk-import/
├── bulk-import-button.tsx    # SUPER_ADMIN-gated entry point (UX only)
└── bulk-import-wizard.tsx    # select file -> preview -> confirm -> result
apps/web/components/admin/admin-bulk-imports-page.tsx  # Admin -> Bulk Imports history
```

### BulkImportAdapter contract

```ts
interface BulkImportAdapter {
  entityType: BulkImportEntity;           // Prisma enum
  label: string;                          // "Vehicle"
  naturalKeyLabel: string;                // "Registration No"
  naturalKeyTenantScoped: boolean;        // false for globally-unique keys (Vehicle, Asset)
  templateColumns: BulkImportTemplateColumn[];

  normalizeRow(raw): BulkImportNormalizedRow;             // pure, no DB access
  findExisting(tenantId, naturalKeys): Promise<Map<...>>; // batch lookup
  create(tenantId, data): Promise<string>;                // returns new id
  buildUpdate(existing, data): Record<string, unknown> | null; // null = no-op
  applyUpdate(id, data): Promise<void>;
}
```

Adding a new entity means adding one adapter file + one registry entry — the
controller, parser, session model, audit, template/error-report generation,
and UI wizard are all already generic.

### Natural keys — audited, not guessed

| Entity | Natural key | Scope | Prisma constraint |
|---|---|---|---|
| Vehicle | `registrationNo` | **Global** | `@unique` |
| Asset | `assetTag` | **Global** | `@unique` |
| Department | `code` | Tenant | `@@unique([tenantId, code])` |
| Supplier | `vendorCode` | Tenant | `@@unique([tenantId, vendorCode])` (nullable in schema; **required** for bulk import rows) |
| JobCode | `code` | Tenant | `@@unique([tenantId, code])` |

Globally-unique natural keys need special handling: if a row's key already
exists but belongs to a **different tenant**, the row is classified `ERROR`
(`NATURAL_KEY_CONFLICT`) rather than `CREATE` (would fail the DB's own
unique constraint) or `SKIP_EXISTING` (would incorrectly imply the record
belongs to the current tenant). The error message never names the owning
tenant.

## Preview → Commit flow

1. **`GET /api/bulk-import/:entity/template?format=csv|xlsx`** — generates a
   template from `adapter.templateColumns` (header + one example row +
   allowed-enum notes on a second sheet for `.xlsx`). No production data.
2. **`POST /api/bulk-import/:entity/preview`** (multipart) — parses, maps
   file headers to the adapter's field keys, normalizes every row, detects
   in-file duplicate natural keys (**every** row sharing a key is
   `SKIP_DUPLICATE_FILE_ROW` — never "last row wins"), batch-looks-up
   existing records, classifies each row's action, and persists a
   `BulkImportRun` + `BulkImportRow[]`. **Never mutates the target
   collection** (covered by an explicit test). Returns a `blocked` flag
   (true when there is nothing to create or update) and the row-by-row
   preview (capped to 500 rows in the response; full detail via `GET
   /api/bulk-import/:entity/:importId`).
3. **`POST /api/bulk-import/:entity/:importId/commit`** (`{ confirmed: true
   }` only — the server never trusts client-supplied tenantId, actions, or
   row data):
   - Re-verifies SUPER_ADMIN from the DB.
   - Atomically transitions `VALIDATED -> COMMITTING` via a conditional
     `updateMany`; a concurrent second commit call sees `count === 0` and
     either returns the already-completed result or a 409
     `COMMIT_IN_PROGRESS` — **idempotent**, no duplicate creation on retry.
   - Re-checks each actionable row's natural key against **current** DB
     state (not the preview snapshot) before writing — a record created or
     removed between preview and commit is safely reclassified
     (`SKIP_EXISTING` / `RECORD_NO_LONGER_EXISTS`) instead of being
     duplicated.
   - Writes one `AuditLog` entry via `writeAuditTrail()` summarizing the run
     (importId, entityType, actor, fileHash, counts, status).
4. **`GET /api/bulk-import/:entity/:importId/errors`** — CSV
   (`rowNumber,naturalKey,field,inputValue,errorCode,message`), no stack
   traces or cross-tenant data.
5. **`GET /api/bulk-import`** — tenant-scoped, paginated history across all
   entities (or filtered by `?entity=`).

## Safe-update semantics (`UPDATE_EXISTING` mode)

`adapter.buildUpdate(existing, data)` only includes fields the file
explicitly provided a non-blank value for. A blank cell **never** clears an
existing value. The generic framework never lets an adapter touch
`tenantId`, `id`, `createdBy`, or other system/audit fields — adapters don't
even receive those in their `data` payload.

## File limits (see `bulk-import.constants.ts`)

| Limit | Value |
|---|---|
| Max file size | 10 MB |
| Max rows | 5,000 |
| Max columns | 50 |
| Formats | `.csv`, `.xlsx` only (`.xls`, `.xlsm`, and other extensions rejected) |
| Preview session TTL | 24 hours (`expiresAt`); an expired run must be re-previewed before commit |

## Testing

- `apps/api/test/bulk-import-parser.service.spec.ts` — file format/size/row/column
  bounds, malformed CSV/XLSX, unsupported types.
- `apps/api/test/bulk-import-auth.service.spec.ts` — DB-authoritative
  SUPER_ADMIN check (disabled/locked accounts, non-SUPER_ADMIN roles, stale
  JWT vs. current DB role).
- `apps/api/test/bulk-import.service.spec.ts` — preview non-mutation,
  in-file duplicate detection, existing-record skip/update, blank-field
  preservation, invalid enum/required-field errors, cross-tenant natural-key
  conflict, idempotent double-commit, concurrent-existing-record-at-commit,
  tenant isolation, foreign/expired importId, error report shape.
- `apps/web/e2e/bulk-import.spec.ts` — button visibility by role, full
  preview → confirm → result flow against a mocked API, Admin history page
  SUPER_ADMIN gate.

## Schema change (flagged per the task's "no schema change unless required" rule)

Two new, additive-only Prisma models: `BulkImportRun` and `BulkImportRow`
(plus three new enums: `BulkImportEntity`, `BulkImportMode`,
`BulkImportRunStatus`, `BulkImportRowAction`). These are new MongoDB
collections — rolling them out via `npm run db:push` does not touch any
existing collection or field. This mirrors the already-shipped
`InventoryImportRun`/`InventoryImportRow` pattern. **Before production
deployment**, this schema addition should be explicitly re-confirmed per the
runbook.
