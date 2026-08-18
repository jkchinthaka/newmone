# ADR-059 — Process FMEA Management

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-11  
**Phase:** 48  

## Context

Process Quality, FMEA facilitation, production, and risk need a structured
Process FMEA register linked to the existing quality-risk architecture. The
repository must not assume RPN thresholds or Action Priority methodology
without a company-approved scoring model.

## Decision

1. New modular-monolith app `apps.process_fmea` stores organization-scoped
   `ProcessFmea` records with owner-supplied identifiers.
2. Content lives on `ProcessFmeaVersion`. Approved, superseded, and withdrawn
   versions are historically immutable. Changes create a new revision.
3. Domain structure is generic: process step, failure mode, failure effect,
   potential cause, current control, recommended action.
4. Assessments may record severity, occurrence, and detection as owner-supplied
   inputs. Automatic S×O×D calculation runs only after
   `ProcessFmeaScoringPolicy` is explicitly enabled with an owner-cited formula
   kind (`SOD_PRODUCT` or `OWNER_SUPPLIED`). Default is **OFF** / `NONE`.
5. The application does not invent RPN thresholds, RAG bands, 1–10 scales, or
   Action Priority tables. A calculated product is not a risk decision.
6. Versions may cite Process, HACCP, checklist, quality risk, NCR, CAPA, and
   change control.
7. Recommended actions become CAPA or change requests only through
   `explicit_user_action=True` and `link_processfmea_action`.
8. Approval uses `approve_processfmea`, separate from draft management.

## Consequences

- Company PFMEA method, S/O/D scales, RPN/AP use (if any), and review cadence
  remain **EVIDENCE REQUIRED** (APR-073).

## Related

- ADR-058 quality risk management, ADR-055 change control, ADR-023 HACCP
