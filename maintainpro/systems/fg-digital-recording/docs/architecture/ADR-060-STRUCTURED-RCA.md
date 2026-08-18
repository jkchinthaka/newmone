# ADR-060 — Structured Root Cause Analysis

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-11  
**Phase:** 49  

## Context

Investigation, CAPA, complaint, and audit workflows need optional structured
RCA tools. Software and future AI must not auto-confirm a root cause.

## Decision

1. New modular-monolith app `apps.rca` stores organization-scoped
   `RootCauseAnalysis` records with owner-supplied identifiers.
2. A record may cite NCR, complaint, QMS audit finding, CAPA, or another
   owner-cited source. Methods are optional: 5 Why, fishbone/Ishikawa
   categories, and a cause/evidence table. No method is mandatory.
3. Cause states are `POSSIBLE_CAUSE`, `SUPPORTED_CAUSE`, and
   `CONFIRMED_ROOT_CAUSE`. New causes are always possible. AI suggestions
   are stored only as `POSSIBLE_CAUSE` with `suggested_by_ai=True`.
4. Confirmation requires `confirm_rca`, a human actor, and an evidence
   citation or evidence link. Edit (`manage_rca`) cannot confirm.
5. Confirmed causes may create or link CAPA only through
   `explicit_user_action=True` and `link_rca_capa`.
6. Closed and cancelled records are historically immutable.

## Consequences

- Company RCA SOP, required method, and investigator SoD remain
  **EVIDENCE REQUIRED** (APR-074).

## Related

- ADR-018 NCR/CAPA, ADR-050 complaints, ADR-056 quality audits, ADR-018 AI
  advisory boundary
