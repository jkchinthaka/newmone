# ADR-028 — Governed quality reporting

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-10  
**Phase:** 16

## Context

Operators, Supervisors, QA, and auditors need org-scoped operational reports and exports without reading mutable draft answers as historical truth, without inventing compliance packs, and without leaking cross-organization data.

## Decision

1. Introduce `apps.reports` with a technical **report catalogue** (batch checklist, submission history, Supervisor review, QA disposition, corrections, HOLD/NCR/CAPA, overdue, audit, integration failures).
2. Every run is authorized via deny-by-default RBAC (`view_reportcatalogue`, `run_qualityreport`, `export_qualityreport`) scoped to the active organization; optional `site_id` filters must fall within the caller's accessible sites, and site-scoped actors are constrained to those sites.
3. Historical submission/review/QA/correction reports use **immutable** `ChecklistSubmission` / review models — never mutable `ChecklistResponse` drafts. A hard guard rejects draft response as a report source.
4. Filters (date range, batch, product, site, department, shift, status, user/reviewer, disposition) apply where the underlying model supports them. `ChecklistTask` has no site/product FK; site filters use assigned department site when present.
5. **CSV** is the Phase 16 export format, with formula-injection sanitization (`=+-@` neutralized). Excel/PDF are explicitly not implemented until owner-approved libraries and need exist.
6. Large runs (`limit` above sync soft threshold, or `force_async`) enqueue Celery background generation into `ReportRun`.
7. Export and download paths emit security audit events (`REPORT_EXPORTED`, `REPORT_EXPORT_DOWNLOADED`, plus enqueue/complete).

## Consequences

- Official Nelna report packs, distribution lists, and compliance claims remain **EVIDENCE REQUIRED**.
- Call sites must not treat catalogue titles as certified audit packs.
- Product filter on task reports is deferred until an owner-approved join exists.
