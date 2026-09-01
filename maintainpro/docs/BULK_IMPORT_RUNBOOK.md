# Bulk Import Runbook

How a SUPER_ADMIN safely bulk-imports master data in MaintainPro, and how an
operator/engineer verifies and supports the feature. See
[`BULK_IMPORT_ARCHITECTURE.md`](./BULK_IMPORT_ARCHITECTURE.md) for the
technical design and [`BULK_IMPORT_MATRIX.md`](./BULK_IMPORT_MATRIX.md) for
what's in scope.

## What's live in V1

- **Entities:** Vehicles, Assets, Departments, Suppliers, Job Codes.
- **Who can use it:** SUPER_ADMIN only. The Bulk Upload button is hidden for
  every other role, and the server independently re-verifies the actor's
  role against the database (not the JWT) on every preview and commit call
  — a stale or forged token claiming SUPER_ADMIN is rejected with 403 if the
  database currently says otherwise.
- **Where:** a "Bulk Upload" button next to the existing Create/Add action
  on `/vehicles`, `/assets`, `/master-data/departments`,
  `/master-data/suppliers` (new page — see the matrix), and
  `/maintenance/job-codes`. Import history for all entities lives at
  **Admin Console → Bulk Imports** (`/admin/bulk-imports`).

## How to safely import data (SUPER_ADMIN walkthrough)

1. Open the target module (e.g. Vehicles) and click **Bulk Upload**.
2. **Download the template** (CSV or Excel) from the wizard's first step.
   Column headers must match the template — extra/unknown columns are
   ignored, but every **required** column must be present and non-blank on
   every row you want imported.
3. Choose **Create new, skip existing** (default — never overwrites
   anything) or **Update existing records** (only touches non-blank cells;
   a blank cell never erases an existing value; system/audit fields like
   `tenantId`/`createdBy` are never accepted from the file).
4. Drag & drop or choose your `.csv`/`.xlsx` file (max 10 MB, 5,000 rows, 50
   columns). The file is parsed and validated **immediately, but nothing is
   created or changed yet** — this is a preview only.
5. Review the summary tiles (rows / will create / will update / skipped /
   errors) and the row-by-row table. Every duplicate natural key found
   *within the file itself* is skipped (both/all occurrences — never
   "last row wins"); every row that already exists is skipped by default;
   every invalid row is flagged with the exact field and reason.
6. If there are errors, click **Download error report** (CSV:
   `rowNumber, naturalKey, field, inputValue, errorCode, message`), fix the
   source file, and upload it again — the previous preview session is not
   reused; each upload gets a fresh review.
7. Click **Confirm & Import** only when you're satisfied with what will
   happen. This is disabled entirely if nothing is ready to import.
8. The result screen shows final created/updated/skipped/error counts. If
   anything failed at commit time (e.g. another admin created the same
   record moments earlier), you can download the error report again — no
   duplicate records are ever created, whether from a network retry, a
   double-click, or two admins racing each other.
9. Check **Admin Console → Bulk Imports** any time afterward for the full
   history: file, actor, timestamp, counts, status, and error downloads.

## Permission model

- **V1: SUPER_ADMIN only**, for both preview and commit. ADMIN, MANAGER,
  ASSET_MANAGER, INVENTORY_KEEPER, and every other role receive **403** from
  every `/api/bulk-import/*` endpoint, verified against the live database
  role — not the JWT claim, which may be stale until token expiry.
- This is intentionally stricter than the existing per-entity write
  permissions (e.g. `vehicles.create`) because bulk import can create or
  modify hundreds of records in one action.
- The existing specialized ERP Excel Import and Inventory Excel Import
  permission models are **unchanged** — this framework does not touch them.

## Tenant isolation

- `tenantId` is always server-derived from the authenticated session's
  active tenant (via `X-Tenant-Id` + tenant membership, same as every other
  tenant-scoped endpoint) — never accepted from a spreadsheet column, and
  never trusted from the request body at commit time.
- A run created under one tenant is invisible (404, not 403 — no existence
  leak) to a request under a different tenant.
- For entities whose natural key is **globally unique in the schema**
  (Vehicle's `registrationNo`, Asset's `assetTag`), a row whose key already
  belongs to a different tenant is reported as a generic `ERROR` — the
  owning tenant is never revealed in the message.

## Idempotency and concurrency

- Re-submitting a commit for the same `importId` (double-click, browser
  retry, network timeout) returns the already-committed result — it never
  reprocesses or duplicates rows.
- Two concurrent commit attempts on the same run: the second one gets a
  clean 409 (`COMMIT_IN_PROGRESS`) or the completed result, never a race.
- If another admin creates a matching record between your preview and your
  commit, that row is safely skipped at commit time (re-checked against the
  live database, not the preview snapshot) instead of creating a duplicate.

## Audit

Every preview and every commit writes one `AuditLog` entry (`entity:
"BulkImportRun"`) via the shared `writeAuditTrail()` helper, capturing
actor, tenant, file name/hash, and row counts. No passwords, tokens, or
secrets are ever written to the audit trail (V1 doesn't touch User records
at all — see the matrix for why Users are excluded).

## File limits

| Limit | Value |
|---|---|
| Max file size | 10 MB |
| Max rows | 5,000 |
| Max columns | 50 |
| Formats | `.csv`, `.xlsx` (legacy `.xls`, macro-enabled `.xlsm`, and any other extension are rejected) |
| Preview session validity | 24 hours — an expired preview must be re-uploaded before it can be committed |

## Production deployment notes

- **Schema change**: this feature adds two new MongoDB collections
  (`BulkImportRun`, `BulkImportRow`) via `npm run db:generate && npm run
  db:push`. This is additive-only — no existing collection, field, or index
  is modified. Still, per the project's "no schema change unless required"
  policy, this should be called out and confirmed before the production
  `db:push`, not run silently as part of a routine deploy.
- **No seed, no real data import is authorized by shipping this feature.**
  Deploying the bulk import *code* to production does not import any real
  vehicles/assets/departments/suppliers/job codes — that only happens when a
  SUPER_ADMIN explicitly uploads a file and clicks Confirm & Import in the
  live environment, with a real file they provide.
- **Redis is not required.** Preview/commit state lives in MongoDB
  (`BulkImportRun`/`BulkImportRow`), so this feature works correctly even
  though Redis is not currently provisioned in this deployment's production
  environment (see the architecture doc for why).
- **Post-deploy verification** (no real data import):
  1. `GET /health` and the web app's landing page both return healthy.
  2. Log in as SUPER_ADMIN; confirm the Bulk Upload button appears on the 5
     V1 pages and `/admin/bulk-imports` loads.
  3. Log in as a non-SUPER_ADMIN role; confirm the button is hidden and that
     directly calling `POST /api/bulk-import/vehicle/preview` returns 403.
  4. Upload a small **synthetic** file (e.g. one obviously fake vehicle
     registration like `TEST-DO-NOT-USE-001`) through **preview only** —
     confirm the preview renders and that no vehicle was actually created
     (check the Vehicles list). **Do not click Confirm & Import in
     production** unless a real, user-provided import has been explicitly
     authorized.

## Rollback

- **Code rollback**: redeploy the previously-known-good commit via the same
  mechanism used to deploy this feature (Render `render:deploy` / Cloudflare
  `wrangler deploy` — see the repository's `docs/DEPLOYMENT.md`). No data
  migration is needed to roll back, since the schema change is additive-only
  and unused by any other code path.
- **No data to roll back** in this task: no real business data is imported
  by shipping the code itself (see above). Any `BulkImportRun`/`BulkImportRow`
  documents created during verification are import-session metadata, not
  business records, and are safe to leave in place (they age out
  informationally after `expiresAt` but are not auto-deleted).
