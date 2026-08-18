# ADR-048 — Product Recall / Withdrawal Case Management

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-10  
**Phase:** 37  

## Context

Recall, Food Safety, QA, Logistics, ERP, and governance need controlled
recall/withdrawal case management with genealogy-backed scope and quantity
reconciliation — without inventing regulatory classes, reporting times, or
automatic authority/customer notification obligations.

## Decision

1. New modular-monolith app `apps.recall` stores organization-scoped recall /
   withdrawal cases with opaque case ID, type/procedure reference, reason,
   initiator, status, scope, owner, and closure fields.
2. Affected products and batches are opaque references; batch selection may
   expand via Phase 36 `apps.batch_genealogy` traces (ERP-sourced only).
3. Quantity reconciliation stores opaque produced / distributed / remaining /
   recovered / disposed / reworked references — **no invented acceptable
   variance**.
4. Communication records store references/evidence only; they do **not** send
   messages. External notification and ERP distribution pulls are dual-gated
   OFF (`RECALL_EXTERNAL_NOTIFICATION_APPROVED`,
   `RECALL_ERP_DISTRIBUTION_PULL_APPROVED` + org policy; APR-062).
5. `initiate_recall` is high-risk and requires an **explicit scoped Role grant**.
   System Admin / `is_staff` / Django `is_superuser` do **not** automatically
   hold recall initiation authority.
6. Immutable append-only `RecallTimelineEntry` plus `security_audit` events
   provide a full case timeline.

## Consequences

- Company recall/withdrawal procedure, SoD, and any live notification/ERP
  cutover remain **EVIDENCE REQUIRED** (APR-062).
- No regulatory class catalogue or reporting-time SLA is seeded.

## Related

- ADR-047 Batch Genealogy, ADR-029 Integrations, ADR-002 PostgreSQL SoR
