# Phase 04A Test Plan — Configurable Shift Foundation

**Document status:** Phase 04A technical foundation
**Last updated:** 2026-08-07
**Coverage gate:** ≥80% (`apps` + `config`)
**Database:** PostgreSQL only (no SQLite)

## Scope

Automated tests for the configurable, **unseeded** Shift domain foundation.

Synthetic codes only (examples): `ORG-TEST`, `SITE-TEST`, `DEPT-TEST`, `SHIFT-TEST`.

No Nelna operational shift names, codes, or times.

## Model and constraints

- Organization-wide / site-wide / department-specific Shift
- Department without site rejected
- Cross-organization and cross-site references rejected
- `effective_to` before `effective_from` rejected
- Code normalization (trim + uppercase); blank code/name rejected
- Duplicate codes rejected within the same scope (`nulls_distinct=False`)
- Same code allowed in different valid scopes
- Overnight derivation (`end_time <= start_time`)

## Services and authorization

- Authorized create/update/activate/deactivate
- Unauthorized and out-of-scope actions denied
- Duplicate integrity mapped to safe `ValidationError`
- No hard-delete service
- Audit events: `SHIFT_CREATED`, `SHIFT_UPDATED`, `SHIFT_ACTIVATED`, `SHIFT_DEACTIVATED`

## Selectors

- Scoped visibility; organization/site/department filters
- Active selector excludes inactive rows
- No cross-organization leakage

## Admin

- Model registered; list/search/filter configuration
- Destructive deletion restricted

## Regression

- Existing authentication, scoped RBAC, and security audit suites remain green
- No SQLite database created

## Out of scope for 04A

- Shift management frontend / operator UI
- Real business Shift seeding
- FG / checklist / recording / review / evidence modules
- Production UAT
