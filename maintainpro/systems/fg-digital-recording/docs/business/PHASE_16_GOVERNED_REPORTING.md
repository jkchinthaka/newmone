# Phase 16 — Governed Quality Reporting

**Document status:** Technical foundation  
**Phase:** 16  
**ADR:** [ADR-028-GOVERNED-QUALITY-REPORTING.md](../architecture/ADR-028-GOVERNED-QUALITY-REPORTING.md)

## Goal

Provide governed operational reports and CSV exports with org/site RBAC, immutable historical sources, and audited sensitive downloads.

## Delivered

- Report catalogue (9 codes): batch checklist, submission history, Supervisor review, QA disposition, corrections, HOLD/NCR/CAPA, overdue, audit, integration failures
- Org-scoped permissions: view catalogue / run / export
- Immutable submission snapshots for historical answer-bearing paths (never draft `ChecklistResponse`)
- Filters: date range, batch, product (where modeled), site, department, shift, status, user/reviewer, disposition
- CSV export with formula-injection protection
- Background `ReportRun` generation via Celery for large/async requests
- Audit events for enqueue, complete, export, download
- Tests: RBAC, cross-org, filter accuracy, historical integrity, CSV injection, pagination / async enqueue

## Explicit non-claims

- Excel/PDF not implemented
- No invented Nelna official report packs or compliance certifications
- Not production-ready without UAT, role mapping, and owner approval

## STATUS: PHASE 16 REPORTING COMPLETE
