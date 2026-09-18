# MaintainPro Enterprise Final Implementation — Progress Report

**Branch:** `maintainpro/enterprise-final-implementation`  
**PR:** https://github.com/jkchinthaka/newmone/pull/39  
**Started from main:** `2c29096e` (PR #37 already merged)  
**Current HEAD:** `300ba847`  
**Date:** 2026-09-18

## Starting state

- Final-enterprise-closure PR #37 was **already MERGED** to main despite some CI red checks.
- CI blocker on main tip: tenant fail-open audit (5 unapproved patterns).

## Completed in this branch

### Phase 0 — Correctness
- Tenant fail-open: ERP exceptions + WO status history → `requireTenantId` (**audit:tenant green**)
- WO hard delete → cancel OPEN (retain history)
- Vehicle hard delete → DISPOSED/decommission
- Daily Inventory REVERSAL: opposite signed impact via `reversalOf.type` (not treated as Return)
- Expanded daily reversal tests: RETURN / TRANSFER_* / ADJUSTMENT_* + orphan REVERSAL
- ERP stock compare: Part + Warehouse preferred; single-warehouse fallback with warning
- ERP load balances from `WarehouseItemBalance` when present
- Production compose structure fixture: required FG/Mongo/JWT vars filled
- Text integrity: U+FFFD replacements removed from IMPLEMENTATION_LOG + migrate dry-run script

### Phase 1 — IA
- Navigation: Administration + Technical Administration (`/system-health`) under admin
- Settings page: personal Profile/Preferences only; admin deep-links to Administration
- Create WO: “Legacy type” → “Work type”

### Phase 2 — Work management
- MR reject/duplicate → **CLOSED** + `resolutionCode` (status ≠ resolution); REJECTED legacy-only
- Migration `20260918020000_request_resolution_code`
- Create WO wizard steps: **Context → Work → Plan → Review** (due ≠ expectedCompletion)

### Phase 3 — Assets / PM
- `version` OCC on Asset, WorkOrder, MaintenanceRequest
- First-class `PmOccurrence` model + migration `20260918010000`
- PM auto-WO generation **upserts PmOccurrence** (GENERATED); WO create alone does not complete
- WO **close** marks linked PmOccurrence COMPLETED and advances `PmPlan.lastCompletionAt`

### Phase 4 — Inventory
- `StockCountSession` / `StockCountLine` + migration `20260918030000`
- API: list/create/transition/upsert-line/post via Inventory Transaction Engine only
- UI: `/inventory/stock-counts` + section nav

### Docs
- `docs/database/DATABASE_OVERVIEW.md`
- `docs/database/DATA_DICTIONARY.md`
- `docs/database/STATUS_CATALOG.md`
- `docs/database/LEGACY_DISPOSITION.md`

## Still open (continue on this PR / follow-ups)

- Background PM scheduler job (Bull/cron) — currently on-demand auto-WO API
- Stock count line-entry UX polish (counted qty UI per line)
- Gate/claims/fines state-machine UI polish
- Full reporting views (`rpt.*`) + Power BI RLS (external)
- Accessibility audit pass
- Human UAT / external ERP/Entra/SMTP

## External blockers (not code-owned)

- Live Bileeta credentials
- Entra tenant registration
- SMTP/SMS production credentials
- Power BI production RLS
- Human Gate-1 UAT sign-off
- Irreversible production cutover

## Test evidence (this branch)

- `npm run audit:tenant` → PASSED (prior)
- `inventory-daily.spec` → PASSED (incl. multi-type REVERSAL)
- `stock-count.spec` → PASSED
- `request-lifecycle.spec` → PASSED
- `erp-exceptions.spec` → PASSED (tenant fail-closed)
- `validate:text-integrity` → PASSED
- Production compose structure fixture → `docker compose config --quiet` PASSED locally

## Merge policy

Merge to main **only** when required GitHub checks are green. Do not bypass branch protection.
