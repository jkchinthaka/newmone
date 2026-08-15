# ADR-034 — Phase 20 UAT / pilot evidence gate

**Status:** Accepted (process)  
**Date:** 2026-08-10  
**Phase:** 20

## Context

Production go-live requires controlled real-business validation. Automation and agents can prepare plans and templates but cannot substitute for named business/QA/IT execution and signoff.

## Decision

1. Phase 20 delivers a UAT/pilot **framework** (scenarios, test records, pilot scope capture, baseline metrics, parallel-run log, defect log, blank signoff).
2. **UAT PASSED** / **PILOT PASSED** may be set only when real evidence exists in `docs/uat/` filled records and blank signoff forms completed by named owners.
3. Agents must not invent PASS/FAIL, pilot duration, product lists, or signatures.
4. PostgreSQL remains SoR for pilot readiness; MongoDB POC stability is not a substitute gate.
5. Until prerequisites and signoffs exist, project status remains **PHASE 20 UAT/PILOT BLOCKED**.

## Consequences

- Phase 21 production release remains blocked on Phase 20 pass.
- Framework documents are safe to maintain on `main`; execution evidence should cite build IDs and named approvers.

## Note

ADR-032 is reserved for Laboratory / LIMS foundation. This UAT gate is **ADR-034**.
