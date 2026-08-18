# Analytics Lineage Catalogue — Phase 65

**Document status:** Technical foundation  
**Last updated:** 2026-08-10  
**Rule:** Every analytical field must trace to an operational source. Fields without lineage are forbidden in staging/extract contracts.

## Conventions

| Column | Meaning |
| --- | --- |
| Analytical field | Proposed warehouse / staging attribute |
| Operational source | Django model.field (PostgreSQL SoR) |
| Transform | Deterministic mapping only — no invented business rules |
| PII | `none` / `opaque_id` / `excluded` |

## Fact: checklist submission (proposed)

| Analytical field | Operational source | Transform | PII |
| --- | --- | --- | --- |
| `submission_id` | `recording.ChecklistSubmission.id` | identity | none |
| `organization_id` | `recording.ChecklistRecord.organization_id` | via record FK | none |
| `record_id` | `ChecklistSubmission.checklist_record_id` | identity | none |
| `submission_number` | `ChecklistSubmission.submission_number` | identity | none |
| `submitted_at` | `ChecklistSubmission.submitted_at` | identity (UTC store) | none |
| `submitted_by_id` | `ChecklistSubmission.submitted_by_id` | opaque UUID only | opaque_id |
| `template_id` | `scheduling.ChecklistTask.checklist_template_id` | via record.task | none |
| `version_id` | `ChecklistTask.checklist_version_id` | via record.task | none |
| `batch_reference` | `ChecklistTask.batch_reference` | identity | none |
| `source_updated_at` | `ChecklistSubmission.submitted_at` | watermark cursor | none |

**Excluded:** employee codes, display names, passwords, session keys, free-text answer payloads (unless a future privacy-approved extract defines them).

## Fact: QA disposition (proposed)

| Analytical field | Operational source | Transform | PII |
| --- | --- | --- | --- |
| `qa_review_id` | `quality.QAReview.id` | identity | none |
| `organization_id` | `QAReview.organization_id` | identity | none |
| `submission_id` | `QAReview.checklist_submission_id` | identity | none |
| `decision` | `QAReview.decision` | identity (RELEASE/HOLD/REJECT labels as recorded) | none |
| `reviewed_at` | `QAReview.reviewed_at` | identity | none |
| `reviewed_by_id` | `QAReview.reviewed_by_id` | opaque UUID only | opaque_id |
| `review_note` | — | **excluded** (may contain sensitive free text) | excluded |

## Dimensions (proposed — not seeded)

| Dimension | Source | Notes |
| --- | --- | --- |
| `dim_organization` | `organizations.Organization` | codes/names only as configured; no invented sites |
| `dim_checklist_template` | `checklists.ChecklistTemplate` | versioned separately |
| `dim_checklist_version` | `checklists.ChecklistVersion` | immutable published/retired |
| `dim_calendar_date` | derived from timestamps | technical calendar only |

Supplier / NCR / CAPA / lab / complaints facts are **listed as future lineage placeholders** only — populate when those operational modules are evidenced and privacy-reviewed. Do not invent metrics.

## Code registry

Runtime lineage definitions live in `apps.analytics.lineage` and must stay aligned with this catalogue.
