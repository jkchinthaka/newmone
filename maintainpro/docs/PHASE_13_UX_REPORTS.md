# Phase 13 — Role UX, Reports & Dashboards

**Branch:** `maintainpro/phase-13-ux-reports`

## Role Home

Role-aware Home cards for Requester / Technician / Supervisor / Fleet / Manager via `resolveRoleHome` and `GET /reporting-kpis/home/:role`.

## KPI definitions

Versioned catalog `KPI_FORMULA_VERSION = 2026-09-14.v1` with documented formulas and help text.
UI must not silently redefine historical KPI meaning — bump version explicitly.

## Reports

Existing reports modules retained; KPI definitions document machinery/fleet/buildings/compliance formulas for consistent tooling.
