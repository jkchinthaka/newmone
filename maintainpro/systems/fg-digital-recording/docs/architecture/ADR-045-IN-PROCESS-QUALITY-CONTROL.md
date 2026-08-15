# ADR-045 — In-Process Quality Control (IPQC) workflows

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-10  
**Phase:** 34  

## Context

Production quality needs configurable process checks during manufacture that are
**separate from Finished Goods release**. Company IPQC checklists, frequencies,
and stop-line rules remain **EVIDENCE REQUIRED** (APR-059).

## Decision

1. New modular-monolith app `apps.ipqc` orchestrates in-process checks.
2. Process-check definitions reference PUBLISHED checklist templates — **no
   hardcoded questions**.
3. Triggers supported as shells: `TIME_INTERVAL`, `SHIFT`, `PRODUCTION_ORDER`,
   `BATCH`, `MANUAL` (company frequencies not seeded).
4. Process context captures Product, production line code, process step, shift,
   batch/order when available; frozen in `frozen_process_context`.
5. Measurements reuse ProductSpecification evaluation, equipment device
   traceability, sampling engine (`IN_PROCESS`), and HACCP metadata snapshots.
6. Failed IPQC does **not** stop production unless dual-gated
   (`IpqcWorkflowPolicy.stop_production_on_fail_enabled` **and**
   `IPQC_STOP_PRODUCTION_ON_FAIL_APPROVED`).
7. Escalation to NCR/HOLD is **controlled and explicit** — never automatic from
   FAIL alone.
8. Completing an IPQC case is **not** Finished Goods RELEASE.
9. Dashboard selectors expose due / overdue / failure visibility.

## Consequences

- Company process-check catalogues, line-stop SOP wiring, and SoD remain
  **EVIDENCE REQUIRED** (APR-059).
- FG release workflows remain outside this phase.

## Related

- ADR-044 (IQC), ADR-019 (checklist engine), ADR-037 (device trace), Phase 24
  sampling, Phase 23 HACCP, Phase 12 NCR/HOLD
