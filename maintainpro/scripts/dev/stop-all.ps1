# Stops node processes listening on 3000-3099 when they belong to a MaintainPro folder.
$ErrorActionPreference = "Stop"

function Test-MaintainProProcess([int]$ProcessId) {
  $current = $ProcessId
  for ($depth = 0; $depth -lt 8 -and $current -gt 0; $depth++) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$current" -ErrorAction SilentlyContinue
    if (-not $proc) { return $false }
    $cmd = [string]$proc.CommandLine
    if ($cmd -match "(?i)maintainpro|\\newmone\\maintainpro") { return $true }
    if ($proc.Name -eq "Cursor.exe" -or $proc.Name -eq "explorer.exe") { return $false }
    $current = [int]$proc.ParentProcessId
  }
  return $false
}

$listeners = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object {
  $_.LocalPort -ge 3000 -and $_.LocalPort -le 3099 -and $_.OwningProcess -gt 0
})
$pids = @($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
foreach ($procId in $pids) {
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$procId" -ErrorAction SilentlyContinue
  if (-not $proc -or $proc.Name -ne "node.exe") { continue }
  if (-not (Test-MaintainProProcess $procId)) { continue }
  taskkill /T /F /PID $procId | Out-Null
}
