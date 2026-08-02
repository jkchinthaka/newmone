# Replication and Backup Separation

**Phase:** 6A  
**Rule:** Never label replication alone as `BACKUP_VALIDATED`.

## Summary

MaintainPro's `ReplicationOutbox` asynchronous replication to `BACKUP_DATABASE_URL` is a **secondary copy mechanism**, not an independently recoverable backup. Deletes, corrupt updates, and malicious changes can replicate. Recovery requires **archive + integrity verification + tested restore** to a fresh target in an independent failure domain.

## Code and configuration audited

| Component | Role |
| --- | --- |
| `prisma/schema.prisma` — `ReplicationOutbox` | Durable outbox on primary |
| `apps/api/src/database/prisma.service.ts` | Primary writes; enqueue replication events |
| `apps/api/src/database/replication-sync.service.ts` | Poll, retry, dead-letter sync to backup client |
| `DATABASE_REPLICATION_MODE` | `async_outbox` (default), `strict_dual_write`, `disabled` |
| `HealthService` / backup-replication readiness | Lag, pending/failed counts (separate from backup drill) |
| `DeploymentReadinessService` | Must not conflate replication OK with restore-test OK |
| Compose defaults | Primary + backup URLs often share **one MongoDB service** |

## Verification checklist

| # | Question | Finding (default Compose / typical deploy) |
| ---: | --- | --- |
| 1 | Replication source and target names? | Primary DB (e.g. configured primary name) → backup DB (e.g. `bileeta_db`) |
| 2 | Same MongoDB server? | **Often yes** in Compose — both URLs point at `mongo:27017` |
| 3 | Same disk / volume? | **Often yes** — single Mongo data volume |
| 4 | Do deletes / corrupt updates replicate? | **Yes** — outbox captures upserts/deletes; bad writes propagate |
| 5 | Historical point-in-time copies? | **No** — replication is current-state sync, not time-travel archive |
| 6 | Backup DB independently reachable? | Yes as separate database name; not independent **host** in default Compose |
| 7 | Replication lag monitored? | Yes via health/readiness and `db:backup:verify` |
| 8 | Dead-letter events block readiness? | Configurable; failed/dead-letter counts surface in admin health |
| 9 | Replication safely pausable? | `disabled` mode / worker stop — operator procedure |
| 10 | Backup restore independent of replication? | **Required** — restore from archive does not require outbox drain first |

## Failure-domain labels

| Pattern | Label | Default Compose backup DB |
| --- | --- | --- |
| Same Mongo service + different database name | `SAME_FAILURE_DOMAIN` | **Applies** |
| Same host + different Docker volume | `PARTIAL_SEPARATION` | Not default |
| Off-host encrypted backup | `INDEPENDENT_BACKUP` | **Not provided by replication alone** |
| Tested restore to fresh target | `RECOVERY_VERIFIED` | Phase 6A E2E only (disposable) |

## Rules for documentation and readiness

1. `ReplicationOutbox` async replication is **NOT** backup.
2. Default Compose backup target shares **SAME_FAILURE_DOMAIN** with primary (same `mongo` service/volume).
3. Accidental `deleteMany`, bad deploy, or ransomware-like updates **can replicate** to the backup database.
4. **Independent recoverable backup** = encrypted off-host archive + SHA-256 integrity + tested restore to fresh DB + app smoke.
5. Status strings:
   - `REPLICATION_HEALTHY` — lag/outbox acceptable
   - `BACKUP_VALIDATED` — **only** after independent backup + integrity + restore test evidence
   - Never promote (4) from (1) alone

## Resync script caveat

`npm run db:backup:resync` upserts from primary to backup; it does **not** delete extra backup rows and does **not** create historical archives. Use only per `DUAL_DATABASE_REPLICATION.md` after operator review.

## Phase 6A E2E boundary

Disposable rehearsal uses `maintainpro_e2e_*` → archive → `maintainpro_restore_*`. It proves **mechanics**, not that production `nelna` has off-host DR.
