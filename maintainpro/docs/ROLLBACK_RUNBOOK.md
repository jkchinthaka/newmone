# Production Rollback Runbook

> **This is a pointer document.** The full runbook is at:
>
> [`docs/remediation/PRODUCTION_ROLLBACK_RUNBOOK.md`](remediation/PRODUCTION_ROLLBACK_RUNBOOK.md)

---

## Quick reference

Backup architecture: `docs/remediation/BACKUP_AND_RECOVERY_ARCHITECTURE.md`  
Disaster recovery: `docs/remediation/DISASTER_RECOVERY_RUNBOOK.md`  
Backup manifest: `docs/remediation/BACKUP_MANIFEST_CONTRACT.md`  
Deployment: `docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md`

## Note on MongoDB

MongoDB (Atlas) has no SQL migration rollback files. Rollback is performed by restoring from the dual-DB backup (`BACKUP_DATABASE_URL`). Ensure `npm run db:backup:verify` passes before cutover.
