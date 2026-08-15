# ADR-046 — Electronic Batch Quality Dossier (EBR)

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-10  
**Phase:** 35  

## Context

QA and reporting need one aggregated view of batch quality evidence spanning
checklists, reviews, lab, IPQC, NCR/HOLD/CAPA, dispatch, evidence, and
integrations — without inventing a competing ProductionBatch master or copying
mutable operational rows.

## Decision

1. New modular-monolith app `apps.batch_dossier` provides a **read-only**
   electronic batch quality dossier assembled for one opaque `batch_reference`.
2. Source of truth remains in domain tables; the dossier holds **references**
   and **immutable snapshot excerpts** only (`mutable_records_not_duplicated`).
3. Historical answers come from immutable submissions/reviews — never draft
   `ChecklistResponse` rows.
4. Chronological `timeline` is derived from authorized section references.
5. Object-level security: `view_batchdossier` is required, and each section is
   further gated by the domain view/review permission (DENIED when missing).
6. Evidence and audit sections are **paginated**; assembly avoids unbounded
   retrieval.
7. PDF evidence-pack export is a **prepare-only hook**, dual-gated OFF
   (`BATCH_DOSSIER_PDF_EXPORT_APPROVED` + org policy) — no PDF renderer in
   Phase 35.
8. Completing/viewing a dossier is **not** an FG RELEASE decision.

## Consequences

- Official batch identifier source, dossier retention, and export SoD remain
  **EVIDENCE REQUIRED** (APR-060).
- No ProductionBatch / ProductionOrder master is introduced.

## Related

- ADR-019 checklist engine, ADR-044 IQC, ADR-045 IPQC, Phase 12 NCR/HOLD,
  Phase 16 reporting, Phase 17 integrations
