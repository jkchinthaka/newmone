# FG Collection Manifest

Canonical machine-generated detail lives in:

[FG_MONGODB_COLLECTION_MANIFEST.md](FG_MONGODB_COLLECTION_MANIFEST.md)

Regenerate:

```bash
uv run python scripts/migration/generate_fg_collection_manifest.py
```

## Contract

```text
Production logical database: mgintginpro_prod
FG namespace prefix: fg_
Rule: fg_{django_default_db_table}
No separate FG production database
MaintainPro collections: untouched
```

## Examples

| Model | PostgreSQL table | Mongo collection |
| --- | --- | --- |
| accounts.User | accounts_user | fg_accounts_user |
| organizations.Organization | organizations_organization | fg_organizations_organization |
| organizations.Department | organizations_department | fg_organizations_department |
| checklists.ChecklistTemplate | checklists_checklisttemplate | fg_checklists_checklisttemplate |
| scheduling.ChecklistTask | scheduling_checklisttask | fg_scheduling_checklisttask |
| recording.ChecklistRecord | recording_checklistrecord | fg_recording_checklistrecord |
| recording.ChecklistSubmission | recording_checklistsubmission | fg_recording_checklistsubmission |
| reviews.SupervisorReview | reviews_supervisorreview | fg_reviews_supervisorreview |
| quality.QAReview | quality_qareview | fg_quality_qareview |
| rca.RootCauseAnalysis | (see manifest) | fg_rca_* |
| capa.CorrectiveAction | (see manifest) | fg_capa_* |
| nonconformance.* | (see manifest) | fg_nonconformance_* |
