# Prisma Schema-Change Gate

**Status:** SOURCE_VALIDATED  
**Scope:** Any change to `maintainpro/prisma/schema.prisma` (and generated client consumers).

## Mandatory before production

1. **Schema diff** — human-readable before/after of models/indexes/relations.
2. **Data-impact analysis** — additive vs destructive; nullability; unique constraints; tenant fields.
3. **Backup confirmation** — `<BACKUP_REFERENCE>` recorded and restore path known.
4. **Test-database validation** — apply on disposable/non-prod Mongo; run audits and focused tests.
5. **Forward-compatible deployment plan** — prefer expand/contract; avoid big-bang destructive renames.
6. **Rollback limitation documentation** — state what cannot be auto-reversed.
7. **Record-count and integrity checks** — agreed queries (no secrets) before/after.
8. **Separate operator approval** — change ticket + DBA/Tech Lead sign-off.

## Forbidden during normal deploy

- Production `npm run db:push`
- Production `db:reset:all`
- `dropDatabase`
- Production `deleteMany` cleanup
- Automatic schema reversal on application rollback

## Deploy coupling

- Application rollback restores API/Web images only.
- Schema rollback requires an explicit data plan (restore or compensating migration) and is a separate change.