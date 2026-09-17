# MP-003 — Tenant-scoped business-key uniqueness (migration plan)

**Status:** COMPLETE (2026-09-17)
**Branch:** `maintainpro/phase-15-sqlserver-migration`
**Migration:** `prisma/migrations/20260917120000_mp003_tenant_scoped_business_keys/migration.sql`
**Live acceptance:** `scripts/mp003-two-tenant-acceptance.mjs` (`npm run test:mp003-two-tenant-acceptance`)

> Everything below this line is the **original plan**, written for the pre-Phase-15 MongoDB
> architecture on branch `fix/live-production-remediation` (Atlas snapshots, Mongo aggregation
> duplicate-detection, sparse Mongo indexes). It is kept for historical record of the original
> inventory and reasoning, but the actual execution differs in every implementation detail
> because the platform migrated to SQL Server in Phase 15 between this plan being written and
> being executed. **Do not follow the SQL/index syntax below — it is Mongo, not SQL Server.**
> See the summary immediately below for what was actually done.

## What was actually done (2026-09-17, SQL Server / Phase 15)

**Migrated to `@@unique([tenantId, <key>])`** (9 models), with `tenantId` also made a required
(NOT NULL) column on all nine — see schema.prisma comments on each field for the specific
evidence considered per model, and the migration file's header comment for the full rationale:

| Model | Field |
| --- | --- |
| `Asset` | `assetTag` |
| `Vehicle` | `registrationNo` |
| `Vehicle` | `vin` (nullable — filtered index `WHERE vin IS NOT NULL`, no plain `@unique`; Prisma has no partial-unique syntax) |
| `Driver` | `licenseNumber` |
| `WorkOrder` | `woNumber` |
| `SparePart` | `partNumber` |
| `UtilityMeter` | `meterNumber` |
| `AccidentReport` | `reportNumber` |
| `InsuranceClaim` | `claimNumber` |
| `TrafficFine` | `fineNumber` |

**Kept global (product decision, with evidence — not left undecided):**

| Model | Field | Why |
| --- | --- | --- |
| `CleaningLocation` | `qrCode` | Cryptographically random (`randomUUID()`), resolved by `findUnique({ where: { qrCode } })` alone at scan time (a physical QR sticker scan has no tenant context available by design); `CleaningService.scanVisit()` already enforces isolation at the application layer with an explicit post-lookup `location.tenantId !== scopedTenantId` check. |

**VIN decision reversed from the prior (2026-09-16) session.** That session treated VIN as a
"real-world globally-unique identifier" and kept it global — that was an assumption about the
physical world, not evidence from this codebase. This session found the actual evidence:
`vehicle-master-import.ts`'s VIN duplicate-detection has only ever compared against
`prisma.vehicle.findMany({ where: { tenantId } })` — i.e. the application has only ever
validated VIN uniqueness per tenant, never platform-wide. VIN is now tenant-scoped.

**Application code changed:** every `findUnique`/`upsert` bare lookup on a migrated field now
uses the compound `tenantId_<field>` selector (seed.ts, assets.service.ts,
vehicle-master-import.ts); `AssetsService.ensureUniqueAssetTag` and its bulk-import duplicate
check now take a required `tenantId`; four work-order-number generators
(`AccidentsService.nextReportNumber`, `InsuranceClaimsService.nextClaimNumber`,
`TrafficFinesService.nextFineNumber`, `PredictiveAiService.nextWorkOrderNumber`) were scoped by
tenant and given the same retry-on-P2002 concurrency pattern `WorkOrdersService.nextWoNumber`
already had (they previously counted rows platform-wide, which — like the schema constraint
itself — was a latent cross-tenant collision bug masked by only ever having one seeded tenant);
~15 additional call sites across driver-intelligence/evidence/fuel/maintenance/erp-stock-sync/
work-order-category-reports/work-order-activity services needed a `null`-safe sentinel value
for `tenantId` filters once the columns became non-nullable (an authenticated actor with no
tenant membership must still resolve to "no match", not a type error or an unfiltered query).

**Live-verified:** `scripts/mp003-two-tenant-acceptance.mjs` — two throwaway tenants, cross-tenant
reuse succeeds for every migrated field, same-tenant reuse is rejected (P2002), tenant lookup
isolation holds, work-order number generation no longer collides across tenants, ERP part-number
lookup stays tenant-scoped. Run against both the existing dev database and a from-empty
disposable database (`MaintainProTenantScopeValidation`) — 18/18 checks pass in both.

**Not migrated — awaiting product decision or deliberately out of scope of this batch:** none.
Every field in the original inventory below was resolved one way or the other.

---

## Original plan (2026-09-15, MongoDB era — historical record only)

**Status:** MIGRATION REQUIRED (no Prisma `@unique` / Mongo index change in this remediation batch)  
**Branch:** `fix/live-production-remediation`  
**Rule:** Do not alter live-index semantics until duplicate inventory, backups, and dual-write rollout are approved.

---

## 1. Exact affected model + field inventory (global `@unique` business keys)

| Model | Field | Schema today | Should become |
| --- | --- | --- | --- |
| `Asset` | `assetTag` | `@unique` | `@@unique([tenantId, assetTag])` |
| `Vehicle` | `registrationNo` | `@unique` | `@@unique([tenantId, registrationNo])` |
| `Vehicle` | `vin` | `String? @unique` | sparse / partial unique on `(tenantId, vin)` where `vin != null` |
| `SparePart` | `partNumber` | `@unique` | `@@unique([tenantId, partNumber])` |
| `WorkOrder` | `woNumber` | `@unique` | `@@unique([tenantId, woNumber])` |
| `Driver` | `licenseNumber` | `@unique` | `@@unique([tenantId, licenseNumber])` |
| `UtilityMeter` | `meterNumber` | `@unique` | `@@unique([tenantId, meterNumber])` |
| `FacilityAsset` (QR) | `qrCode` | `@unique` | **Product decision:** tenant-scoped **or** keep global if QR is absolute |
| Accident report | `reportNumber` | `@unique` | `@@unique([tenantId, reportNumber])` |
| Insurance claim | `claimNumber` | `@unique` | `@@unique([tenantId, claimNumber])` |
| Traffic fine | `fineNumber` | `@unique` | `@@unique([tenantId, fineNumber])` |

Inventory regression test: `apps/api/test/tenant-uniqueness-inventory.spec.ts` asserts the high-risk Asset/Vehicle/SparePart globals remain until migration.

---

## 2. Tenant-scoped vs system-global

### Must become tenant-scoped (multi-tenant SaaS collision risk)

All rows in §1 except QR (pending product confirmation).

### Must remain system-global

| Model | Field | Reason |
| --- | --- | --- |
| `Tenant` | `slug` | Platform routing identity |
| `User` | `email` | Global login identity (current auth model) |
| `Permission` | `key` | Permission catalog |
| Invite / reset tokens | `token` / `tokenHash` | Cryptographic one-time secrets |
| Stripe / billing | `stripeSubscriptionId`, `stripeInvoiceId`, `customerId` | External global IDs |
| Plan features | `@@unique([planId, key])` | Catalog composites (already correct) |

### Already tenant-scoped (patterns to copy)

`Department @@unique([tenantId, code])`, `Employee @@unique([tenantId, employeeNo])`, `PurchaseOrder @@unique([tenantId, poNumber])`, cleaning/compliance ticket numbers, ERP import batch numbers.

---

## 3. Production duplicate-detection (required before any index change)

Run **read-only** against a restored backup or Atlas secondary — never against a destructive migration path.

Example Mongo aggregation shape (repeat per field):

```js
// Asset.assetTag — values that appear under >1 tenant or with null tenantId
db.Asset.aggregate([
  { $group: {
      _id: "$assetTag",
      tenants: { $addToSet: "$tenantId" },
      count: { $sum: 1 },
      ids: { $push: "$_id" }
  }},
  { $match: { $or: [
      { count: { $gt: 1 } },
      { "tenants.0": null },
      { $expr: { $gt: [{ $size: "$tenants" }, 1] } }
  ]}}
])
```

Repeat for: `Vehicle.registrationNo`, `Vehicle.vin` (non-null only), `SparePart.partNumber`, `WorkOrder.woNumber`, `Driver.licenseNumber`, `UtilityMeter.meterNumber`, `reportNumber` / `claimNumber` / `fineNumber`, and `qrCode` if scoped.

Also inventory rows with `tenantId: null` / missing.

Deliverable: CSV/report of colliding keys + recommended merge/rename/quarantine actions. **Stop if collisions exist.**

---

## 4. Target compound uniqueness shape

- Required string keys: `@@unique([tenantId, <businessKey>])` (Mongo compound unique index).
- Optional `vin`: prefer **partial/sparse** unique so multiple documents may omit VIN, while `(tenantId, vin)` is unique when present. Prisma Mongo sparse support must be validated in the migration change-set; if unsupported, use application enforcement + carefully named raw index.

---

## 5. Nullable key handling (`vin` and null `tenantId`)

1. Backfill or quarantine all `tenantId == null` business rows **before** compound unique create.
2. Normalize empty-string VIN → `null` before index build.
3. Do not create a non-sparse unique on `vin` alone after migration (current global `@unique` already blocks cross-tenant reuse and multiple nulls depending on Mongo null-index behavior — verify on Atlas before cutover).

---

## 6. Rollback strategy

1. Keep previous global unique indexes until compound indexes are verified in production traffic.
2. Prefer **expand** (add compound unique) → dual-read/write in app → **contract** (drop global unique) only after soak.
3. Rollback app: redeploy previous API build that still expects global uniqueness.
4. Rollback index: drop newly added compound unique only if no writes depend on it; never drop both old and new in the same change window.
5. Restore from pre-migration backup if data repair was incorrect (see §7).

---

## 7. Backup prerequisite

- Atlas snapshot (or equivalent) taken **immediately before** index create and **before** any data repair writes.
- Document snapshot ID, cluster, and restore owner in the change ticket.
- Verify restore drill on a non-production clone at least once for this class of change.

---

## 8. Required application-query changes (same release train as indexes)

| Area | Change |
| --- | --- |
| Asset create/validate | `ensureUniqueAssetTag` → `{ tenantId, assetTag }` |
| Vehicle create/update | registration / VIN lookups scoped to tenant |
| SparePart create / ERP match | `{ tenantId, partNumber }` (ERP sync already filters parts by tenant when actor has tenantId) |
| Work order numbering | generate + uniqueness check per tenant |
| Driver / meters / claims / fines / accidents | create paths + any “exists” validators |
| API conflict mapping | treat unique violations as tenant-local conflicts |

Until indexes flip, treat **global** unique violations as migration debt signals, not product intent.

---

## 9. Controlled deployment / index-reconciliation order

1. Backup (§7) + read-only duplicate report (§3); repair/quarantine until clean.  
2. Deploy API that **queries** `{ tenantId, key }` but still tolerates old global unique errors.  
3. Create compound unique indexes **in background** on Atlas (no `--accept-data-loss`).  
4. Soak: monitor write conflicts / slow queries.  
5. Drop obsolete global uniques one model at a time.  
6. Remove temporary dual-path logging.  

**This batch:** documentation + inventory test only — **no schema/index mutation.**

---

## Safe work completed here (non-migration)

- Inventory regression test for Asset / Vehicle / SparePart globals.
- This plan. Status remains **MIGRATION REQUIRED**.
