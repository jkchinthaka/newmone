# ADR-058 — Quality Risk Management

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-11  
**Phase:** 47  

## Context

Quality Risk, Food Safety, QMS, and engineering need a configurable risk
register. The repository must not invent a Nelna scoring methodology,
1–5 matrix, RAG thresholds, or acceptance criteria.

## Decision

1. New modular-monolith app `apps.quality_risks` stores organization-scoped
   `QualityRisk` records with owner-supplied identifiers.
2. Domain fields are generic: category (unseeded shell), cause, potential
   impact, existing control, owner, status, mitigation, review date.
3. Assessments may record likelihood, severity, detectability, exposure, and
   residual-risk *inputs* as owner-supplied text. Historical assessment rows
   are append-only and never overwritten.
4. `QualityRiskScoringPolicy.scoring_enabled` defaults to **OFF**. Enabling
   it requires an owner-cited formula reference. The application does not
   compute a numeric matrix. Owner-supplied `computed_score_text` is refused
   while scoring is disabled.
5. High-rated dashboard membership uses only owner-configured residual-risk
   input codes on an enabled policy. Empty codes yield an empty high-rated
   list.
6. Risks may cite Product, Process, HACCP, Supplier, Equipment, system
   feature, NCR, CAPA, QMS audit, and change control.
7. Mitigations may cite CAPA, change request, training, document, or control.
   CAPA/change creation requires explicit follow-up and owner-supplied codes.
8. Residual acceptance requires `accept_qualityrisk`, separate from manage.

## Consequences

- Company scoring method, category catalogue, review cadence, and acceptance
  criteria remain **EVIDENCE REQUIRED** (APR-072).

## Related

- ADR-057 compliance mapping, ADR-056 quality audits, ADR-055 change control,
  ADR-018 NCR/CAPA
