# Phase 46 — Compliance Control Mapping Foundation

**Status:** Technical foundation delivered  
**Approval:** APR-071 EVIDENCE REQUIRED  
**ADR:** [ADR-057](../architecture/ADR-057-COMPLIANCE-CONTROL-MAPPING.md)

## Purpose

Provide a controlled compliance/control-mapping framework so owners can
record which system controls may supply evidence for company-applicable
standards, policies, and regulations.

## Non-claims

This phase does **not** claim:

- ISO certification
- FSSC certification
- HACCP certification
- SLS / SLSI compliance
- legal compliance
- regulatory approval

System controls can **support** compliance evidence. Software implementation
alone does **not** prove regulatory or certification compliance.

## Source register

Capable of recording: Source ID, standard/regulation/company policy, version
or edition, applicability status, business owner, evidence reference, last
reviewed date, and register status.

Possible source kinds (architectural only): company policies, approved HACCP
plan, customer requirements, legal/regulatory requirements, certification-
scheme requirements. None are pre-marked applicable.

## Mapping

Requirement / clause → system control → evidence record → owner →
implementation status → verification status → gap / action.

## Status model

`NOT_ASSESSED`, `APPLICABILITY_PENDING`, `APPLICABLE`, `NOT_APPLICABLE`,
`CONTROL_DESIGNED`, `IMPLEMENTED`, `VERIFIED`, `GAP_IDENTIFIED`.

`IMPLEMENTED` ≠ `COMPLIANT`. There is no `COMPLIANT` status.

## External requirements

If an external standard is recorded, store the exact official source and
version citation only. Do not paste copyrighted or proprietary requirement
text from memory.

## Gap follow-up

Risk, Change Request, NCR, CAPA, and generic Action require explicit
authorized action. Findings/gaps never auto-create CAPA.

## Authorization

- `view_compliancemapping` — read-only auditor access
- `manage_compliancesource` / `manage_compliancecontrol` — restricted administration
- `verify_compliancecontrol` — verification of implemented controls
- `link_compliance_gap_action` — explicit gap follow-up

## Still required from the company

Official source list and editions, applicability decisions, clause text from
licensed/owned documents, owner mapping, and any certification-scheme scope
(APR-071).

## STATUS: PHASE 46 COMPLIANCE MAPPING COMPLETE
