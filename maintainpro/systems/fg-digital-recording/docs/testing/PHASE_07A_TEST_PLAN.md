# Phase 07A Test Plan — Batch Checklist Task Foundation

**Document status:** Phase 07A orchestration foundation
**Created:** 2026-08-07

## Scope

`ChecklistTask` model/services/selectors/admin/UI; PUBLISHED-only explicit version binding; org/template/batch uniqueness; cancel; audit; no recording/HOLD.

## Suites

- Model / DB integrity and uniqueness
- Service create/cancel/idempotency/version-conflict/authz
- Selectors org isolation and filters
- UI list/create/detail/cancel/CSRF/empty state
- Admin registration and delete restriction
- Architecture ALLOWED_APPS includes `scheduling`
- Regression across auth, RBAC, Shift, Product, Checklists 06A–D

## Out of scope

FG-QA-001 publish; automatic task generation; recording; Supervisor/QA workflows.
