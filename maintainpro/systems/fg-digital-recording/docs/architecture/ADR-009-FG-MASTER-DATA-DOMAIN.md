# ADR-009 — FG Master Data Domain (Phase 05A)

**Status:** Accepted (provisional technical direction for Phase 05A)  
**Date:** 2026-08-07

## Context

Phase 05 requires operational master data for later checklist and recording modules. MASTER-001 remains evidence-required: official Product Master inventory, ERP contract, and pilot data are not supplied. Waiting indefinitely blocks technical progress. The project owner directed a configurable, unseeded FG Product foundation with an explicit minimum field contract.

## Decision

1. Create a dedicated `apps/master_data` bounded context (not inside `organizations`).
2. Implement **only** `FGProduct` in Phase 05A.
3. Organization is a required ForeignKey scope; Site/Department Product ownership is deferred.
4. Normalized code uniqueness is per Organization (`Lower(code)` + organization).
5. Lifecycle uses create/update/activate/deactivate; no operational hard delete.
6. Authorization uses scoped RBAC (`view_fgproduct` / `manage_fgproduct`) at Organization Scope.
7. Audit events: `FG_PRODUCT_CREATED|UPDATED|ACTIVATED|DEACTIVATED`.
8. Selectors filter by query-level organization IDs with the required permission (avoid Phase 04 per-row list filtering).
9. No production/seed rows; synthetic test data only.
10. Future ERP integration remains an anti-corruption boundary (no silent ERP DB reads/writes).

## Consequences

### Positive

- Unblocks Phase 05 technical work without inventing ERP catalogues.
- Clear exclusion list reduces speculative schema churn.
- Organization isolation matches existing security boundary.

### Negative / residual risk

- MASTER-001 remains unresolved; Phase 06 must not assume unsupported attributes.
- Provisional uniqueness may differ from future ERP policy.
- Site/department Product ownership may require a later migration if evidence appears.

## Intentionally excluded

Category, UOM, barcode, ERP item IDs, production line, work center, process area, temperature class, instruments, training, recipe/BOM, brand, site, department, costing/pricing/tax, SFA mapping.

## Related

- [PHASE_05_FG_PRODUCT_PROVISIONAL_CONFIGURATION.md](../decisions/PHASE_05_FG_PRODUCT_PROVISIONAL_CONFIGURATION.md)
- [MODULE_MAP.md](MODULE_MAP.md)
- [FG_PRODUCT_MANAGEMENT_UI.md](../design/FG_PRODUCT_MANAGEMENT_UI.md)
