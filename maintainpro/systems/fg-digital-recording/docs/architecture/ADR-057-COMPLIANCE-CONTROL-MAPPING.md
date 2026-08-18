# ADR-057 — Compliance Control Mapping Foundation

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-11  
**Phase:** 46  

## Context

QMS, Food Safety, Internal Audit, Security, and Technical Writing need a
controlled register that shows which *system controls* can supply evidence
against company-applicable sources (policies, approved HACCP plans, customer
requirements, legal/regulatory requirements, certification-scheme
requirements).

The repository must not claim ISO, FSSC, HACCP, SLS/SLSI, legal, or
regulatory compliance unless verified company evidence explicitly proves it.

## Decision

1. New modular-monolith app `apps.compliance_mapping` stores
   organization-scoped `ComplianceSource` records with owner-supplied
   identifiers. Sources are not seeded with applicability claims.
2. Each source has versioned `ComplianceSourceEdition` rows that record
   exact official publisher/version citations only. Copyrighted or
   proprietary requirement text is not reproduced from memory.
3. Default applicability is `NOT_ASSESSED`. Supported applicability values
   are `NOT_ASSESSED`, `APPLICABILITY_PENDING`, `APPLICABLE`, and
   `NOT_APPLICABLE`.
4. `ComplianceControlMapping` maps an owner-supplied clause/requirement
   reference to a system control, evidence citations, owner, implementation
   status, verification status, and gap/action. Mapping statuses are
   truthful: `NOT_ASSESSED`, `APPLICABILITY_PENDING`, `APPLICABLE`,
   `NOT_APPLICABLE`, `CONTROL_DESIGNED`, `IMPLEMENTED`, `VERIFIED`,
   `GAP_IDENTIFIED`. There is no `COMPLIANT` status.
   **`IMPLEMENTED` is not `COMPLIANT`.**
5. Evidence citations may reference checklist definitions, HACCP controls,
   training, calibration, laboratory, NCR/CAPA, QMS audit records, document
   versions, system security controls, and backup/DR evidence.
6. A gap may create or link Risk (owner-supplied register ID), Change
   Request, NCR, CAPA, or a generic Action only through
   `explicit_user_action=True` and `link_compliance_gap_action`.
7. Administration is restricted. Read-only auditor access uses
   `view_compliancemapping` only.
8. Mapping changes, applicability decisions, and verification updates write
   append-only `ComplianceMappingEvent` rows and separate `security_audit`
   events. These are not QMS quality-audit records.

## Consequences

- Company source catalogues, official editions, applicability decisions,
  and clause text remain **EVIDENCE REQUIRED** (APR-071).
- Software implementation of a control is evidence *support*, not
  certification or legal compliance.

## Related

- ADR-056 quality audits, ADR-054 document control, ADR-055 change control,
  ADR-023 evidence, ADR-007 scoped RBAC
