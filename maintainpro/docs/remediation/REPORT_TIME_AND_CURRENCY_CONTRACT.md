# Report Time and Currency Contract (Phase 5D)

**Status:** CONTRACT_DEFINED  
**Preserve:** Phase 5B `fe3b3992d883d33c916b3595769add2c4db8878a` / `30712469601`; Phase 5C `512745d678a4be6b0d0a62f2400763ff9fd4ec08` / `30715842098`

## Defaults (when no tenant override)

| Dimension | Value |
| --- | --- |
| Storage | UTC Instant / BSON Date |
| Reporting / business timezone | `Asia/Colombo` |
| Currency | `LKR` |
| Locale | `en-LK` |
| API money | Numeric amount + `currencyCode` metadata |
| UI formatting | Central `localization` helpers (`en-LK`, `Asia/Colombo`, `LKR`) |

## Date range semantics

1. `startDate` (date-only `YYYY-MM-DD`) means **start of business day** in `Asia/Colombo` (00:00:00.000+0530), converted to UTC for queries.
2. `endDate` means **end of business day** in `Asia/Colombo` (23:59:59.999+0530), converted to UTC.
3. Invalid date strings → exact **HTTP 400** (`VALIDATION_ERROR`); never silently ignored.
4. `startDate` after `endDate` → exact **HTTP 400**.
5. Maximum range: **366 days** inclusive for interactive reports/dashboard; export may use the same bound unless a documented async path exists.
6. Monthly grouping buckets by Colombo calendar month; records must not shift across Sri Lankan day/month boundaries due to UTC-only grouping.
7. Sri Lanka has **no DST**; do not apply DST shift logic.

## Query validation

| Input | Rule |
| --- | --- |
| ISO date-only | Required pattern for range fields |
| Datetime filters | Accept ISO-8601; interpret wall times in reporting TZ when date-only |
| Audit `from`/`to` | Same 400 rules (no silent drop) |
| Unknown trusted filters | Rejected, not widened |

## Currency rules

1. Every financial API payload includes `currencyCode` (default `LKR`) in metadata and/or per-line.
2. Monetary fields remain **numbers** in JSON; formatting is a presentation concern.
3. Exports include currency code in header or column.
4. LKR precision: round to **2 decimal places** for presentation totals; store/compute with documented decimal handling; never emit `NaN` / `Infinity`.
5. Negative amounts require explicit meaning (credit, reversal, recovery).
6. **No silent FX conversion** between LKR and USD (or any pair). Historical amounts stay in their recorded currency.
7. Modules that truly hold USD must set `currencyCode: "USD"` explicitly; LKR business reports must not hardcode USD labels.
8. Farm `amountLkr` and similar fields map to LKR reporting — never relabel as USD.

## Browser vs server

| Layer | Responsibility |
| --- | --- |
| Database | UTC storage |
| API | Resolve range in Asia/Colombo; return `reportingTimezone`, `currencyCode`, `range` |
| BFF | Pass-through; no re-bucketing |
| Web | Format with `en-LK` / LKR helpers; display generatedAt in reporting TZ |

## Test IDs

- E2E-DASH-011 — metadata includes generatedAt / range / timezone / currency
- E2E-REPORT-003 — invalid dates 400; inverted range 400; max range enforced
- E2E-REPORT-004 — monthly buckets respect Asia/Colombo
- Contract self-tests for date bound conversion and currency metadata
