# Phase 05 — Configurable FG Product Provisional Configuration

**Document status:** Owner-directed provisional technical decision — not real-data approval  
**Created:** 2026-08-07  
**Decision date:** 2026-08-07

## Facts

1. MASTER-001 evidence is incomplete. No official Product Master field inventory or pilot dataset was supplied.
2. Development proceeds with a **minimum configurable FG Product foundation** only.
3. This is a **technical design decision**. It is **not** proof of the final Nelna ERP/business Product Master schema.
4. No real product codes, names, catalogues, or ERP mappings may be invented or seeded.
5. FG Product is **organization-scoped** provisionally.
6. Normalized Product code uniqueness is **per Organization** provisionally (not claimed as ERP policy).
7. Site and Department are **not** part of Product ownership in Phase 05A. Site-only management does **not** imply Product management until business scope is evidenced (confirmed in Phase 05B).
8. Category, UOM, barcode, ERP IDs, production line, work center, temperature class, instruments, training, and related attributes are **explicitly excluded**.
9. Real ERP source-of-truth and import/migration formats remain unresolved.
10. MASTER-001 remains **EVIDENCE REQUIRED**.
11. Phase 06 must not rely on unsupported Product attributes.
12. This decision does **not** authorize pilot, deployment, or production use.

## Provisional technical rules

1. One master entity: `FGProduct` in the `master_data` bounded context.
2. Required fields: organization, code, name; optional description; `is_active`; timestamps; UUID PK.
3. Code: trim + uppercase; reject blank.
4. Name: trim; reject blank; preserve display case.
5. Description: optional; trimmed; blank allowed.
6. Organization is immutable after create.
7. No hard-delete service; use activate/deactivate.
8. Permissions: `master_data.view_fgproduct`, `master_data.manage_fgproduct`.
9. Authorization is organization-scoped and deny-by-default.
10. Mutations emit `FG_PRODUCT_*` security audit events.

## Field limits

| Field | Limit |
| --- | --- |
| `code` | 64 characters (normalized uppercase) |
| `name` | 255 characters (trimmed only) |
| `description` | Text, optional |

## MASTER-001 status

| Topic | Status |
| --- | --- |
| Official Product Master field inventory | Unresolved — EVIDENCE REQUIRED |
| Actual product codes / names | Unresolved |
| ERP source of truth | Unresolved |
| Site applicability | Unresolved — not modeled in 05A |
| Category / UOM / integration IDs | Unresolved — excluded from 05A |
| Technical unseeded foundation | Provisionally unblocked |
| Real-data / pilot / production | Remains blocked |

## Related

- [ADR-009-FG-MASTER-DATA-DOMAIN.md](../architecture/ADR-009-FG-MASTER-DATA-DOMAIN.md)
- [ASSUMPTION_REGISTER.md](../business/ASSUMPTION_REGISTER.md)
- [ROADMAP.md](../ROADMAP.md)
