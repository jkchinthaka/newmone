# ADR-050 — Customer Quality Complaint Management

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-10  
**Phase:** 39  

## Context

Customer Quality, QA Investigation, CAPA, and software engineering need
traceable complaint case management with batch-trace links and investigation
hooks — without inventing category/severity taxonomies, storing unnecessary
customer PII, or auto-sending customer responses.

## Decision

1. New modular-monolith app `apps.customer_complaints` stores organization-scoped
   complaint cases with opaque complaint ID, received date, channel reference,
   ERP customer reference, product, optional batch, description, configurable
   category/severity references, owner, and status.
2. Customer identity uses ERP customer master references as SoR; local display
   labels are optional and privacy-restricted
   (`view_complaint_customer_sensitive`).
3. Batch-known and batch-unknown are both supported; unknown batches are not
   invented. Batch-trace shells link to dossier, genealogy, QA disposition,
   lab, and dispatch via opaque references.
4. Investigation / RCA / NCR / CAPA links require explicit user action.
5. Communication records store references only; customer auto-response is
   dual-gated OFF (`COMPLAINT_CUSTOMER_RESPONSE_AUTO_SEND_APPROVED` + org policy;
   APR-064).
6. Category/severity config shells are empty until owners configure values —
   never a seeded Nelna taxonomy.

## Consequences

- Company complaint handling SOP, taxonomy, and response workflow remain
  **EVIDENCE REQUIRED** (APR-064).
- Evidence binaries remain in object storage via attachment IDs.

## Related

- ADR-048 Recall, ADR-046 Batch Dossier, ADR-047 Genealogy, ADR-018 NCR/CAPA
