# Backup and Recovery Architecture

**Phase:** 6A — contract definition  
**Status:** CONTRACT_DEFINED (E2E rehearsal validates mechanics only; not production DR)  
**Related:** `REPLICATION_AND_BACKUP_SEPARATION.md`, `RPO_RTO_POLICY.md`, `BACKUP_MANIFEST_CONTRACT.md`, `DISASTER_RECOVERY_RUNBOOK.md`

## Purpose

Define what must be protected, who owns it, and how independent recovery differs from replication, HA, archives, and release artifacts.

## Data class inventory

| Data class | Authoritative? | Backup required? | Restore method | Owner |
| --- | ---: | ---: | --- | --- |
| MongoDB business data (tenants, WOs, inventory, PO, fleet, etc.) | yes | yes | Consistent point-in-time archive → restore to **fresh** database namespace | DBA / IT |
| MongoDB audit / security data (`AuditLog`, `SecurityEvent`, replication outbox metadata) | yes | yes | Same archive as business data; preserve immutability expectations | DBA / IT + Compliance |
| MinIO evidence / uploads (WO photos, attachments, report exports when stored locally) | yes when enabled | yes | Object copy + per-object checksum manifest → **new** bucket/prefix | IT / Object storage |
| Redis queues / Bull job state | operational (not SoT) | policy required | Rebuild/reconcile from MongoDB authoritative records (Policy B) | IT / Backend |
| Application container images | release artifact | yes | Immutable registry tag by `APP_COMMIT_SHA` | IT / Release |
| Runtime configuration (env var **names**, compose overlays, nginx) | yes | names/templates in repo only | Secured external store + versioned deploy bundle | IT |
| Secrets (JWT, DB users, MinIO, SMTP, ERP, TLS keys) | sensitive | yes **outside** repo | Vault / password manager; never in Git or manifests | Authorized operator |
| Logs (API, nginx, compose json-file) | operational / compliance | retention policy | External log archive / SIEM | IT / SRE |
| Source code | release source | yes | Protected Git repository + tagged releases | IT / Engineering |

## Terminology (do not conflate)

| Term | Definition | MaintainPro example |
| --- | --- | --- |
| **Backup** | Independent, historical, integrity-checked copy in a **separate failure domain**, restorable to a fresh target without overwriting source | Off-host encrypted `mongodump` archive + object manifest; **not** replication alone |
| **Replication** | Continuous or near-continuous copy of **current** state to a secondary target; may propagate deletes and bad writes | `ReplicationOutbox` → `BACKUP_DATABASE_URL` (`async_outbox`) |
| **High availability (HA)** | Redundancy within or across nodes to survive component failure without restore | MongoDB replica set; multi-instance API behind nginx (when deployed) |
| **Archive** | Long-retention, often immutable copy for compliance or legal hold | Monthly encrypted backup tier (MANAGEMENT_APPROVAL_REQUIRED) |
| **Release artifact** | Immutable deployable built from a Git SHA | `maintainpro-api|web:<APP_COMMIT_SHA>` |
| **Disaster recovery (DR)** | End-to-end capability to rebuild service in a new environment from backups + secrets + config | Runbook-driven restore; **production DR not exercised in Phase 6A E2E** |

## Platform topology (conceptual)

```text
Browser → Nginx → Web (BFF) → API → Primary MongoDB (authoritative)
                              ↘ Redis (queues) / MinIO (objects)
Primary MongoDB → ReplicationOutbox → async sync → Backup MongoDB (secondary copy)
Independent backup archive (off-host, encrypted) ← NOT the same as replication
```

## Phase 6A scope boundary

| In scope (E2E disposable) | Out of scope (production) |
| --- | --- |
| Create checksum-verified Mongo archive from `maintainpro_e2e_*` | Access `nelna`, Atlas production, or operator hosts |
| Restore to fresh `maintainpro_restore_*` | `mongorestore --drop`, overwrite source, volume deletion |
| Temporary recovery API smoke against restored DB | Production credential rotation (incl. Mongo root) |
| MinIO E2E bucket copy → new bucket | Raw archive/object CI artifact upload |
| Safe manifest + duration metadata | Claim `PRODUCTION_DR_VALIDATED` or approved RPO/RTO |

**E2E rehearsal only validates recovery mechanics** (backup → integrity → fresh restore → app smoke). It does **not** prove production off-host backup, retention approval, or business RPO/RTO compliance.

## Readiness separation

- **Replication status** (lag, outbox pending/dead-letter) is reported separately from **backup/restore-test status**.
- A green replication health check must **never** be labeled `BACKUP_VALIDATED`.
- Go-live gate **G5.1** requires off-server backup + restore drill evidence (operator/production); Phase 6A supplies contracts and E2E rehearsal path only until runtime passes.

## Related implementation (Phase 6A)

- Safety guard: `scripts/recovery/validate-recovery-target.mjs`
- Manifest builder: `scripts/recovery/lib/recovery-safety.mjs` (`buildSafeManifest`)
- Validators: `validate:recovery-safety` (destructive command detection)

## Evidence continuity (prior phases — do not replace)

- Phase 5B: `fe3b3992d883d33c916b3595769add2c4db8878a` / workflow `30712469601`
- Phase 5C: `512745d678a4be6b0d0a62f2400763ff9fd4ec08` / workflow `30715842098`
- Phase 5D: `5836bc330cc03e7a3f658ed9cee5f334649f3091` / workflow `30719294386`
