# Shift Management UI (Phase 04B)

**Document status:** Phase 04B operational management UI  
**Last updated:** 2026-08-07  
**Language:** English UI pending Sinhala design/UAT resolution (DEBT-01C-R-NOTO remains open)

## Purpose

Provide authorized staff with a production-quality web interface to configure and maintain Shift definitions without Django admin or direct database edits.

This is the first operational management UI in the FG Digital Recording System. It does **not** implement FG recording, checklists, or scheduling.

## Business boundaries

| Item | State |
| --- | --- |
| ASM-004 official org/site/department names/codes | Unresolved — UI is configurable only |
| ASM-005 official Shift names/codes | Unresolved — no seeded Day/Night or Nelna values |
| ASM-006 official timings / overnight operational policy | Unresolved — overnight uses Phase 04A technical rule |
| Production / UAT authorization | Not claimed |

Synthetic codes are allowed in automated tests only.

## User journey

1. Sign in  
2. Open **Shift Management** (nav / landing CTA when `view_shift` is held)  
3. Search / filter the list  
4. Create a Shift or open an existing definition  
5. Review scope, times, overnight classification, effective dates, status  
6. Edit when `manage_shift` allows  
7. Activate / deactivate when required (POST + confirmation for deactivate)

## Screen inventory

| Screen | Route | Permission |
| --- | --- | --- |
| Shift list | `/shifts/` | `organizations.view_shift` (any scope) |
| Create Shift | `/shifts/new/` | `organizations.manage_shift` |
| Shift detail | `/shifts/<uuid>/` | `view_shift` on that Shift scope |
| Edit Shift | `/shifts/<uuid>/edit/` | `manage_shift` on that Shift scope |
| Activate | `/shifts/<uuid>/activate/` | POST + `manage_shift` |
| Deactivate | `/shifts/<uuid>/deactivate/` | POST + `manage_shift` |
| Site options (HTMX) | `/shifts/options/sites/` | GET + `manage_shift` |
| Department options (HTMX) | `/shifts/options/departments/` | GET + `manage_shift` |

Navigation visibility is convenience only — every route enforces authorization server-side.

## Field behaviour

| Field | Notes |
| --- | --- |
| Organization / Site / Department | Scoped choices only; progressive HTMX enhancement |
| Code / Name | Normalized by Phase 04A services |
| Start / End time | Overnight derived when `end_time <= start_time` (technical rule) |
| Effective from / to | Optional end; invalid `effective_to < effective_from` rejected |
| Active | Create default follows model/service default; lifecycle actions also available on detail |

Scope labels (interface only): **Organization-wide**, **Site-wide**, **Department-specific**.

## Hierarchy dependent selection

- Selecting Organization refreshes allowed Sites (HTMX GET).  
- Selecting Site refreshes allowed Departments (HTMX GET).  
- Without HTMX, full-page POST validation remains authoritative.  
- Option endpoints never return out-of-scope hierarchy rows.

## Empty / error states

| Condition | Message intent |
| --- | --- |
| No shifts in scope | “No shifts have been configured yet.” (+ Create CTA if manager) |
| Filters match nothing | “No shifts match the current filters.” |
| Validation failures | Field-level + summary errors |
| Unauthorized | Repository-standard 403 / login redirect |

## Responsive strategy

- Desktop (≥768px): accessible data table  
- Narrow viewports: stacked shift cards; table hidden  
- Filters grid scales 1 → 2 → 3 columns  
- Primary actions wrap; no reliance on horizontal-only tables

## Accessibility strategy

- Semantic headings and labelled form controls  
- Status pills include text (not colour alone)  
- Table headers use `scope="col"`  
- CSRF on all mutating forms  
- Activate/deactivate are buttons in POST forms (no GET mutation)  
- Skip link and visible focus from existing shell

## Architecture

- Forms: `apps/organizations/forms.py`  
- Views: thin adapters in `apps/organizations/views.py`  
- Reads: selectors  
- Writes: Phase 04A `create_shift` / `update_shift` / `activate_shift` / `deactivate_shift`  
- Audit: service-owned `SHIFT_*` events (not duplicated in views)  
- Design: local Tailwind / tokens / existing components — no second design system

## Phase 04B boundaries

**In scope:** Shift list/search/filter/pagination, create, detail, edit, activate/deactivate, scoped RBAC UX, HTMX dependent selects.

**Out of scope:** FG product master, checklist templates/builder, recording, review, evidence, ERP/SFA, offline, mobile app, deployment, Sinhala closure, inventing ASM values.

Phase 04 is **not** fully complete merely because this UI exists — real-data configuration and remaining gates still apply.
