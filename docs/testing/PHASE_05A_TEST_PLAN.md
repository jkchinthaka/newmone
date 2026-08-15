# Phase 05A Test Plan — Configurable FG Product Foundation

**Document status:** Phase 05A technical foundation  
**Last updated:** 2026-08-07

Synthetic codes only (examples): `ORG-TEST`, `PROD-TEST`.

No Nelna operational product names, codes, categories, or ERP identifiers.

## Coverage areas

- Model/DB normalization and per-organization uniqueness
- Services create/update/activate/deactivate + audit
- Selectors org-scoped query filtering
- Management UI list/search/filter/create/edit/detail/lifecycle
- CSRF, IDOR, cross-organization denial
- Admin registration and delete restriction
- Regression: auth, RBAC, Shift domain/UI, architecture boundaries

## Related

- [PHASE_05_FG_PRODUCT_PROVISIONAL_CONFIGURATION.md](../decisions/PHASE_05_FG_PRODUCT_PROVISIONAL_CONFIGURATION.md)
- [ADR-009-FG-MASTER-DATA-DOMAIN.md](../architecture/ADR-009-FG-MASTER-DATA-DOMAIN.md)
