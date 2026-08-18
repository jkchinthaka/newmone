# Phase 05C — FG Product Master Foundation

**Document status:** Technical foundation expansion — **not** official catalogue receipt  
**Phase:** 05C  
**MASTER-001:** Still **EVIDENCE REQUIRED**

## Field gap analysis (implemented as optional blanks)

| Candidate | Phase 05C treatment |
| --- | --- |
| product code / name | Already primary identity (org-scoped normalized code) |
| ERP item code | Optional mapping reference; unique within org when set; **not** primary identity; **no live Bileeta calls** |
| category / brand / pack size / UOM / barcode | Optional free-text fields — no seeded catalogues |
| storage category | Optional label only — **not** CCP/temperature class approval |
| shelf-life / label-artwork references | Optional document references — not computed limits |
| active / effective dates | `is_active` + optional `effective_from` / `effective_to` |

Actual Nelna values remain empty until MASTER-001 / APR-005 evidence is supplied.

## Lifecycle / historical safety

Hard delete refused. Deactivate and/or set `effective_to`. Checklist FKs remain `PROTECT`.

## Import

```text
python manage.py import_fg_products --write-template docs/business/templates/FG_PRODUCT_IMPORT_TEMPLATE.csv
python manage.py import_fg_products --csv <evidence.csv> --actor <USER_UUID>
python manage.py import_fg_products --csv <evidence.csv> --actor <USER_UUID> --commit --error-file errors.csv
```

Dry-run by default. Atomic commit. Duplicate code / ERP detection. Audited preview/complete/fail.

CSV is the supported controlled import format. XLSX is not required for Phase 05C (operators can export CSV from spreadsheet tools). No live ERP/Bileeta calls.

## Authorization

Organization-scoped `manage_fgproduct` / `view_fgproduct`. Site-only grants do **not** escalate to org-wide Product management (`organization_ids_with_permission`).

## Search / UI

List search covers code, name, ERP item, barcode, category, brand; status/org/category filters; pagination retained.
