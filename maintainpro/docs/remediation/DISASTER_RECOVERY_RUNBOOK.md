# Disaster Recovery Runbook

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
- Record `backupId` and manifest checksum in ticket (no archive contents).

### 5. Integrity verification

- Verify SHA-256 before any restore.
- Reject corrupted archives; select prior backup if needed.

### 6. Fresh infrastructure preparation (**OPERATOR_ONLY**)

- Provision clean MongoDB target (new cluster or new database name).
- Provision MinIO bucket or restore prefix (new name).
- Prepare network/firewall; no production secrets in tickets.

### 7. MongoDB restore (**OPERATOR_ONLY** / **REQUIRES_EXPLICIT_APPROVAL**)

- Restore archive to **fresh** database namespace only.
- **Never** `mongorestore --drop` on production source.
- **Never** restore over `maintainpro_e2e_*` source during rehearsal.

### 8. Object-storage restore (**OPERATOR_ONLY**)

- Copy objects to new bucket/prefix; verify manifest checksums.
- **Never** `mc rm`, `mc rb`, or `mc mirror --remove`.

### 9. Configuration / secret recovery (**OPERATOR_ONLY**)

- Restore secrets from vault per `SECRET_AND_CONFIGURATION_RECOVERY.md` (names only in docs).
- Update env to point API at restored DB and buckets.
- Mongo root rotation if compromise suspected — **OPERATOR_OWNED_P0** (outside Phase 6A).

### 10. Application boot (**OPERATOR_ONLY**)

- Deploy known-good images by `APP_COMMIT_SHA` or approved rollback tag.
- Start Redis; expect empty queues (Policy B reconciliation).

### 11. Health checks

- `GET /api/health` → 200; database operational.
- `GET /api/health/readiness` (admin) — replication/backup/queue status reviewed separately.

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
- Update `RISK_REGISTER.md` and backup drill schedule.

### 17. Evidence retention

- Store manifests, checksums, workflow/run IDs — **no raw DB dumps in Git**.
- Link to `FULL_STACK_E2E_RUNTIME_EVIDENCE.md` for rehearsal pattern.

---

## Forbidden in automation

- `docker compose down -v` / volume prune / `dropDatabase`
- Raw backup upload to CI artifacts
- Restore into forbidden names: `nelna`, `bileeta_db`, `admin`, `config`, `local`

## Phase 6A E2E subset

Steps 4–12 run in CI against disposable `maintainpro_e2e_*` → `maintainpro_restore_*` only. Does **not** satisfy production G5.1 until operator off-host drill completes.
