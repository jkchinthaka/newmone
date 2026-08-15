# ADR-055 — Quality Change Control

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-11  
**Phase:** 44  

## Context

Quality Change Control, Product, Architecture, QA, and governance need formal
records for significant quality, process, and configuration changes. Engineering
delivery of a version or mapping must not be treated as business approval.

## Decision

1. New modular-monolith app `apps.change_control` stores organization-scoped
   `QualityChangeRequest` records with owner-supplied change identifiers (not
   seeded Nelna codes).
2. Architectural lifecycle is `REQUESTED` → `ASSESSMENT` → `APPROVED` →
   `IMPLEMENTING` → `VERIFICATION` → `CLOSED`. This is a technical flow only;
   company change-control SOP remains APR-069 EVIDENCE REQUIRED.
3. Affected areas are generic kinds: Product, Specification, Checklist, HACCP
   plan, Equipment, Process, ERP mapping, Document, Training, Site/Line. Links
   use object id and/or opaque reference. Scope is frozen after approval.
4. Impact assessment captures quality, food-safety, technical, training,
   validation, and data-migration notes before approval.
5. Implementation links cite the deployed configuration/version. Recording a
   link sets `engineering_complete` but `does_not_constitute_approval` remains
   true. Engineering completion never auto-approves or auto-closes.
6. Requester cannot approve. Approver cannot also close verification.
7. Closed records are historically immutable. Append-only events plus
   security-audit types cover the full lifecycle.

## Consequences

- Change numbering, risk scoring, and role mapping remain **EVIDENCE REQUIRED**.
- Deployed software or configuration is not evidence of approved change.

## Related

- ADR-054 document control, ADR-007 scoped RBAC, ADR-022 workflow ownership
