# ADR-054 — Quality Document Control

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-11  
**Phase:** 43  

## Context

QMS Document Control, QA, Security, and software engineering need controlled,
versioned management of quality procedures. Operators must see only applicable
effective documents. Approved or effective versions must not be silently edited.
Quality records must be able to cite the exact SOP / test-method version used.

## Decision

1. New modular-monolith app `apps.document_control` stores organization-scoped
   `QualityDocument` identities and `QualityDocumentVersion` revisions.
2. Architectural document kinds are generic only: SOP, Work Instruction,
   Specification, Test Method, Policy, Form Reference. Nelna document codes
   are not seeded. Optional `type_code_reference` remains empty until owners
   configure a catalogue (APR-068).
3. Version lifecycle is `DRAFT` → `UNDER_REVIEW` → `APPROVED` → `EFFECTIVE` →
   `RETIRED` (return to draft is allowed only from `UNDER_REVIEW`).
4. `APPROVED`, `EFFECTIVE`, and `RETIRED` versions are content-immutable.
   Corrections require a new revision.
5. Making a revision effective retires the previous effective version of the
   same document and preserves `effective_from` / `effective_to` for as-of
   lookup.
6. Files use Phase 11 private evidence storage via
   `EvidenceLinkedKind.QUALITY_DOCUMENT_VERSION`. Operators may view files
   only on effective versions; editors/approvers are separately authorized.
7. Optional acknowledgement records that a user read an effective version.
   Acknowledgement is explicitly **not** competency training (Phase 05E).
8. `QualityRecordDocumentLink` binds a quality record (kind + object id) to an
   exact approved, effective, or retired version.
9. Append-only `QualityDocumentEvent` plus security-audit event types cover the
   full lifecycle.

## Consequences

- Document numbering, type catalogues, acknowledgement obligation, and
  approver SoD remain **EVIDENCE REQUIRED** (APR-068).
- Acknowledgement never grants recording competency and never replaces
  training records.

## Related

- ADR-023 evidence attachments, ADR-007 scoped RBAC, Phase 05E training
