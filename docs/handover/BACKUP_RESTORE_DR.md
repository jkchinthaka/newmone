# Backup / restore / DR

PostgreSQL is the system of record. MongoDB is not.

## Non-production drill

Run `python scripts/ops/restore_drill.py` on an approved non-production workstation.

- Host tools: `psql` / `pg_dump` / `pg_restore` on PATH, or
- Docker: `RESTORE_DRILL_DOCKER_SERVICE=postgres`

The script writes `docs/operations/RESTORE_DRILL_EVIDENCE.md`.
RPO/RTO remain **COMPANY DECISION REQUIRED**.

## Attachments

Evidence files live in object storage (MinIO locally; S3-compatible in production).
Object-store backup/restore is a separate operator procedure. Do not assume database restore includes photos.

## RPO / RTO decision package

Do **not** invent company targets. Choose and approve in writing:

| Candidate | Options (examples only) | Decision |
| --- | --- | --- |
| RPO | 15 min / 1 hour / 24 hour | BUSINESS/IT DECISION REQUIRED |
| RTO | 1 hour / 4 hour / next business day | BUSINESS/IT DECISION REQUIRED |

Backup frequency and restore staffing must match the approved pair.

## Restore drill classification

```text
RESTORE DRILL:
LOCAL / TEST ONLY
```

Do not claim production DR evidence from a laptop drill.

## Production

Do not run the scratch-DB drill against production. Production backup ownership is unassigned until IT names it.
