# MASTER-001 — FG Product Evidence Intake

**Document status:** Evidence collection contract — **not** approved business truth
**Requirement:** MASTER-001
**Created:** 2026-08-07 (Phase 05B)
**Technical foundation:** Phase 05A identity + Phase 05C optional mapping/attribute blanks (still unseeded). Official catalogue **not** received.

## Purpose

This document defines what business, QA, and ERP stakeholders must supply before Product Master schema expansion, real catalogue loading, or production authorization.

Empty fields are marked **EVIDENCE REQUIRED**. Do not invent answers.

Companion template: [templates/MASTER_001_PRODUCT_FIELD_INVENTORY.csv](templates/MASTER_001_PRODUCT_FIELD_INVENTORY.csv) (column definitions only; no sample Product rows).

Controlled import template (header-only): [templates/FG_PRODUCT_IMPORT_TEMPLATE.csv](templates/FG_PRODUCT_IMPORT_TEMPLATE.csv). No live Bileeta calls.

## Current technical baseline (do not treat as business approval)

| Aspect | Provisional technical state |
| --- | --- |
| Entity | `FGProduct` in `master_data` |
| Scope | Organization-owned |
| Fields | organization, code, name, description, optional ERP/category/brand/pack/UOM/barcode/storage/shelf-life/artwork refs, effective_from/to, is_active, timestamps |
| Site / Department ownership | Not modeled — site-only RBAC does **not** imply Product management |
| Category / UOM / ERP IDs / etc. | Optional blank fields TECHNICALLY SUPPORTED in 05C — values **EVIDENCE REQUIRED** |
| Seeded catalogue | None |
| Controlled import | Header-only template + dry-run importer — **no** official catalogue loaded |
| MASTER-001 | **EVIDENCE REQUIRED** (not marked received) |

---

## A. Source of truth

| Item | Value |
| --- | --- |
| ERP system / module / table / API | EVIDENCE REQUIRED |
| Manual master source (if no ERP) | EVIDENCE REQUIRED |
| Authoritative business owner | EVIDENCE REQUIRED |
| Evidence document / report / export reference | EVIDENCE REQUIRED |

## B. Product identity

| Item | Value |
| --- | --- |
| Official Product code definition | EVIDENCE REQUIRED |
| Official Product name definition | EVIDENCE REQUIRED |
| Description required? | EVIDENCE REQUIRED |
| Code format rules | EVIDENCE REQUIRED |
| Case sensitivity policy | EVIDENCE REQUIRED |
| Code reuse policy | EVIDENCE REQUIRED |
| Example approved codes (attach separately; do not invent here) | EVIDENCE REQUIRED |

## C. Scope

| Item | Value |
| --- | --- |
| Global vs Organization ownership | EVIDENCE REQUIRED (provisional tech: Organization) |
| Site applicability | EVIDENCE REQUIRED |
| Department applicability | EVIDENCE REQUIRED |
| Whether Product ownership changes over time | EVIDENCE REQUIRED |

## D. Additional candidate attributes

Ask about each candidate. Do **not** implement until evidenced and approved.

For each candidate complete: required? / source / data type / allowed values / validation rule / example real value / downstream use.

| Candidate | Required? | Source | Data type | Allowed values | Validation | Example real value | Downstream use |
| --- | --- | --- | --- | --- | --- | --- | --- |
| category | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED |
| UOM | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED |
| pack size | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED |
| barcode | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED |
| ERP item identifier | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED |
| production line | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED |
| work center | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED |
| temperature classification | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED |
| other business fields | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED | EVIDENCE REQUIRED |

> Phase 05C added **optional blank columns** for several candidates above so evidence can be loaded later. That does **not** mean official values, allowed lists, or business approval exist.

## E. Lifecycle

| Item | Value |
| --- | --- |
| Active / inactive rule | EVIDENCE REQUIRED |
| Discontinued Product handling | EVIDENCE REQUIRED |
| Code reuse after deactivation | EVIDENCE REQUIRED |
| Historical retention | EVIDENCE REQUIRED |

## F. Integration

| Item | Value |
| --- | --- |
| ERP source | EVIDENCE REQUIRED |
| Sync direction | EVIDENCE REQUIRED |
| External key | EVIDENCE REQUIRED |
| Update frequency | EVIDENCE REQUIRED |
| Conflict ownership | EVIDENCE REQUIRED |
| Deletion / deactivation mapping | EVIDENCE REQUIRED |

## G. Initial data load

| Item | Value |
| --- | --- |
| Approved pilot catalogue | EVIDENCE REQUIRED |
| Import format | EVIDENCE REQUIRED |
| Expected record count | EVIDENCE REQUIRED |
| Sample rows (attach; do not invent) | EVIDENCE REQUIRED |
| Duplicate handling | EVIDENCE REQUIRED |

## H. Approval / evidence provenance

| Item | Value |
| --- | --- |
| Person / team providing evidence | EVIDENCE REQUIRED |
| Date | EVIDENCE REQUIRED |
| Source document / API / report | EVIDENCE REQUIRED |
| Version | EVIDENCE REQUIRED |

---

## Explicit non-claims

- Completing Phase 05A/05B technical work does **not** resolve MASTER-001.
- Provisional organization ownership is **not** proof of final Site/Department policy.
- Phase 06 must not assume category, UOM, ERP IDs, or other unsupported Product attributes.
- This intake form is **not** an import specification and does **not** authorize CSV import code.

## Related

- [ASSUMPTION_REGISTER.md](ASSUMPTION_REGISTER.md)
- [PHASE_05_FG_PRODUCT_PROVISIONAL_CONFIGURATION.md](../decisions/PHASE_05_FG_PRODUCT_PROVISIONAL_CONFIGURATION.md)
- [ADR-009-FG-MASTER-DATA-DOMAIN.md](../architecture/ADR-009-FG-MASTER-DATA-DOMAIN.md)
- [TRACEABILITY_MATRIX.md](../requirements/TRACEABILITY_MATRIX.md)
