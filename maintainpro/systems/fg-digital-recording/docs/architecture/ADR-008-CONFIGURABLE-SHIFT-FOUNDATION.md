# ADR-008 — Configurable Shift Foundation

**Status:** Accepted (provisional technical direction for Phase 04A)
**Date:** 2026-08-07
**Phase:** 04A — Configurable Shift domain foundation

## Context

Phase 04 requires Shift support after organization hierarchy confirmation. Official ASM-004 / ASM-005 / ASM-006 business values (names, codes, timings, overnight policy) were not supplied. Waiting indefinitely blocks technical progress. The project owner directed a configurable, unseeded foundation.

## Decision

Implement a **configurable Shift** entity in `organizations` with:

- Required Organization scope; optional Site and Department narrowing
- Administrator-configured codes and names (no seeded business rows)
- Required start/end times with derived overnight (`end_time <= start_time`)
- Required `effective_from`; optional `effective_to`
- Soft activate/deactivate lifecycle (no hard delete via application services)
- PostgreSQL uniqueness of normalized code within scope using `nulls_distinct=False`
- Scoped permissions `organizations.view_shift` and `organizations.manage_shift`
- Security audit events for create/update/activate/deactivate

## Consequences

- Development can proceed without inventing Nelna operational values.
- Real Shift configuration remains an administrator/owner action after evidence.
- ASM-004 / ASM-005 / ASM-006 remain partially unresolved.
- Phase 04B management UI is delivered; real-data UAT remains pending.
- No deployment, pilot, or production authorization is granted by this ADR.
- DEBT-01C-R-NOTO remains open and unrelated to Shift foundation.

## Alternatives considered

1. **Block until ASM evidence** — rejected by owner direction for this provisional slice.
2. **Seed Day/Night defaults** — rejected; invents business values.
3. **Complex multi-version Shift history in 04A** — deferred; one definition per code/scope for this slice.

## References

- [PHASE_04_SHIFT_PROVISIONAL_CONFIGURATION.md](../decisions/PHASE_04_SHIFT_PROVISIONAL_CONFIGURATION.md)
- [MODULE_MAP.md](MODULE_MAP.md)
- [ASSUMPTION_REGISTER.md](../business/ASSUMPTION_REGISTER.md)
