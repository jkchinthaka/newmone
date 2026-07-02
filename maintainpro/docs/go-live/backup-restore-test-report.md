# Backup & Restore Test Report — MaintainPro

**UAT phase:** UAT-023  
**Document owner:** DevOps + DBA  
**Last updated:** 2026-07-02  
**Related runbook:** [developer-protection/backup-restore-plan.md](developer-protection/backup-restore-plan.md)

---

## 1. Executive verdict

| Area | Status | Notes |
|------|--------|-------|
| **Backup configured (Atlas)** | ✅ **Configured** | MongoDB Atlas automated cloud backup enabled on primary cluster |
| **Application replication** | ✅ **Configured** | `async_outbox` mode; `db:backup:verify` available |
| **Restore tested (full PITR)** | ⚠️ **Manual step required** | No documented full restore drill completed in this UAT cycle |
| **Object storage backup** | ⚠️ **Gap** | Evidence files (Cloudinary/MinIO) — separate policy not verified |
| **Production isolation** | ⚠️ **Pre-cutover** | Production cluster must be isolated from staging before go-live |

**Overall verdict:** **Backup Configured — Restore Test Pending**

Pilot may proceed on staging with Atlas backups in place. **Production cutover requires a completed restore drill** signed by DevOps and DBA before final go-live checklist section D is marked complete.

---

## 2. Backup configuration review

### 2.1 MongoDB Atlas (primary)

| Check | Result | Evidence |
|-------|--------|----------|
| Atlas project identified | ✅ Pass | Documented in secret manager (not in git) |
| Automated cloud backup enabled | ✅ Pass | Atlas console — continuous backup |
| Retention policy | ✅ Pass | ≥ 7 days configured; 30 days recommended for production |
| Pre-deploy snapshot procedure | ✅ Documented | [backup-restore-plan.md](developer-protection/backup-restore-plan.md) § Snapshot |
| Staging vs production separation | ⚠️ Verify at cutover | Staging cluster must not share production data |

### 2.2 Application-level replication (optional secondary)

| Check | Result | Evidence |
|-------|--------|----------|
| `DATABASE_REPLICATION_MODE` documented | ✅ Pass | `async_outbox` default per architecture docs |
| `npm run db:backup:verify` | ✅ Available | Operator command from `maintainpro/` |
| `npm run db:backup:resync` dry-run | ⚠️ Not executed in UAT-023 | Schedule before production cutover |
| Replication lag monitoring | ⚠️ Manual | No automated alert wired in staging |

### 2.3 What is backed up

| Data class | Backed up | Method |
|------------|-----------|--------|
| Tenant domain data (WO, inventory, users, audit) | ✅ Yes | Atlas + optional replica |
| `AuditLog` collection | ✅ Yes | Atlas |
| `ReplicationOutbox` | ✅ Yes | Atlas |
| JWT secrets / env vars | ❌ N/A | Secret manager versioning (Render/Cloudflare) |
| Evidence file bytes | ⚠️ Separate | Cloudinary/MinIO provider backup — **not tested** |
| Redis queue state | ❌ Ephemeral | Jobs re-processable; not DR-critical |

---

## 3. Restore test status

### 3.1 Tests completed

| Test | Date | Environment | Result |
|------|------|-------------|--------|
| Atlas backup status visible in console | 2026-07-02 | Staging cluster | ✅ Pass |
| `db:backup:verify` script execution | Not run | — | ⏳ Pending operator run |
| API health after backup window | 2026-07-02 | Staging | ✅ Pass — no backup-induced outage |

### 3.2 Tests not completed (gaps)

| Test | Priority | Owner | Target date |
|------|----------|-------|-------------|
| **Point-in-time restore (PITR) to new cluster** | P0 for production | DBA | **TBD** |
| Restore single collection (`WorkOrder`) to scratch DB | P1 | DBA | **TBD** |
| Application connectivity to restored cluster | P0 | DevOps | **TBD** |
| `db:backup:resync --dry-run` on production-like data | P1 | DevOps | **TBD** |
| Evidence file restore from object storage | P2 | DevOps | **TBD** |
| Document RPO/RTO achieved in drill | P0 | DBA + Ops Manager | **TBD** |

### 3.3 Manual restore drill procedure (to execute)

Operators must complete the following and attach evidence to the change ticket (not git):

1. Create Atlas restore job to **new** cluster (or scratch database) from snapshot ≤ 24 h old
2. Update a **non-production** connection string in isolated test env only
3. Run `npm run db:generate` and API smoke: login, list work orders, read audit log
4. Record actual RTO (wall clock) and data timestamp (RPO)
5. Destroy scratch cluster after sign-off
6. Update this report §3.1 with dates and measured RPO/RTO

**Status:** ☐ Not started · ☐ In progress · ☐ Complete

---

## 4. Recovery objectives (targets)

| Metric | Target | Measured (drill) |
|--------|--------|------------------|
| **RPO** | ≤ 1 hour | **TBD** — pending PITR drill |
| **RTO** | ≤ 4 hours | **TBD** — pending PITR drill |
| **Audit retention** | 365 days (tenant policy) | Atlas retention must cover |

---

## 5. Honest gaps and risks

| Gap | Risk if unaddressed | Mitigation before production |
|-----|---------------------|------------------------------|
| No completed PITR drill | Unknown restore time; possible data loss anxiety | Mandatory drill + sign-off |
| Evidence not in MongoDB backup | WO marked complete but photos lost after disaster | Enable object-storage lifecycle + backup |
| `async_outbox` lag | Backup DB stale vs primary | Monitor `db:backup:verify`; alert on lag |
| Staging restore ≠ production restore | False confidence | Repeat drill on production cluster tier |
| Operator runbook not exercised | Slow incident response | Tabletop + timed drill |

---

## 6. Recommendations

1. **Before pilot:** Run `db:backup:verify` on staging and file output in ticket.
2. **Before production cutover:** Complete PITR drill to scratch cluster; record RPO/RTO.
3. **At cutover:** Take manual Atlas snapshot; record snapshot ID in deployment checklist.
4. **Post go-live:** Weekly `db:backup:verify`; monthly restore drill on non-prod clone.

---

## 7. Sign-off

| Role | Name | Signature | Date | Backup OK | Restore tested |
|------|------|-----------|------|-----------|----------------|
| DevOps Lead | | | | ☐ | ☐ |
| DBA / Data Owner | | | | ☐ | ☐ |
| Operations Manager | | | | ☐ | ☐ |

**Restore test blocks production go-live until DevOps + DBA sign the "Restore tested" column.**
