# Navigation and admin restructure — 16 October 2026

Worktree: `C:\Users\chint\AppData\Local\MaintainPro\worktrees\release-final-20261013`
Branch: `fix/enterprise-remediation-20261015`
HEAD: `a79859dc`
Git: uncommitted. No push. No merge. Not release ready. Independent QA is BLOCKED.

## Navigation

Before: meter entry lived inside privileged Utilities screens. `/utilities` was an active-state alias of `/assets`.

After:

- Meter Readings is `/utilities/readings`, icon Gauge, immediately after Inspections.
- Visible to SUPER_ADMIN, ADMIN, ASSET_MANAGER, SUPERVISOR, TECHNICIAN, and MECHANIC.
- Admin items: Register asset, Register vehicle, Asset tag upload.
- The `/utilities` → `/assets` alias is removed.
- Bottom navigation was left unchanged. The existing daily slots already cover jobs, requests, assets, and fleet.

## Roles

| Action | Roles |
| --- | --- |
| Record a meter reading and view reading history | SUPER_ADMIN, ADMIN, ASSET_MANAGER, SUPERVISOR, TECHNICIAN, MECHANIC |
| Meter setup, bills, analytics | SUPER_ADMIN, ADMIN, ASSET_MANAGER, plus the existing supervisor chart/bill routes |
| Create an asset, bulk-import assets, or create a vehicle | SUPER_ADMIN, ADMIN |
| Upload asset tags | SUPER_ADMIN, ADMIN |

`utilities.readings.create` is in the permission catalog. The live gate is the NestJS role list, so technicians do not receive meter setup or bills.

## Routes

- `/utilities/readings`
- `/admin/assets/new`
- `/admin/vehicles/new`
- `/admin/asset-tags`
- `/admin/utilities` links to the existing meter setup, bills, and reports pages

Unauthorized users see Access required. Historic `/utilities` URLs stay in place. `(fms)/vehicle/new` is still the vehicle job editor.

## API create endpoints

Protected at the controller:

- `POST /utilities/meters/:id/readings`
- `POST /utilities/readings`
- `POST /assets`
- `POST /assets/bulk-import`
- `POST /vehicles`

Edit, movement, status, retirement, and fleet operations keep their previous roles. Linking an existing vehicle does not create a record and was not narrowed.

## Meter readings

A reading must be numeric and at least 0. A future time is rejected. A lower reading is rejected unless a reset or replacement reason of at least 3 characters is sent. Reset consumption is stored as null. Consumption above three times the average of the last five positive readings is a warning and is still saved. The same meter and timestamp is rejected inside the create transaction. `Idempotency-Key` is accepted. The same key with the same value and timestamp returns the existing row. A different payload for that key is a conflict.

Migration `prisma/migrations/20261016093000_meter_reading_timestamp_unique` adds unique index `MeterReading_meterId_readingDate_key` on `(meterId, readingDate)`. The schema uses `@@unique([meterId, readingDate])`. It was applied only to disposable database `maintainpro_e2e_wo_verify`. Other databases receive it on migrate deploy. Prisma client was not regenerated. A database uniqueness conflict (`P2002`) is returned as a conflict. Concurrent first inserts for the same meter and timestamp cannot both succeed on a database where this migration is applied.

The recorder is the user id stored in the reading note. Optional meter photos were not added. Evidence storage stays on work orders.

## Asset registration

Operational pages no longer show Create Asset, asset bulk import, Register Vehicle, vehicle bulk import, or Add Vehicle. Administrators get a link to the admin register. The admin pages post the existing create contracts. The large assets management page was not rewritten.

## Asset tags

Required column `assetTag`, format `AST-` plus at least four letters or digits. Match on serial number, current tag, or vehicle registration. Preview happens before writes. Replace needs Allow replace and a reason. Apply updates only `assetTag`, writes an audit row, and records a `BulkImportRun`. Invalid rows are returned and the page downloads them as CSV. An equivalent tag already stored is unchanged.

## QR

Work-order verification still accepts the internal id. It also accepts the asset tag or serial number, and a vehicle registration or vehicle tag, only when that value belongs to the work order's own record and tenant. The applied batch links to the existing asset QR download, which encodes the asset tag.

`/utilities/readings` opens the existing `QrScanner`. A scanned code is matched to the current tenant's meters by id, meter number, location, or description. One match selects that meter. No match shows that no meter in this tenant matched. Typed meter numbers still work. Denied or unavailable camera stays on the scanner's manual entry. A physical camera was not used, so camera scanning is NOT EXECUTED.

## Tests this pass (16 Oct gap close)

- Focused disposable DB: `admin-create-roles.spec.ts` and `nav-admin-remediation.integration.spec.ts`, 7 passed, 0 failed, exit 0, database `maintainpro_e2e_wo_verify`
- API Jest with `DISPOSABLE_SQLSERVER_URL` on that database and `DATABASE_URL` unset: 251 suites passed, 5 skipped, 2124 passed, 26 skipped, 0 failed, exit 0
- Web unit: 312 passed, 0 failed
- API and web `tsc --noEmit` exit 0
- API emit `tsc -p apps/api/tsconfig.build.json` exit 0
- Web production build exit 0
- `audit:tenant` unapproved 0
- `audit:rbac` violations 0 across 962 routes
- `validate:e2e-no-mocks` PASS
- `validate:e2e-safety` 17 passed
- `validate:secret-safety` 12 passed

Earlier full Jest without `DISPOSABLE_SQLSERVER_URL` was 2097 passed and 46 skipped because the SQL integration files use `describe.skip` until that URL names a `maintainpro_e2e_*` database. The 2126 passed / 10 skipped run had disposable SQL available. Those suites were not removed.

`test:release` exit 0. Browser and Playwright: NOT EXECUTED. Docker could not open `npipe:////./pipe/dockerDesktopLinuxEngine`.

## Known limitations

- The unique index is in the migration and on `maintainpro_e2e_wo_verify` only until migrate deploy runs elsewhere.
- Camera scanning is wired and was not executed on a device camera.
- Live HTTP 403 and 201 for asset and vehicle create were not called. Role metadata locks those routes to SUPER_ADMIN and ADMIN.
- Optional meter photos are a separate future feature.
- Registration pages are focused forms over the existing APIs, not a move of every selector from the operational pages.
- Screenshots were not captured.
