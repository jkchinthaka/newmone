# FG-only MongoDB backup and restore in a shared MaintainPro database

## Rule

The production logical database is shared:

```text
Logical database: mgintginpro_prod
FG namespace: fg_
```

FG backup and restore must **never** dump or restore the whole database. A whole-database restore would overwrite MaintainPro collections.

This document is the FG-only plan. It does **not** authorize production execution.

## What FG owns

Dump and restore only:

1. Collections whose names begin with `fg_`
2. Explicitly registered FG-owned Django infrastructure collections (auth/contenttypes/sessions/admin) **if and only if** they are namespaced `fg_*` at cutover

Unknown collection names: **REFUSE WRITE**. MaintainPro PascalCase collections are out of scope.

Authoritative inventory generators (static, no company writes):

- `scripts/migration/generate_fg_collection_manifest.py`
- `docs/migration/FG_COLLECTION_MANIFEST.md`
- `docs/migration/FG_MONGODB_COLLECTION_MANIFEST.md`

## Isolated POC only

Use the isolated replica-set POC (`compose.mongo-poc.yaml`, database `fg_same_db_poc`). Never point dump/restore at `mgintginpro_prod`.

## Tooling (implemented)

```bash
# Inventory + dry-run (isolated)
uv run python scripts/migration/fg_mongo_backup.py \
  --uri "$MONGODB_URI" --database fg_same_db_poc \
  --out .mongo_fg_backup_poc --dry-run

# Restore refuses company DB
uv run python scripts/migration/fg_mongo_restore.py \
  --uri "$MONGODB_URI" --target-database mgintginpro_prod \
  --dump-dir .mongo_fg_backup_poc/fg_same_db_poc
# → REFUSED WRITE (exit 2)

# Dump of company DB name also refuses unless --allow-production-read
```

POC dry-run (2026-08-13): **232** `fg_*` collections; **0** non-fg ignored leftovers in `fg_same_db_poc`.

## Dump plan (FG collections only)

```text
mongodump \
  --uri="$MONGODB_URI" \
  --db=fg_same_db_poc \
  --collection=fg_<name> \
  --out=/safe/isolated/dump
```

Repeat per `fg_*` collection, or use a wrapper that lists collections, keeps only `fg_*`, and refuses anything else.

Do not use `--db` restore of the entire database as an FG operation.

## Restore plan (isolated new test database)

1. Create a new empty isolated database (never `mgintginpro_prod`).
2. `mongorestore` only `fg_*` BSON files into that new database.
3. Verify counts for users, records, submissions, reviews, RCA/CAPA/NCR, print snapshots.
4. Verify auth login against the restored isolated DB.

## Verification checklist

- [ ] Dump file set contains only `fg_*` collections
- [ ] Restore target is an isolated database name
- [ ] MaintainPro collection names are absent from the dump
- [ ] Record / submission / review counts match pre-dump
- [ ] Historical snapshots still render (no live-definition reconstruction)
- [ ] No URI or password in logs

## Production cutover

A later authorized operation must include:

- read-only live collection audit
- MaintainPro health baseline
- dedicated FG Mongo user
- approved release SHA
- rollback plan
- IT/owner approval

Until then: **no company Mongo writes, no production restore.**
