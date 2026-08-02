# Backup Retention Policy

**Phase:** 6A  
**Status:** Provisional tiers — **MANAGEMENT_APPROVAL_REQUIRED** for all production periods

## Proposed retention tiers

| Tier | Proposed retention | Approval status | Typical use |
| --- | --- | --- | --- |
| Daily | 7–14 days (PROVISIONAL) | **MANAGEMENT_APPROVAL_REQUIRED** | Operational rewind |
| Weekly | 4–8 weeks (PROVISIONAL) | **MANAGEMENT_APPROVAL_REQUIRED** | Recent mistake recovery |
| Monthly | 12 months (PROVISIONAL) | **MANAGEMENT_APPROVAL_REQUIRED** | Compliance / audit alignment |
| Pre-release | 1 snapshot per production deploy | **MANAGEMENT_APPROVAL_REQUIRED** | Rollback anchor |
| Pre-migration | 1 snapshot before schema/data migration | **MANAGEMENT_APPROVAL_REQUIRED** | Migration safety |

Do **not** treat proposed numbers as approved until business sign-off.

## Production requirements (target state)

1. Backups stored **outside** application Docker volumes.
2. Backups stored **outside** the same physical host where feasible.
3. **Encryption at rest** (operator-managed keys — names only in docs).
4. **Restricted access** — break-glass logging.
5. **Immutable / object-lock** option where storage provider supports it.
6. **Integrity checks** — SHA-256 manifest per `BACKUP_MANIFEST_CONTRACT.md`.
7. **Retention enforcement** and expiration audit trail.
8. **Restoration test schedule** — counted restore to fresh DB; results stored as safe metadata.

## Atlas / operator MongoDB

Production primary on MongoDB Atlas: use Atlas backup retention aligned with audit policy (`system.auditPolicy.retentionDays`) — operator configured, not in Git.

## CI / E2E recovery rehearsal

| Rule | Requirement |
| --- | --- |
| Data | Synthetic disposable only (`maintainpro_e2e_*`) |
| Raw archive on runner | Ephemeral temp path only |
| CI artifact upload | **Safe manifest OK**; **no raw archive upload** |
| Post-job | Delete temp archive after verification; runner disposal |
| `productionApproved` in manifest | Always `false` |

## Replication vs retention

Replication lag is **not** a retention policy. Off-host archives with manifest + restore tests satisfy independent backup retention goals.
