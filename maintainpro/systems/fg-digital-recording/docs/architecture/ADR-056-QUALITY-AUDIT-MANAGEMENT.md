# ADR-056 — Quality Audit Management

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-11  
**Phase:** 45  

## Context

Internal Audit, QMS, CAPA, Reporting, and software engineering need structured
planning, execution, findings, and follow-up for quality audits. This QMS
module is not the security event log (`apps.security_audit`). Company audit
frequency and severity taxonomies must not be invented.

## Decision

1. New modular-monolith app `apps.quality_audits` stores organization-scoped
   `QualityAudit` plans with owner-supplied identifiers (not seeded).
2. Architectural audit types are generic only: Internal, External, Supplier,
   Process, System. Optional `type_code_reference` remains empty until owners
   configure a catalogue (APR-070). Frequency is not stored as a company rule.
3. Lifecycle is `PLANNED` → `IN_PROGRESS` → `FINDINGS` → `CLOSED`, with
   `CANCELLED` from planned/in-progress. This is a technical workflow only.
4. Audit checklists reuse the Checklist Engine only after an explicit
   `QualityAuditChecklistBinding`. Operational FG checklists are not reused
   automatically.
5. `QualityAuditFinding` is generic: description, reference, optional
   owner-configured classification/severity codes, owner, due date, status.
   No seeded severity taxonomy.
6. NCR/CAPA may be linked or created only through
   `link_audit_quality_case` with `explicit_user_action=True` and a separate
   permission. Findings never auto-create CAPA. Owner-supplied case codes are
   required when creating.
7. Finding follow-up is `OPEN` → `ACTION_COMPLETED` → `VERIFIED` → `CLOSED`.
8. Files use Phase 11 private evidence via
   `EvidenceLinkedKind.QUALITY_AUDIT_FINDING`.
9. Auditor permissions (`plan` / `execute` / `close` / `link`) are distinct
   from operational QA review authority.
10. Reporting selectors provide open findings, overdue findings, audit status
    counts, CAPA links, and site/process trend aggregates.

## Consequences

- Audit programme frequency, severity catalogue, and close-all-findings rules
  remain **EVIDENCE REQUIRED** (APR-070).
- Security audit events remain a separate control plane.

## Related

- ADR-018 NCR/CAPA, ADR-023 evidence, ADR-007 scoped RBAC
