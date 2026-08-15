# ADR-017 — QA Final Review Disposition

**Status:** Accepted (Phase 10A technical foundation)
**Date:** 2026-08-08
**Deciders:** Engineering (quality-first direct-main)
**Related:** ADR-014, ADR-015, ADR-016; PHASE_10_QA_REVIEW_READINESS_GATE

## Context

After Supervisor APPROVED on an immutable ChecklistSubmission, owners require a
manual QA final disposition recorded in the application.

## Decision

### Bounded context

QA disposition lives in `apps.quality` as `QAReview`, separate from Supervisor
`apps.reviews`. MODULE_MAP Phase 10 owns quality verification/disposition.

### Submission-specific identity

`QAReview` is OneToOne to `ChecklistSubmission` and also OneToOne to the exact
`SupervisorReview` that made it eligible. Historical QA decisions stay on their
submission forever.

### Eligibility

Only the latest submission for a SUBMITTED record, with Supervisor APPROVED,
no existing QAReview, and a PENDING (not CANCELLED) task may receive QA review.

### Manual provisional decisions

`RELEASE` / `HOLD` / `REJECT` are owner-directed provisional workflow labels.
They are recorded only after an explicit human action. Response values never
auto-derive disposition. No ERP / warehouse / dispatch / inventory side effects.

### Permission

`quality.qa_review_checklistsubmission` is distinct from Supervisor review,
record, and manage permissions. No automatic role mapping.

### Immutability / concurrency

One QAReview per submission. Same-decision requests are idempotent. Different
decision after review conflicts. Race-safe via locks + unique constraint.

### Record / task status

ChecklistRecord remains SUBMITTED. ChecklistTask remains PENDING. Operational
workflow labels are derived (Phase 10B / ADR-022) — not duplicated onto these models.

### Privacy

QA notes are optional; note-required-by-disposition remains EVIDENCE REQUIRED.
Notes and answer values are never written to audit metadata.

### SoD

Segregation-of-duties (recorder / Supervisor / QA) remains EVIDENCE REQUIRED
and is not enforced in Phase 10A. Actor fields remain separately persisted.

## Consequences

Technical end-to-end foundation may include Task → Record → Submit → Supervisor
→ Correction → Supervisor → QA disposition. Production use remains BLOCKED until
published definitions, role mappings, and disposition follow-up evidence exist.
