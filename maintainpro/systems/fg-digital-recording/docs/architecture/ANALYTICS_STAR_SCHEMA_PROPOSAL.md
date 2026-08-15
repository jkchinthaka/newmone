# Analytics Star Schema Proposal — Phase 65

**Document status:** Proposed design (not implemented warehouse)  
**Last updated:** 2026-08-10  
**ADR:** [ADR-021](ADR-021-QUALITY-ANALYTICS-DATA-PLATFORM.md)

## Intent

Define analytics-friendly facts/dimensions for when a warehouse becomes justified. This is **not** authorization to build or load production BI content. No Nelna KPI targets, temperature classes, or CCP rates are invented here.

## Proposed facts (illustrative grains)

| Fact | Grain | Primary operational source | Status |
| --- | --- | --- | --- |
| `fact_checklist_submission` | one row per `ChecklistSubmission` | `recording` | Foundation extract supported |
| `fact_qa_disposition` | one row per `QAReview` | `quality` | Foundation extract supported |
| `fact_supervisor_review` | one row per `SupervisorReview` | `reviews` | Lineage TBD when prioritized |
| `fact_ncr` | one row per NC (when matured) | `nonconformance` | Placeholder |
| `fact_capa` | one row per CAPA (when matured) | `capa` | Placeholder |
| `fact_supplier_quality_event` | one row per event | `supplier_quality` | Placeholder |
| `fact_lab_result` / complaints / production quality | OWNER REQUIRED | Not evidenced | Do not invent |

## Proposed dimensions

`dim_organization`, `dim_template`, `dim_version`, `dim_date`, optional `dim_product` (only after MASTER-001 evidence).

## Immutability

Analytical facts for submissions and QA dispositions must reflect **immutable operational records**. Corrections create new submissions; facts should append new submission numbers rather than rewrite history.

## BI integration

Keep BI tooling **generic** (ODBC/JDBC/SQL views or approved semantic layer). Do not hard-require Power BI, Tableau, or Looker until company selection is recorded (OWNER REQUIRED).

## Staging vs warehouse

Phase 65 may land **staging rows in PostgreSQL** for ETL contract tests. Staging ≠ warehouse. External analytics store remains blocked by the justification gate.
