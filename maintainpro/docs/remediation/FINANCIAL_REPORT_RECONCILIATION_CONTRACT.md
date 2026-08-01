# Financial Report Reconciliation Contract (Phase 5D)

**Status:** CONTRACT_DEFINED  
**Preserve:** Phase 5B `fe3b3992d883d33c916b3595769add2c4db8878a` / `30712469601`; Phase 5C `512745d678a4be6b0d0a62f2400763ff9fd4ec08` / `30715842098`  
**Currency:** LKR (see `REPORT_TIME_AND_CURRENCY_CONTRACT.md`)

## Problem statement

Historical `getFinancialTransactions` union-summed work-order `actualCost`, work-order parts `totalCost`, maintenance logs, purchase orders, utilities, and farm expenses into one “Total Expenses” figure. That silently **double-counts** overlapping economic events.

Phase 5D forbids combining distinct cost bases into one total without an explicit basis label.

## Cost bases

| Basis | Meaning | Typical sources |
| --- | --- | --- |
| `committed` | Obligation accepted but not necessarily received/consumed | Approved PO line totals |
| `received` | Goods/services received (GRN / receipt value) | Purchase receipts / received qty × price |
| `consumed_maintenance` | Maintenance cost consumed on jobs | Work-order `actualCost` (see default below) |
| `accrued` | Recognized expense before payment | Accrual documents when modeled |
| `paid` | Cash/bank settlement | Payment records when modeled |
| `operational_estimate` | Estimates only | `estimatedCost`; never mixed into consumed totals |

## Source classification

| Source | Basis | Include in default Total Expenses? | Notes |
| --- | --- | --- | --- |
| `WorkOrder.actualCost` | consumed_maintenance | **Yes (primary)** | Authoritative job cost when present |
| `WorkOrderPart.totalCost` | consumed (parts detail) | **No when `actualCost` present** | Excluded to prevent double count; usable in parts drill-down |
| Maintenance log `cost` | consumed / estimate | **No** by default if WO actualCost covers job | Separate card if shown |
| Purchase order `totalAmount` | committed | **No** | Separate **Committed PO spend** card |
| Purchase receipts | received | **No** in default total | Separate received-spend card |
| Utility bill `totalAmount` | consumed / accrued | **Yes** in default total | Distinct domain from WO |
| Farm expense `amountLkr` | consumed | **Yes** in default total | LKR; never label USD |
| Fuel expenses | consumed | Optional separate fleet card | Not silently merged without label |
| Vendor invoices | accrued/paid | Separate when used | Do not also add covered WO costs |

## Default “Total Expenses” card

**Basis key:** `consumed_maintenance_plus_utilities_farm`

```
Total Expenses =
  sum(WorkOrder.actualCost in range, tenant-scoped)
  + sum(utility bills in range)
  + sum(farm expenses amountLkr in range)
```

### Double-count prevention rules

1. When `WorkOrder.actualCost` is present → **exclude** that WO’s parts `totalCost` from the default total.
2. When `actualCost` is null → document fallback (e.g. parts + labor components) under an explicit `coverageStatus: DEGRADED` or use parts-only with labeled basis — never silently invent.
3. **Never** add PO committed totals into the same default Total Expenses card.
4. **Never** add both PO total and GRN received value into one unlabeled total.
5. **Never** add stock-issue cost and procurement cost for the same economic event into one unlabeled total.
6. API returns `basis`, `currencyCode`, component breakdown metadata for reconciliation tests.

## Separate cards (required)

| Card | Basis | Formula sketch |
| --- | --- | --- |
| Committed PO spend | committed | Σ approved/open PO server line totals in range |
| Received spend | received | Σ receipt line values in range |
| Parts consumed (detail) | parts lines | Σ part costs where included by policy |
| Budget vs actual | estimate vs consumed | estimatedCost vs actualCost; N/A if estimates sparse |

## Reconciliation tests

Prove for a seeded fixture:

1. Default Total Expenses equals WO actualCost + utilities + farm (no parts, no PO).
2. Committed PO card equals server PO totals only.
3. Adding a part line under a WO that already has `actualCost` does **not** change default Total Expenses.
4. Cross-tenant exclusion holds.
5. Currency metadata is `LKR` for these cards.

## Test IDs

- E2E-REPORT-010 … E2E-REPORT-014 — financial basis reconciliation
- Contract self-test: financial double-count prevention
