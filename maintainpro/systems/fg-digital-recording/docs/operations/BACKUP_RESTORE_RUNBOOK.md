# Backup and Restore Runbook — Phase 19

## What to back up

| Asset | Method | Owner |
| --- | --- | --- |
| PostgreSQL (SoR) | `scripts/ops/backup_postgres.sh` (`pg_dump -Fc`) | COMPANY-APPROVED OPERATOR |
| Evidence files | `scripts/ops/backup_evidence_tree.sh` | COMPANY-APPROVED OPERATOR |
| Critical config | `scripts/ops/backup_critical_config.sh` (inventory only) + vault-held secrets | IT |

MongoDB is **not** the system of record. If a Mongo POC database exists, treat backups as optional lab data only.

## Encryption / custody

Backup media and object targets must be encrypted and retained under company-approved custody. Do not store production dumps in the application git repository.

## Restore drill (mandatory)

A backup without restore evidence is incomplete.

```bash
# Non-production only (host PostgreSQL clients)
export RESTORE_DRILL_SOURCE_DB=...   # non-prod
export RESTORE_DRILL_SCRATCH_DB=nelna_fg_restore_drill
python scripts/ops/restore_drill.py

# Or against local Compose postgres service (no host psql required)
export RESTORE_DRILL_DOCKER_SERVICE=postgres
export POSTGRES_USER=nelna_fg
export POSTGRES_PASSWORD=...
python scripts/ops/restore_drill.py
```

Record outcome in [RESTORE_DRILL_EVIDENCE.md](RESTORE_DRILL_EVIDENCE.md).
