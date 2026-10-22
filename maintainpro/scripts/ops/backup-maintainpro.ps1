<#>
.SYNOPSIS
    Nightly backup for MaintainPro production database + evidence folder.
    Runs as a scheduled task (Windows Task Scheduler) under the service account.

.DESCRIPTION
    - Takes a full SQL Server backup of MaintainProProd using Windows integrated auth.
    - Copies the evidence folder (D:\MaintainPro\evidence) into the same dated backup folder.
    - Retains 14 days of backups (older folders deleted).
    - Logs to C:\MaintainProData\backups\backup-YYYYMMDD.log

.PARAMETER DatabaseName
    Target database name. Default: MaintainProProd

.PARAMETER BackupRoot
    Root folder for dated backup subfolders. Default: C:\MaintainProData\backups

.PARAMETER EvidenceSource
    Evidence folder to copy. Default: D:\MaintainPro\evidence

.PARAMETER RetentionDays
    Days to keep. Default: 14

.EXAMPLE
    .\backup-maintainpro.ps1

.EXAMPLE
    .\backup-maintainpro.ps1 -DatabaseName MaintainProProd -RetentionDays 30

.NOTES
    Requires: sqlcmd (SQL Server client tools) in PATH.
    Service account needs: BACKUP DATABASE permission, read on evidence folder, write on backup root.
#>

param(
    [string]$DatabaseName = "MaintainProProd",
    [string]$BackupRoot = "C:\MaintainProData\backups",
    [string]$EvidenceSource = "D:\MaintainPro\evidence",
    [int]$RetentionDays = 14
)

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $BackupRoot "MaintainProProd_$timestamp"
$logFile = Join-Path $BackupRoot "backup-$timestamp.log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [$Level] $Message"
    Add-Content -Path $logFile -Value $line
    Write-Host $line
}

try {
    New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
    Write-Log "=== MaintainPro Backup Started ==="
    Write-Log "Database: $DatabaseName"
    Write-Log "Backup dir: $backupDir"
    Write-Log "Evidence source: $EvidenceSource"
    Write-Log "Retention: $RetentionDays days"

    # 1. Create dated backup directory
    if (-not (Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir | Out-Null
        Write-Log "Created backup directory: $backupDir"
    }

    # 2. SQL Server full backup (Windows integrated auth)
    $bakFile = Join-Path $backupDir "${DatabaseName}_$timestamp.bak"
    $sqlCmd = @"
BACKUP DATABASE [$DatabaseName]
TO DISK = N'$bakFile'
WITH NOFORMAT, NOINIT, NAME = N'MaintainProProd-Full-$timestamp',
SKIP, NOREWIND, NOUNLOAD, COMPRESSION, STATS = 10
"@

    Write-Log "Starting SQL backup..."
    $sqlResult = sqlcmd -E -Q $sqlCmd -b 2>&1
    $sqlExit = $LASTEXITCODE
    $sqlResult | ForEach-Object { Write-Log $_ }

    if ($sqlExit -ne 0) {
        throw "sqlcmd exited with code $sqlExit"
    }
    Write-Log "SQL backup completed: $bakFile"

    # 3. Verify backup (RESTORE VERIFYONLY)
    Write-Log "Verifying backup integrity..."
    $verifySql = "RESTORE VERIFYONLY FROM DISK = N'$bakFile'"
    $verifyResult = sqlcmd -E -Q $verifySql -b 2>&1
    $verifyExit = $LASTEXITCODE
    $verifyResult | ForEach-Object { Write-Log $_ }
    if ($verifyExit -ne 0) {
        throw "Backup verification failed (exit $verifyExit)"
    }
    Write-Log "Backup verification PASSED"

    # 4. Copy evidence folder into same dated folder
    $evidenceDest = Join-Path $backupDir "evidence-prod"
    if (Test-Path $EvidenceSource) {
        Write-Log "Copying evidence folder to $evidenceDest ..."
        # Both paths are explicit: /MIR deletes only inside this new dated evidence destination.
        $resolvedSource = [IO.Path]::GetFullPath($EvidenceSource)
        $resolvedDestination = [IO.Path]::GetFullPath($evidenceDest)
        $resolvedBackup = [IO.Path]::GetFullPath($backupDir).TrimEnd("\") + "\"
        if (-not $resolvedDestination.StartsWith($resolvedBackup, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Evidence destination must remain inside the dated backup directory"
        }
        robocopy $resolvedSource $resolvedDestination /MIR /XJ /R:2 /W:5 | ForEach-Object { Write-Log $_ }
        if ($LASTEXITCODE -ge 8) { throw "Evidence robocopy failed (exit $LASTEXITCODE)" }
        $evCount = (Get-ChildItem $evidenceDest -Recurse -File).Count
        $evSize = (Get-ChildItem $evidenceDest -Recurse -File | Measure-Object -Property Length -Sum).Sum
        Write-Log "Evidence copied: $evCount files, $([math]::Round($evSize/1MB,2)) MB"
    } else {
        throw "Evidence source not found: $EvidenceSource"
    }

    # 5. Retention cleanup (delete folders older than RetentionDays)
    Write-Log "Applying retention policy ($RetentionDays days)..."
    $cutoff = (Get-Date).AddDays(-$RetentionDays)
    $deleted = 0
    Get-ChildItem $BackupRoot -Directory -Filter "MaintainProProd_*" | ForEach-Object {
        if ($_.LastWriteTime -lt $cutoff) {
            $folderName = $_.Name
            Write-Log "Deleting expired backup: $folderName"
            $expired = [IO.Path]::GetFullPath($_.FullName)
            $retentionRoot = [IO.Path]::GetFullPath($BackupRoot).TrimEnd("\") + "\"
            if (-not $expired.StartsWith($retentionRoot, [StringComparison]::OrdinalIgnoreCase)) { throw "Invalid retention target" }
            Remove-Item -LiteralPath $expired -Recurse -Force
            $deleted++
        }
    }
    Write-Log "Retention cleanup: $deleted folder(s) removed"

    # 6. Log backup size summary
    $bakSize = (Get-Item $bakFile).Length
    Write-Log "Backup file size: $([math]::Round($bakSize/1MB,2)) MB"
    Write-Log "=== MaintainPro Backup Completed Successfully ==="

    exit 0
}
catch {
    Write-Log "BACKUP FAILED: $($_.Exception.Message)" "ERROR"
    Write-Log $_.ScriptStackTrace "ERROR"
    exit 1
}