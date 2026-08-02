/**
 * One-shot writer for Phase 6A remediation documentation (UTF-8).
 * Run: node scripts/recovery/write-phase6a-docs.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.resolve(__dirname, "../../docs/remediation");

function write(rel, content) {
  const full = path.join(DOCS, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
  return full;
}

const files = {};

files["BACKUP_AND_RECOVERY_ARCHITECTURE.md"] = `# Backup and Recovery Architecture

**Phase:** 6A — contract definition  
**Status:** CONTRACT_DEFINED (E2E rehearsal validates mechanics only; not production DR)  
**Related:** \`REPLICATION_AND_BACKUP_SEPARATION.md\`, \`RPO_RTO_POLICY.md\`, \`BACKUP_MANIFEST_CONTRACT.md\`, \`DISASTER_RECOVERY_RUNBOOK.md\`

## Purpose

Define what must be protected, who owns it, and how independent recovery differs from replication, HA, archives, and release artifacts.

## Data class inventory

| Data class | Authoritative? | Backup required? | Restore method | Owner |
| --- | ---: | ---: | --- | --- |
| MongoDB business data (tenants, WOs, inventory, PO, fleet, etc.) | yes | yes | Consistent point-in-time archive → restore to **fresh** database namespace | DBA / IT |
| MongoDB audit / security data (\`AuditLog\`, \`SecurityEvent\`, replication outbox metadata) | yes | yes | Same archive as business data; preserve immutability expectations | DBA / IT + Compliance |
| MinIO evidence / uploads (WO photos, attachments, report exports when stored locally) | yes when enabled | yes | Object copy + per-object checksum manifest → **new** bucket/prefix | IT / Object storage |
| Redis queues / Bull job state | operational (not SoT) | policy required | Rebuild/reconcile from MongoDB authoritative records (Policy B) | IT / Backend |
| Application container images | release artifact | yes | Immutable registry tag by \`APP_COMMIT_SHA\` | IT / Release |
| Runtime configuration (env var **names**, compose overlays, nginx) | yes | names/templates in repo only | Secured external store + versioned deploy bundle | IT |
| Secrets (JWT, DB users, MinIO, SMTP, ERP, TLS keys) | sensitive | yes **outside** repo | Vault / password manager; never in Git or manifests | Authorized operator |
| Logs (API, nginx, compose json-file) | operational / compliance | retention policy | External log archive / SIEM | IT / SRE |
| Source code | release source | yes | Protected Git repository + tagged releases | IT / Engineering |

## Terminology (do not conflate)

| Term | Definition | MaintainPro example |
| --- | --- | --- |
| **Backup** | Independent, historical, integrity-checked copy in a **separate failure domain**, restorable to a fresh target without overwriting source | Off-host encrypted \`mongodump\` archive + object manifest; **not** replication alone |
| **Replication** | Continuous or near-continuous copy of **current** state to a secondary target; may propagate deletes and bad writes | \`ReplicationOutbox\` → \`BACKUP_DATABASE_URL\` (\`async_outbox\`) |
| **High availability (HA)** | Redundancy within or across nodes to survive component failure without restore | MongoDB replica set; multi-instance API behind nginx (when deployed) |
| **Archive** | Long-retention, often immutable copy for compliance or legal hold | Monthly encrypted backup tier (MANAGEMENT_APPROVAL_REQUIRED) |
| **Release artifact** | Immutable deployable built from a Git SHA | \`maintainpro-api|web:<APP_COMMIT_SHA>\` |
| **Disaster recovery (DR)** | End-to-end capability to rebuild service in a new environment from backups + secrets + config | Runbook-driven restore; **production DR not exercised in Phase 6A E2E** |

## Platform topology (conceptual)

\`\`\`text
Browser → Nginx → Web (BFF) → API → Primary MongoDB (authoritative)
                              ↘ Redis (queues) / MinIO (objects)
Primary MongoDB → ReplicationOutbox → async sync → Backup MongoDB (secondary copy)
Independent backup archive (off-host, encrypted) ← NOT the same as replication
\`\`\`

## Phase 6A scope boundary

| In scope (E2E disposable) | Out of scope (production) |
| --- | --- |
| Create checksum-verified Mongo archive from \`maintainpro_e2e_*\` | Access \`nelna\`, Atlas production, or operator hosts |
| Restore to fresh \`maintainpro_restore_*\` | \`mongorestore --drop\`, overwrite source, volume deletion |
| Temporary recovery API smoke against restored DB | Production credential rotation (incl. Mongo root) |
| MinIO E2E bucket copy → new bucket | Raw archive/object CI artifact upload |
| Safe manifest + duration metadata | Claim \`PRODUCTION_DR_VALIDATED\` or approved RPO/RTO |

**E2E rehearsal only validates recovery mechanics** (backup → integrity → fresh restore → app smoke). It does **not** prove production off-host backup, retention approval, or business RPO/RTO compliance.

## Readiness separation

- **Replication status** (lag, outbox pending/dead-letter) is reported separately from **backup/restore-test status**.
- A green replication health check must **never** be labeled \`BACKUP_VALIDATED\`.
- Go-live gate **G5.1** requires off-server backup + restore drill evidence (operator/production); Phase 6A supplies contracts and E2E rehearsal path only until runtime passes.

## Related implementation (Phase 6A)

- Safety guard: \`scripts/recovery/validate-recovery-target.mjs\`
- Manifest builder: \`scripts/recovery/lib/recovery-safety.mjs\` (\`buildSafeManifest\`)
- Validators: \`validate:recovery-safety\` (destructive command detection)

## Evidence continuity (prior phases — do not replace)

- Phase 5B: \`fe3b3992d883d33c916b3595769add2c4db8878a\` / workflow \`30712469601\`
- Phase 5C: \`512745d678a4be6b0d0a62f2400763ff9fd4ec08\` / workflow \`30715842098\`
- Phase 5D: \`5836bc330cc03e7a3f658ed9cee5f334649f3091\` / workflow \`30719294386\`
`;

files["RPO_RTO_POLICY.md"] = `# RPO / RTO Policy

**Phase:** 6A  
**Status:** PROVISIONAL — **MANAGEMENT_APPROVAL_REQUIRED** for all production targets  
**Timing label for E2E measurements:** \`E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE\`

## Policy rules

1. **Do not invent management approval.** Where business has not signed numeric targets, status is \`MANAGEMENT_APPROVAL_REQUIRED\`.
2. Phase 6A may record **technical** recovery durations from disposable E2E rehearsal; these are smoke timings only.
3. Approved production RPO/RTO require off-host backup evidence, restore drill, and signed business acceptance — not E2E alone.

## Per-service proposed targets

| Service / data domain | Business criticality | Proposed RPO | Proposed RTO | Data-loss consequence | Recovery dependency | Business owner | Technical owner | Approval status | Test frequency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Primary MongoDB (business + audit) | Critical | ≤ 24 h (PROVISIONAL) | ≤ 8 h (PROVISIONAL) | Total platform data loss window | Off-host backup, fresh DB restore, secrets, app images | **MANAGEMENT_APPROVAL_REQUIRED** | DBA / IT | **MANAGEMENT_APPROVAL_REQUIRED** | Quarterly restore drill (prod); each release candidate rehearsal (staging) |
| Async backup DB (\`ReplicationOutbox\` target) | High (warm copy) | Minutes–hours (lag-bound) | ≤ 4 h to resync | Does **not** replace backup; may replicate bad writes | Primary + replication worker | **MANAGEMENT_APPROVAL_REQUIRED** | Backend / DBA | **MANAGEMENT_APPROVAL_REQUIRED** | Weekly \`db:backup:verify\` |
| MinIO / object evidence | High when enabled | ≤ 24 h (PROVISIONAL) | ≤ 4 h (PROVISIONAL) | Missing WO photos / attachments | Object backup manifest + bucket restore | **MANAGEMENT_APPROVAL_REQUIRED** | IT | **MANAGEMENT_APPROVAL_REQUIRED** | Semi-annual object restore drill |
| Redis / Bull queues | Medium | Accept job loss (Policy B) | ≤ 1 h rebuild | Delayed notifications / retries | MongoDB SoT + startup reconciler | **MANAGEMENT_APPROVAL_REQUIRED** | Backend / SRE | **MANAGEMENT_APPROVAL_REQUIRED** | Post-incident; optional chaos in staging |
| API + Web containers | Critical | N/A (stateless) | ≤ 2 h (PROVISIONAL) | Service unavailable | Registry images by SHA, config, secrets | **MANAGEMENT_APPROVAL_REQUIRED** | DevOps | **MANAGEMENT_APPROVAL_REQUIRED** | Rollback drill (Phase 3) |
| Secrets / TLS | Critical | N/A | ≤ 4 h (PROVISIONAL) | Auth / transport failure | Vault restore | **MANAGEMENT_APPROVAL_REQUIRED** | Security / Ops | **MANAGEMENT_APPROVAL_REQUIRED** | Rotation runbook exercise |
| Logs / compliance archive | Medium | ≤ 24 h (PROVISIONAL) | ≤ 24 h (PROVISIONAL) | Audit gap | External log store | **MANAGEMENT_APPROVAL_REQUIRED** | Compliance / IT | **MANAGEMENT_APPROVAL_REQUIRED** | Quarterly review |

## E2E rehearsal timing fields (smoke only)

When Phase 6A CI/E2E recovery gate runs, record (safe metadata only):

| Field | Label |
| --- | --- |
| \`backupCreationSeconds\` | E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE |
| \`integrityVerificationSeconds\` | E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE |
| \`restoreSeconds\` | E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE |
| \`recoveryApiBootSeconds\` | E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE |
| \`smokeValidationSeconds\` | E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE |
| \`totalRecoveryRehearsalSeconds\` | E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE |

These durations must **not** be cited as approved business RTO without \`MANAGEMENT_APPROVAL_REQUIRED\` → approved transition.

## Go-live linkage

- **G5.1** (backup + restore drill) remains **pending runtime** until operator off-host backup and counted restore succeed.
- Phase 6A E2E success yields \`RECOVERY_RUNTIME_VALIDATED\` (disposable) — **not** \`PRODUCTION_DR_VALIDATED\`.
`;

files["REPLICATION_AND_BACKUP_SEPARATION.md"] = `# Replication and Backup Separation

**Phase:** 6A  
**Rule:** Never label replication alone as \`BACKUP_VALIDATED\`.

## Summary

MaintainPro's \`ReplicationOutbox\` asynchronous replication to \`BACKUP_DATABASE_URL\` is a **secondary copy mechanism**, not an independently recoverable backup. Deletes, corrupt updates, and malicious changes can replicate. Recovery requires **archive + integrity verification + tested restore** to a fresh target in an independent failure domain.

## Code and configuration audited

| Component | Role |
| --- | --- |
| \`prisma/schema.prisma\` — \`ReplicationOutbox\` | Durable outbox on primary |
| \`apps/api/src/database/prisma.service.ts\` | Primary writes; enqueue replication events |
| \`apps/api/src/database/replication-sync.service.ts\` | Poll, retry, dead-letter sync to backup client |
| \`DATABASE_REPLICATION_MODE\` | \`async_outbox\` (default), \`strict_dual_write\`, \`disabled\` |
| \`HealthService\` / backup-replication readiness | Lag, pending/failed counts (separate from backup drill) |
| \`DeploymentReadinessService\` | Must not conflate replication OK with restore-test OK |
| Compose defaults | Primary + backup URLs often share **one MongoDB service** |

## Verification checklist

| # | Question | Finding (default Compose / typical deploy) |
| ---: | --- | --- |
| 1 | Replication source and target names? | Primary DB (e.g. configured primary name) → backup DB (e.g. \`bileeta_db\`) |
| 2 | Same MongoDB server? | **Often yes** in Compose — both URLs point at \`mongo:27017\` |
| 3 | Same disk / volume? | **Often yes** — single Mongo data volume |
| 4 | Do deletes / corrupt updates replicate? | **Yes** — outbox captures upserts/deletes; bad writes propagate |
| 5 | Historical point-in-time copies? | **No** — replication is current-state sync, not time-travel archive |
| 6 | Backup DB independently reachable? | Yes as separate database name; not independent **host** in default Compose |
| 7 | Replication lag monitored? | Yes via health/readiness and \`db:backup:verify\` |
| 8 | Dead-letter events block readiness? | Configurable; failed/dead-letter counts surface in admin health |
| 9 | Replication safely pausable? | \`disabled\` mode / worker stop — operator procedure |
| 10 | Backup restore independent of replication? | **Required** — restore from archive does not require outbox drain first |

## Failure-domain labels

| Pattern | Label | Default Compose backup DB |
| --- | --- | --- |
| Same Mongo service + different database name | \`SAME_FAILURE_DOMAIN\` | **Applies** |
| Same host + different Docker volume | \`PARTIAL_SEPARATION\` | Not default |
| Off-host encrypted backup | \`INDEPENDENT_BACKUP\` | **Not provided by replication alone** |
| Tested restore to fresh target | \`RECOVERY_VERIFIED\` | Phase 6A E2E only (disposable) |

## Rules for documentation and readiness

1. \`ReplicationOutbox\` async replication is **NOT** backup.
2. Default Compose backup target shares **SAME_FAILURE_DOMAIN** with primary (same \`mongo\` service/volume).
3. Accidental \`deleteMany\`, bad deploy, or ransomware-like updates **can replicate** to the backup database.
4. **Independent recoverable backup** = encrypted off-host archive + SHA-256 integrity + tested restore to fresh DB + app smoke.
5. Status strings:
   - \`REPLICATION_HEALTHY\` — lag/outbox acceptable
   - \`BACKUP_VALIDATED\` — **only** after independent backup + integrity + restore test evidence
   - Never promote (4) from (1) alone

## Resync script caveat

\`npm run db:backup:resync\` upserts from primary to backup; it does **not** delete extra backup rows and does **not** create historical archives. Use only per \`DUAL_DATABASE_REPLICATION.md\` after operator review.

## Phase 6A E2E boundary

Disposable rehearsal uses \`maintainpro_e2e_*\` → archive → \`maintainpro_restore_*\`. It proves **mechanics**, not that production \`nelna\` has off-host DR.
`;

files["BACKUP_MANIFEST_CONTRACT.md"] = `# Backup Manifest Contract

**Schema version:** \`1.0\`  
**Phase:** 6A  
**E2E default:** \`productionApproved: false\`

## Purpose

Safe, shareable metadata describing a MongoDB backup archive (and optional object-storage manifest reference) without credentials or document payloads.

## Required fields (\`schemaVersion\` 1.0)

| Field | Type | Description |
| --- | --- | --- |
| \`schemaVersion\` | string | Always \`"1.0"\` for this contract |
| \`backupId\` | string | Unique backup identifier (alias, not URI) |
| \`runId\` | string | E2E/workflow run correlation (\`E2E_RUN_ID\`) |
| \`createdAt\` | string (ISO-8601 UTC) | Archive creation timestamp |
| \`applicationCommit\` | string | Git SHA of tested application image |
| \`sourceDatabaseAlias\` | string | Safe DB alias only (e.g. \`maintainpro_e2e_<runId>\`) — **never URI** |
| \`archiveFormat\` | string | e.g. \`mongodump-archive\` |
| \`compression\` | string | e.g. \`gzip\` |
| \`checksumAlgorithm\` | string | \`sha256\` |
| \`archiveChecksum\` | string | Hex SHA-256 of archive file |
| \`archiveSizeBytes\` | number | Must be > 0 |
| \`collectionCount\` | number | Count of collections in manifest |
| \`collectionDocumentCounts\` | object | Map collection name → document count (safe counts only) |
| \`objectStorageManifestRef\` | string \\| null | Reference to companion object manifest ID, if any |
| \`toolVersions\` | object | e.g. \`mongodump\`, \`mongorestore\` versions |
| \`encryptionStatus\` | string | e.g. \`none_e2e\`, \`encrypted_at_rest_operator\` |
| \`productionApproved\` | boolean | **false** for all Phase 6A / CI E2E manifests |
| \`restoreTestRequired\` | boolean | **true** — restore test must pass before production reliance |

## Reference implementation

\`scripts/recovery/lib/recovery-safety.mjs\` — \`buildSafeManifest()\`, \`assertManifestSafe()\`.

## Forbidden content (never include)

- Database URI or connection string
- Username, password, root credential
- JWT / CSRF / MinIO / SMTP / ERP secrets or keys
- Encryption keys
- Raw document content, PII payloads
- Tokens, cookies, \`Authorization\` values
- Signed URLs

## Validation rules

1. \`assertManifestSafe\` must pass before upload or persistence.
2. Zero-byte archive → fail (\`DR-INTEGRITY-003\`).
3. Checksum mismatch → fail restore start (\`DR-INTEGRITY-006\`).
4. \`backupId\` in manifest must match caller context (\`DR-INTEGRITY-005\`).
5. CI may upload **manifest JSON only** — never raw \`.archive\` / \`.gz\` (\`DR-E2E-019\`).

## Example shape (synthetic, no secrets)

\`\`\`json
{
  "schemaVersion": "1.0",
  "backupId": "e2e-backup-ci-12345",
  "runId": "ci-12345",
  "createdAt": "2026-08-02T04:49:00.000Z",
  "applicationCommit": "5836bc330cc03e7a3f658ed9cee5f334649f3091",
  "sourceDatabaseAlias": "maintainpro_e2e_ci-12345",
  "archiveFormat": "mongodump-archive",
  "compression": "gzip",
  "checksumAlgorithm": "sha256",
  "archiveChecksum": "<64-char-hex>",
  "archiveSizeBytes": 1234567,
  "collectionCount": 16,
  "collectionDocumentCounts": { "Tenant": 2, "User": 8 },
  "objectStorageManifestRef": null,
  "toolVersions": { "mongodump": "100.9.0" },
  "encryptionStatus": "none_e2e",
  "productionApproved": false,
  "restoreTestRequired": true
}
\`\`\`

## Production promotion

Setting \`productionApproved: true\` requires operator evidence: off-host encrypted storage, \`MANAGEMENT_APPROVAL_REQUIRED\` retention sign-off, and successful counted restore drill — **outside** Phase 6A E2E scope.
`;

files["REDIS_QUEUE_RECOVERY_POLICY.md"] = `# Redis and Queue Recovery Policy

**Phase:** 6A — policy documented  
**Selected policy:** **B — Redis is operational state; queues rebuilt/reconciled from MongoDB authoritative records**

## Decision

| Policy | Description | Selected? |
| --- | --- | --- |
| A | Recover queue state from Redis AOF/RDB backup | No |
| B | Treat Redis/Bull as ephemeral; rebuild from MongoDB SoT | **Yes** |

MaintainPro authoritative business state lives in **MongoDB** (work orders, notifications preferences, ERP outbox records, audit). Redis holds Bull queues, rate limits, and transient job payloads.

## Acceptable data loss (Policy B)

| Redis data | Acceptable loss on DR? | Rationale |
| --- | ---: | --- |
| Pending notification jobs | Yes | Re-enqueue from MongoDB notification records / business triggers |
| Delayed jobs | Yes (within replay window) | Re-schedule from domain schedules where persisted |
| In-flight job locks | Yes | Idempotent handlers must tolerate redelivery |
| Failed job metadata in Redis | Partial | Persist terminal failures to MongoDB audit where required |

## Duplicate-delivery prevention

1. Handlers must be **idempotent** (natural keys, \`jobId\`, or dedupe collection).
2. Email/SMS: use provider message dedupe or store \`notificationSentId\` on domain row before send.
3. ERP sync jobs: rely on \`ReplicationOutbox\` / ERP sync cursor models — not Redis alone.
4. Stock movements: already guarded by conditional updates and idempotency keys (inventory).

## Notification replay

- On startup after Redis loss: scan pending notification rows / retryable ERP sync states in MongoDB.
- Replay with capped batch size and exponential backoff — **no unbounded queue replay**.
- Mark replay source \`DR_STARTUP_RECONCILE\` in logs (no secrets).

## Delayed jobs

- Jobs scheduled only in Redis without MongoDB anchor may be **lost** — acceptable under Policy B.
- New delayed work must persist schedule anchor in MongoDB where business-critical (follow-up P1 if gaps found).

## Dead-letter handling (DLQ)

- Bull failed jobs: surface in admin/health; operator may retry after root-cause fix.
- \`ReplicationOutbox\` \`DEAD_LETTER\`: separate from Redis — reconcile via \`db:backup:verify\` / admin tools.
- DR: do not auto-replay all DLQ entries without classification.

## Startup reconciliation (required design)

On API boot after Redis empty/cold start:

1. Drain or ignore stale Redis keys.
2. Enqueue reconciliation pass for: pending notifications, stuck ERP retries (env-gated), report export jobs if persisted.
3. Expose readiness flag \`queueReconciliationComplete\` before marking fully ready (when configured).

## Implementation status

| Item | Status |
| --- | --- |
| Policy B documented | **Done (Phase 6A)** |
| Full startup reconciler for all queues | **P1 OPERATIONAL_BLOCKER** if not fully implemented before production DR claim |
| Bounded replay limits | Required before production |

**Do not claim complete disaster recovery** until queue reconciliation is implemented and tested. Phase 6A documents policy; full reconciler may remain P1.

## Compose note

E2E Redis uses persistent volume for stack stability; DR rehearsal treats Redis as disposable — MongoDB restore drives business correctness.
`;

files["SECRET_AND_CONFIGURATION_RECOVERY.md"] = `# Secret and Configuration Recovery

**Phase:** 6A  
**Rule:** Document **secret names and owners only — never values.**

## Recovery inventory

| Secret / config item | Owner | Approved storage | Rotation frequency | Recovery source | Last rotation status | Production requirement |
| --- | --- | --- | --- | --- | --- | --- |
| MongoDB root credential | **OPERATOR** (DBA) | Host vault / secret manager | On compromise or policy | Operator break-glass vault | **OPERATOR_OWNED_P0 — not rotated in Phase 6A** | Required; least privilege; not in Git |
| MongoDB application user (\`DATABASE_URL\` / \`PRIMARY_DATABASE_URL\`) | DBA + DevOps | Secret manager + server \`.env\` | Quarterly (PROVISIONAL) | Vault + compose env | **MANAGEMENT_APPROVAL_REQUIRED** | Required at boot |
| \`BACKUP_DATABASE_URL\` app user | DBA | Secret manager | Quarterly (PROVISIONAL) | Vault | **MANAGEMENT_APPROVAL_REQUIRED** | Required if replication enabled |
| \`JWT_ACCESS_SECRET\` / \`JWT_SECRET\` | Security + Backend | Secret manager | On compromise / 90d (PROVISIONAL) | Vault | **MANAGEMENT_APPROVAL_REQUIRED** | Boot fails if missing/CI sentinel |
| \`JWT_REFRESH_SECRET\` | Security + Backend | Secret manager | With access secret | Vault | **MANAGEMENT_APPROVAL_REQUIRED** | Required |
| CSRF / session cookie config (\`COOKIE_SECURE\`, \`ALLOW_INSECURE_HTTP\`) | Security + DevOps | Env + documented policy | On transport mode change | Git policy + env | Documented Phase 2 | HTTP dual opt-in only |
| MinIO root / service credentials (\`MINIO_ROOT_USER\`, \`MINIO_ROOT_PASSWORD\`, access keys) | IT | Secret manager | Quarterly (PROVISIONAL) | Vault | **MANAGEMENT_APPROVAL_REQUIRED** | Internal network only |
| SMTP credentials (\`SMTP_*\`) | IT | Secret manager | Per provider policy | Vault | Optional integration | Env-gated no-op when unset |
| SMS provider credentials | IT | Secret manager | Per provider | Vault | Optional | Env-gated |
| ERP credentials (\`ERP_*\`, Bileeta, etc.) | BA + IT | Secret manager | Per vendor | Vault | MOCK in E2E | Never commit; sanitize payloads |
| Readiness / admin API key (if configured) | Security | Secret manager | On compromise | Vault | **MANAGEMENT_APPROVAL_REQUIRED** | Protect detailed readiness |
| Cloudflare / DNS / TLS cert + private key | **OPERATOR** | CF dashboard + host vault | Before expiry | Operator store | **OPERATOR_OWNED** | HTTPS target state |
| Release image references (\`maintainpro-api|web:<SHA>\`) | Release manager | Container registry | Each release | Registry + \`APP_COMMIT_SHA\` | Phase 3 validated | Immutable deploy |

## Configuration (non-secret)

| Item | In Git? | Recovery |
| --- | --- | --- |
| \`docker-compose.yml\`, production/E2E overlays | Yes (structure) | Git tag matching \`APP_COMMIT_SHA\` |
| \`.env.production.example\` | Yes (names only) | Template + operator values |
| Nginx \`default.conf\` | Yes | Redeploy with image |
| Prisma schema | Yes | Migrate/push per runbook |

## Phase 6A exclusions

- **Do not rotate** MongoDB root or production secrets during E2E rehearsal.
- E2E uses disposable credentials from \`.env.e2e.example\` / CI materialization — never committed.
- Recovery smoke uses disposable JWT settings on temporary recovery API only.

## Post-DR order of operations

1. Restore platform secrets from vault (names above).
2. Point \`PRIMARY_DATABASE_URL\` to **restored** fresh database (operator).
3. Redeploy API/Web images at known SHA.
4. Reconcile Redis queues per \`REDIS_QUEUE_RECOVERY_POLICY.md\` (Policy B).
5. Validate MinIO credentials against restored buckets.
6. Run business smoke — no secret values in logs.
`;

files["BACKUP_RETENTION_POLICY.md"] = `# Backup Retention Policy

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
6. **Integrity checks** — SHA-256 manifest per \`BACKUP_MANIFEST_CONTRACT.md\`.
7. **Retention enforcement** and expiration audit trail.
8. **Restoration test schedule** — counted restore to fresh DB; results stored as safe metadata.

## Atlas / operator MongoDB

Production primary on MongoDB Atlas: use Atlas backup retention aligned with audit policy (\`system.auditPolicy.retentionDays\`) — operator configured, not in Git.

## CI / E2E recovery rehearsal

| Rule | Requirement |
| --- | --- |
| Data | Synthetic disposable only (\`maintainpro_e2e_*\`) |
| Raw archive on runner | Ephemeral temp path only |
| CI artifact upload | **Safe manifest OK**; **no raw archive upload** |
| Post-job | Delete temp archive after verification; runner disposal |
| \`productionApproved\` in manifest | Always \`false\` |

## Replication vs retention

Replication lag is **not** a retention policy. Off-host archives with manifest + restore tests satisfy independent backup retention goals.
`;

files["DISASTER_RECOVERY_RUNBOOK.md"] = `# Disaster Recovery Runbook

**Phase:** 6A — operator runbook (no production hostnames or credentials)  
**Scope:** Production DR procedure outline; E2E rehearsal uses disposable subset only

## Severity and authority

- **Incident commander:** named on-call / IT manager (**OPERATOR**)
- **Communications:** status channel per org policy
- **Stop-write authority:** incident commander + DBA (**REQUIRES_EXPLICIT_APPROVAL**)

---

## 17-step procedure

### 1. Incident declaration

- Confirm outage scope (API, DB, object storage, region).
- Open incident ticket; assign roles; start timeline.

### 2. Authority and communication

- Notify stakeholders per severity matrix.
- External comms only through approved spokesperson.

### 3. Stop-write decision (**REQUIRES_EXPLICIT_APPROVAL**)

- Scale API to zero or enable maintenance mode to prevent split-brain writes.
- Document stop-write time (UTC).

### 4. Backup selection

- Choose latest **independent** off-host backup with valid manifest checksum.
- **Do not** assume replication DB is point-in-time backup.
- Record \`backupId\` and manifest checksum in ticket (no archive contents).

### 5. Integrity verification

- Verify SHA-256 before any restore.
- Reject corrupted archives; select prior backup if needed.

### 6. Fresh infrastructure preparation (**OPERATOR_ONLY**)

- Provision clean MongoDB target (new cluster or new database name).
- Provision MinIO bucket or restore prefix (new name).
- Prepare network/firewall; no production secrets in tickets.

### 7. MongoDB restore (**OPERATOR_ONLY** / **REQUIRES_EXPLICIT_APPROVAL**)

- Restore archive to **fresh** database namespace only.
- **Never** \`mongorestore --drop\` on production source.
- **Never** restore over \`maintainpro_e2e_*\` source during rehearsal.

### 8. Object-storage restore (**OPERATOR_ONLY**)

- Copy objects to new bucket/prefix; verify manifest checksums.
- **Never** \`mc rm\`, \`mc rb\`, or \`mc mirror --remove\`.

### 9. Configuration / secret recovery (**OPERATOR_ONLY**)

- Restore secrets from vault per \`SECRET_AND_CONFIGURATION_RECOVERY.md\` (names only in docs).
- Update env to point API at restored DB and buckets.
- Mongo root rotation if compromise suspected — **OPERATOR_OWNED_P0** (outside Phase 6A).

### 10. Application boot (**OPERATOR_ONLY**)

- Deploy known-good images by \`APP_COMMIT_SHA\` or approved rollback tag.
- Start Redis; expect empty queues (Policy B reconciliation).

### 11. Health checks

- \`GET /api/health\` → 200; database operational.
- \`GET /api/health/readiness\` (admin) — replication/backup/queue status reviewed separately.

### 12. Business smoke tests

- Admin login; tenant isolation spot check.
- List WO, inventory part, PO/receipt; dashboard snapshot 200.
- Audit query for recent security events (no credential leaks in logs).

### 13. Reconciliation

- Redis queue startup reconcile (Policy B).
- ERP sync / notification backlog per runbook caps.
- Compare collection counts to manifest expectations.

### 14. DNS / traffic decision (**REQUIRES_EXPLICIT_APPROVAL**)

- Cut traffic to recovered stack only after smoke pass.
- TTL and rollback path documented.

### 15. User communication

- User-visible status page / email when approved.
- State data loss window honestly (RPO actual vs approved).

### 16. Post-incident audit

- Timeline, root cause, backup age at failure, restore duration.
- Update \`RISK_REGISTER.md\` and backup drill schedule.

### 17. Evidence retention

- Store manifests, checksums, workflow/run IDs — **no raw DB dumps in Git**.
- Link to \`FULL_STACK_E2E_RUNTIME_EVIDENCE.md\` for rehearsal pattern.

---

## Forbidden in automation

- \`docker compose down -v\` / volume prune / \`dropDatabase\`
- Raw backup upload to CI artifacts
- Restore into forbidden names: \`nelna\`, \`bileeta_db\`, \`admin\`, \`config\`, \`local\`

## Phase 6A E2E subset

Steps 4–12 run in CI against disposable \`maintainpro_e2e_*\` → \`maintainpro_restore_*\` only. Does **not** satisfy production G5.1 until operator off-host drill completes.
`;

files["DISASTER_RECOVERY_TEST_MATRIX.md"] = `# Disaster Recovery Test Matrix

**Phase:** 6A  
**Rule:** No mandatory test may \`skip\`.  
**Runtime status:** CONTRACT_DEFINED until \`RECOVERY_RUNTIME_VALIDATED\` workflow evidence exists.

## E2E recovery rehearsal (mandatory)

| ID | Assertion |
| --- | --- |
| DR-E2E-001 | Source safety guard passes (\`validate-recovery-target.mjs\`) |
| DR-E2E-002 | Mongo backup created from disposable source |
| DR-E2E-003 | Safe manifest created (\`schemaVersion\` 1.0) |
| DR-E2E-004 | Archive checksum passes |
| DR-E2E-005 | Corrupted archive rejected before restore |
| DR-E2E-006 | Fresh target required (\`maintainpro_restore_*\`, not pre-existing) |
| DR-E2E-007 | Restore completes without \`--drop\` |
| DR-E2E-008 | Required collection counts reconcile |
| DR-E2E-009 | Restored relationships pass (tenant/user/WO/inventory/PO coherence) |
| DR-E2E-010 | Recovery API boots against restored DB |
| DR-E2E-011 | Restored disposable login passes |
| DR-E2E-012 | Restored work-order read passes |
| DR-E2E-013 | Restored inventory read passes |
| DR-E2E-014 | Restored PO/GRN read passes |
| DR-E2E-015 | Restored dashboard read passes |
| DR-E2E-016 | Object backup manifest created (E2E bucket) |
| DR-E2E-017 | Object restore checksums reconcile |
| DR-E2E-018 | Replication and backup statuses remain separate in readiness |
| DR-E2E-019 | Raw archive is not uploaded to CI artifacts |
| DR-E2E-020 | Cleanup preserves Docker volumes (\`down --remove-orphans\` only) |
| DR-E2E-021 | No production-like target accepted (forbidden DB names / public hosts) |
| DR-E2E-022 | No database drop/reset command in recovery scripts |
| DR-E2E-023 | No secret appears in logs or manifests |
| DR-E2E-024 | Recovery duration metadata recorded (E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE) |
| DR-E2E-025 | Tenant isolation survives restore |

## Integrity tests

| ID | Assertion |
| --- | --- |
| DR-INTEGRITY-001 | Valid archive checksum passes |
| DR-INTEGRITY-002 | Changed archive checksum fails |
| DR-INTEGRITY-003 | Zero-byte archive fails |
| DR-INTEGRITY-004 | Missing manifest fails |
| DR-INTEGRITY-005 | Mismatched backup ID fails |
| DR-INTEGRITY-006 | Restore cannot start before integrity verification |

## Object storage tests

| ID | Assertion |
| --- | --- |
| DR-OBJECT-001 | Object manifest created |
| DR-OBJECT-002 | Restore bucket is fresh |
| DR-OBJECT-003 | Object count matches |
| DR-OBJECT-004 | Checksums match |
| DR-OBJECT-005 | Missing object fails verification |
| DR-OBJECT-006 | Modified object fails verification |
| DR-OBJECT-007 | No bucket deletion command exists in recovery scripts |

## Safety validator cross-reference

\`validate:recovery-safety\` — RECOVERY-SAFE-001..012 (see \`scripts/validate-recovery-safety.mjs\`).

## Gate placement (Full-Stack E2E)

Execute after seed and business gates, before full Playwright suite:

1. Backup → manifest → corruption reject → fresh restore → recovery API smoke → object backup/restore → full suite.

## Evidence

Record results in \`FULL_STACK_E2E_RUNTIME_EVIDENCE.md\` with tested application SHA only after success. Preserve Phase 5B/5C/5D SHAs in all summary docs.
`;

// Append sections for existing files (read current, append if not already present)
function appendSection(filename, marker, section) {
  const full = path.join(DOCS, filename);
  let existing = fs.existsSync(full) ? fs.readFileSync(full, "utf8") : "";
  if (existing.includes(marker)) {
    return full + " (unchanged — marker present)";
  }
  if (!existing.endsWith("\n")) existing += "\n";
  existing += section;
  fs.writeFileSync(full, existing, "utf8");
  return full;
}

const written = Object.entries(files).map(([rel, content]) => write(rel, content));

appendSection(
  "MASTER_TODO.md",
  "## Phase 6A — Backup, restore, and disaster recovery",
  `
## Phase 6A — Backup, restore, and disaster recovery

**Status:** **IN_PROGRESS** / **CONTRACT_DEFINED**  
**Branch target:** \`fix/phase6a-backup-restore-recovery\`  
**Base after Phase 5D:** application SHA \`5836bc330cc03e7a3f658ed9cee5f334649f3091\` / workflow \`30719294386\`

**Objective:** Define and verify safe recovery mechanics on disposable E2E data only — not production DR.

| Item | Status |
| --- | --- |
| BACKUP_AND_RECOVERY_ARCHITECTURE.md | CONTRACT_DEFINED |
| RPO_RTO_POLICY.md | PROVISIONAL / MANAGEMENT_APPROVAL_REQUIRED |
| REPLICATION_AND_BACKUP_SEPARATION.md | CONTRACT_DEFINED |
| BACKUP_MANIFEST_CONTRACT.md | CONTRACT_DEFINED (schemaVersion 1.0) |
| REDIS_QUEUE_RECOVERY_POLICY.md | CONTRACT_DEFINED (Policy B; reconciler P1) |
| SECRET_AND_CONFIGURATION_RECOVERY.md | CONTRACT_DEFINED |
| BACKUP_RETENTION_POLICY.md | PROVISIONAL / MANAGEMENT_APPROVAL_REQUIRED |
| DISASTER_RECOVERY_RUNBOOK.md | CONTRACT_DEFINED |
| DISASTER_RECOVERY_TEST_MATRIX.md | CONTRACT_DEFINED |
| Recovery safety guard + validator | SOURCE_VALIDATED (partial) |
| Mongo backup/restore scripts | IN_PROGRESS |
| E2E recovery gate runtime | **PENDING** — not RECOVERY_RUNTIME_VALIDATED |
| G5.1 production backup drill | OPERATOR_ACTION_REQUIRED |

#### TODO-P6A-001 — Recovery contracts and separation
- **Priority:** P0 | **Status:** IN_PROGRESS (docs CONTRACT_DEFINED)
- **Acceptance:** Replication ≠ backup documented; never label replication alone BACKUP_VALIDATED

#### TODO-P6A-002 — E2E recovery rehearsal gate
- **Priority:** P0 | **Status:** IN_PROGRESS
- **Acceptance:** DR-E2E-001..025 mandatory skipped=0; DR-INTEGRITY/OBJECT suites pass

#### TODO-P6A-003 — Operator off-host backup + G5.1
- **Priority:** P1 | **Owner:** Ops (**OPERATOR**)
- **Status:** NOT_STARTED
- **Acceptance:** Off-host encrypted backup + counted restore; MANAGEMENT_APPROVAL_REQUIRED retention

**Preserve Phase 5 evidence:** 5B \`fe3b3992d883d33c916b3595769add2c4db8878a\` / \`30712469601\`; 5C \`512745d678a4be6b0d0a62f2400763ff9fd4ec08\` / \`30715842098\`; 5D \`5836bc330cc03e7a3f658ed9cee5f334649f3091\` / \`30719294386\`.
`
);

appendSection(
  "GO_LIVE_GATES.md",
  "## Phase 6A — recovery rehearsal gate",
  `
## Phase 6A — recovery rehearsal gate

| Gate | Status | Notes |
| --- | --- | --- |
| G5.1 Backup + restore drill | **PENDING RUNTIME** | Requires operator off-host Mongo backup + counted restore; Phase 6A E2E rehearsal is mechanics-only |
| G5.1 E2E recovery gate | **CONTRACT_DEFINED** | DR-E2E-001..025; must pass with failed=0, mandatory skipped=0 before RECOVERY_RUNTIME_VALIDATED |
| Replication vs backup | **CONTRACT_DEFINED** | Replication health must not satisfy G5.1 alone |

Phase 6A does **not** approve production go-live. Preserve Phase 5B/5C/5D RUNTIME_VALIDATED SHAs.
`
);

appendSection(
  "RISK_REGISTER.md",
  "## Phase 6A — replication versus backup",
  `
## Phase 6A — replication versus backup

| Risk | Update |
| --- | --- |
| R-14 Backup/restore RPO/RTO undefined | **Mitigation in progress (Phase 6A):** \`RPO_RTO_POLICY.md\` marks PROVISIONAL / MANAGEMENT_APPROVAL_REQUIRED; E2E timings labeled E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE |
| R-14b Replication mistaken for backup | **NEW / OPEN:** Async \`ReplicationOutbox\` shares SAME_FAILURE_DOMAIN with primary in default Compose; deletes/corrupt updates replicate. **Phase 6A mitigation:** \`REPLICATION_AND_BACKUP_SEPARATION.md\`, independent archive + integrity + fresh restore rehearsal; never BACKUP_VALIDATED from replication alone |
| Queue loss on Redis failure | **Policy B documented;** full startup reconciler P1 OPERATIONAL_BLOCKER until implemented |

Preserve Phase 5B \`fe3b3992d883d33c916b3595769add2c4db8878a\` / \`30712469601\`; Phase 5C \`512745d678a4be6b0d0a62f2400763ff9fd4ec08\` / \`30715842098\`; Phase 5D \`5836bc330cc03e7a3f658ed9cee5f334649f3091\` / \`30719294386\`.
`
);

appendSection(
  "ARCHITECTURE_FINDINGS.md",
  "## Phase 6A — backup versus replication",
  `
## Phase 6A — backup versus replication

- **Replication** (\`ReplicationOutbox\` → backup DB) is a near-current secondary copy, often **SAME_FAILURE_DOMAIN** as primary in Compose (one \`mongo\` service/volume).
- **Backup** requires off-host encrypted archive, SHA-256 manifest, and tested restore to a **fresh** database namespace.
- E2E rehearsal (\`maintainpro_e2e_*\` → \`maintainpro_restore_*\`) validates mechanics only — not production DR or approved RPO/RTO.
- Readiness must keep \`replicationStatus\` and \`backupRestoreTestStatus\` separate.

Preserve Phase 5B/5C/5D evidence SHAs unchanged.
`
);

appendSection(
  "TEST_STRATEGY.md",
  "## Phase 6A — recovery gate recipe",
  `
## Phase 6A — recovery gate recipe

**Tag:** \`@recovery-gate\` (focused) + DR-E2E / DR-INTEGRITY / DR-OBJECT IDs in Full-Stack workflow.

### Execution order (after seed, alongside existing gates)

1. \`npm run validate:recovery-safety\`
2. \`node scripts/recovery/validate-recovery-target.mjs\` (DR-E2E-001)
3. Create Mongo backup → manifest → checksum (DR-E2E-002..004)
4. Corruption rejection on copied archive (DR-E2E-005, DR-INTEGRITY-*)
5. Restore to fresh \`maintainpro_restore_*\` without drop (DR-E2E-006..009)
6. Boot temporary recovery API — health, login, WO/inventory/PO/dashboard reads (DR-E2E-010..015)
7. Object backup/restore reconcile (DR-E2E-016..017, DR-OBJECT-*)
8. Assert replication ≠ backup in readiness (DR-E2E-018)
9. Full Playwright suite; cleanup \`down --remove-orphans\` only (DR-E2E-020)

### Contract tests

\`npm run test:backup-manifest-contract\`, \`test:mongo-restore-contract\`, \`test:object-recovery-contract\`, \`test:recovery-readiness-contract\`, \`test:recovery-safety-contract\`

### Timing evidence

Label all recovery durations **E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE** — not approved RTO.

Preserve Phase 5B \`fe3b3992d883d33c916b3595769add2c4db8878a\` / \`30712469601\`; Phase 5C \`512745d678a4be6b0d0a62f2400763ff9fd4ec08\` / \`30715842098\`.
`
);

appendSection(
  "FULL_STACK_E2E_TEST_MATRIX.md",
  "## Phase 6A — recovery rehearsal",
  `
## Phase 6A — recovery rehearsal

| Suite | IDs | Gate |
| --- | --- | --- |
| Recovery E2E | DR-E2E-001..025 | \`@recovery-gate\` — mandatory skipped=0 |
| Integrity | DR-INTEGRITY-001..006 | Contract + CI step |
| Object storage | DR-OBJECT-001..007 | E2E MinIO disposable buckets |

See \`DISASTER_RECOVERY_TEST_MATRIX.md\` for per-ID assertions. Runtime SHA recorded only after RECOVERY_RUNTIME_VALIDATED.

Preserve Phase 5B \`fe3b3992d883d33c916b3595769add2c4db8878a\` / \`30712469601\`; Phase 5C \`512745d678a4be6b0d0a62f2400763ff9fd4ec08\` / \`30715842098\`; Phase 5D \`5836bc330cc03e7a3f658ed9cee5f334649f3091\` / \`30719294386\`.
`
);

appendSection(
  "FULL_STACK_E2E_KNOWN_LIMITATIONS.md",
  "## Phase 6A — disaster recovery limitations",
  `
## Phase 6A — disaster recovery limitations

1. Phase 6A E2E recovery rehearsal does **not** prove production disaster recovery, off-host backup, or Atlas PITR.
2. E2E recovery durations are **E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE** — not approved business RTO (\`MANAGEMENT_APPROVAL_REQUIRED\`).
3. Proposed RPO/RTO in \`RPO_RTO_POLICY.md\` remain **PROVISIONAL** until management approval — do not cite as compliance.
4. MongoDB root credential rotation is **OPERATOR_OWNED_P0** — not executed in Phase 6A.
5. Replication to backup DB is **not** a substitute for independent backup (\`SAME_FAILURE_DOMAIN\` in default Compose).
6. Redis queue full startup reconciler (Policy B) may remain **P1 OPERATIONAL_BLOCKER** — policy documented, implementation may be incomplete.
7. Raw Mongo archives and MinIO objects are **never** uploaded as CI artifacts; safe manifests only.
8. \`productionApproved: false\` on all E2E backup manifests.

Preserve Phase 5B/5C/5D RUNTIME_VALIDATED evidence unchanged.
`
);

console.log("Phase 6A docs written (UTF-8):");
for (const p of written) console.log("  " + p);
console.log("Updated append sections in MASTER_TODO, GO_LIVE_GATES, RISK_REGISTER, ARCHITECTURE_FINDINGS, TEST_STRATEGY, FULL_STACK_E2E_TEST_MATRIX, FULL_STACK_E2E_KNOWN_LIMITATIONS");
