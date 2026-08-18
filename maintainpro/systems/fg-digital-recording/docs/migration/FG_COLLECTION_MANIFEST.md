# FG Collection Manifest

Canonical machine-generated detail lives in:

[FG_MONGODB_COLLECTION_MANIFEST.md](FG_MONGODB_COLLECTION_MANIFEST.md)

Regenerate:

```bash
uv run python scripts/migration/generate_fg_collection_manifest.py
```

## Contract

```text
Production logical database: maintainpro_prod
FG namespace prefix: fg_
Rule: fg_{django_default_db_table}
No separate FG production database
MaintainPro collections: untouched
```

## Isolated POC proof (fg_same_db_poc)

```text
DATE: 2026-08-13
SETTINGS: config.settings.mongo_same_db_poc
DATABASE: fg_same_db_poc (NOT maintainpro_prod)
TOPOLOGY: compose.mongo-poc.yaml replica set nelnaPocRs @ 127.0.0.1:27027
MIGRATE: succeeded
COLLECTIONS_AFTER_MIGRATE: 232
PREFIXED_fg_: 232
UNPREFIXED_APP_COLLECTIONS: 0
MODEL_MANIFEST_COUNT: 231 (generated)
fg_accounts_user: present
fg_django_migrations: present
fg_auth_permission: present
fg_django_content_type: present
```

Runtime enforcement:

- `apply_fg_collection_namespace()` sets live `model._meta.db_table`
- `DatabaseSchemaEditor.create_model` / `get_collection` prefix DDL
- `DatabaseWrapper.get_collection` prefixes ORM writes (including historical models during post_migrate)

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
| django.contrib.auth.Permission | auth_permission | fg_auth_permission |
| django.contrib.contenttypes.ContentType | django_content_type | fg_django_content_type |
| django.contrib.sessions.Session | django_session | fg_django_session |
| MigrationRecorder | django_migrations | fg_django_migrations |
