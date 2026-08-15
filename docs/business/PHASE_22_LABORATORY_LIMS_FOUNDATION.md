# Phase 22 — Laboratory / LIMS Foundation

**Document status:** Technical foundation  
**ADR:** [ADR-032-LABORATORY-LIMS-FOUNDATION.md](../architecture/ADR-032-LABORATORY-LIMS-FOUNDATION.md)

## Goal

Generic laboratory sample/test/result foundation capable of linking lab work to FG quality workflows.

## Delivered

- `apps.laboratory` domain models + services + selectors + admin (soft retention)
- Sample provenance links (org/site/product/batch/sub-lot/submission/NCR/hold)
- Result lifecycle with finalized immutability + amendment revisions
- Parameter definitions with optional approved bounds / specification references (unset by default)
- External lab certificate metadata hook
- Positive-release policy stub (**non-blocking by default**)
- COA interface hooks only
- Separate lab permissions + security audit events
- Tests for provenance, numeric/qualitative results, immutability, amendment, auth, cross-org, external cert, positive-release default OFF

## Explicit non-claims

- Not positive-release enablement
- Not a Nelna test catalogue / method library / limit set
- Not MongoDB SoR (PostgreSQL remains authoritative; APR-020 PENDING)
- Not Phase 21 production go-live

## Company evidence still required

- Official lab catalogue (methods, parameters, units, limits where any)
- Laboratory role mappings
- Positive-release / HOLD-until-lab-finalized policy (if any)
- External laboratory vendor list (if any)
- COA template content (if any)

## STATUS: PHASE 22 LAB LIMS FOUNDATION COMPLETE
