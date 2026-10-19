# MaintainPro Restore Procedure

**Applies to:** Production database `MaintainProProd` on `localhost:1433` (Windows integrated auth)  
**Backup location:** `C:\MaintainProData\backups\MaintainProProd_YYYYMMDD_HHMMSS\`  
**Evidence restore target:** `C:\MaintainProData\evidence-prod\`

---

## 1. Prerequisites

- Stop the API service: `nssm stop MaintainProApi`
- Ensure no active connections to `MaintainProProd`
- Service account has `sysadmin` or `dbcreator` + `RESTORE DATABASE` permission
- Latest backup verified with `RESTORE VERIFYONLY` (done nightly by backup script)

---

## 2. Full Database Restore (Point-in-Time to Last Nightly)

```powershell
# 1. Stop API
nssm stop MaintainProApi

# 2. Identify latest backup folder
$latest = Get-ChildItem C:\MaintainProData\backups -Directory -Filter "MaintainProProd_*" |
          Sort-Object LastWriteTime -Descending |
          Select-Object -First 1

$bakFile = Join-Path $latest.FullName "$($latest.Name).bak"
# Note: backup script names file as MaintainProProd_YYYYMMDD_HHMMSS.bak inside the folder

# 3. Verify backup one more time (safety)
sqlcmd -E -Q "RESTORE VERIFYONLY FROM DISK = N'$bakFile'"

# 4. Kill existing connections and restore
sqlcmd -E -Q "ALTER DATABASE MaintainProProd SET SINGLE_USER WITH ROLLBACK IMMEDIATE"
sqlcmd -E -Q "RESTORE DATABASE MaintainProProd FROM DISK = N'$bakFile' WITH REPLACE, RECOVERY"

# 5. Verify schema version matches application
#    (Run prisma migrate status — should show migrations matching the deployed build tag)
cd C:\Users\chint\AppData\Local\MaintainPro\worktrees\release-final-20261013\maintainpro
$env:DATABASE_URL = "sqlserver://localhost:1433;database=MaintainProProd;integratedSecurity=true;trustServerCertificate=true;encrypt=true"
npx prisma migrate status

# 6. Start API
nssm start MaintainProApi

# 7. Run smoke checks
.\scripts\ops\health-check.ps1
```

---

## 3. Evidence Folder Restore

**Scenario:** Evidence files corrupted/deleted, database intact.

```powershell
# 1. Stop API (prevents new uploads during restore)
nssm stop MaintainProApi

# 2. Identify backup folder with evidence
$latest = Get-ChildItem C:\MaintainProData\backups -Directory -Filter "MaintainProProd_*" |
          Sort-Object LastWriteTime -Descending |
          Select-Object -First 1

$evidenceBackup = Join-Path $latest.FullName "evidence-prod"

# 3. Restore evidence (replace current)
if (Test-Path $evidenceBackup) {
    # Backup current evidence first (optional safety)
    $currentEvidence = "C:\MaintainProData\evidence-prod"
    if (Test-Path $currentEvidence) {
        Rename-Item $currentEvidence "evidence-prod.before-restore-$(Get-Date -Format 'yyyyMMddHHmmss')"
    }
    Copy-Item -Path $evidenceBackup -Destination $currentEvidence -Recurse -Force
    Write-Host "Evidence restored from $evidenceBackup"
} else {
    Write-Error "No evidence folder in backup $latest"
}

# 4. Fix permissions (service account needs Modify)
icacls "C:\MaintainProData\evidence-prod" /grant "maintainpro-svc:(OI)(CI)M" /T

# 5. Start API
nssm start MaintainProApi
```

---

## 4. Combined Restore (DB + Evidence from Same Backup Set)

Use when both DB and evidence must be consistent (e.g., ransomware, disk failure).

```powershell
nssm stop MaintainProApi

$latest = Get-ChildItem C:\MaintainProData\backups -Directory -Filter "MaintainProProd_*" |
          Sort-Object LastWriteTime -Descending |
          Select-Object -First 1

$bakFile = Join-Path $latest.FullName "$($latest.Name).bak"
$evidenceBackup = Join-Path $latest.FullName "evidence-prod"

# Verify backup
sqlcmd -E -Q "RESTORE VERIFYONLY FROM DISK = N'$bakFile'"

# Restore DB
sqlcmd -E -Q "ALTER DATABASE MaintainProProd SET SINGLE_USER WITH ROLLBACK IMMEDIATE"
sqlcmd -E -Q "RESTORE DATABASE MaintainProProd FROM DISK = N'$bakFile' WITH REPLACE, RECOVERY"

# Restore evidence
if (Test-Path $evidenceBackup) {
    $currentEvidence = "C:\MaintainProData\evidence-prod"
    if (Test-Path $currentEvidence) {
        Remove-Item $currentEvidence -Recurse -Force
    }
    Copy-Item -Path $evidenceBackup -Destination $currentEvidence -Recurse -Force
    icacls $currentEvidence /grant "maintainpro-svc:(OI)(CI)M" /T
}

# Verify migrations
cd C:\Users\chint\AppData\Local\MaintainPro\worktrees\release-final-20261013\maintainpro
$env:DATABASE_URL = "sqlserver://localhost:1433;database=MaintainProProd;integratedSecurity=true;trustServerCertificate=true;encrypt=true"
npx prisma migrate status

nssm start MaintainProApi
.\scripts\ops\health-check.ps1
```

---

## 5. Partial Restore (Single Table / Row) — NOT SUPPORTED

MaintainPro does **not** support table-level restores. The audit log and tenant-scoped data make partial restores unsafe (FK violations, audit gaps). Always restore the full database from a nightly backup.

If you need to recover a single deleted work order:
1. Restore full DB to a **staging database** (`MaintainProProd_Staging_YYYYMMDD`)
2. Query the staging DB for the missing row
3. Re-create it in production via the API (creates proper audit trail)

```powershell
# Staging restore example
$bakFile = "C:\MaintainProData\backups\MaintainProProd_20261019_020000\MaintainProProd_20261019_020000.bak"
sqlcmd -E -Q "RESTORE DATABASE MaintainProProd_Staging_20261019 FROM DISK = N'$bakFile' WITH MOVE 'MaintainProProd' TO 'C:\SQLData\MaintainProProd_Staging_20261019.mdf', MOVE 'MaintainProProd_log' TO 'C:\SQLData\MaintainProProd_Staging_20261019.ldf', RECOVERY"

# Then query:
sqlcmd -E -d MaintainProProd_Staging_20261019 -Q "SELECT * FROM WorkOrder WHERE woNumber = 'WO-2026-0123'"
```

---

## 6. Verification After Any Restore

| Check | Command |
|-------|---------|
| DB online | `sqlcmd -E -Q "SELECT name, state_desc FROM sys.databases WHERE name = 'MaintainProProd'"` |
| Migrations current | `npx prisma migrate status` (exit 0, "0 drift") |
| API health | `curl -f http://127.0.0.1:3000/health/ready` |
| Web login | Open `https://app.maintainpro.local`, sign in as SUPER_ADMIN |
| Evidence accessible | Upload a test image to a WO, confirm it appears in `evidence-prod` |
| Audit log writes | Create a WO, check `AuditLog` for `entity=WorkOrder, action=CREATE` |

---

## 7. Rollback Log Entry

After any restore, create an incident record:

```markdown
# docs/handover/INCIDENT_YYYYMMDD.md
## Restore Performed: 2026-10-XX HH:MM
- **Trigger:** [e.g., migration failure, disk corruption, ransomware]
- **Backup used:** `MaintainProProd_20261019_020000`
- **Scope:** [DB only / Evidence only / Combined]
- **Downtime:** XX minutes
- **Verification:** All smoke checks PASS
- **Root cause:** [to be filled within 24h]
- **Prevention:** [action items]
```

---

## 8. Emergency Contacts

| Role | Contact |
|------|---------|
| DBA | — |
| DevOps | — |
| Security | — |

---

**Last tested:** 2026-10-19 (backup verification only — full restore drill pending)  
**Next scheduled drill:** Before go-live 2026-10-21