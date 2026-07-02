# Backup & Restore Plan — MongoDB Atlas (MaintainPro)

**Document owner:** DevOps + DBA  
**UAT phase:** UAT-022  
**Last updated:** 2026-07-02

This plan covers **MongoDB Atlas** backup and restore for MaintainPro production. It does **not** contain credentials, connection strings, or passwords — those live in secret manager only.

---

## Architecture overview

| Component | Role | Technology |
|-----------|------|------------|
| **Primary database** | Source of truth for all application reads/writes | MongoDB Atlas (database name configured via `PRIMARY_DATABASE_NAME`, default `nelna`) |
| **Application ORM** | Prisma Client | `PRIMARY_DATABASE_URL` / `DATABASE_URL` |
| **Optional backup replica** | Async replication target | Local or secondary MongoDB (`BACKUP_DATABASE_URL`, database `bileeta_db`) |
| **Replication mechanism** | Durable outbox → background sync | `ReplicationOutbox` model, `DATABASE_REPLICATION_MODE` |

See [DUAL_DATABASE_REPLICATION.md](../../DUAL_DATABASE_REPLICATION.md) for replication runbook.

---

## Backup strategy

### Atlas native backups (primary — production)

| Item | Policy |
|------|--------|
| **Provider** | MongoDB Atlas automated cloud backup |
| **Scope** | Production cluster only (isolated from staging) |
| **Frequency** | Continuous cloud backup (Atlas default for M10+) |
| **Retention** | Minimum 7 days; recommend 30 days for production |
| **Pre-cutover** | Manual snapshot before every production deploy |
| **Snapshot ID** | Record in change ticket (not in git) |

### Application-level replication (secondary — optional)

| Mode | Behaviour | When to use |
|------|-----------|-------------|
| `async_outbox` (default) | Primary writes always succeed; backup syncs asynchronously | Staging, DR warm copy |
| `strict_dual_write` | Backup failure can block request | High-compliance environments |
| `disabled` | No new replication events | Local dev, single-DB deployments |

**Verify replication health:**

```bash
# From maintainpro/ with env from secret manager
npm run db:backup:verify
```

**Dry-run resync (operator shell only):**

```bash
npm run db:backup:resync -- --dry-run
npm run db:backup:resync   # apply only after dry-run approval
```

### What is backed up

- All Prisma models in `prisma/schema.prisma` including `AuditLog`, `ReplicationOutbox`, tenant-scoped domain data
- **Not** in MongoDB: object storage bytes (Cloudinary/MinIO evidence files) — separate provider backup policy required

---

## Recovery objectives

| Metric | Target (production) | Notes |
|--------|---------------------|-------|
| **RPO** (Recovery Point Objective) | ≤ 1 hour | Atlas continuous backup; replication lag monitored |
| **RTO** (Recovery Time Objective) | ≤ 4 hours | Depends on cluster tier and restore method |
| **Audit retention** | 365 days (tenant policy in `system.auditPolicy`) | Atlas retention must cover audit policy |

Adjust targets with business sign-off and document in change record.

---

## Restore procedures

### Scenario A: Point-in-time restore (preferred — logical error)

**When:** Bad deploy corrupted recent data; need to rewind to specific timestamp.

1. **Stop writes:** Enable maintenance mode or scale API to 0 on Render.
2. **Atlas console:** Cluster → Backup → Restore.
3. Select **point-in-time** restore to timestamp **before** incident (UTC).
4. Restore to a **new** cluster (recommended) to avoid overwriting live cluster blindly.
5. Validate restored data on new cluster (record counts, spot-check tenants).
6. Update `PRIMARY_DATABASE_URL` in secret manager → point to restored cluster.
7. Redeploy API; run `npm run db:backup:verify`.
8. Run `npm run smoke:deploy` on production URLs.
9. Document data loss window (time between restore point and incident).
10. Re-enable traffic; notify stakeholders.

### Scenario B: Snapshot restore (pre-cutover snapshot)

**When:** Cutover deploy failed; revert to known pre-cutover snapshot.

1. Locate snapshot ID from [deployment-checklist.md](deployment-checklist.md).
2. Atlas → Backup → Restore snapshot to new cluster or replace (per ops policy).
3. Follow steps 5–10 from Scenario A.

### Scenario C: Full cluster disaster (region/ cluster loss)

1. Provision new Atlas cluster in available region.
2. Restore latest snapshot or PITR to new cluster.
3. Update DNS/IP allowlist for Render egress.
4. Update `PRIMARY_DATABASE_URL`; redeploy API and web.
5. If `BACKUP_DATABASE_URL` replica survived, run `db:backup:resync` after primary stable.

### Scenario D: Replication lag / backup DB stale only

**When:** Primary healthy; backup replica behind.

1. Check `GET /api/admin/replication/status` (admin) or System Health → Backup Replication card.
2. Run `npm run db:backup:verify` — review outbox pending/failed counts.
3. If lag acceptable for RPO, monitor; else run `npm run db:backup:resync`.
4. **Do not** promote backup DB to primary without formal DR declaration.

---

## Post-restore validation

| ☐ | Check | Pass criteria |
|---|-------|---------------|
| ☐ | `npm run db:backup:verify` | Counts/checksums within policy |
| ☐ | `GET /health` | `database.status=operational` |
| ☐ | Admin login | Success |
| ☐ | Tenant isolation spot check | No cross-tenant leakage |
| ☐ | Audit log continuity | Recent audits present or gap documented |
| ☐ | Replication outbox drained | Pending → 0 (if replication enabled) |
| ☐ | `npm run smoke:deploy` | PASS |

---

## Operational cadence

| Activity | Frequency | Owner |
|----------|-----------|-------|
| Atlas backup policy review | Quarterly | DevOps |
| `db:backup:verify` | Weekly (staging); daily (prod post-cutover) | DevOps |
| Pre-deploy manual snapshot | Every production deploy | DevOps |
| Restore drill (Scenario A to **non-prod** cluster) | Semi-annual | DevOps + DBA |
| Replication lag review | Weekly | DevOps |

---

## Security & compliance

- Atlas credentials: least-privilege DB user; IP allowlist or VPC peering for Render egress.
- Never commit `PRIMARY_DATABASE_URL`, `BACKUP_DATABASE_URL`, or Atlas API keys to git.
- Audit logs are immutable via API — restore preserves `AuditLog` collection integrity.
- GDPR/retention: align Atlas backup retention with `system.auditPolicy.retentionDays`.

---

## Related documents

- [DUAL_DATABASE_REPLICATION.md](../../DUAL_DATABASE_REPLICATION.md)
- [DATABASE_MIGRATION_TO_MONGODB.md](../../DATABASE_MIGRATION_TO_MONGODB.md)
- [rollback-plan.md](rollback-plan.md)
- [deployment-checklist.md](deployment-checklist.md)
