# Mongo Primary Key Matrix

Canonical generated detail:

[MONGODB_PRIMARY_KEY_PLAN.md](MONGODB_PRIMARY_KEY_PLAN.md)

Regenerate:

```bash
uv run python scripts/migration/generate_primary_key_plan.py
```

## Classification legend

| Class | Meaning |
| --- | --- |
| EXPLICIT UUID — KEEP | Prefer preserve as stable identity |
| OBJECTID — MONGO NATIVE | ObjectIdAutoField / ObjectIdField |
| IMPLICIT BIGAUTOFIELD — REDESIGN REQUIRED | Must not silently regenerate historical IDs |
| M2M THROUGH MODEL — REVIEW | Preserve both FKs |
| CONTRIB MODEL — MONGO CONFIG REQUIRED | Django contrib / Celery tables |

## Snapshot (last generation)

See primary key plan summary table for exact counts. Policy:

- Do not silently regenerate submission, review, audit, RCA, CAPA, NCR, evidence, or document IDs
- Synthetic Mongo POC may use clean IDs for **new** data only
- Production data migration is deferred until runtime parity is proven
