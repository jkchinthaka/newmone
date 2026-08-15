# FG Product Management UI (Phase 05A / 05B)

**Document status:** Phase 05A operational management UI + Phase 05B authorization hardening
**Last updated:** 2026-08-07
**Language:** English UI pending Sinhala design/UAT resolution (DEBT-01C-R-NOTO remains open)

## Purpose

Authorized staff configure and maintain FG Product definitions without Django admin or direct database edits.

## Boundaries

- Configurable, unseeded foundation only.
- MASTER-001 remains evidence-required.
- No category/UOM/ERP fields.
- No checklist/recording functionality.
- Phase 05A Product ownership is organization-scoped. Site-only management does not imply Product management until business scope is evidenced.

## Screens

| Screen | Route | Permission |
| --- | --- | --- |
| List | `/products/` | org-level `master_data.view_fgproduct` (at least one Organization) |
| Create | `/products/new/` | org-level `master_data.manage_fgproduct` (at least one Organization) |
| Detail | `/products/<uuid>/` | view on product organization |
| Edit | `/products/<uuid>/edit/` | manage on product organization |
| Activate / Deactivate | POST only | manage on product organization |

## Authorization affordances (05B)

- Create CTA: only when actor has ≥1 manageable Organization.
- List Edit: only when `product.organization_id` is in precomputed `manageable_organization_ids` (no per-row permission queries).
- Detail Edit / Activate / Deactivate: object-aware manage check.
- Filter Organization choices: view-scope only.
- Create Organization choices: manage-scope only.
- Server-side services remain authoritative; UI absence ≠ authorization.

## UX notes

- Organization immutable after create.
- Empty states distinguish “none configured” vs “no filter matches”.
- Desktop table / mobile cards (shared management CSS with Shift UI).
- Overnight/Shift-specific concepts do not apply.

## Related

- [PHASE_05_FG_PRODUCT_PROVISIONAL_CONFIGURATION.md](../decisions/PHASE_05_FG_PRODUCT_PROVISIONAL_CONFIGURATION.md)
- [ADR-009-FG-MASTER-DATA-DOMAIN.md](../architecture/ADR-009-FG-MASTER-DATA-DOMAIN.md)
