# SQL Server Backup & Restore Runbook

## Scope

Replaces Mongo-oriented `db:backup:resync` / `backup-verify` / ReplicationOutbox dual-Mongo path for **production database truth** after SQL cutover.

Mongo backup tooling may remain for **source snapshot** preservation during migration.

## Expectations (minimum)

| Item | Requirement |
|------|-------------|
| Full database backup | SQL Server FULL backup of MaintainPro DB |
| Log / differential | Per ops policy (FULL + LOG for point-in-time if needed) |
| Retention | Documented retention window |
| Location | Secure backup store (not app container ephemeral disk only) |
| Permissions | Dedicated backup operator role |
| Validation | Restore to disposable instance + row-count smoke |

## Example commands (operator — adjust instance/names)

```sql
-- Full backup
BACKUP DATABASE [MaintainProDev]
TO DISK = N'\\backup\MaintainProDev_full.bak'
WITH INIT, COMPRESSION, STATS = 10;

-- Restore to drill DB
RESTORE DATABASE [MaintainProDev_Drill]
FROM DISK = N'\\backup\MaintainProDev_full.bak'
WITH MOVE 'MaintainProDev' TO 'C:\Data\MaintainProDev_Drill.mdf',
     MOVE 'MaintainProDev_log' TO 'C:\Data\MaintainProDev_Drill_log.ldf',
     REPLACE, STATS = 10;
```

After restore: point a disposable API at the drill DB and run login + Asset list smoke.

## Phase 15 execution status

**NOT EXECUTED** on engineering host.

- No SQL Server instance available
- Docker daemon not running
- Do **not** mark Phase 14/15 backup/restore blocker as PASS from this document alone

## Mongo dual-DB tooling disposition

| Component | Disposition |
|-----------|-------------|
| `ReplicationOutbox` model | Retained in schema for generic/legacy; not SQL HA solution |
| `backup-resync.ts` / `backup-verify.ts` | Mark Mongo-source / legacy until SQL jobs replace |
| `db:backup:*` npm scripts | Keep for Mongo source snapshots during migration window |
