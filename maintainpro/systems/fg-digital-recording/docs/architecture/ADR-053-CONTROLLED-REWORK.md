# ADR-053 — Controlled Rework Management

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-11  
**Phase:** 42  

## Context

Rework, Production, QA, Traceability, and ERP Integration teams need controlled
rework handling with source/result genealogy. QA/return REJECT must not
automatically become rework. Original QA review, HOLD, REJECT, and NCR history
must remain unchanged. ERP remains the inventory ledger.

## Decision

1. New modular-monolith app `apps.rework` stores organization-scoped rework
   cases with source batch/sub-lot, quantity/UOM, reason, instruction reference,
   authorization, started/completed timestamps, resulting batch, remaining
   source quantity, and status.
2. Creation and authorization are separate explicit permissions
   (`create_reworkcase`, `authorize_reworkcase`). Execution is a third grant.
   REJECT does not create a rework case.
3. Completion records genealogy: original FG batch → REWORK_BATCH via
   `REWORKED_FROM`, preserving source quantity, resulting quantity, and
   remaining source quantity. Numeric references must conserve
   (source = resulting + remaining). Opaque non-numeric triples are allowed
   when all three are present.
4. Optional pointers to original QA review / HOLD / NCR are read-only links.
   Rework services never mutate those records.
5. Reinspection uses the checklist engine against the **resulting** batch only.
   Source RELEASE / source batch tasks are never reused.
6. Duplicate `execution_key` within an organization is idempotent for the same
   payload and rejected for conflicting payloads.
7. ERP quantity/status updates are dual-gated OFF
   (`REWORK_ERP_STOCK_MOVEMENT_APPROVED` + org policy stub). The outbound
   boundary prepares commands but refuses transmission until integration
   evidence exists (APR-067).

## Consequences

- Company rework SOP, authorization SoD, and ERP movement enablement remain
  **EVIDENCE REQUIRED** (APR-067).
- Genealogy ingest uses a local source-system marker (`nelna.rework`) plus
  opaque event id; it does not invent ERP inventory movements.

## Related

- ADR-018 NCR/Hold, ADR-022 workflow, ADR-047 genealogy, ADR-051 returns
