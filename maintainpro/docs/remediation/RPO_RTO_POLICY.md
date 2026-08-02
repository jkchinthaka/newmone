# RPO / RTO Policy

**Phase:** 6A  
**Status:** PROVISIONAL — **MANAGEMENT_APPROVAL_REQUIRED** for all production targets  
**Timing label for E2E measurements:** `E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE`

## Policy rules

1. **Do not invent management approval.** Where business has not signed numeric targets, status is `MANAGEMENT_APPROVAL_REQUIRED`.
2. Phase 6A may record **technical** recovery durations from disposable E2E rehearsal; these are smoke timings only.
3. Approved production RPO/RTO require off-host backup evidence, restore drill, and signed business acceptance — not E2E alone.

## Per-service proposed targets

| Service / data domain | Business criticality | Proposed RPO | Proposed RTO | Data-loss consequence | Recovery dependency | Business owner | Technical owner | Approval status | Test frequency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Primary MongoDB (business + audit) | Critical | ≤ 24 h (PROVISIONAL) | ≤ 8 h (PROVISIONAL) | Total platform data loss window | Off-host backup, fresh DB restore, secrets, app images | **MANAGEMENT_APPROVAL_REQUIRED** | DBA / IT | **MANAGEMENT_APPROVAL_REQUIRED** | Quarterly restore drill (prod); each release candidate rehearsal (staging) |
| Async backup DB (`ReplicationOutbox` target) | High (warm copy) | Minutes–hours (lag-bound) | ≤ 4 h to resync | Does **not** replace backup; may replicate bad writes | Primary + replication worker | **MANAGEMENT_APPROVAL_REQUIRED** | Backend / DBA | **MANAGEMENT_APPROVAL_REQUIRED** | Weekly `db:backup:verify` |
| MinIO / object evidence | High when enabled | ≤ 24 h (PROVISIONAL) | ≤ 4 h (PROVISIONAL) | Missing WO photos / attachments | Object backup manifest + bucket restore | **MANAGEMENT_APPROVAL_REQUIRED** | IT | **MANAGEMENT_APPROVAL_REQUIRED** | Semi-annual object restore drill |
| Redis / Bull queues | Medium | Accept job loss (Policy B) | ≤ 1 h rebuild | Delayed notifications / retries | MongoDB SoT + startup reconciler | **MANAGEMENT_APPROVAL_REQUIRED** | Backend / SRE | **MANAGEMENT_APPROVAL_REQUIRED** | Post-incident; optional chaos in staging |
| API + Web containers | Critical | N/A (stateless) | ≤ 2 h (PROVISIONAL) | Service unavailable | Registry images by SHA, config, secrets | **MANAGEMENT_APPROVAL_REQUIRED** | DevOps | **MANAGEMENT_APPROVAL_REQUIRED** | Rollback drill (Phase 3) |
| Secrets / TLS | Critical | N/A | ≤ 4 h (PROVISIONAL) | Auth / transport failure | Vault restore | **MANAGEMENT_APPROVAL_REQUIRED** | Security / Ops | **MANAGEMENT_APPROVAL_REQUIRED** | Rotation runbook exercise |
| Logs / compliance archive | Medium | ≤ 24 h (PROVISIONAL) | ≤ 24 h (PROVISIONAL) | Audit gap | External log store | **MANAGEMENT_APPROVAL_REQUIRED** | Compliance / IT | **MANAGEMENT_APPROVAL_REQUIRED** | Quarterly review |

## E2E rehearsal timing fields (smoke only)

When Phase 6A CI/E2E recovery gate runs, record (safe metadata only):

| Field | Label |
| --- | --- |
| `backupCreationSeconds` | E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE |
| `integrityVerificationSeconds` | E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE |
| `restoreSeconds` | E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE |
| `recoveryApiBootSeconds` | E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE |
| `smokeValidationSeconds` | E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE |
| `totalRecoveryRehearsalSeconds` | E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE |

These durations must **not** be cited as approved business RTO without `MANAGEMENT_APPROVAL_REQUIRED` → approved transition.

## Go-live linkage

- **G5.1** (backup + restore drill) remains **pending runtime** until operator off-host backup and counted restore succeed.
- Phase 6A E2E success yields `RECOVERY_RUNTIME_VALIDATED` (disposable) — **not** `PRODUCTION_DR_VALIDATED`.
