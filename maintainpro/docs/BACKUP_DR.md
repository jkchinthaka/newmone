# Backup and Disaster Recovery

## Assumptions (to confirm with ops owners)

| Metric | Proposed assumption |
|--------|---------------------|
| RPO | Point-in-time restore capability of SQL Server backups (owner to confirm interval) |
| RTO | Restore + app restart within agreed maintenance window (owner to confirm) |

## Database

1. Configure SQL Server full + differential + log backups per environment policy
2. Store backups off-host with retention meeting compliance needs
3. Document restore: restore full → differentials → logs → verify app health (`/health/readiness`)
4. Run periodic restore verification drills (evidence required before claiming DR-ready)

## Files / evidence

- Object storage (MinIO/S3) versioning + cross-region copy as configured
- Evidence checksums stored with metadata

## Application

- Dual-write / outbox replication docs remain in `DUAL_DATABASE_REPLICATION.md` where applicable
- Secrets never in backups of source control

## Verification checklist

- [ ] Restore backup to non-prod
- [ ] Run migrations status
- [ ] Seed/bootstrap not required for restore
- [ ] Login + create WO smoke test
- [ ] Record drill date/owner
